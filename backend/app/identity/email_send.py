"""Outbound transactional email via Resend (https://resend.com).

Configure with env vars (see backend/.env.example):

  RESEND_API_KEY=re_...
  RESEND_FROM_EMAIL=Tradeal <onboarding@resend.dev>   # or bare address
  RESEND_FROM_NAME=Tradeal                            # used if FROM_EMAIL has no display name

Call from anywhere::

  from app.identity.email_send import send_email

  send_email(
      to="user@example.com",
      subject="Welcome",
      text="Hello",
      html="<p>Hello</p>",
  )
"""

from __future__ import annotations

import json
import logging
import os
import ssl
import urllib.error
import urllib.request
from email.utils import formataddr, parseaddr
from pathlib import Path
from typing import Sequence

import certifi

logger = logging.getLogger(__name__)

_RESEND_API_URL = "https://api.resend.com/emails"
_DEFAULT_FROM_NAME = "Tradeal"
_DEFAULT_FROM_EMAIL = "onboarding@resend.dev"


def _ssl_context() -> ssl.SSLContext:
    return ssl.create_default_context(cafile=certifi.where())


def load_dotenv_file(path: Path | None = None) -> None:
    """Load KEY=VALUE pairs from a .env file without overriding existing env vars."""
    env_path = path or Path(__file__).resolve().parents[2] / ".env"
    if not env_path.is_file():
        return
    try:
        lines = env_path.read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        logger.warning("Could not read %s: %s", env_path, exc)
        return
    for raw in lines:
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if not key or key in os.environ:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        os.environ[key] = value


def resend_api_key() -> str:
    return (os.environ.get("RESEND_API_KEY") or "").strip()


def email_from_name() -> str:
    return (os.environ.get("RESEND_FROM_NAME") or _DEFAULT_FROM_NAME).strip() or _DEFAULT_FROM_NAME


def email_from_address() -> str:
    """Return Resend ``from`` value: ``Name <email@domain>`` or bare address."""
    raw = (os.environ.get("RESEND_FROM_EMAIL") or _DEFAULT_FROM_EMAIL).strip()
    if not raw:
        raw = _DEFAULT_FROM_EMAIL
    name_part, addr = parseaddr(raw)
    if addr and name_part:
        return formataddr((name_part, addr))
    if addr:
        return formataddr((email_from_name(), addr))
    # Bare local-looking value without angle brackets
    if "<" not in raw and "@" in raw:
        return formataddr((email_from_name(), raw))
    return raw


def email_configured() -> bool:
    return bool(resend_api_key() and email_from_address())


def app_public_url() -> str:
    raw = (
        os.environ.get("APP_PUBLIC_URL")
        or os.environ.get("TRADEAL_APP_URL")
        or "http://127.0.0.1:5173"
    ).strip().rstrip("/")
    return raw or "http://127.0.0.1:5173"


def _as_list(value: str | Sequence[str] | None) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        item = value.strip()
        return [item] if item else []
    out: list[str] = []
    for item in value:
        s = (item or "").strip()
        if s:
            out.append(s)
    return out


def send_email(
    *,
    to: str | Sequence[str],
    subject: str,
    text: str | None = None,
    html: str | None = None,
    reply_to: str | Sequence[str] | None = None,
    cc: str | Sequence[str] | None = None,
    bcc: str | Sequence[str] | None = None,
) -> bool:
    """Send an email via Resend.

    Configure ``to``, ``subject``, and body (``text`` and/or ``html``) per call.
    Returns True on success. Logs and returns False if not configured or send fails.
    """
    recipients = _as_list(to)
    subject_clean = (subject or "").strip()
    if not recipients:
        logger.warning("send_email called with empty recipient (%s)", subject_clean)
        return False
    if not subject_clean:
        logger.warning("send_email called with empty subject (to=%s)", recipients)
        return False
    if not (text or html):
        logger.warning("send_email called with empty body (%s → %s)", subject_clean, recipients)
        return False

    api_key = resend_api_key()
    if not api_key:
        logger.warning(
            "Resend not configured (need RESEND_API_KEY) — email not sent to %s (%s)",
            recipients,
            subject_clean,
        )
        return False

    payload: dict[str, object] = {
        "from": email_from_address(),
        "to": recipients,
        "subject": subject_clean,
    }
    if html is not None:
        payload["html"] = html
    if text is not None:
        payload["text"] = text

    cc_list = _as_list(cc)
    bcc_list = _as_list(bcc)
    reply_list = _as_list(reply_to)
    if cc_list:
        payload["cc"] = cc_list
    if bcc_list:
        payload["bcc"] = bcc_list
    if reply_list:
        payload["reply_to"] = reply_list if len(reply_list) > 1 else reply_list[0]

    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        _RESEND_API_URL,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "Tradeal/1.0",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=30, context=_ssl_context()) as response:
            raw = response.read().decode("utf-8", errors="replace")
            data = json.loads(raw) if raw else {}
            email_id = data.get("id") if isinstance(data, dict) else None
        logger.info(
            "Email sent via Resend to %s (%s)%s",
            recipients,
            subject_clean,
            f" id={email_id}" if email_id else "",
        )
        return True
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            detail = exc.read().decode("utf-8", errors="replace")
        except Exception:
            detail = str(exc)
        logger.error(
            "Resend HTTP %s sending to %s (%s): %s",
            exc.code,
            recipients,
            subject_clean,
            detail,
        )
        return False
    except urllib.error.URLError as exc:
        logger.error("Resend connection failed: %s", exc)
        return False
    except (OSError, json.JSONDecodeError, TimeoutError) as exc:
        logger.error("Resend send failed: %s", exc)
        return False
