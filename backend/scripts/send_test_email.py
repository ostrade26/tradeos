#!/usr/bin/env python3
"""Send a one-off test email via Resend (local / ops only).

Usage (from backend/):

  .venv/bin/python scripts/send_test_email.py you@example.com

Loads backend/.env if present (does not override already-exported env vars).
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.identity.email_send import (  # noqa: E402
    email_configured,
    email_from_address,
    load_dotenv_file,
    resend_api_key,
    send_email,
)


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    load_dotenv_file(BACKEND_ROOT / ".env")

    parser = argparse.ArgumentParser(description="Send a Tradeal Resend test email")
    parser.add_argument("to", help="Recipient email address")
    parser.add_argument(
        "--subject",
        default="Tradeal email test",
        help="Email subject (default: Tradeal email test)",
    )
    args = parser.parse_args()

    if not email_configured():
        print(
            "Resend is not configured. Add these to backend/.env (or export them):\n"
            "  RESEND_API_KEY=re_xxxxxxxx\n"
            "  RESEND_FROM_EMAIL=Tradeal <onboarding@resend.dev>\n"
            "  RESEND_FROM_NAME=Tradeal\n",
            file=sys.stderr,
        )
        return 1

    key = resend_api_key()
    masked = f"{key[:6]}…{key[-4:]}" if len(key) > 12 else "(set)"
    print(f"API key:  {masked}")
    print(f"From:     {email_from_address()}")
    print(f"To:       {args.to}")

    text = (
        "This is a Tradeal email test message.\n\n"
        "If you received this, Resend is configured correctly.\n"
    )
    html = (
        "<p>This is a <strong>Tradeal</strong> email test message.</p>"
        "<p>If you received this, Resend is configured correctly.</p>"
    )
    ok = send_email(to=args.to, subject=args.subject, text=text, html=html)
    if ok:
        print("Sent OK — check inbox (and spam).")
        return 0
    print("Send failed — see log above.", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
