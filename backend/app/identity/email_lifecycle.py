"""Transactional emails for seat requests and feature-interest decisions."""

from __future__ import annotations

import logging
from typing import Any, Literal

from .email_send import app_public_url, email_configured, send_email
from .org_members_repository import find_primary_admin_user, user_email_row

logger = logging.getLogger(__name__)

SeatDecision = Literal["paid", "approved", "rejected"]
FeatureDecision = Literal["approved", "rejected"]


def _org_name(conn, organisation_id: int, fallback: str = "") -> str:
    name = (fallback or "").strip()
    if name:
        return name
    from ..db import uses_postgres

    if uses_postgres():
        row = conn.execute("SELECT name FROM organisations WHERE id = %s", (organisation_id,)).fetchone()
    else:
        row = conn.execute("SELECT name FROM organisations WHERE id = ?", (organisation_id,)).fetchone()
    if not row:
        return "your organisation"
    from .billing_repository import _mapping

    return str(_mapping(row).get("name") or "").strip() or "your organisation"


def _recipient_and_cc(
    conn,
    *,
    organisation_id: int,
    requester_user_id: int | None,
) -> tuple[str | None, str | None, str]:
    """Return (to_email, cc_email_or_None, display_name)."""
    to_email: str | None = None
    display = "there"
    if requester_user_id is not None:
        row = user_email_row(conn, int(requester_user_id))
        if row:
            to_email = (row.get("email") or "").strip() or None
            display = (row.get("name") or "").strip() or display

    admin = find_primary_admin_user(conn, organisation_id)
    admin_email = (admin.get("email") or "").strip() if admin else ""
    if not to_email and admin_email:
        to_email = admin_email
        display = (admin.get("name") or "").strip() or display
        return to_email, None, display

    cc: str | None = None
    if admin_email and to_email and admin_email.lower() != to_email.lower():
        cc = admin_email
    return to_email, cc, display


def send_seat_request_lifecycle_email(
    conn,
    req: dict[str, Any],
    *,
    decision: SeatDecision,
) -> bool:
    """Email requester (CC primary admin when different) after seat paid/approve/reject."""
    if not email_configured():
        logger.warning("Seat %s email skipped — Resend not configured (request=%s)", decision, req.get("id"))
        return False

    org_id = int(req["organisation_id"])
    to_email, cc, display = _recipient_and_cc(
        conn,
        organisation_id=org_id,
        requester_user_id=req.get("requested_by_user_id"),
    )
    if not to_email:
        logger.warning("Seat %s email skipped — no recipient (request=%s)", decision, req.get("id"))
        return False

    org = _org_name(conn, org_id, str(req.get("organisation_name") or ""))
    seats = int(req.get("requested_seats") or 1)
    seat_word = "seat" if seats == 1 else "seats"
    seat_type = str(req.get("seat_type") or "operator").replace("_", " ")
    ref = (req.get("payment_reference") or "").strip()
    note = (req.get("admin_note") or "").strip()
    plan_url = f"{app_public_url()}/settings/plan"

    if decision == "paid":
        subject = f"Seat request payment recorded — {org}"
        headline = f"We recorded payment for your request of {seats} {seat_word} ({seat_type})."
        next_step = "Tradeal will approve the seats once everything is confirmed. You can track status under Settings → Plan & team."
    elif decision == "approved":
        subject = f"Seat request approved — {org}"
        headline = f"Your request for {seats} {seat_word} ({seat_type}) was approved."
        next_step = "Assign the new seats under Settings → Plan & team."
    else:
        subject = f"Seat request rejected — {org}"
        headline = f"Your request for {seats} {seat_word} ({seat_type}) was rejected."
        next_step = "Open Settings → Plan & team for details, or submit a new request if needed."

    detail_lines: list[str] = []
    if ref:
        detail_lines.append(f"Payment reference: {ref}")
    if note and decision != "paid":
        detail_lines.append(f"Message from Tradeal: {note}")

    text_extra = ("\n".join(detail_lines) + "\n\n") if detail_lines else ""
    html_extra = "".join(f"<p>{line}</p>" for line in detail_lines)

    text = (
        f"Hi {display},\n\n"
        f"{headline}\n\n"
        f"{text_extra}"
        f"{next_step}\n"
        f"  {plan_url}\n\n"
        "— Tradeal\n"
    )
    html = (
        f"<p>Hi {display},</p>"
        f"<p>{headline}</p>"
        f"{html_extra}"
        f"<p>{next_step}</p>"
        f'<p><a href="{plan_url}">Open Plan &amp; team</a></p>'
        "<p>— Tradeal</p>"
    )

    sent = send_email(to=to_email, subject=subject, text=text, html=html, cc=cc)
    if sent:
        logger.info("Seat %s email sent to %s (cc=%s) request=%s", decision, to_email, cc, req.get("id"))
    else:
        logger.error("Seat %s email failed for request=%s to=%s", decision, req.get("id"), to_email)
    return sent


def send_feature_interest_lifecycle_email(
    conn,
    interest: dict[str, Any],
    *,
    decision: FeatureDecision,
) -> bool:
    """Email requester (CC primary admin when different) after feature approve/reject."""
    if not email_configured():
        logger.warning(
            "Feature %s email skipped — Resend not configured (interest=%s)",
            decision,
            interest.get("id"),
        )
        return False

    org_id = int(interest["organisation_id"])
    to_email, cc, display = _recipient_and_cc(
        conn,
        organisation_id=org_id,
        requester_user_id=interest.get("requested_by_user_id"),
    )
    if not to_email:
        logger.warning("Feature %s email skipped — no recipient (interest=%s)", decision, interest.get("id"))
        return False

    org = _org_name(conn, org_id, str(interest.get("organisation_name") or ""))
    title = (interest.get("feature_title") or interest.get("feature_key") or "feature").strip()
    note = (interest.get("platform_note") or interest.get("review_note") or interest.get("note") or "").strip()
    settings_url = f"{app_public_url()}/settings"

    if decision == "approved":
        subject = f"Feature approved · {title} — {org}"
        headline = f"Your organisation can now use {title}."
        headline_html = f"Your organisation can now use <strong>{title}</strong>."
        next_step = "Sign in to Tradeal to start using it."
    else:
        subject = f"Feature declined · {title} — {org}"
        headline = f"We could not enable {title} for your organisation at this time."
        headline_html = f"We could not enable <strong>{title}</strong> for your organisation at this time."
        next_step = "You can request access again later from Marketplace or Settings."

    note_text = f"Message from Tradeal: {note}\n\n" if note else ""
    note_html = f"<p>Message from Tradeal: {note}</p>" if note else ""

    text = (
        f"Hi {display},\n\n"
        f"{headline}\n\n"
        f"{note_text}"
        f"{next_step}\n"
        f"  {settings_url}\n\n"
        "— Tradeal\n"
    )
    html = (
        f"<p>Hi {display},</p>"
        f"<p>{headline_html}</p>"
        f"{note_html}"
        f"<p>{next_step}</p>"
        f'<p><a href="{settings_url}">Open Settings</a></p>'
        "<p>— Tradeal</p>"
    )

    sent = send_email(to=to_email, subject=subject, text=text, html=html, cc=cc)
    if sent:
        logger.info(
            "Feature %s email sent to %s (cc=%s) interest=%s",
            decision,
            to_email,
            cc,
            interest.get("id"),
        )
    else:
        logger.error("Feature %s email failed for interest=%s to=%s", decision, interest.get("id"), to_email)
    return sent
