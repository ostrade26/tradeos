"""Unified in-app inbox — Received (to me) and Sent (outbox).

Received: user_notifications for the signed-in user, plus platform work queues for
Tradeal admins (seat/product/feature requests). Bell badges Received only.

Sent: notification_sends for the actor (plus system sends for platform admins),
and org users' product requests to Tradeal.
"""

from __future__ import annotations

from typing import Any, Literal

from .notifications_repository import (
    list_notification_sends_for_actor,
    list_notifications_for_user,
    mark_all_read_for_user,
    mark_notification_read,
)
from .product_request_repository import list_product_requests_for_user, list_product_requests_platform
from .seat_request_repository import list_seat_requests_platform

FilterKind = Literal["open", "all"]
BoxKind = Literal["received", "sent"]

OPEN_SEAT_STATUSES = frozenset({"pending_payment", "paid"})
OPEN_PRODUCT_STATUSES = frozenset({"received"})

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
    send: dict[str, Any] | None = None,
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
        "send": send,
    }


def _is_review_interest_notice(notice: dict[str, Any]) -> bool:
    """Legacy duplicate of feature_interest work items — hide from inbox."""
    payload = notice.get("payload") or {}
    return str(payload.get("cta") or "") == "review_interest"


def _notice_items(conn, user_id: int, limit: int) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for n in list_notifications_for_user(conn, user_id, limit=limit):
        if _is_review_interest_notice(n):
            continue
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
                href=f"/platform-admin/add-ons?tab=access&interestId={row['id']}",
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


def _audience_subtitle(send: dict[str, Any]) -> str:
    audience = str(send.get("audience") or "")
    scope = str(send.get("recipient_scope") or "")
    sent = int(send.get("sent_count") or 0)
    if audience == "active_licences":
        base = "All active licences"
    elif audience == "org":
        base = "One organisation"
    elif audience == "user":
        base = "One user"
    elif audience == "platform_admins":
        base = "Platform admins"
    else:
        base = audience.replace("_", " ").title() or "Recipients"
    who = ""
    if audience not in ("user", "platform_admins"):
        if scope == "org_admin":
            who = " · org admins"
        elif scope == "all_users":
            who = " · all licensed users"
    people = f"{sent} {'person' if sent == 1 else 'people'}"
    return f"{base}{who} · {people}"


def _send_items(conn, user_id: int, role_slug: str, limit: int) -> list[dict[str, Any]]:
    include_system = role_slug == "platform_admin"
    out: list[dict[str, Any]] = []
    for row in list_notification_sends_for_actor(
        conn,
        actor_user_id=user_id,
        include_system=include_system,
        limit=limit,
    ):
        actor = row.get("actor_user_id")
        from_label = "Tradeal system" if actor is None else "You"
        source = str(row.get("source") or "manual")
        if source == "schedule":
            from_label = "Tradeal system"
        out.append(
            _inbox_item(
                item_id=f"send-{row['id']}",
                kind=str(row.get("kind") or "notice"),
                category="sent",
                status="done",
                unread=False,
                title=str(row.get("title") or ""),
                subtitle=_audience_subtitle(row),
                from_label=from_label,
                date_iso=str(row.get("created_at") or ""),
                actionable=False,
                href=str(row.get("href") or ""),
                send=row,
            )
        )
    return out


def _org_sent_product_items(
    conn,
    *,
    organisation_id: int,
    user_id: int,
    limit: int,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for row in list_product_requests_for_user(conn, organisation_id, user_id, limit=limit):
        kind = _KIND_LABEL.get(str(row.get("kind") or ""), "Request")
        pri = _PRIORITY_SHORT.get(str(row.get("priority") or "p3"), "P3")
        status = str(row.get("status") or "received")
        snippet = " ".join(str(row.get("message") or "").split())[:120]
        out.append(
            _inbox_item(
                item_id=f"sent-product-request-{row['id']}",
                kind="product_request",
                category="sent",
                status="done",
                unread=False,
                title=f"{pri} {kind}",
                subtitle=f"To Tradeal · {status.replace('_', ' ')} · {snippet}",
                from_label="You",
                date_iso=str(row.get("created_at") or ""),
                actionable=False,
                product_request=row,
            )
        )
    return out


def _sort_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def key(item: dict[str, Any]) -> str:
        return str(item.get("date_iso") or "")

    return sorted(items, key=key, reverse=True)


NOTICE_INBOX_LIMIT = 30


def list_inbox_for_session(
    conn,
    *,
    user_id: int,
    role_slug: str,
    organisation_id: int | None = None,
    filter_kind: FilterKind = "all",
    box: BoxKind = "received",
    limit: int = 100,
) -> list[dict[str, Any]]:
    if box == "sent":
        items: list[dict[str, Any]] = []
        if role_slug == "platform_admin":
            items.extend(_send_items(conn, user_id, role_slug, limit=limit))
        elif organisation_id:
            items.extend(
                _org_sent_product_items(
                    conn,
                    organisation_id=int(organisation_id),
                    user_id=user_id,
                    limit=limit,
                )
            )
            items.extend(_send_items(conn, user_id, role_slug, limit=limit))
        else:
            items.extend(_send_items(conn, user_id, role_slug, limit=limit))
        return _sort_items(items)[:limit]

    items = []
    items.extend(_notice_items(conn, user_id, limit=min(limit, NOTICE_INBOX_LIMIT)))
    if role_slug == "platform_admin":
        items.extend(_seat_items(conn, limit))
        items.extend(_product_items(conn, limit))
        items.extend(_feature_interest_items(conn, limit))
    items = _sort_items(items)[:limit]
    if filter_kind == "open":
        items = [i for i in items if i.get("status") == "open"]
    return items


def inbox_notice_unread(conn, user_id: int) -> int:
    return sum(
        1
        for n in list_notifications_for_user(conn, user_id, limit=200)
        if n.get("unread") and not _is_review_interest_notice(n)
    )


def inbox_work_open_count(
    conn,
    role_slug: str,
    organisation_id: int | None,
) -> int:
    _ = organisation_id
    if role_slug == "platform_admin":
        from .feature_interests_repository import count_open_interests_platform

        seats = list_seat_requests_platform(conn, limit=500)
        products = list_product_requests_platform(conn, limit=500)
        return (
            sum(1 for s in seats if _seat_open(str(s.get("status") or "")))
            + sum(1 for p in products if _product_open(str(p.get("status") or "")))
            + count_open_interests_platform(conn)
        )
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
    """Bell badge — Received only (unread notices; platform admins + open work)."""
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
