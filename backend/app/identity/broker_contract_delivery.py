"""Email and invite links for broker contracts sent to parties not on Tradeal."""

from __future__ import annotations

import base64
import html
import logging
from typing import Any

from .email_send import app_public_url, email_configured, send_email
from .email_validation import optional_contact_email

logger = logging.getLogger(__name__)


def contract_invite_url(token: str) -> str:
    safe = (token or "").strip()
    return f"{app_public_url()}/contract-invite/{safe}"


def send_external_contract_email(
    *,
    to_email: str,
    party_name: str,
    party_role: str,
    contract_ref: str,
    broker_name: str,
    note: str,
    terms_line: str,
    invite_url: str,
    pdf_bytes: bytes | None,
    pdf_filename: str,
) -> bool:
    recipient = optional_contact_email(to_email)
    if not recipient:
        return False
    role_label = "buyer" if party_role == "buyer" else "seller"
    subject = f"Contract {contract_ref} — {broker_name}"
    text_lines = [
        f"Hello{(' ' + party_name.strip()) if party_name.strip() else ''},",
        "",
        f"{broker_name} shared a contract with you as the {role_label}.",
        f"Contract: {contract_ref}",
    ]
    if terms_line.strip():
        text_lines.append(terms_line.strip())
    if note.strip():
        text_lines.append("")
        text_lines.append(note.strip())
    text_lines.extend([
        "",
        f"View the contract PDF: {invite_url}",
        "",
        "When your organisation joins Tradeal, your broker can link this contract to your account for confirmations and orders.",
    ])
    text = "\n".join(text_lines)

    safe_name = html.escape(party_name or role_label)
    safe_ref = html.escape(contract_ref)
    safe_broker = html.escape(broker_name)
    safe_terms = html.escape(terms_line) if terms_line.strip() else ""
    safe_note = html.escape(note).replace("\n", "<br/>") if note.strip() else ""
    safe_url = html.escape(invite_url)
    html_body = f"""
<p>Hello {safe_name},</p>
<p><strong>{safe_broker}</strong> shared contract <strong>{safe_ref}</strong> with you as the {role_label}.</p>
"""
    if safe_terms:
        html_body += f"<p>{safe_terms}</p>"
    if safe_note:
        html_body += f"<p>{safe_note}</p>"
    html_body += f"""<p><a href="{safe_url}">Open contract PDF</a></p>
<p style="color:#666;font-size:13px;">When your organisation joins Tradeal, your broker can link this contract for in-app confirmation.</p>
"""

    attachments = None
    if pdf_bytes:
        attachments = [{
            "filename": pdf_filename or f"{contract_ref}.pdf",
            "content": base64.b64encode(pdf_bytes).decode("ascii"),
        }]

    return send_email(
        to=recipient,
        subject=subject,
        text=text,
        html=html_body,
        attachments=attachments,
    )


def whatsapp_contract_message(
    *,
    party_name: str,
    party_role: str,
    contract_ref: str,
    broker_name: str,
    terms_line: str,
    invite_url: str,
) -> str:
    role_label = "Buyer" if party_role == "buyer" else "Seller"
    lines = [
        f"*Contract {contract_ref}*",
        f"From *{broker_name}* · You are the *{role_label}*",
    ]
    if party_name.strip():
        lines.append(f"*{party_name.strip()}*")
    if terms_line.strip():
        lines.append(terms_line.strip())
    lines.append(f"View PDF: {invite_url}")
    lines.append("_Sent via Tradeal_")
    return "\n".join(lines)


def party_delivery_public(row: dict[str, Any], side: str, *, include_invite: bool) -> dict[str, Any]:
    prefix = side
    raw_org = row.get(f"{prefix}_organisation_id")
    try:
        org_id = int(raw_org) if raw_org not in (None, "") else 0
    except (TypeError, ValueError):
        org_id = 0
    channel = "tradeal" if org_id > 0 else "external"
    out: dict[str, Any] = {
        "channel": channel,
        "name": (
            str(row.get(f"{prefix}_name") or "")
            or str(row.get(f"{prefix}_external_name") or "")
        ),
        "org_code": str(row.get(f"{prefix}_org_code") or "") if channel == "tradeal" else "",
        "email": str(row.get(f"{prefix}_external_email") or "") if channel == "external" else "",
        "phone": str(row.get(f"{prefix}_external_phone") or "") if channel == "external" else "",
        "email_sent": bool(str(row.get(f"{prefix}_email_sent_at") or "").strip()),
    }
    if include_invite and channel == "external":
        token = str(row.get(f"{prefix}_invite_token") or "").strip()
        if token:
            out["invite_url"] = contract_invite_url(token)
    return out
