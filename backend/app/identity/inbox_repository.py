"""Unified in-app inbox — notices plus platform work items."""

from __future__ import annotations

from typing import Any, Literal

from .notifications_repository import (
    list_notifications_for_user,
    mark_all_read_for_user,
    mark_notification_read,
    unread_count_for_user,
)
from .product_request_repository import list_product_requests_platform
from .seat_request_repository import list_seat_requests_platform

FilterKind = Literal["open", "all"]

OPEN_SEAT_STATUSES = frozenset({"pending_payment", "paid"})
OPEN_PRODUCT_STATUSES = frozenset({"received"})
OPEN_FEATURE_INTEREST_STATUS = "interested"

_KIND_LABEL = {"issue": "Issue", "improvement": "Improvement", "requirement": "New need"}
_PRIORITY_SHORT = {"p1": "P1", "p2": "P2", "p3": "P3"}


def _seat_open(status: str) -> bool:
    return (status or "").strip().lower() in OPEN_SEAT_STATUSES


def _product_open(status: str) -> bool:
    return (status or "").strip().lower() in OPEN_PRODUCT_STATUSES


def _inbox_item(
    *,
    item_id: str,
    kind: str,
    category: str,
    status: str,
    unread: bool,
    title: str,
    subtitle: str,
    from_label: str,
    date_iso: str,
    actionable: bool,
    href: str = "",
    notice: dict[str, Any] | None = None,
    seat_request: dict[str, Any] | None = None,
    product_request: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "id": item_id,
        "kind": kind,
        "category": category,
        "status": status,
        "unread": unread,
        "title": title,
        "subtitle": subtitle,
        "from": from_label,
        "date_iso": date_iso,
        "href": href,
        "actionable": actionable,
        "notice": notice,
        "seat_request": seat_request,
        "product_request": product_request,
    }


def _notice_items(conn, user_id: int, limit: int) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for n in list_notifications_for_user(conn, user_id, limit=limit):
        unread = bool(n.get("unread"))
        out.append(
            _inbox_item(
                item_id=f"notice-{n['id']}",
                kind=str(n.get("kind") or "notice"),
                category="notice",
                status="open" if unread else "done",
                unread=unread,
                title=str(n.get("title") or ""),
                subtitle=str(n.get("body") or "")[:240],
                from_label="Tradeal",
                date_iso=str(n.get("created_at") or ""),
                actionable=unread,
                href=str(n.get("href") or ""),
                notice=n,
            )
        )
    return out


def _seat_items(conn, limit: int) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for row in list_seat_requests_platform(conn, limit=limit):
        org = (row.get("organisation_name") or f"Organisation #{row.get('organisation_id')}").strip()
        seats = int(row.get("requested_seats") or 1)
        open_ = _seat_open(str(row.get("status") or ""))
        seat_type = str(row.get("seat_type") or "operator").replace("_", " ")
        amount = int(row.get("amount_cents") or 0)
        amount_bit = f" · ₹{amount // 100:,}" if amount > 0 else ""
        out.append(
            _inbox_item(
                item_id=f"seat-request-{row['id']}",
                kind="seat_request",
                category="work",
                status="open" if open_ else "done",
                unread=open_,
                title=f"{org} · {seats} {'seat' if seats == 1 else 'seats'}",
                subtitle=f"{seat_type.title()}{amount_bit}",
                from_label=org,
                date_iso=str(row.get("created_at") or ""),
                actionable=open_,
                seat_request=row,
            )
        )
    return out


def _feature_interest_items(conn, limit: int) -> list[dict[str, Any]]:
    from .feature_interests_repository import list_open_interests_platform

    out: list[dict[str, Any]] = []
    for row in list_open_interests_platform(conn, limit=limit):
        org = (row.get("organisation_name") or f"Organisation #{row.get('organisation_id')}").strip()
        title = str(row.get("feature_title") or row.get("feature_key") or "Feature")
        who = (row.get("requested_by_name") or row.get("requested_by_username") or "A user").strip()
        out.append(
            _inbox_item(
                item_id=f"feature-interest-{row['id']}",
                kind="feature_interest",
                category="work",
                status="open",
                unread=True,
                title=f"{org} · {title}",
                subtitle=f"{who} requested access",
                from_label=org,
                date_iso=str(row.get("created_at") or ""),
                actionable=True,
                href=f"/platform-admin/feature-interests?interestId={row['id']}",
            )
        )
    return out


def _product_items(conn, limit: int) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for row in list_product_requests_platform(conn, limit=limit):
        org = (row.get("organisation_name") or f"Organisation #{row.get('organisation_id')}").strip()
        who = (row.get("requested_by_name") or row.get("requested_by_username") or "A user").strip()
        kind = _KIND_LABEL.get(str(row.get("kind") or ""), "Request")
        pri = _PRIORITY_SHORT.get(str(row.get("priority") or "p3"), "P3")
        snippet = " ".join(str(row.get("message") or "").split())[:90]
        open_ = _product_open(str(row.get("status") or ""))
        out.append(
            _inbox_item(
                item_id=f"product-request-{row['id']}",
                kind="product_request",
                category="work",
                status="open" if open_ else "done",
                unread=open_,
                title=f"{org} · {pri} {kind}",
                subtitle=f"{who} · {snippet}",
                from_label=org,
                date_iso=str(row.get("created_at") or ""),
                actionable=open_,
                product_request=row,
            )
        )
    return out


def _sort_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def key(item: dict[str, Any]) -> str:
        return str(item.get("date_iso") or "")

    return sorted(items, key=key, reverse=True)


def _trade_items(organisation_id: int) -> list[dict[str, Any]]:
    from ..db import get_state
    from ..trade.action_inbox import build_trade_inbox_items
    from ..trade.loader import apply_lift_totals, load_and_normalize

    # Reconcile order lifted/committed qty from lift rows (incl. newly delivered).
    state = apply_lift_totals(load_and_normalize(get_state(organisation_id)))
    return build_trade_inbox_items(state)


NOTICE_INBOX_LIMIT = 30


def list_inbox_for_session(
    conn,
    *,
    user_id: int,
    role_slug: str,
    organisation_id: int | None = None,
    filter_kind: FilterKind = "all",
    limit: int = 100,
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    items.extend(_notice_items(conn, user_id, limit=min(limit, NOTICE_INBOX_LIMIT)))
    if role_slug == "platform_admin":
        items.extend(_seat_items(conn, limit))
        items.extend(_product_items(conn, limit))
        items.extend(_feature_interest_items(conn, limit))
    elif organisation_id is not None:
        items.extend(_trade_items(organisation_id))
    items = _sort_items(items)[:limit]
    if filter_kind == "open":
        items = [i for i in items if i.get("status") == "open"]
    return items


def inbox_notice_unread(conn, user_id: int) -> int:
    return unread_count_for_user(conn, user_id)


def inbox_work_open_count(
    conn,
    role_slug: str,
    organisation_id: int | None,
) -> int:
    if role_slug == "platform_admin":
        from .feature_interests_repository import count_open_interests_platform

        seats = list_seat_requests_platform(conn, limit=500)
        products = list_product_requests_platform(conn, limit=500)
        return (
            sum(1 for s in seats if _seat_open(str(s.get("status") or "")))
            + sum(1 for p in products if _product_open(str(p.get("status") or "")))
            + count_open_interests_platform(conn)
        )
    if organisation_id is not None:
        return len(_trade_items(organisation_id))
    return 0


def inbox_open_count(
    conn,
    user_id: int,
    role_slug: str,
    organisation_id: int | None = None,
) -> int:
    return inbox_notice_unread(conn, user_id) + inbox_work_open_count(
        conn, role_slug, organisation_id
    )


def inbox_bell_count(
    conn,
    user_id: int,
    role_slug: str,
    organisation_id: int | None = None,
) -> int:
    """Bell badge — unread Tradeal notices; platform admins also see open seat/product work."""
    count = inbox_notice_unread(conn, user_id)
    if role_slug == "platform_admin":
        count += inbox_work_open_count(conn, role_slug, organisation_id)
    return count


def parse_inbox_item_id(item_id: str) -> tuple[str, int] | None:
    raw = (item_id or "").strip()
    if raw.startswith("notice-"):
        try:
            return ("notice", int(raw.split("-", 1)[1]))
        except ValueError:
            return None
    return None


def mark_inbox_item_read(conn, item_id: str, user_id: int) -> dict[str, Any] | None:
    parsed = parse_inbox_item_id(item_id)
    if not parsed:
        return None
    kind, pk = parsed
    if kind == "notice":
        return mark_notification_read(conn, pk, user_id)
    return None


def mark_all_inbox_notices_read(conn, user_id: int) -> int:
    return mark_all_read_for_user(conn, user_id)
