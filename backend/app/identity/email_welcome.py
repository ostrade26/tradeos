"""Welcome / onboarding emails for new organisation admins and teammates."""

from __future__ import annotations

import logging

from .email_send import app_public_url, email_configured, send_email

logger = logging.getLogger(__name__)


def send_org_admin_welcome_email(
    *,
    to: str,
    name: str,
    organisation_name: str,
    login_id: str,
    temporary_password: str,
) -> bool:
    """Email sign-in credentials after an organisation is created.

    Returns True if Resend accepted the message. Does not raise — caller decides UX.
    """
    email = (to or "").strip()
    password = (temporary_password or "").strip()
    if not email or not password:
        return False
    if not email_configured():
        logger.warning(
            "Welcome email skipped — Resend not configured (org=%s login=%s)",
            organisation_name,
            login_id,
        )
        return False

    display_name = (name or "").strip() or "there"
    org = (organisation_name or "").strip() or "your organisation"
    login = (login_id or "").strip()
    sign_in_url = f"{app_public_url()}/login"

    text = (
        f"Hi {display_name},\n\n"
        f"Welcome to Tradeal. Your organisation “{org}” is ready.\n\n"
        "Sign in with these details:\n"
        f"  Login ID: {login}\n"
        f"  Temporary password: {password}\n"
        f"  Sign in: {sign_in_url}\n\n"
        "After you sign in, open Settings and change your password.\n"
        "If you forget it later, use Forgot password on the sign-in page.\n\n"
        "— Tradeal\n"
    )
    html = (
        f"<p>Hi {display_name},</p>"
        f"<p>Welcome to Tradeal. Your organisation <strong>{org}</strong> is ready.</p>"
        "<p>Sign in with these details:</p>"
        "<ul>"
        f"<li><strong>Login ID:</strong> {login}</li>"
        f"<li><strong>Temporary password:</strong> <code>{password}</code></li>"
        "</ul>"
        f'<p><a href="{sign_in_url}">Sign in to Tradeal</a></p>'
        "<p>After you sign in, open <strong>Settings</strong> and change your password. "
        "If you forget it later, use <strong>Forgot password</strong> on the sign-in page.</p>"
        "<p>— Tradeal</p>"
    )

    sent = send_email(
        to=email,
        subject=f"Welcome to Tradeal — {org}",
        text=text,
        html=html,
    )
    if sent:
        logger.info("Welcome email sent to %s for org %s", email, org)
    else:
        logger.error("Failed to send welcome email to %s for org %s", email, org)
    return sent


def send_teammate_welcome_email(
    *,
    to: str,
    name: str,
    organisation_name: str,
    login_id: str,
    temporary_password: str,
) -> bool:
    """Email sign-in credentials after an org admin adds a teammate."""
    email = (to or "").strip()
    password = (temporary_password or "").strip()
    if not email or not password:
        return False
    if not email_configured():
        logger.warning(
            "Teammate welcome email skipped — Resend not configured (org=%s login=%s)",
            organisation_name,
            login_id,
        )
        return False

    display_name = (name or "").strip() or "there"
    org = (organisation_name or "").strip() or "your organisation"
    login = (login_id or "").strip()
    sign_in_url = f"{app_public_url()}/login"

    text = (
        f"Hi {display_name},\n\n"
        f"You've been added to \"{org}\" on Tradeal.\n\n"
        "Sign in with these details:\n"
        f"  Login ID: {login}\n"
        f"  Temporary password: {password}\n"
        f"  Sign in: {sign_in_url}\n\n"
        "After you sign in, open Settings and change your password.\n"
        "If you forget it later, use Forgot password on the sign-in page.\n\n"
        "— Tradeal\n"
    )
    html = (
        f"<p>Hi {display_name},</p>"
        f"<p>You've been added to <strong>{org}</strong> on Tradeal.</p>"
        "<p>Sign in with these details:</p>"
        "<ul>"
        f"<li><strong>Login ID:</strong> {login}</li>"
        f"<li><strong>Temporary password:</strong> <code>{password}</code></li>"
        "</ul>"
        f'<p><a href="{sign_in_url}">Sign in to Tradeal</a></p>'
        "<p>After you sign in, open <strong>Settings</strong> and change your password. "
        "If you forget it later, use <strong>Forgot password</strong> on the sign-in page.</p>"
        "<p>— Tradeal</p>"
    )

    sent = send_email(
        to=email,
        subject=f"Welcome to Tradeal — {org}",
        text=text,
        html=html,
    )
    if sent:
        logger.info("Teammate welcome email sent to %s for org %s", email, org)
    else:
        logger.error("Failed to send teammate welcome email to %s for org %s", email, org)
    return sent
