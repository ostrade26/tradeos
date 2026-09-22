"""Forgot / reset password via emailed one-time link (Resend)."""

from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from ..db import _pg_connect, _sqlite_connect, row_get, uses_postgres
from .email_send import app_public_url, email_configured, send_email
from .security import hash_password

logger = logging.getLogger(__name__)

_TOKEN_TTL = timedelta(hours=1)
_MIN_PASSWORD_LEN = 4
_GENERIC_OK = {
    "ok": True,
    "message": "If an account exists for that email, we sent a password reset link.",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def _find_active_user_by_email(email: str) -> dict | None:
    """Return id/name/email for an active user, or None."""
    email_norm = _normalize_email(email)
    if not email_norm or "@" not in email_norm:
        return None

    if uses_postgres():
        with _pg_connect() as conn:
            row = conn.execute(
                """
                SELECT u.id, u.name, u.email, u.username, u.organisation_id, u.status
                FROM users u
                WHERE lower(u.email) = %s AND u.status = 'active'
                ORDER BY u.id ASC
                LIMIT 1
                """,
                (email_norm,),
            ).fetchone()
    else:
        with _sqlite_connect() as conn:
            row = conn.execute(
                """
                SELECT u.id, u.name, u.email, u.username, u.organisation_id, u.status
                FROM users u
                WHERE lower(u.email) = ? AND u.status = 'active'
                ORDER BY u.id ASC
                LIMIT 1
                """,
                (email_norm,),
            ).fetchone()

    if not row:
        return None
    return {
        "id": int(row_get(row, "id")),
        "name": (row_get(row, "name") or "").strip() or "there",
        "email": (row_get(row, "email") or "").strip(),
        "username": (row_get(row, "username") or "").strip(),
        "organisation_id": row_get(row, "organisation_id"),
    }


def _invalidate_open_tokens(user_id: int) -> None:
    now = _now_iso()
    if uses_postgres():
        with _pg_connect() as conn:
            conn.execute(
                """
                UPDATE password_reset_tokens
                SET used_at = COALESCE(used_at, %s)
                WHERE user_id = %s AND used_at IS NULL
                """,
                (now, user_id),
            )
            conn.commit()
    else:
        with _sqlite_connect() as conn:
            conn.execute(
                """
                UPDATE password_reset_tokens
                SET used_at = COALESCE(used_at, ?)
                WHERE user_id = ? AND used_at IS NULL
                """,
                (now, user_id),
            )
            conn.commit()


def _store_token(user_id: int, token: str, expires_at: datetime) -> None:
    token_hash = _hash_token(token)
    created = _now_iso()
    expires = expires_at.isoformat()
    if uses_postgres():
        with _pg_connect() as conn:
            conn.execute(
                """
                INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at)
                VALUES (%s, %s, %s, %s)
                """,
                (user_id, token_hash, expires, created),
            )
            conn.commit()
    else:
        with _sqlite_connect() as conn:
            conn.execute(
                """
                INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (user_id, token_hash, expires, created),
            )
            conn.commit()


def _build_reset_email(*, name: str, reset_url: str) -> tuple[str, str]:
    text = (
        f"Hi {name},\n\n"
        "We received a request to reset your Tradeal password.\n\n"
        f"Open this link to choose a new password (expires in 1 hour):\n{reset_url}\n\n"
        "If you did not request this, you can ignore this email.\n\n"
        "— Tradeal\n"
    )
    html = (
        f"<p>Hi {name},</p>"
        "<p>We received a request to reset your Tradeal password.</p>"
        f'<p><a href="{reset_url}">Reset your password</a></p>'
        f"<p style=\"color:#666;font-size:13px\">Or paste this link into your browser:<br/>"
        f'<span style="word-break:break-all">{reset_url}</span></p>'
        "<p>This link expires in 1 hour. If you did not request a reset, you can ignore this email.</p>"
        "<p>— Tradeal</p>"
    )
    return text, html


def request_password_reset(email: str) -> dict:
    """Start reset flow. Always returns a generic success payload."""
    email_norm = _normalize_email(email)
    if not email_norm or "@" not in email_norm:
        raise HTTPException(status_code=400, detail="Enter a valid email address")

    user = _find_active_user_by_email(email_norm)
    if not user:
        # Do not reveal whether the email exists.
        logger.info("Password reset requested for unknown email")
        return _GENERIC_OK

    if not email_configured():
        logger.error("Password reset requested but Resend is not configured")
        raise HTTPException(
            status_code=503,
            detail="Email is not configured. Contact your Tradeal admin.",
        )

    token = secrets.token_urlsafe(32)
    expires_at = _now() + _TOKEN_TTL
    _invalidate_open_tokens(user["id"])
    _store_token(user["id"], token, expires_at)

    reset_url = f"{app_public_url()}/reset-password?token={token}"
    text, html = _build_reset_email(name=user["name"], reset_url=reset_url)
    sent = send_email(
        to=user["email"] or email_norm,
        subject="Reset your Tradeal password",
        text=text,
        html=html,
    )
    if not sent:
        logger.error("Failed to send password reset email to user_id=%s", user["id"])
        raise HTTPException(
            status_code=503,
            detail="Could not send reset email. Try again shortly.",
        )

    logger.info("Password reset email sent for user_id=%s", user["id"])
    return _GENERIC_OK


def _lookup_valid_token(token: str) -> dict | None:
    raw = (token or "").strip()
    if not raw:
        return None
    token_hash = _hash_token(raw)
    now = _now()

    if uses_postgres():
        with _pg_connect() as conn:
            row = conn.execute(
                """
                SELECT t.id, t.user_id, t.expires_at, t.used_at, u.status
                FROM password_reset_tokens t
                JOIN users u ON u.id = t.user_id
                WHERE t.token_hash = %s
                LIMIT 1
                """,
                (token_hash,),
            ).fetchone()
    else:
        with _sqlite_connect() as conn:
            row = conn.execute(
                """
                SELECT t.id, t.user_id, t.expires_at, t.used_at, u.status
                FROM password_reset_tokens t
                JOIN users u ON u.id = t.user_id
                WHERE t.token_hash = ?
                LIMIT 1
                """,
                (token_hash,),
            ).fetchone()

    if not row:
        return None
    if (row_get(row, "status") or "") != "active":
        return None
    if row_get(row, "used_at"):
        return None
    try:
        expires = datetime.fromisoformat(str(row_get(row, "expires_at")))
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None
    if expires < now:
        return None
    return {
        "id": int(row_get(row, "id")),
        "user_id": int(row_get(row, "user_id")),
    }


def reset_password_with_token(token: str, new_password: str) -> dict:
    pwd = (new_password or "").strip()
    if len(pwd) < _MIN_PASSWORD_LEN:
        raise HTTPException(
            status_code=400,
            detail=f"New password must be at least {_MIN_PASSWORD_LEN} characters",
        )

    row = _lookup_valid_token(token)
    if not row:
        raise HTTPException(
            status_code=400,
            detail="This reset link is invalid or has expired. Request a new one.",
        )

    now = _now_iso()
    pwd_hash = hash_password(pwd)
    if uses_postgres():
        with _pg_connect() as conn:
            conn.execute(
                "UPDATE users SET password_hash = %s, updated_at = %s WHERE id = %s",
                (pwd_hash, now, row["user_id"]),
            )
            conn.execute(
                "UPDATE password_reset_tokens SET used_at = %s WHERE id = %s",
                (now, row["id"]),
            )
            conn.execute(
                """
                UPDATE password_reset_tokens
                SET used_at = COALESCE(used_at, %s)
                WHERE user_id = %s AND used_at IS NULL
                """,
                (now, row["user_id"]),
            )
            conn.execute("DELETE FROM auth_sessions WHERE user_id = %s", (row["user_id"],))
            conn.commit()
    else:
        with _sqlite_connect() as conn:
            conn.execute(
                "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
                (pwd_hash, now, row["user_id"]),
            )
            conn.execute(
                "UPDATE password_reset_tokens SET used_at = ? WHERE id = ?",
                (now, row["id"]),
            )
            conn.execute(
                """
                UPDATE password_reset_tokens
                SET used_at = COALESCE(used_at, ?)
                WHERE user_id = ? AND used_at IS NULL
                """,
                (now, row["user_id"]),
            )
            conn.execute("DELETE FROM auth_sessions WHERE user_id = ?", (row["user_id"],))
            conn.commit()

    logger.info("Password reset completed for user_id=%s", row["user_id"])
    return {"ok": True, "message": "Password updated. You can sign in with your new password."}
