"""Email for marketing demo / get-started requests."""

from __future__ import annotations

import html
import logging
import os

from .email_send import email_configured, send_email

logger = logging.getLogger(__name__)


def demo_notify_emails() -> list[str]:
    raw = (os.environ.get("DEMO_NOTIFY_EMAIL") or "hello@tradeal.in").strip()
    return [part.strip() for part in raw.split(",") if part.strip()]


def send_demo_request_emails(
    *,
    name: str,
    company: str,
    phone: str,
    email: str,
    message: str,
) -> bool:
    """Notify the Tradeal inbox and, when possible, confirm to the requester.

    Returns True if at least one message was accepted by Resend. Does not raise.
    """
    if not email_configured():
        logger.warning("Demo request email skipped — Resend not configured (company=%s)", company)
        return False

    sent_any = False
    notify = demo_notify_emails()
    if notify:
        sent_any = _send_notify(
            to=notify,
            name=name,
            company=company,
            phone=phone,
            email=email,
            message=message,
        ) or sent_any

    requester = (email or "").strip()
    if requester:
        sent_any = _send_confirmation(to=requester, name=name, company=company) or sent_any

    return sent_any


def _send_notify(
    *,
    to: list[str],
    name: str,
    company: str,
    phone: str,
    email: str,
    message: str,
) -> bool:
    display_name = name.strip() or "Someone"
    org = company.strip() or "—"
    phone_line = phone.strip() or "—"
    email_line = email.strip() or "—"
    notes = message.strip() or "—"

    text = (
        "New Tradeal demo request\n\n"
        f"Name: {display_name}\n"
        f"Company: {org}\n"
        f"Phone: {phone_line}\n"
        f"Email: {email_line}\n"
        f"What to cover:\n{notes}\n"
    )
    html_body = (
        "<p>New Tradeal demo request</p>"
        "<ul>"
        f"<li><strong>Name:</strong> {html.escape(display_name)}</li>"
        f"<li><strong>Company:</strong> {html.escape(org)}</li>"
        f"<li><strong>Phone:</strong> {html.escape(phone_line)}</li>"
        f"<li><strong>Email:</strong> {html.escape(email_line)}</li>"
        "</ul>"
        f"<p><strong>What to cover</strong></p><p>{html.escape(notes).replace(chr(10), '<br>')}</p>"
    )

    sent = send_email(
        to=to,
        subject=f"Demo request — {org}",
        text=text,
        html=html_body,
        reply_to=email.strip() or None,
    )
    if sent:
        logger.info("Demo request notify sent for %s (%s)", org, display_name)
    else:
        logger.error("Failed to send demo request notify for %s", org)
    return sent


def _send_confirmation(*, to: str, name: str, company: str) -> bool:
    display_name = name.strip() or "there"
    org = company.strip() or "your company"
    text = (
        f"Hi {display_name},\n\n"
        "We received your request to walk through Tradeal"
        f"{f' for {org}' if org != 'your company' else ''}.\n\n"
        "We'll be in touch shortly to cover orders, movement, inventory, "
        "and remaining-to-lift on a working desk.\n\n"
        "— Tradeal\n"
    )
    html_body = (
        f"<p>Hi {html.escape(display_name)},</p>"
        "<p>We received your request to walk through Tradeal"
        f"{f' for <strong>{html.escape(org)}</strong>' if org != 'your company' else ''}.</p>"
        "<p>We'll be in touch shortly to cover orders, movement, inventory, "
        "and remaining-to-lift on a working desk.</p>"
        "<p>— Tradeal</p>"
    )
    sent = send_email(
        to=to,
        subject="We received your Tradeal request",
        text=text,
        html=html_body,
    )
    if sent:
        logger.info("Demo request confirmation sent to %s", to)
    else:
        logger.error("Failed to send demo request confirmation to %s", to)
    return sent
