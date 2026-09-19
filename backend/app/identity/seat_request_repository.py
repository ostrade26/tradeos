"""Organisation seat purchase requests (request → pay → platform approve)."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from ..db import uses_postgres
from .billing_repository import _mapping, _now, add_purchased_seat, get_active_subscription
from .repository import append_audit_log

SEAT_REQUEST_STATUSES = ("pending_payment", "paid", "approved", "rejected", "cancelled")


def _row_to_request(row) -> dict[str, Any]:
    d = dict(_mapping(row))
    d["id"] = int(d["id"])
    d["organisation_id"] = int(d["organisation_id"])
    d["subscription_id"] = int(d["subscription_id"])
    d["requested_seats"] = int(d["requested_seats"])
    d["amount_cents"] = int(d["amount_cents"])
    if d.get("requested_by_user_id") is not None:
        d["requested_by_user_id"] = int(d["requested_by_user_id"])
    if d.get("reviewed_by_user_id") is not None:
        d["reviewed_by_user_id"] = int(d["reviewed_by_user_id"])
    if d.get("request_note") is not None and not d.get("note"):
        d["note"] = str(d.get("request_note") or "")
    return d


def get_seat_request_for_org(
    conn,
    request_id: int,
    *,
    organisation_id: int,
) -> dict[str, Any] | None:
    """Return a seat request for inbox notice context (org-scoped)."""
    if uses_postgres():
        row = conn.execute(
            "SELECT * FROM seat_requests WHERE id = %s AND organisation_id = %s",
            (request_id, organisation_id),
        ).fetchone()
    else:
        row = conn.execute(
            "SELECT * FROM seat_requests WHERE id = ? AND organisation_id = ?",
            (request_id, organisation_id),
        ).fetchone()
    if not row:
        return None
    return _row_to_request(row)


def seat_addon_unit_price_cents(conn, subscription: dict[str, Any]) -> int:
    plan_id = int(subscription["plan_id"])
    cycle = subscription.get("billing_cycle") or "annual"
    col = "additional_seat_annual_price_cents" if cycle == "annual" else "additional_seat_monthly_price_cents"
    if uses_postgres():
        row = conn.execute(
            f"SELECT {col} AS price FROM subscription_plans WHERE id = %s",
            (plan_id,),
        ).fetchone()
    else:
        row = conn.execute(
            f"SELECT {col} AS price FROM subscription_plans WHERE id = ?",
            (plan_id,),
        ).fetchone()
    if not row:
        return 0
    return int(_mapping(row).get("price") or 0)


def list_seat_requests_for_org(conn, organisation_id: int, *, limit: int = 20) -> list[dict[str, Any]]:
    q = """
        SELECT * FROM seat_requests
        WHERE organisation_id = ?
        ORDER BY id DESC
        LIMIT ?
    """
    if uses_postgres():
        q = q.replace("?", "%s")
        rows = conn.execute(q, (organisation_id, limit)).fetchall()
    else:
        rows = conn.execute(q, (organisation_id, limit)).fetchall()
    return [_row_to_request(r) for r in rows]


def list_seat_requests_platform(
    conn,
    *,
    status: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    if uses_postgres():
        if status:
            rows = conn.execute(
                """
                SELECT sr.*, o.name AS organisation_name
                FROM seat_requests sr
                JOIN organisations o ON o.id = sr.organisation_id
                WHERE sr.status = %s AND COALESCE(o.is_test, 0) = 0
                ORDER BY sr.id DESC
                LIMIT %s
                """,
                (status, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT sr.*, o.name AS organisation_name
                FROM seat_requests sr
                JOIN organisations o ON o.id = sr.organisation_id
                WHERE COALESCE(o.is_test, 0) = 0
                ORDER BY sr.id DESC
                LIMIT %s
                """,
                (limit,),
            ).fetchall()
    else:
        if status:
            rows = conn.execute(
                """
                SELECT sr.*, o.name AS organisation_name
                FROM seat_requests sr
                JOIN organisations o ON o.id = sr.organisation_id
                WHERE sr.status = ? AND COALESCE(o.is_test, 0) = 0
                ORDER BY sr.id DESC
                LIMIT ?
                """,
                (status, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT sr.*, o.name AS organisation_name
                FROM seat_requests sr
                JOIN organisations o ON o.id = sr.organisation_id
                WHERE COALESCE(o.is_test, 0) = 0
                ORDER BY sr.id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
    return [_row_to_request(r) for r in rows]


def _get_request(conn, request_id: int) -> dict[str, Any]:
    if uses_postgres():
        row = conn.execute("SELECT * FROM seat_requests WHERE id = %s", (request_id,)).fetchone()
    else:
        row = conn.execute("SELECT * FROM seat_requests WHERE id = ?", (request_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Seat request not found")
    return _row_to_request(row)


def create_seat_request(
    conn,
    *,
    organisation_id: int,
    requested_by_user_id: int,
    requested_seats: int = 1,
    seat_type: str = "operator",
    note: str = "",
) -> dict[str, Any]:
    if seat_type not in ("operator", "view_only"):
        seat_type = "operator"
    if requested_seats < 1 or requested_seats > 20:
        raise HTTPException(status_code=400, detail="requested_seats must be between 1 and 20")
    sub = get_active_subscription(conn, organisation_id)
    if not sub:
        raise HTTPException(status_code=400, detail="No active subscription for this organisation")

    pending_q = """
        SELECT id FROM seat_requests
        WHERE organisation_id = ? AND status IN ('pending_payment', 'paid')
        LIMIT 1
    """
    if uses_postgres():
        pending_q = pending_q.replace("?", "%s")
        pending = conn.execute(pending_q, (organisation_id,)).fetchone()
    else:
        pending = conn.execute(pending_q, (organisation_id,)).fetchone()
    if pending:
        raise HTTPException(
            status_code=409,
            detail="A seat request is already in progress. Wait for Tradeal to process it or cancel the pending request.",
        )

    unit = seat_addon_unit_price_cents(conn, sub)
    amount = unit * requested_seats
    now = _now()
    billing_cycle = sub.get("billing_cycle") or "annual"
    plan_name = sub.get("plan_name") or ""

    if uses_postgres():
        row = conn.execute(
            """
            INSERT INTO seat_requests
            (organisation_id, subscription_id, requested_seats, amount_cents, billing_cycle,
             plan_name, status, payment_reference, request_note, admin_note, seat_type,
             requested_by_user_id, reviewed_by_user_id, paid_at, approved_at, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, 'pending_payment', '', %s, '', %s, %s, NULL, NULL, NULL, %s, %s)
            RETURNING *
            """,
            (
                organisation_id,
                int(sub["id"]),
                requested_seats,
                amount,
                billing_cycle,
                plan_name,
                note.strip(),
                seat_type,
                requested_by_user_id,
                now,
                now,
            ),
        ).fetchone()
        req = _row_to_request(row)
    else:
        cur = conn.execute(
            """
            INSERT INTO seat_requests
            (organisation_id, subscription_id, requested_seats, amount_cents, billing_cycle,
             plan_name, status, payment_reference, request_note, admin_note, seat_type,
             requested_by_user_id, reviewed_by_user_id, paid_at, approved_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'pending_payment', '', ?, '', ?, ?, NULL, NULL, NULL, ?, ?)
            """,
            (
                organisation_id,
                int(sub["id"]),
                requested_seats,
                amount,
                billing_cycle,
                plan_name,
                note.strip(),
                seat_type,
                requested_by_user_id,
                now,
                now,
            ),
        )
        req = _get_request(conn, int(cur.lastrowid))

    append_audit_log(
        organisation_id=organisation_id,
        actor_user_id=requested_by_user_id,
        action="seat_request.created",
        entity_type="seat_request",
        entity_id=str(req["id"]),
        new_value={"requested_seats": requested_seats, "amount_cents": amount},
    )
    return req


def cancel_seat_request(conn, request_id: int, *, organisation_id: int, actor_user_id: int) -> dict[str, Any]:
    req = _get_request(conn, request_id)
    if int(req["organisation_id"]) != organisation_id:
        raise HTTPException(status_code=404, detail="Seat request not found")
    if req["status"] != "pending_payment":
        raise HTTPException(status_code=400, detail="Only pending requests can be cancelled")
    now = _now()
    if uses_postgres():
        conn.execute(
            "UPDATE seat_requests SET status = 'cancelled', updated_at = %s WHERE id = %s",
            (now, request_id),
        )
    else:
        conn.execute(
            "UPDATE seat_requests SET status = 'cancelled', updated_at = ? WHERE id = ?",
            (now, request_id),
        )
    append_audit_log(
        organisation_id=organisation_id,
        actor_user_id=actor_user_id,
        action="seat_request.cancelled",
        entity_type="seat_request",
        entity_id=str(request_id),
    )
    return _get_request(conn, request_id)


def mark_seat_request_paid(
    conn,
    request_id: int,
    *,
    actor_user_id: int,
    payment_reference: str = "",
) -> dict[str, Any]:
    req = _get_request(conn, request_id)
    if req["status"] != "pending_payment":
        raise HTTPException(status_code=400, detail="Only pending payment requests can be marked paid")
    now = _now()
    ref = payment_reference.strip()
    if uses_postgres():
        conn.execute(
            """
            UPDATE seat_requests
            SET status = 'paid', payment_reference = %s, paid_at = %s, updated_at = %s
            WHERE id = %s
            """,
            (ref, now, now, request_id),
        )
    else:
        conn.execute(
            """
            UPDATE seat_requests
            SET status = 'paid', payment_reference = ?, paid_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (ref, now, now, request_id),
        )
    append_audit_log(
        organisation_id=int(req["organisation_id"]),
        actor_user_id=actor_user_id,
        action="seat_request.paid",
        entity_type="seat_request",
        entity_id=str(request_id),
        new_value={"payment_reference": ref},
    )
    return _get_request(conn, request_id)


def _notify_requester_of_decision(
    conn,
    req: dict[str, Any],
    *,
    decision: str,
    actor_user_id: int,
    admin_note: str,
) -> None:
    """Inbox notice to the org user who requested seats."""
    from .notifications_repository import create_notifications_for_audience

    recipient_id = req.get("requested_by_user_id")
    if recipient_id is None:
        return
    seats = int(req.get("requested_seats") or 1)
    seat_word = "seat" if seats == 1 else "seats"
    seat_type = str(req.get("seat_type") or "operator")
    amount_cents = int(req.get("amount_cents") or 0)
    ref = (req.get("payment_reference") or "").strip()
    if decision == "approved":
        title = f"Seat request approved · {seats} {seat_word}"
        body = admin_note.strip() or (
            f"Your request for {seats} {seat_word} was approved. Assign them under Settings → Plan & team."
        )
    else:
        title = f"Seat request rejected · {seats} {seat_word}"
        body = admin_note.strip() or (
            f"Your request for {seats} {seat_word} was rejected. Open Settings → Plan & team for details."
        )
    payload: dict[str, str] = {
        "seat_request_id": str(req["id"]),
        "decision": decision,
        "status": decision,
        "requested_seats": str(seats),
        "seat_type": seat_type,
        "amount_cents": str(amount_cents),
    }
    if ref:
        payload["payment_reference"] = ref
    create_notifications_for_audience(
        conn,
        audience="user",
        organisation_id=int(req["organisation_id"]),
        recipient_user_id=int(recipient_id),
        recipient_scope="all_users",
        exclude_expired_amc=False,
        kind="seat_request",
        title=title,
        body=body,
        payload=payload,
        href="/settings/plan",
        actor_user_id=actor_user_id,
    )


def approve_seat_request(
    conn,
    request_id: int,
    *,
    actor_user_id: int,
    payment_reference: str = "",
    admin_note: str = "",
) -> dict[str, Any]:
    req = _get_request(conn, request_id)
    if req["status"] not in ("pending_payment", "paid"):
        raise HTTPException(
            status_code=400,
            detail="Only open seat requests can be approved (after off-platform payment is received)",
        )
    ref = payment_reference.strip() or (req.get("payment_reference") or "").strip()
    note = admin_note.strip()
    if not ref:
        raise HTTPException(status_code=400, detail="Payment reference is required to approve")
    if not note:
        raise HTTPException(status_code=400, detail="A message to the organisation is required to approve")
    org_id = int(req["organisation_id"])
    count = int(req["requested_seats"])
    seat_type = req.get("seat_type") or "operator"
    if seat_type not in ("operator", "view_only"):
        seat_type = "operator"
    seats = add_purchased_seat(
        conn,
        org_id,
        actor_user_id=actor_user_id,
        count=count,
        seat_type=seat_type,
    )
    now = _now()
    if uses_postgres():
        conn.execute(
            """
            UPDATE seat_requests
            SET status = 'approved',
                payment_reference = %s,
                admin_note = %s,
                paid_at = COALESCE(paid_at, %s),
                reviewed_by_user_id = %s,
                approved_at = %s,
                updated_at = %s
            WHERE id = %s
            """,
            (ref, note, now, actor_user_id, now, now, request_id),
        )
    else:
        conn.execute(
            """
            UPDATE seat_requests
            SET status = 'approved',
                payment_reference = ?,
                admin_note = ?,
                paid_at = COALESCE(paid_at, ?),
                reviewed_by_user_id = ?,
                approved_at = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (ref, note, now, actor_user_id, now, now, request_id),
        )
    append_audit_log(
        organisation_id=org_id,
        actor_user_id=actor_user_id,
        action="seat_request.approved",
        entity_type="seat_request",
        entity_id=str(request_id),
        new_value={
            "seats_added": count,
            "seat_summary": seats,
            "payment_reference": ref,
            "admin_note": note,
        },
    )
    updated = _get_request(conn, request_id)
    _notify_requester_of_decision(
        conn,
        updated,
        decision="approved",
        actor_user_id=actor_user_id,
        admin_note=note,
    )
    return {"request": updated, "seats": seats}


def count_open_seat_requests(conn) -> int:
    """Requests waiting for platform action (org submitted; payment is off-platform)."""
    row = conn.execute(
        "SELECT COUNT(*) AS n FROM seat_requests WHERE status IN ('pending_payment', 'paid')"
    ).fetchone()
    return int(_mapping(row).get("n") or 0)


def reject_seat_request(
    conn,
    request_id: int,
    *,
    actor_user_id: int,
    admin_note: str = "",
) -> dict[str, Any]:
    req = _get_request(conn, request_id)
    if req["status"] not in ("pending_payment", "paid"):
        raise HTTPException(status_code=400, detail="This request can no longer be rejected")
    now = _now()
    note = admin_note.strip()
    if uses_postgres():
        conn.execute(
            """
            UPDATE seat_requests
            SET status = 'rejected', admin_note = %s, reviewed_by_user_id = %s, updated_at = %s
            WHERE id = %s
            """,
            (note, actor_user_id, now, request_id),
        )
    else:
        conn.execute(
            """
            UPDATE seat_requests
            SET status = 'rejected', admin_note = ?, reviewed_by_user_id = ?, updated_at = ?
            WHERE id = ?
            """,
            (note, actor_user_id, now, request_id),
        )
    append_audit_log(
        organisation_id=int(req["organisation_id"]),
        actor_user_id=actor_user_id,
        action="seat_request.rejected",
        entity_type="seat_request",
        entity_id=str(request_id),
        new_value={"admin_note": note},
    )
    updated = _get_request(conn, request_id)
    _notify_requester_of_decision(
        conn,
        updated,
        decision="rejected",
        actor_user_id=actor_user_id,
        admin_note=note,
    )
    return updated


def organisation_seat_request_context(conn, organisation_id: int) -> dict[str, Any]:
    sub = get_active_subscription(conn, organisation_id)
    if not sub:
        return {
            "subscription": None,
            "addon_seat_unit_price_cents": 0,
            "billing_cycle": None,
            "requests": [],
        }
    unit = seat_addon_unit_price_cents(conn, sub)
    return {
        "subscription": sub,
        "addon_seat_unit_price_cents": unit,
        "billing_cycle": sub.get("billing_cycle"),
        "plan_name": sub.get("plan_name"),
        "requests": list_seat_requests_for_org(conn, organisation_id),
    }
