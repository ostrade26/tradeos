"""Transactional emails for org lifecycle: requests to Tradeal, decisions, notices.

Channel policy
--------------
- Customer → Tradeal (seat / feature / product requests): platform Inbox + email
  Tradeal admins (skip email for test orgs).
- Tradeal → customer (seat/feature decisions, payment reminder, maintenance,
  product-request reply): email + customer Inbox.
- Nice-to-know (feature launch, product update, soft announcement, backup,
  release notes): customer Inbox only — no email.
"""

from __future__ import annotations

import logging
from typing import Any, Literal

from .email_send import app_public_url, email_configured, send_email
from .org_members_repository import find_primary_admin_user, user_email_row

logger = logging.getLogger(__name__)

SeatDecision = Literal["paid", "approved", "rejected"]
FeatureDecision = Literal["approved", "rejected"]

# Kinds that email customers when create_notifications_for_audience runs.
CUSTOMER_EMAIL_NOTICE_KINDS = frozenset({"payment_reminder", "maintenance", "product_request"})


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


def _org_is_test(conn, organisation_id: int, hint: Any = None) -> bool:
    if hint is not None and hint != "":
        return bool(int(hint) if not isinstance(hint, bool) else hint)
    from ..db import uses_postgres
    from .billing_repository import _mapping

    if uses_postgres():
        trow = conn.execute(
            "SELECT COALESCE(is_test, 0) AS is_test FROM organisations WHERE id = %s",
            (organisation_id,),
        ).fetchone()
    else:
        trow = conn.execute(
            "SELECT COALESCE(is_test, 0) AS is_test FROM organisations WHERE id = ?",
            (organisation_id,),
        ).fetchone()
    if not trow:
        return False
    return bool(int(_mapping(trow).get("is_test") or 0))


def _platform_admin_emails(conn) -> list[str]:
    from .platform_admins_repository import list_platform_admins

    admins = list_platform_admins(conn)
    return sorted({
        (a.get("email") or "").strip()
        for a in admins
        if (a.get("email") or "").strip() and "@" in (a.get("email") or "")
        and str(a.get("status") or "") == "active"
    })


def _send_platform_ops_alert(
    *,
    emails: list[str],
    subject: str,
    headline: str,
    note: str,
    cta_url: str,
    cta_label: str,
    log_key: str,
) -> bool:
    note_text = f"Note: {note}\n\n" if note else ""
    note_html = f"<p>Note: {note}</p>" if note else ""
    text = (
        f"Hi,\n\n"
        f"{headline}\n\n"
        f"{note_text}"
        f"Review in Tradeal:\n  {cta_url}\n\n"
        "— Tradeal\n"
    )
    html = (
        f"<p>Hi,</p>"
        f"<p>{headline}</p>"
        f"{note_html}"
        f'<p><a href="{cta_url}">{cta_label}</a></p>'
        "<p>— Tradeal</p>"
    )
    sent = send_email(to=emails, subject=subject, text=text, html=html)
    if sent:
        logger.info("Platform ops alert emailed to %s admins (%s)", len(emails), log_key)
    else:
        logger.error("Platform ops alert email failed (%s)", log_key)
    return sent


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


def send_seat_request_submitted_to_platform(
    conn,
    req: dict[str, Any],
) -> bool:
    """Email Tradeal platform admins when an organisation requests seats."""
    if not email_configured():
        logger.warning("Seat request alert skipped — Resend not configured (request=%s)", req.get("id"))
        return False

    emails = _platform_admin_emails(conn)
    if not emails:
        logger.warning("Seat request alert skipped — no platform admin emails (request=%s)", req.get("id"))
        return False

    org_id = int(req["organisation_id"])
    # Test orgs stay visible in the Tradeal inbox, but do not email live admins
    # (avoids local / sandbox noise when Resend is pointed at production).
    if _org_is_test(conn, org_id, req.get("org_is_test")):
        logger.info(
            "Seat request alert skipped for test org (request=%s org=%s)",
            req.get("id"),
            org_id,
        )
        return False

    org = _org_name(conn, org_id, str(req.get("organisation_name") or ""))
    seats = int(req.get("requested_seats") or 1)
    seat_word = "seat" if seats == 1 else "seats"
    seat_type = str(req.get("seat_type") or "operator").replace("_", " ")
    amount = int(req.get("amount_cents") or 0)
    amount_bit = f" · ₹{amount // 100:,}" if amount > 0 else ""
    note = (req.get("request_note") or req.get("note") or "").strip()
    seats_url = f"{app_public_url()}/platform-admin/seats?tab=requests"

    return _send_platform_ops_alert(
        emails=emails,
        subject=f"Seat request · {org} · {seats} {seat_word}",
        headline=f"{org} requested {seats} {seat_word} ({seat_type}){amount_bit}.",
        note=note,
        cta_url=seats_url,
        cta_label="Open seat requests",
        log_key=f"seat-request={req.get('id')}",
    )


def send_feature_interest_submitted_to_platform(
    conn,
    interest: dict[str, Any],
) -> bool:
    """Email Tradeal admins when an org requests feature / add-on access."""
    if not email_configured():
        logger.warning(
            "Feature interest alert skipped — Resend not configured (interest=%s)",
            interest.get("id"),
        )
        return False

    emails = _platform_admin_emails(conn)
    if not emails:
        logger.warning(
            "Feature interest alert skipped — no platform admin emails (interest=%s)",
            interest.get("id"),
        )
        return False

    org_id = int(interest["organisation_id"])
    if _org_is_test(conn, org_id, interest.get("org_is_test")):
        logger.info(
            "Feature interest alert skipped for test org (interest=%s org=%s)",
            interest.get("id"),
            org_id,
        )
        return False

    org = _org_name(conn, org_id, str(interest.get("organisation_name") or ""))
    title = (interest.get("feature_title") or interest.get("feature_key") or "feature").strip()
    who = (
        interest.get("requested_by_name")
        or interest.get("requested_by_username")
        or "A user"
    ).strip()
    interest_id = interest.get("id")
    cta = f"{app_public_url()}/platform-admin/add-ons?tab=access&interestId={interest_id}"

    return _send_platform_ops_alert(
        emails=emails,
        subject=f"Add-on request · {org} · {title}",
        headline=f"{org}: {who} requested access to {title}.",
        note="",
        cta_url=cta,
        cta_label="Open feature access",
        log_key=f"feature-interest={interest_id}",
    )


def send_product_request_submitted_to_platform(
    conn,
    req: dict[str, Any],
) -> bool:
    """Email Tradeal admins when an org submits product feedback."""
    if not email_configured():
        logger.warning(
            "Product request alert skipped — Resend not configured (request=%s)",
            req.get("id"),
        )
        return False

    emails = _platform_admin_emails(conn)
    if not emails:
        logger.warning(
            "Product request alert skipped — no platform admin emails (request=%s)",
            req.get("id"),
        )
        return False

    org_id = int(req["organisation_id"])
    if _org_is_test(conn, org_id, req.get("org_is_test")):
        logger.info(
            "Product request alert skipped for test org (request=%s org=%s)",
            req.get("id"),
            org_id,
        )
        return False

    org = _org_name(conn, org_id, str(req.get("organisation_name") or ""))
    kind = str(req.get("kind") or "request").replace("_", " ")
    priority = str(req.get("priority") or "p3").upper()
    message = " ".join(str(req.get("message") or "").split())
    snippet = message[:160] + ("…" if len(message) > 160 else "")
    inbox_url = f"{app_public_url()}/platform-admin/notifications"

    return _send_platform_ops_alert(
        emails=emails,
        subject=f"Product {kind} · {org} · {priority}",
        headline=f"{org} submitted a {priority} {kind}.",
        note=snippet,
        cta_url=inbox_url,
        cta_label="Open Inbox",
        log_key=f"product-request={req.get('id')}",
    )


def send_customer_notice_emails(
    conn,
    *,
    kind: str,
    title: str,
    body: str,
    href: str,
    notifications: list[dict[str, Any]],
) -> int:
    """Email each unique recipient for payment / maintenance / product-reply notices.

    Returns the number of successful send_email calls (one per unique address).
    """
    if kind not in CUSTOMER_EMAIL_NOTICE_KINDS:
        return 0
    if not email_configured():
        logger.warning("Customer notice email skipped — Resend not configured (kind=%s)", kind)
        return 0

    title_clean = (title or "").strip() or "Tradeal notice"
    body_clean = (body or "").strip()
    link = (href or "").strip()
    if link and not link.startswith("http"):
        link = f"{app_public_url()}{link if link.startswith('/') else '/' + link}"
    if not link:
        link = f"{app_public_url()}/notifications"

    kind_label = {
        "payment_reminder": "Payment reminder",
        "maintenance": "Maintenance",
        "product_request": "Reply from Tradeal",
    }.get(kind, "Notice")

    seen: set[str] = set()
    sent_count = 0
    for item in notifications:
        uid = item.get("recipient_user_id")
        if uid is None:
            continue
        row = user_email_row(conn, int(uid))
        if not row:
            continue
        email = (row.get("email") or "").strip()
        if not email or "@" not in email:
            continue
        key = email.lower()
        if key in seen:
            continue
        seen.add(key)
        display = (row.get("name") or "").strip() or "there"
        subject = f"{kind_label} — {title_clean}"
        body_block = f"{body_clean}\n\n" if body_clean else ""
        body_html = f"<p>{body_clean}</p>" if body_clean else ""
        text = (
            f"Hi {display},\n\n"
            f"{title_clean}\n\n"
            f"{body_block}"
            f"Open in Tradeal:\n  {link}\n\n"
            "— Tradeal\n"
        )
        html = (
            f"<p>Hi {display},</p>"
            f"<p><strong>{title_clean}</strong></p>"
            f"{body_html}"
            f'<p><a href="{link}">Open in Tradeal</a></p>'
            "<p>— Tradeal</p>"
        )
        if send_email(to=email, subject=subject, text=text, html=html):
            sent_count += 1
        else:
            logger.error("Customer notice email failed (kind=%s to=%s)", kind, email)

    if sent_count:
        logger.info("Customer notice emails sent=%s kind=%s", sent_count, kind)
    return sent_count


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
    title = (interest.get("feature_title") or interest.get("feature_key") or "add-on").strip()
    note = (interest.get("platform_note") or interest.get("review_note") or interest.get("note") or "").strip()
    addons_url = f"{app_public_url()}/app/addons"

    if decision == "approved":
        subject = f"Add-on approved · {title} — {org}"
        headline = f"Your organisation can now use {title}."
        headline_html = f"Your organisation can now use <strong>{title}</strong>."
        next_step = "Open Add-ons in Tradeal to get started."
    else:
        subject = f"Add-on declined · {title} — {org}"
        headline = f"We could not enable {title} for your organisation at this time."
        headline_html = f"We could not enable <strong>{title}</strong> for your organisation at this time."
        next_step = "You can request access again later from Add-ons."

    note_text = f"Message from Tradeal: {note}\n\n" if note else ""
    note_html = f"<p>Message from Tradeal: {note}</p>" if note else ""

    text = (
        f"Hi {display},\n\n"
        f"{headline}\n\n"
        f"{note_text}"
        f"{next_step}\n"
        f"  {addons_url}\n\n"
        "— Tradeal\n"
    )
    html = (
        f"<p>Hi {display},</p>"
        f"<p>{headline_html}</p>"
        f"{note_html}"
        f"<p>{next_step}</p>"
        f'<p><a href="{addons_url}">Open Add-ons</a></p>'
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
