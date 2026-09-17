"""Platform Needs attention inbox (status-based, not localStorage).

v1 includes open seat requests. Product requests (org → Tradeal) are not a
backend entity yet; when they exist, add them here so the header badge stays
a single server-derived unread count.
"""

from __future__ import annotations

from typing import Any

from .seat_request_repository import count_open_seat_requests, list_seat_requests_platform


def _format_inr_cents(cents: int | None) -> str:
    if cents is None or int(cents) <= 0:
        return "—"
    rupees = int(cents) / 100
    return f"₹{rupees:,.0f}"


def _seat_request_item(row: dict[str, Any]) -> dict[str, Any]:
    org = str(row.get("organisation_name") or "").strip() or f"Organisation #{row['organisation_id']}"
    seats = int(row.get("requested_seats") or 0)
    amount = _format_inr_cents(row.get("amount_cents"))
    seat_word = "seat" if seats == 1 else "seats"
    return {
        "id": f"seat-request-{row['id']}",
        "kind": "seat_request",
        "title": f"{org} requested {seats} {seat_word}",
        "subtitle": f"{amount} · Approve after payment received",
        "href": f"/platform-admin/seat-requests?highlight={row['id']}",
        "urgency": "high",
        "created_at": row.get("created_at"),
        "entity_id": int(row["id"]),
        "amount_cents": int(row.get("amount_cents") or 0),
    }


def list_platform_action_items(conn) -> list[dict[str, Any]]:
    pending = list_seat_requests_platform(conn, status="pending_payment", limit=50)
    paid = list_seat_requests_platform(conn, status="paid", limit=50)
    open_requests = sorted(
        pending + paid,
        key=lambda r: r.get("created_at") or "",
        reverse=True,
    )
    return [_seat_request_item(r) for r in open_requests]


def platform_action_inbox(conn) -> dict[str, Any]:
    items = list_platform_action_items(conn)
    seat_count = count_open_seat_requests(conn)
    return {
        "unread": seat_count,
        "items": items,
        "counts": {
            "seat_request": seat_count,
            "product_request": 0,
        },
    }
