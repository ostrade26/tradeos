"""A broker sends one contract PDF to the buyer organisation and the seller organisation."""

from __future__ import annotations

import base64
import json
import secrets
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from ..db import row_dict, uses_postgres
from .broker_contract_delivery import (
    party_delivery_public,
    send_external_contract_email,
    whatsapp_contract_message,
)
from .email_validation import optional_contact_email
from .notifications_repository import create_notifications_for_audience

_MAX_PDF_BYTES = 1_200_000


def contract_ref_for_id(share_id: int) -> str:
    """Contract number, same shape as PO1 / SO1 / LT1."""
    return f"CT{int(share_id)}"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ph() -> str:
    return "%s" if uses_postgres() else "?"


def _pdf_bytes(data_url: str) -> tuple[bytes, str]:
    raw = (data_url or "").strip()
    if not raw.startswith("data:") or "," not in raw:
        raise HTTPException(status_code=400, detail="Choose a PDF")
    header, encoded = raw.split(",", 1)
    if "application/pdf" not in header.lower():
        raise HTTPException(status_code=400, detail="Choose a PDF")
    try:
        blob = base64.b64decode(encoded, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Choose a PDF") from exc
    if len(blob) > _MAX_PDF_BYTES:
        raise HTTPException(status_code=400, detail="PDF must be 1.2 MB or smaller")
    if not blob.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Choose a PDF")
    return blob, encoded.strip()


def _org_by_code(conn, code: str) -> dict[str, Any]:
    ph = _ph()
    key = code.strip().lower()
    if not key:
        raise HTTPException(status_code=400, detail="Enter the organisation code")
    row = conn.execute(
        f"""
        SELECT id, name, org_code, account_type, status,
               legal_name, gstin, city, state
        FROM organisations
        WHERE lower(org_code) = {ph}
        """,
        (key,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"No organisation with code {code.strip()}")
    org = dict(row_dict(row))
    if str(org.get("status") or "") != "active":
        raise HTTPException(status_code=400, detail=f"{org.get('name') or 'That organisation'} is not active")
    if str(org.get("account_type") or "") == "broker":
        raise HTTPException(status_code=400, detail="Send the contract to the buyer and the seller, not another broker")
    return org


def lookup_organisation_by_code(conn, code: str) -> dict[str, str]:
    org = _org_by_code(conn, code)
    return {
        "name": str(org.get("name") or ""),
        "legal_name": str(org.get("legal_name") or ""),
        "org_code": str(org.get("org_code") or ""),
        "gstin": str(org.get("gstin") or ""),
        "city": str(org.get("city") or ""),
        "state": str(org.get("state") or ""),
    }


def _party_org_id(share: dict[str, Any], side: str) -> int | None:
    raw = share.get(f"{side}_organisation_id")
    if raw in (None, ""):
        return None
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None
    return value if value > 0 else None


def _can_read(share: dict[str, Any], organisation_id: int) -> bool:
    allowed = {int(share["sender_organisation_id"])}
    for side in ("buyer", "seller"):
        org_id = _party_org_id(share, side)
        if org_id is not None:
            allowed.add(org_id)
    return organisation_id in allowed


def _public_tankers(raw: object) -> list[dict[str, Any]]:
    text = raw if isinstance(raw, str) else ""
    if not text.strip():
        return []
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    out: list[dict[str, Any]] = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        planned = item.get("planned_qty_mt")
        actual = item.get("actual_qty_mt")
        try:
            planned_f = float(planned) if planned not in (None, "") else 0.0
        except (TypeError, ValueError):
            planned_f = 0.0
        try:
            actual_f = float(actual) if actual not in (None, "") else 0.0
        except (TypeError, ValueError):
            actual_f = 0.0
        qty = float(item.get("qty_mt") or 0)
        out.append({
            "tanker_no": str(item.get("tanker_no") or ""),
            "transport_name": str(item.get("transport_name") or ""),
            "driver_mobile": str(item.get("driver_mobile") or ""),
            "lr_no": str(item.get("lr_no") or ""),
            "qty_mt": qty,
            "planned_qty_mt": planned_f,
            "actual_qty_mt": actual_f,
            "sales_invoice_no": str(item.get("sales_invoice_no") or ""),
            "po_invoice_no": str(item.get("po_invoice_no") or ""),
        })
    return out


def _tanker_changes(raw: object) -> list[dict[str, str]]:
    text = raw if isinstance(raw, str) else ""
    if not text.strip():
        return []
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    out: list[dict[str, str]] = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        current = str(item.get("tanker_no") or "").strip()
        previous = str(item.get("previous_tanker_no") or "").strip()
        if current and previous and current != previous:
            out.append({"tanker_no": current, "previous_tanker_no": previous})
    return out


def _annotate_changed_tankers(tankers: list[dict[str, Any]], raw_changes: object) -> list[dict[str, Any]]:
    previous_by_number = {
        change["tanker_no"]: change["previous_tanker_no"]
        for change in _tanker_changes(raw_changes)
    }
    annotated: list[dict[str, Any]] = []
    for tanker in tankers:
        row = dict(tanker)
        previous = previous_by_number.get(str(row.get("tanker_no") or "").strip(), "")
        row["previous_tanker_no"] = previous
        row["tanker_changed"] = bool(previous)
        annotated.append(row)
    return annotated


def _changed_tanker_numbers(previous: list[dict[str, Any]], current: list[dict[str, Any]]) -> list[dict[str, str]]:
    old_numbers = [str(item.get("tanker_no") or "").strip() for item in previous]
    changes: list[dict[str, str]] = []
    for index, item in enumerate(current):
        new_number = str(item.get("tanker_no") or "").strip()
        old_number = old_numbers[index] if index < len(old_numbers) else ""
        if old_number and new_number and old_number != new_number:
            changes.append({"tanker_no": new_number, "previous_tanker_no": old_number})
    return changes


def _is_broker_recorded_lift(lift_id: str) -> bool:
    return str(lift_id or "").startswith("broker:")


def _short_qty_from_broker_tankers(status: str, tankers: list[dict[str, Any]]) -> float:
    planned = 0.0
    actual = 0.0
    for tanker in tankers:
        try:
            planned += float(tanker.get("planned_qty_mt") or tanker.get("qty_mt") or 0)
        except (TypeError, ValueError):
            pass
        try:
            actual += float(tanker.get("actual_qty_mt") or 0)
        except (TypeError, ValueError):
            pass
    if str(status).strip().lower() != "delivered":
        return max(0.0, planned - actual) if planned > actual + 0.0005 else max(0.0, planned)
    return max(0.0, planned - actual)


def _public_lift_event(row: dict[str, Any]) -> dict[str, Any]:
    read_at = str(row.get("broker_read_at") or "")
    completed_at = str(row.get("broker_completed_at") or "")
    lift_id = str(row.get("lift_id") or "")
    return {
        "id": int(row["id"]),
        "party_role": row.get("party_role") or "",
        "party_name": row.get("party_name") or "",
        "lift_ref": int(row.get("lift_ref") or 0),
        "broker_lift_ref": int(row.get("broker_lift_ref") or 0),
        "order_ref": row.get("order_ref") or "",
        "qty_mt": float(row.get("qty_mt") or 0),
        "status": row.get("status") or "pending",
        "event_at": row.get("event_at") or "",
        "delivered_at": row.get("delivered_at") or "",
        "updated_at": row.get("updated_at") or "",
        "broker_read_at": read_at,
        "unread": not bool(read_at.strip()),
        "broker_completed_at": completed_at,
        "broker_completed": bool(completed_at.strip()),
        "broker_recorded": _is_broker_recorded_lift(lift_id),
        "tankers": _annotate_changed_tankers(
            _public_tankers(row.get("tankers_json")),
            row.get("tanker_changes_json"),
        ),
    }


def _tankers_from_trade_lift(conn, organisation_id: int, lift_id: str) -> list[dict[str, Any]]:
    """Trucks live on the organisation's lift. Copy them when the contract row was saved before trucks were stored."""
    if not lift_id:
        return []
    ph = _ph()
    row = conn.execute(
        f"SELECT data FROM trade_state WHERE organisation_id = {ph}",
        (organisation_id,),
    ).fetchone()
    if not row:
        return []
    raw = dict(row_dict(row)).get("data")
    try:
        data = raw if isinstance(raw, dict) else json.loads(raw or "{}")
    except json.JSONDecodeError:
        return []
    lifts = data.get("lifts") if isinstance(data, dict) else None
    if not isinstance(lifts, list):
        return []
    match = next((lift for lift in lifts if str(lift.get("id") or "") == lift_id), None)
    if not isinstance(match, dict):
        return []
    tankers = match.get("tankers") if isinstance(match.get("tankers"), list) else []
    total = float(match.get("liftedQty") or match.get("plannedQtyMt") or 0)
    delivered = str(match.get("status") or "") == "delivered"
    try:
        planned_total = float(match.get("plannedQtyMt") or 0)
    except (TypeError, ValueError):
        planned_total = 0.0
    if planned_total <= 0:
        planned_total = total
    copied: list[dict[str, Any]] = []
    for tanker in tankers:
        if not isinstance(tanker, dict):
            continue
        actual = tanker.get("actualQtyMt")
        try:
            qty = float(actual) if actual not in (None, "") else 0
        except (TypeError, ValueError):
            qty = 0
        if qty <= 0 and len(tankers) == 1:
            qty = total
        if delivered:
            planned_qty = qty
            if qty > 0 and planned_total > qty + 0.0005 and len(tankers) == 1:
                planned_qty = planned_total
            actual_qty = qty
        else:
            planned_qty = qty if qty > 0 else (total if len(tankers) == 1 else 0)
            actual_qty = 0.0
        copied.append({
            "tanker_no": str(tanker.get("tankerNo") or ""),
            "transport_name": str(tanker.get("transportName") or ""),
            "driver_mobile": str(tanker.get("driverMobile") or ""),
            "lr_no": str(tanker.get("lrNo") or ""),
            "qty_mt": qty if delivered else planned_qty,
            "planned_qty_mt": planned_qty,
            "actual_qty_mt": actual_qty,
            "sales_invoice_no": str(tanker.get("salesInvoiceNo") or ""),
            "po_invoice_no": str(tanker.get("poInvoiceNo") or ""),
        })
    return copied


def _short_qty_from_trade_lift(conn, organisation_id: int, lift_id: str) -> float:
    """Weight short of the planned lift, when the organisation recorded one."""
    if not lift_id:
        return 0
    ph = _ph()
    row = conn.execute(
        f"SELECT data FROM trade_state WHERE organisation_id = {ph}",
        (organisation_id,),
    ).fetchone()
    if not row:
        return 0
    raw = dict(row_dict(row)).get("data")
    try:
        data = raw if isinstance(raw, dict) else json.loads(raw or "{}")
    except json.JSONDecodeError:
        return 0
    lifts = data.get("lifts") if isinstance(data, dict) else None
    if not isinstance(lifts, list):
        return 0
    match = next((lift for lift in lifts if str(lift.get("id") or "") == lift_id), None)
    if not isinstance(match, dict):
        return 0
    try:
        balance = float(match.get("balanceQtyMt") or 0)
    except (TypeError, ValueError):
        balance = 0
    if balance > 0.0005:
        return balance
    try:
        planned = float(match.get("plannedQtyMt") or 0)
        actual = float(match.get("liftedQty") or 0)
    except (TypeError, ValueError):
        return 0
    if planned > actual + 0.0005:
        return planned - actual
    return 0


def _lift_events_for_shares(conn, share_ids: list[int]) -> dict[int, list[dict[str, Any]]]:
    if not share_ids:
        return {}
    ph = _ph()
    placeholders = ", ".join(ph for _ in share_ids)
    rows = conn.execute(
        f"""
        SELECT e.*,
               CASE e.party_role
                   WHEN 'buyer' THEN COALESCE(b.name, s.buyer_external_name)
                   ELSE COALESCE(sel.name, s.seller_external_name)
               END AS party_name
        FROM broker_contract_share_lift_events e
        JOIN broker_contract_shares s ON s.id = e.share_id
        LEFT JOIN organisations b ON b.id = s.buyer_organisation_id
        LEFT JOIN organisations sel ON sel.id = s.seller_organisation_id
        WHERE e.share_id IN ({placeholders})
        ORDER BY e.updated_at DESC, e.id DESC
        """,
        tuple(share_ids),
    ).fetchall()
    out: dict[int, list[dict[str, Any]]] = {sid: [] for sid in share_ids}
    for row in rows:
        data = dict(row_dict(row))
        sid = int(data["share_id"])
        event = _public_lift_event(data)
        lift_id = str(data.get("lift_id") or "")
        if _is_broker_recorded_lift(lift_id):
            event["short_qty_mt"] = _short_qty_from_broker_tankers(
                str(data.get("status") or ""),
                event["tankers"],
            )
        else:
            event["short_qty_mt"] = _short_qty_from_trade_lift(
                conn, int(data["organisation_id"]), lift_id,
            )
        if not event["tankers"]:
            copied = _tankers_from_trade_lift(conn, int(data["organisation_id"]), str(data.get("lift_id") or ""))
            if copied:
                event["tankers"] = copied
                conn.execute(
                    f"UPDATE broker_contract_share_lift_events SET tankers_json = {ph} WHERE id = {ph}",
                    (json.dumps(copied), int(data["id"])),
                )
        out.setdefault(sid, []).append(event)
    return out


def _attach_lift_events(conn, shares: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ids = [int(s["id"]) for s in shares]
    by_share = _lift_events_for_shares(conn, ids)
    for share in shares:
        share["lift_events"] = by_share.get(int(share["id"]), [])
    return shares


def _public_share(row: dict[str, Any], *, viewer_org_id: int) -> dict[str, Any]:
    role = "broker"
    buyer_org = _party_org_id(row, "buyer")
    seller_org = _party_org_id(row, "seller")
    if buyer_org is not None and buyer_org == viewer_org_id:
        role = "buyer"
    elif seller_org is not None and seller_org == viewer_org_id:
        role = "seller"
    include_invites = int(row["sender_organisation_id"]) == viewer_org_id
    buyer_display = (row.get("buyer_name") or row.get("buyer_external_name") or "").strip()
    seller_display = (row.get("seller_name") or row.get("seller_external_name") or "").strip()
    return {
        "id": int(row["id"]),
        "contract_ref": row.get("contract_ref") or "",
        "note": row.get("note") or "",
        "filename": row.get("filename") or "",
        "created_at": row.get("created_at") or "",
        "buyer_name": buyer_display,
        "seller_name": seller_display,
        "buyer_party": party_delivery_public(row, "buyer", include_invite=include_invites),
        "seller_party": party_delivery_public(row, "seller", include_invite=include_invites),
        "buyer_org_code": row.get("buyer_org_code") or "",
        "seller_org_code": row.get("seller_org_code") or "",
        "buyer_legal_name": row.get("buyer_legal_name") or "",
        "seller_legal_name": row.get("seller_legal_name") or "",
        "buyer_city": row.get("buyer_city") or "",
        "buyer_state": row.get("buyer_state") or "",
        "seller_city": row.get("seller_city") or "",
        "seller_state": row.get("seller_state") or "",
        "buyer_gstin": row.get("buyer_gstin") or "",
        "seller_gstin": row.get("seller_gstin") or "",
        "sender_name": row.get("sender_name") or "",
        "role": role,
        "item_name": row.get("item_name") or "",
        "quantity": row.get("quantity") or "",
        "rate": row.get("rate") or "",
        "brokerage": row.get("brokerage") or "",
        "delivery_period": row.get("delivery_period") or "",
        "payment_terms": row.get("payment_terms") or "",
        "buyer_order_ref": row.get("buyer_order_ref") or "",
        "seller_order_ref": row.get("seller_order_ref") or "",
        "buyer_confirmed_at": row.get("buyer_confirmed_at") or "",
        "seller_confirmed_at": row.get("seller_confirmed_at") or "",
        "buyer_confirmed": bool(str(row.get("buyer_confirmed_at") or "").strip()),
        "seller_confirmed": bool(str(row.get("seller_confirmed_at") or "").strip()),
        "edited_at": row.get("edited_at") or "",
        "edited": bool(str(row.get("edited_at") or "").strip()),
        "deleted_at": row.get("deleted_at") or "",
        "lift_events": row.get("lift_events") if isinstance(row.get("lift_events"), list) else [],
    }


_SHARE_SELECT = """
    SELECT s.*,
           b.name AS buyer_name, b.org_code AS buyer_org_code,
           b.legal_name AS buyer_legal_name, b.city AS buyer_city, b.state AS buyer_state, b.gstin AS buyer_gstin,
           sel.name AS seller_name, sel.org_code AS seller_org_code,
           sel.legal_name AS seller_legal_name, sel.city AS seller_city, sel.state AS seller_state, sel.gstin AS seller_gstin,
           org.name AS sender_name
    FROM broker_contract_shares s
    LEFT JOIN organisations b ON b.id = s.buyer_organisation_id
    LEFT JOIN organisations sel ON sel.id = s.seller_organisation_id
    JOIN organisations org ON org.id = s.sender_organisation_id
"""


def _resolve_contract_party(
    conn,
    *,
    side: str,
    org_code: str,
    external_name: str,
    external_email: str,
    external_phone: str,
) -> tuple[dict[str, Any] | None, str, str, str, str]:
    """Returns (org row or None, external name, email, phone, invite_token)."""
    label = "Buyer" if side == "buyer" else "Seller"
    code = org_code.strip()
    if code:
        org = _org_by_code(conn, code)
        return org, "", "", "", ""

    name = external_name.strip()[:120]
    email = optional_contact_email(external_email) if external_email.strip() else ""
    phone = external_phone.strip()[:40]
    if not name:
        raise HTTPException(
            status_code=400,
            detail=f"Enter {label.lower()} organisation code or name for a party not on Tradeal yet",
        )
    if not email and not phone:
        raise HTTPException(
            status_code=400,
            detail=f"Enter {label.lower()} email or mobile — needed to send the contract off Tradeal",
        )
    token = secrets.token_urlsafe(24)
    return None, name, email, phone, token


def get_public_contract_invite(conn, token: str) -> dict[str, Any]:
    safe = (token or "").strip()
    if len(safe) < 16:
        raise HTTPException(status_code=404, detail="Contract link not found")
    ph = _ph()
    row = conn.execute(
        f"""
        {_SHARE_SELECT}
        WHERE s.deleted_at = '' AND (s.buyer_invite_token = {ph} OR s.seller_invite_token = {ph})
        """,
        (safe, safe),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Contract link not found or expired")
    data = dict(row_dict(row))
    party_role = "buyer" if str(data.get("buyer_invite_token") or "") == safe else "seller"
    encoded = str(data.get("pdf_data") or "")
    pdf_data = f"data:application/pdf;base64,{encoded}" if encoded else ""
    counterparty = (
        (data.get("seller_name") or data.get("seller_external_name") or "")
        if party_role == "buyer"
        else (data.get("buyer_name") or data.get("buyer_external_name") or "")
    )
    return {
        "contract_ref": data.get("contract_ref") or "",
        "party_role": party_role,
        "broker_name": data.get("sender_name") or "",
        "counterparty_name": counterparty,
        "item_name": data.get("item_name") or "",
        "quantity": data.get("quantity") or "",
        "rate": data.get("rate") or "",
        "delivery_period": data.get("delivery_period") or "",
        "payment_terms": data.get("payment_terms") or "",
        "note": data.get("note") or "",
        "filename": data.get("filename") or "",
        "pdf_data": pdf_data,
    }


def clear_contract_shares_for_organisation(conn, organisation_id: int) -> int:
    """Remove broker contracts this org sent or received (lift events cascade on share delete)."""
    ph = _ph()
    cur = conn.execute(
        f"""
        DELETE FROM broker_contract_shares
        WHERE sender_organisation_id = {ph}
           OR buyer_organisation_id = {ph}
           OR seller_organisation_id = {ph}
        """,
        (organisation_id, organisation_id, organisation_id),
    )
    conn.commit()
    if uses_postgres():
        return int(cur.rowcount or 0)
    return int(getattr(cur, "rowcount", 0) or 0)


def _next_broker_lift_ref(conn, sender_organisation_id: int) -> int:
    """Next lift number for this broker. Buyer and seller numbers stay on their own books."""
    ph = _ph()
    row = conn.execute(
        f"""
        SELECT COALESCE(MAX(e.broker_lift_ref), 0) AS n
        FROM broker_contract_share_lift_events e
        JOIN broker_contract_shares s ON s.id = e.share_id
        WHERE s.sender_organisation_id = {ph}
        """,
        (sender_organisation_id,),
    ).fetchone()
    return int(dict(row_dict(row) or {}).get("n") or 0) + 1


def _ensure_broker_lift_refs(conn, sender_organisation_id: int) -> None:
    """Give each mirrored party lift a stable number on the broker's register."""
    ph = _ph()
    rows = conn.execute(
        f"""
        SELECT e.id
        FROM broker_contract_share_lift_events e
        JOIN broker_contract_shares s ON s.id = e.share_id
        WHERE s.sender_organisation_id = {ph} AND COALESCE(e.broker_lift_ref, 0) = 0
        ORDER BY e.id ASC
        """,
        (sender_organisation_id,),
    ).fetchall()
    if not rows:
        return
    nxt = _next_broker_lift_ref(conn, sender_organisation_id)
    for row in rows:
        event_id = int(dict(row_dict(row))["id"])
        conn.execute(
            f"UPDATE broker_contract_share_lift_events SET broker_lift_ref = {ph} WHERE id = {ph}",
            (nxt, event_id),
        )
        nxt += 1
    conn.commit()


def list_shares_for_broker(conn, organisation_id: int) -> list[dict[str, Any]]:
    _ensure_broker_lift_refs(conn, organisation_id)
    ph = _ph()
    rows = conn.execute(
        f"""
        {_SHARE_SELECT}
        WHERE s.sender_organisation_id = {ph}
        ORDER BY s.id DESC
        """,
        (organisation_id,),
    ).fetchall()
    shares = [_public_share(dict(row_dict(row)), viewer_org_id=organisation_id) for row in rows]
    return _attach_lift_events(conn, shares)


def list_shares_for_organisation(conn, organisation_id: int) -> list[dict[str, Any]]:
    ph = _ph()
    rows = conn.execute(
        f"""
        {_SHARE_SELECT}
        WHERE (s.buyer_organisation_id = {ph} OR s.seller_organisation_id = {ph})
          AND s.deleted_at = ''
        ORDER BY s.id DESC
        """,
        (organisation_id, organisation_id),
    ).fetchall()
    shares = [_public_share(dict(row_dict(row)), viewer_org_id=organisation_id) for row in rows]
    return _attach_lift_events(conn, shares)


def get_share(conn, share_id: int, organisation_id: int, *, include_pdf: bool = False) -> dict[str, Any]:
    ph = _ph()
    row = conn.execute(
        f"{_SHARE_SELECT} WHERE s.id = {ph}",
        (share_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Contract not found")
    data = dict(row_dict(row))
    if not _can_read(data, organisation_id):
        raise HTTPException(status_code=404, detail="Contract not found")
    if str(data.get("deleted_at") or "").strip() and int(data["sender_organisation_id"]) != organisation_id:
        raise HTTPException(status_code=404, detail="Contract not found")
    if int(data["sender_organisation_id"]) == organisation_id:
        _ensure_broker_lift_refs(conn, organisation_id)
    out = _public_share(data, viewer_org_id=organisation_id)
    if include_pdf:
        encoded = str(data.get("pdf_data") or "")
        out["pdf_data"] = f"data:application/pdf;base64,{encoded}" if encoded else ""
    events = _lift_events_for_shares(conn, [share_id])
    out["lift_events"] = events.get(share_id, [])
    return out


def share_contract(
    conn,
    *,
    sender_organisation_id: int,
    sender_user_id: int,
    sender_org_name: str,
    buyer_org_code: str,
    seller_org_code: str,
    buyer_external_name: str = "",
    buyer_external_email: str = "",
    buyer_external_phone: str = "",
    seller_external_name: str = "",
    seller_external_email: str = "",
    seller_external_phone: str = "",
    contract_ref: str,
    note: str,
    filename: str,
    pdf_data_url: str,
    item_name: str = "",
    quantity: str = "",
    rate: str = "",
    brokerage: str = "",
    delivery_period: str = "",
    payment_terms: str = "",
) -> dict[str, Any]:
    ref = contract_ref.strip() or "pending"
    if len(ref) > 80:
        raise HTTPException(status_code=400, detail="Contract number is too long")
    message = note.strip()
    if len(message) > 2000:
        raise HTTPException(status_code=400, detail="Note must be 2000 characters or fewer")
    encoded = ""
    safe_name = ""
    if pdf_data_url.strip():
        _blob, encoded = _pdf_bytes(pdf_data_url)
        safe_name = (filename or "contract.pdf").strip().replace("\\", "/").split("/")[-1][:120] or "contract.pdf"
        if not safe_name.lower().endswith(".pdf"):
            safe_name = f"{safe_name}.pdf"

    buyer, b_ext_name, b_ext_email, b_ext_phone, b_token = _resolve_contract_party(
        conn,
        side="buyer",
        org_code=buyer_org_code,
        external_name=buyer_external_name,
        external_email=buyer_external_email,
        external_phone=buyer_external_phone,
    )
    seller, s_ext_name, s_ext_email, s_ext_phone, s_token = _resolve_contract_party(
        conn,
        side="seller",
        org_code=seller_org_code,
        external_name=seller_external_name,
        external_email=seller_external_email,
        external_phone=seller_external_phone,
    )
    buyer_id = int(buyer["id"]) if buyer else None
    seller_id = int(seller["id"]) if seller else None
    if buyer_id is not None and seller_id is not None and buyer_id == seller_id:
        raise HTTPException(status_code=400, detail="Buyer and seller must be different organisations")
    blocked = {oid for oid in (buyer_id, seller_id) if oid is not None}
    if sender_organisation_id in blocked:
        raise HTTPException(status_code=400, detail="Send the contract to the buyer and the seller")

    now = _now_iso()
    ph = _ph()
    vals = (
        sender_organisation_id,
        sender_user_id,
        buyer_id,
        seller_id,
        ref,
        message,
        safe_name,
        encoded,
        now,
        item_name.strip()[:120],
        quantity.strip()[:40],
        rate.strip()[:40],
        brokerage.strip()[:40],
        delivery_period.strip()[:120],
        payment_terms.strip()[:120],
        b_ext_name,
        b_ext_email,
        b_ext_phone,
        s_ext_name,
        s_ext_email,
        s_ext_phone,
        b_token,
        s_token,
        "",
        "",
    )
    columns = (
        "sender_organisation_id, sender_user_id, buyer_organisation_id, seller_organisation_id, "
        "contract_ref, note, filename, pdf_data, created_at, "
        "item_name, quantity, rate, brokerage, delivery_period, payment_terms, "
        "buyer_external_name, buyer_external_email, buyer_external_phone, "
        "seller_external_name, seller_external_email, seller_external_phone, "
        "buyer_invite_token, seller_invite_token, buyer_email_sent_at, seller_email_sent_at"
    )
    marks = ", ".join(ph for _ in vals)
    if uses_postgres():
        row = conn.execute(
            f"INSERT INTO broker_contract_shares ({columns}) VALUES ({marks}) RETURNING id",
            vals,
        ).fetchone()
        share_id = int(dict(row_dict(row))["id"])
    else:
        cur = conn.execute(
            f"INSERT INTO broker_contract_shares ({columns}) VALUES ({marks})",
            vals,
        )
        share_id = int(cur.lastrowid)

    if ref == "pending":
        ref = contract_ref_for_id(share_id)
        conn.execute(
            f"UPDATE broker_contract_shares SET contract_ref = {ph} WHERE id = {ph}",
            (ref, share_id),
        )

    firm = sender_org_name.strip() or "Your broker"
    title = f"Contract {ref} from {firm}"
    terms = " · ".join(
        part for part in (
            item_name.strip(),
            f"{quantity.strip()} MT" if quantity.strip() else "",
            f"rate {rate.strip()}" if rate.strip() else "",
        )
        if part
    )
    body = message or f"{firm} sent contract {ref}."
    if terms:
        body = f"{body}\n{terms}"
    href = f"/app/contract-shares/{share_id}"
    seller_label = (seller.get("name") if seller else s_ext_name) or ""
    buyer_label = (buyer.get("name") if buyer else b_ext_name) or ""
    if buyer is not None:
        create_notifications_for_audience(
            conn,
            audience="org",
            organisation_id=int(buyer["id"]),
            recipient_user_id=None,
            recipient_scope="org_admin",
            exclude_expired_amc=False,
            kind="contract",
            title=title,
            body=body,
            payload={
                "cta": "contract_share",
                "share_id": str(share_id),
                "contract_ref": ref,
                "party_role": "buyer",
                "counterparty_name": seller_label,
                "source": "broker",
            },
            href=href,
            actor_user_id=sender_user_id,
            source="broker",
        )
    if seller is not None:
        create_notifications_for_audience(
            conn,
            audience="org",
            organisation_id=int(seller["id"]),
            recipient_user_id=None,
            recipient_scope="org_admin",
            exclude_expired_amc=False,
            kind="contract",
            title=title,
            body=body,
            payload={
                "cta": "contract_share",
                "share_id": str(share_id),
                "contract_ref": ref,
                "party_role": "seller",
                "counterparty_name": buyer_label,
                "source": "broker",
            },
            href=href,
            actor_user_id=sender_user_id,
            source="broker",
        )

    terms_line = terms
    pdf_blob = base64.b64decode(encoded) if encoded else None
    delivery: dict[str, Any] = {"buyer": {}, "seller": {}}

    if buyer is None and b_token:
        from .broker_contract_delivery import contract_invite_url

        invite = contract_invite_url(b_token)
        sent = send_external_contract_email(
            to_email=b_ext_email,
            party_name=b_ext_name,
            party_role="buyer",
            contract_ref=ref,
            broker_name=firm,
            note=message,
            terms_line=terms_line,
            invite_url=invite,
            pdf_bytes=pdf_blob,
            pdf_filename=safe_name,
        )
        if sent:
            conn.execute(
                f"UPDATE broker_contract_shares SET buyer_email_sent_at = {ph} WHERE id = {ph}",
                (now, share_id),
            )
        delivery["buyer"] = {
            "channel": "external",
            "email_sent": sent,
            "invite_url": invite,
            "whatsapp_text": whatsapp_contract_message(
                party_name=b_ext_name,
                party_role="buyer",
                contract_ref=ref,
                broker_name=firm,
                terms_line=terms_line,
                invite_url=invite,
            ),
            "phone": b_ext_phone,
        }
    elif buyer is not None:
        delivery["buyer"] = {"channel": "tradeal", "email_sent": False}

    if seller is None and s_token:
        from .broker_contract_delivery import contract_invite_url

        invite = contract_invite_url(s_token)
        sent = send_external_contract_email(
            to_email=s_ext_email,
            party_name=s_ext_name,
            party_role="seller",
            contract_ref=ref,
            broker_name=firm,
            note=message,
            terms_line=terms_line,
            invite_url=invite,
            pdf_bytes=pdf_blob,
            pdf_filename=safe_name,
        )
        if sent:
            conn.execute(
                f"UPDATE broker_contract_shares SET seller_email_sent_at = {ph} WHERE id = {ph}",
                (now, share_id),
            )
        delivery["seller"] = {
            "channel": "external",
            "email_sent": sent,
            "invite_url": invite,
            "whatsapp_text": whatsapp_contract_message(
                party_name=s_ext_name,
                party_role="seller",
                contract_ref=ref,
                broker_name=firm,
                terms_line=terms_line,
                invite_url=invite,
            ),
            "phone": s_ext_phone,
        }
    elif seller is not None:
        delivery["seller"] = {"channel": "tradeal", "email_sent": False}

    conn.commit()
    return {"share": get_share(conn, share_id, sender_organisation_id), "delivery": delivery}


def _change(label: str, old: str, new: str, changes: list[dict[str, str]]) -> None:
    left = (old or "").strip()
    right = (new or "").strip()
    if left == right:
        return
    changes.append({"label": label, "from": left or "—", "to": right or "—"})


def _notify_contract_parties(
    conn,
    *,
    organisation_ids: list[int],
    actor_user_id: int,
    title: str,
    body: str,
    payload: dict[str, Any],
    href: str,
) -> None:
    seen: set[int] = set()
    for organisation_id in organisation_ids:
        if organisation_id in seen:
            continue
        seen.add(organisation_id)
        try:
            create_notifications_for_audience(
                conn,
                audience="org",
                organisation_id=organisation_id,
                recipient_user_id=None,
                recipient_scope="org_admin",
                exclude_expired_amc=False,
                kind="contract",
                title=title,
                body=body,
                payload=payload,
                href=href,
                actor_user_id=actor_user_id,
                source="broker",
            )
        except HTTPException as exc:
            if exc.status_code != 400:
                raise


def update_share(
    conn,
    *,
    share_id: int,
    sender_organisation_id: int,
    sender_user_id: int,
    sender_org_name: str,
    buyer_org_code: str,
    seller_org_code: str,
    note: str,
    item_name: str,
    quantity: str,
    rate: str,
    brokerage: str,
    delivery_period: str,
    payment_terms: str,
) -> dict[str, Any]:
    ph = _ph()
    row = conn.execute(
        f"{_SHARE_SELECT} WHERE s.id = {ph}",
        (share_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Contract not found")
    data = dict(row_dict(row))
    if int(data["sender_organisation_id"]) != sender_organisation_id:
        raise HTTPException(status_code=404, detail="Contract not found")
    if str(data.get("deleted_at") or "").strip():
        raise HTTPException(status_code=400, detail="This contract has been deleted")

    message = note.strip()
    if len(message) > 2000:
        raise HTTPException(status_code=400, detail="Note must be 2000 characters or fewer")
    buyer = _org_by_code(conn, buyer_org_code)
    seller = _org_by_code(conn, seller_org_code)
    if int(buyer["id"]) == int(seller["id"]):
        raise HTTPException(status_code=400, detail="Buyer and seller must be different organisations")
    if sender_organisation_id in {int(buyer["id"]), int(seller["id"])}:
        raise HTTPException(status_code=400, detail="Send the contract to the buyer and the seller")

    item = item_name.strip()[:120]
    qty = quantity.strip()[:40]
    price = rate.strip()[:40]
    brok = brokerage.strip()[:40]
    delivery = delivery_period.strip()[:120]
    payment = payment_terms.strip()[:120]
    changes: list[dict[str, str]] = []
    _change("Buyer", str(data.get("buyer_name") or ""), str(buyer.get("name") or ""), changes)
    _change("Seller", str(data.get("seller_name") or ""), str(seller.get("name") or ""), changes)
    _change("Commodity", str(data.get("item_name") or ""), item, changes)
    _change("Quantity", str(data.get("quantity") or ""), qty, changes)
    _change("Rate", str(data.get("rate") or ""), price, changes)
    _change("Brokerage", str(data.get("brokerage") or ""), brok, changes)
    _change("Delivery", str(data.get("delivery_period") or ""), delivery, changes)
    _change("Payment terms", str(data.get("payment_terms") or ""), payment, changes)
    _change("Note", str(data.get("note") or ""), message, changes)
    if not changes:
        raise HTTPException(status_code=400, detail="No changes to save")

    now = _now_iso()
    conn.execute(
        f"""
        UPDATE broker_contract_shares
        SET buyer_organisation_id = {ph},
            seller_organisation_id = {ph},
            note = {ph},
            item_name = {ph},
            quantity = {ph},
            rate = {ph},
            brokerage = {ph},
            delivery_period = {ph},
            payment_terms = {ph},
            edited_at = {ph}
        WHERE id = {ph}
        """,
        (
            int(buyer["id"]),
            int(seller["id"]),
            message,
            item,
            qty,
            price,
            brok,
            delivery,
            payment,
            now,
            share_id,
        ),
    )

    ref = str(data.get("contract_ref") or contract_ref_for_id(share_id))
    firm = sender_org_name.strip() or "Your broker"
    lines = [f"{firm} updated contract {ref}."]
    lines.extend(f"{change['label']}: {change['from']} → {change['to']}" for change in changes)
    body = "\n".join(lines)
    if len(body) > 4000:
        body = body[:3997] + "..."
    href = f"/app/contract-shares/{share_id}"
    payload = {
        "cta": "contract_share",
        "share_id": str(share_id),
        "contract_ref": ref,
        "edited": "true",
        "source": "broker",
    }
    previous_buyer = int(data["buyer_organisation_id"])
    previous_seller = int(data["seller_organisation_id"])
    _notify_contract_parties(
        conn,
        organisation_ids=[int(buyer["id"]), int(seller["id"])],
        actor_user_id=sender_user_id,
        title=f"Contract {ref} was updated",
        body=body,
        payload=payload,
        href=href,
    )
    removed: list[tuple[int, str]] = []
    if previous_buyer != int(buyer["id"]):
        removed.append((previous_buyer, str(data.get("buyer_name") or "Buyer")))
    if previous_seller != int(seller["id"]):
        removed.append((previous_seller, str(data.get("seller_name") or "Seller")))
    for org_id, party_name in removed:
        _notify_contract_parties(
            conn,
            organisation_ids=[org_id],
            actor_user_id=sender_user_id,
            title=f"Removed from contract {ref}",
            body=f"{firm} updated contract {ref}. {party_name} is no longer a party on this contract.",
            payload={
                "share_id": str(share_id),
                "contract_ref": ref,
                "source": "broker",
            },
            href="",
        )

    conn.commit()
    return get_share(conn, share_id, sender_organisation_id)


def delete_share(
    conn,
    *,
    share_id: int,
    sender_organisation_id: int,
    sender_user_id: int,
    sender_org_name: str,
) -> dict[str, Any]:
    ph = _ph()
    row = conn.execute(
        f"{_SHARE_SELECT} WHERE s.id = {ph}",
        (share_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Contract not found")
    data = dict(row_dict(row))
    if int(data["sender_organisation_id"]) != sender_organisation_id:
        raise HTTPException(status_code=404, detail="Contract not found")
    if str(data.get("deleted_at") or "").strip():
        return get_share(conn, share_id, sender_organisation_id)

    now = _now_iso()
    conn.execute(
        f"UPDATE broker_contract_shares SET deleted_at = {ph} WHERE id = {ph}",
        (now, share_id),
    )
    ref = str(data.get("contract_ref") or contract_ref_for_id(share_id))
    firm = sender_org_name.strip() or "Your broker"
    _notify_contract_parties(
        conn,
        organisation_ids=[
            oid for oid in (_party_org_id(data, "buyer"), _party_org_id(data, "seller")) if oid is not None
        ],
        actor_user_id=sender_user_id,
        title=f"Contract {ref} was deleted",
        body=f"{firm} deleted contract {ref}.",
        payload={
            "share_id": str(share_id),
            "contract_ref": ref,
            "deleted": "true",
            "source": "broker",
        },
        href="",
    )
    conn.commit()
    return get_share(conn, share_id, sender_organisation_id)


def confirm_share(conn, share_id: int, organisation_id: int, actor_user_id: int) -> dict[str, Any]:
    """Record that the buyer or seller accepts the contract, and tell the broker."""
    ph = _ph()
    row = conn.execute(
        f"{_SHARE_SELECT} WHERE s.id = {ph}",
        (share_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Contract not found")
    data = dict(row_dict(row))
    if str(data.get("deleted_at") or "").strip():
        raise HTTPException(status_code=404, detail="Contract not found")
    buyer_org = _party_org_id(data, "buyer")
    seller_org = _party_org_id(data, "seller")
    if buyer_org is not None and buyer_org == organisation_id:
        column = "buyer_confirmed_at"
        party_name = str(data.get("buyer_name") or data.get("buyer_external_name") or "Buyer")
        party_role = "buyer"
    elif seller_org is not None and seller_org == organisation_id:
        column = "seller_confirmed_at"
        party_name = str(data.get("seller_name") or data.get("seller_external_name") or "Seller")
        party_role = "seller"
    else:
        raise HTTPException(status_code=404, detail="Contract not found")
    if str(data.get(column) or "").strip():
        return get_share(conn, share_id, organisation_id)

    now = _now_iso()
    conn.execute(
        f"UPDATE broker_contract_shares SET {column} = {ph} WHERE id = {ph}",
        (now, share_id),
    )
    ref = str(data.get("contract_ref") or contract_ref_for_id(share_id))
    role_label = "buyer" if party_role == "buyer" else "seller"
    try:
        create_notifications_for_audience(
            conn,
            audience="org",
            organisation_id=int(data["sender_organisation_id"]),
            recipient_user_id=None,
            recipient_scope="all_users",
            exclude_expired_amc=False,
            kind="contract",
            title=f"{party_name} confirmed contract {ref}",
            body=f"{party_name} confirmed contract {ref} as the {role_label}.",
            payload={
                "share_id": str(share_id),
                "contract_ref": ref,
                "party_role": party_role,
                "party_name": party_name,
            },
            href="",
            actor_user_id=actor_user_id,
            source="broker",
        )
    except HTTPException as exc:
        if exc.status_code != 400:
            raise
    conn.commit()
    return get_share(conn, share_id, organisation_id)


def book_share(conn, share_id: int, organisation_id: int, order_ref: str) -> dict[str, Any]:
    """Record the order this organisation created from the broker contract. Their own books only."""
    ref = order_ref.strip()
    if not ref:
        raise HTTPException(status_code=400, detail="Order reference is required")
    ph = _ph()
    row = conn.execute(
        f"SELECT * FROM broker_contract_shares WHERE id = {ph}",
        (share_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Contract not found")
    data = dict(row_dict(row))
    if str(data.get("deleted_at") or "").strip():
        raise HTTPException(status_code=404, detail="Contract not found")
    buyer_org = _party_org_id(data, "buyer")
    seller_org = _party_org_id(data, "seller")
    if buyer_org is not None and buyer_org == organisation_id:
        column = "buyer_order_ref"
    elif seller_org is not None and seller_org == organisation_id:
        column = "seller_order_ref"
    else:
        raise HTTPException(status_code=404, detail="Contract not found")
    if not str(data.get("buyer_confirmed_at") or "").strip() or not str(data.get("seller_confirmed_at") or "").strip():
        raise HTTPException(
            status_code=400,
            detail="Both parties must confirm the contract before an order can be created",
        )
    existing = str(data.get(column) or "").strip()
    if existing and existing != ref:
        return get_share(conn, share_id, organisation_id)
    conn.execute(
        f"UPDATE broker_contract_shares SET {column} = {ph} WHERE id = {ph}",
        (ref[:40], share_id),
    )
    conn.commit()
    return get_share(conn, share_id, organisation_id)


def _normalize_order_ref(ref: str) -> str:
    return (
        str(ref or "")
        .strip()
        .upper()
        .replace("-", "")
        .replace("#", "")
        .replace(" ", "")
    )


def _order_refs_equal(stored: str, incoming: str) -> bool:
    left = _normalize_order_ref(stored)
    right = _normalize_order_ref(incoming)
    return bool(left) and left == right


def _resolve_share_for_order(conn, organisation_id: int, order_ref: str) -> tuple[int, str, dict[str, Any]] | None:
    ref = order_ref.strip()
    if not ref:
        return None
    ph = _ph()
    rows = conn.execute(
        f"""
        SELECT * FROM broker_contract_shares
        WHERE buyer_organisation_id = {ph} AND buyer_order_ref != ''
        """,
        (organisation_id,),
    ).fetchall()
    for row in rows:
        data = dict(row_dict(row))
        if str(data.get("deleted_at") or "").strip():
            continue
        if _order_refs_equal(str(data.get("buyer_order_ref") or ""), ref):
            return int(data["id"]), "buyer", data
    rows = conn.execute(
        f"""
        SELECT * FROM broker_contract_shares
        WHERE seller_organisation_id = {ph} AND seller_order_ref != ''
        """,
        (organisation_id,),
    ).fetchall()
    for row in rows:
        data = dict(row_dict(row))
        if str(data.get("deleted_at") or "").strip():
            continue
        if _order_refs_equal(str(data.get("seller_order_ref") or ""), ref):
            return int(data["id"]), "seller", data
    return None


def _org_display_name(conn, org_id: int) -> str:
    ph = _ph()
    row = conn.execute(f"SELECT name FROM organisations WHERE id = {ph}", (org_id,)).fetchone()
    if not row:
        return ""
    return str(dict(row_dict(row)).get("name") or "")


def _broker_lift_event(conn, event_id: int, sender_organisation_id: int) -> dict[str, Any]:
    ph = _ph()
    row = conn.execute(
        f"""
        SELECT e.id, e.broker_read_at, e.broker_completed_at
        FROM broker_contract_share_lift_events e
        JOIN broker_contract_shares s ON s.id = e.share_id
        WHERE e.id = {ph} AND s.sender_organisation_id = {ph}
        """,
        (event_id, sender_organisation_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Lift not found")
    return dict(row_dict(row))


def mark_broker_lift_read(conn, event_id: int, sender_organisation_id: int) -> dict[str, Any]:
    data = _broker_lift_event(conn, event_id, sender_organisation_id)
    if not str(data.get("broker_read_at") or "").strip():
        ph = _ph()
        conn.execute(
            f"UPDATE broker_contract_share_lift_events SET broker_read_at = {ph} WHERE id = {ph}",
            (_now_iso(), event_id),
        )
        conn.commit()
    return {"id": event_id, "unread": False}


def complete_broker_lift(conn, event_id: int, sender_organisation_id: int) -> dict[str, Any]:
    data = _broker_lift_event(conn, event_id, sender_organisation_id)
    now = _now_iso()
    completed_at = str(data.get("broker_completed_at") or "").strip() or now
    read_at = str(data.get("broker_read_at") or "").strip() or now
    ph = _ph()
    conn.execute(
        f"""
        UPDATE broker_contract_share_lift_events
        SET broker_completed_at = {ph}, broker_read_at = {ph}
        WHERE id = {ph}
        """,
        (completed_at, read_at, event_id),
    )
    conn.commit()
    return {"id": event_id, "broker_completed": True, "unread": False}


def _normalize_manual_broker_tankers(
    *,
    qty_mt: float,
    status: str,
    tankers: list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    safe_status = "delivered" if str(status).strip().lower() == "delivered" else "pending"
    public = _public_tankers(json.dumps(tankers or []))
    qty = max(0.0, float(qty_mt or 0))
    if not public:
        planned = qty
        actual = qty if safe_status == "delivered" else 0.0
        row_qty = actual if safe_status == "delivered" else planned
        return [{
            "tanker_no": "",
            "transport_name": "",
            "driver_mobile": "",
            "lr_no": "",
            "qty_mt": row_qty,
            "planned_qty_mt": planned,
            "actual_qty_mt": actual,
            "sales_invoice_no": "",
            "po_invoice_no": "",
        }]
    out: list[dict[str, Any]] = []
    for item in public:
        row = dict(item)
        try:
            planned = float(row.get("planned_qty_mt") or row.get("qty_mt") or 0)
        except (TypeError, ValueError):
            planned = 0.0
        if planned <= 0 and qty > 0:
            planned = qty / max(1, len(public))
        try:
            actual = float(row.get("actual_qty_mt") or 0)
        except (TypeError, ValueError):
            actual = 0.0
        if safe_status == "delivered" and actual <= 0:
            actual = planned
        row["planned_qty_mt"] = planned
        row["actual_qty_mt"] = actual
        row["qty_mt"] = actual if safe_status == "delivered" else planned
        out.append(row)
    return out


def create_broker_recorded_lift(
    conn,
    *,
    share_id: int,
    sender_organisation_id: int,
    actor_user_id: int,
    party_role: str,
    qty_mt: float,
    status: str,
    event_at: str,
    tankers: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Broker-recorded lift on a contract (e.g. when a party is not on Tradeal)."""
    role = party_role.strip().lower()
    if role not in {"buyer", "seller"}:
        raise HTTPException(status_code=400, detail="Party must be buyer or seller")
    ph = _ph()
    row = conn.execute(
        f"SELECT * FROM broker_contract_shares WHERE id = {ph}",
        (share_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Contract not found")
    share_row = dict(row_dict(row))
    if int(share_row["sender_organisation_id"]) != sender_organisation_id:
        raise HTTPException(status_code=404, detail="Contract not found")
    if str(share_row.get("deleted_at") or "").strip():
        raise HTTPException(status_code=400, detail="This contract has been deleted")

    safe_status = "delivered" if str(status).strip().lower() == "delivered" else "pending"
    tankers_public = _normalize_manual_broker_tankers(qty_mt=qty_mt, status=safe_status, tankers=tankers)
    qty = max(0.0, float(qty_mt or 0))
    if qty <= 0:
        qty = sum(float(t.get("qty_mt") or 0) for t in tankers_public)
    if qty <= 0:
        raise HTTPException(status_code=400, detail="Enter a lift quantity")

    when = (event_at or "").strip() or _now_iso()
    if len(when) > 40:
        when = when[:40]
    now = _now_iso()
    lift_id = f"broker:{secrets.token_urlsafe(16)}"
    broker_ref = _next_broker_lift_ref(conn, sender_organisation_id)
    tankers_json = json.dumps(tankers_public)

    columns = (
        "share_id, organisation_id, party_role, lift_id, lift_ref, broker_lift_ref, order_ref, "
        "qty_mt, status, event_at, delivered_at, updated_at, tankers_json, broker_read_at"
    )
    marks = ", ".join(ph for _ in range(14))
    delivered_at = when if safe_status == "delivered" else ""
    conn.execute(
        f"INSERT INTO broker_contract_share_lift_events ({columns}) VALUES ({marks})",
        (
            share_id,
            sender_organisation_id,
            role,
            lift_id,
            broker_ref,
            broker_ref,
            "",
            qty,
            safe_status,
            when,
            delivered_at,
            now,
            tankers_json,
            now,
        ),
    )

    ref = str(share_row.get("contract_ref") or contract_ref_for_id(share_id))
    party_org = _party_org_id(share_row, role)
    if party_org is not None:
        lift_label = f"LT{broker_ref}"
        qty_text = f"{qty:g}".rstrip("0").rstrip(".") or "0"
        party_name = _org_display_name(conn, party_org) or ("Buyer" if role == "buyer" else "Seller")
        try:
            create_notifications_for_audience(
                conn,
                audience="org",
                organisation_id=party_org,
                recipient_user_id=None,
                recipient_scope="org_admin",
                exclude_expired_amc=False,
                kind="contract",
                title=f"Lift {lift_label} on contract {ref}",
                body=f"{party_name} side · {qty_text} MT recorded by your broker.",
                payload={
                    "share_id": str(share_id),
                    "contract_ref": ref,
                    "broker_lift_ref": str(broker_ref),
                    "source": "broker",
                },
                href=f"/app/contract-shares/{share_id}",
                actor_user_id=actor_user_id,
                source="broker",
            )
        except HTTPException as exc:
            if exc.status_code != 400:
                raise

    conn.commit()
    return get_share(conn, share_id, sender_organisation_id)


def report_share_lift(
    conn,
    *,
    organisation_id: int,
    actor_user_id: int,
    lift_id: str,
    lift_ref: int,
    order_ref: str,
    qty_mt: float,
    status: str,
    event_at: str,
    tankers: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Mirror a lift from an org's books onto the broker contract (read-only for other parties)."""
    lid = lift_id.strip()
    if not lid:
        raise HTTPException(status_code=400, detail="Lift id is required")
    resolved = _resolve_share_for_order(conn, organisation_id, order_ref)
    if not resolved:
        return {"linked": False}

    share_id, party_role, share_row = resolved
    safe_status = "delivered" if str(status).strip().lower() == "delivered" else "pending"
    qty = max(0.0, float(qty_mt or 0))
    when = (event_at or "").strip() or _now_iso()
    now = _now_iso()
    tankers_public = _public_tankers(json.dumps(tankers or []))
    tankers_json = json.dumps(tankers_public)
    ph = _ph()

    existing = conn.execute(
        f"""
        SELECT id, status, broker_lift_ref, tankers_json, tanker_changes_json
        FROM broker_contract_share_lift_events
        WHERE share_id = {ph} AND organisation_id = {ph} AND lift_id = {ph}
        """,
        (share_id, organisation_id, lid),
    ).fetchone()
    is_new = existing is None
    existing_row = dict(row_dict(existing)) if existing else {}
    previous_status = str(existing_row.get("status") or "")
    number_changes = _changed_tanker_numbers(_public_tankers(existing_row.get("tankers_json")), tankers_public)
    changes_json = json.dumps(number_changes) if number_changes else str(existing_row.get("tanker_changes_json") or "[]")

    broker_ref = 0
    if is_new:
        broker_ref = _next_broker_lift_ref(conn, int(share_row["sender_organisation_id"]))
        columns = (
            "share_id, organisation_id, party_role, lift_id, lift_ref, broker_lift_ref, order_ref, "
            "qty_mt, status, event_at, delivered_at, updated_at, tankers_json"
        )
        marks = ", ".join(ph for _ in range(13))
        conn.execute(
            f"INSERT INTO broker_contract_share_lift_events ({columns}) VALUES ({marks})",
            (
                share_id,
                organisation_id,
                party_role,
                lid,
                int(lift_ref or 0),
                broker_ref,
                order_ref.strip()[:40],
                qty,
                safe_status,
                when[:40],
                when[:40] if safe_status == "delivered" else "",
                now,
                tankers_json,
            ),
        )
    else:
        broker_ref = int(existing_row.get("broker_lift_ref") or 0)
        conn.execute(
            f"""
            UPDATE broker_contract_share_lift_events
            SET lift_ref = {ph}, order_ref = {ph}, qty_mt = {ph}, status = {ph},
                delivered_at = CASE WHEN {ph} = 'delivered' THEN {ph} ELSE delivered_at END,
                tankers_json = {ph}, tanker_changes_json = {ph}, updated_at = {ph}
            WHERE share_id = {ph} AND organisation_id = {ph} AND lift_id = {ph}
            """,
            (
                int(lift_ref or 0),
                order_ref.strip()[:40],
                qty,
                safe_status,
                safe_status,
                when[:40],
                tankers_json,
                changes_json,
                now,
                share_id,
                organisation_id,
                lid,
            ),
        )

    became_delivered = safe_status == "delivered" and (is_new or previous_status != "delivered")
    if became_delivered:
        ref = str(share_row.get("contract_ref") or contract_ref_for_id(share_id))
        party_name = _org_display_name(conn, organisation_id) or (
            "Buyer" if party_role == "buyer" else "Seller"
        )
        lift_label = f"LT{broker_ref}" if broker_ref else "Lift"
        qty_text = f"{qty:g}".rstrip("0").rstrip(".") or "0"
        try:
            create_notifications_for_audience(
                conn,
                audience="org",
                organisation_id=int(share_row["sender_organisation_id"]),
                recipient_user_id=None,
                recipient_scope="all_users",
                exclude_expired_amc=False,
                kind="contract",
                title=f"{lift_label} delivered · {ref}",
                body=f"{party_name} recorded {qty_text} MT on {order_ref.strip()} (delivered).",
                payload={
                    "share_id": str(share_id),
                    "contract_ref": ref,
                    "party_role": party_role,
                    "lift_ref": str(broker_ref),
                    "order_ref": order_ref.strip(),
                },
                href=f"/app/lifts?ref={broker_ref}" if broker_ref else "",
                actor_user_id=actor_user_id,
                source="broker",
            )
        except HTTPException as exc:
            if exc.status_code != 400:
                raise

    conn.commit()
    return {"linked": True, "share_id": share_id}
