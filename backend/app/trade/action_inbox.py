"""Trade register work items for the unified org inbox (mirrors frontend buildActionInbox)."""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import quote

from .buy_back import effective_po_qty
from .helpers import format_deletion_date, format_qty, round_qty_mt
from .lift_logic import get_lift_allocations
from .loader import get_sos_for_po

STOCK_LIFT_LABEL = "Own stock"
_URGENCY_RANK = {"high": 0, "medium": 1, "low": 2}


def _ref_core(ref: str | int) -> str:
    return re.sub(r"^(PO|SO|LT)[-#\s]*", "", str(ref).strip(), flags=re.IGNORECASE)


def _format_po_ref(ref: str | int) -> str:
    core = _ref_core(ref)
    return f"PO{core}" if core else ""


def _format_so_ref(ref: str | int) -> str:
    core = _ref_core(ref)
    return f"SO{core}" if core else ""


def _format_lift_ref(ref: str | int) -> str:
    core = _ref_core(ref)
    return f"LT{core}" if core else ""


def _to_be_lifted(order: dict[str, Any]) -> float:
    lifted = float(order.get("liftedQty") or 0)
    committed = float(order.get("committedLiftQty") if order.get("committedLiftQty") is not None else lifted)
    if order.get("side") == "purchase":
        cap = effective_po_qty(order)
    else:
        cap = float(order.get("orderQty") or 0)
    return round_qty_mt(max(0.0, cap - committed))


def _format_allocations_summary(allocations: list[dict], stock_lift: bool = False) -> str:
    if stock_lift:
        return STOCK_LIFT_LABEL
    pos = list(dict.fromkeys(a["poRef"] for a in allocations))
    sos = list(dict.fromkeys(a["soRef"] for a in allocations if a.get("soRef")))
    po_labels = [_format_po_ref(p) for p in pos]
    so_labels = [_format_so_ref(s) for s in sos]
    if len(po_labels) == 1 and len(so_labels) == 1:
        return f"{po_labels[0]} → {so_labels[0]}"
    return f"{', '.join(so_labels)} · {', '.join(po_labels)}"


def _format_lift_order_summary(lift: dict[str, Any]) -> str:
    return _format_allocations_summary(get_lift_allocations(lift), bool(lift.get("stockLift")))


def _work_item(
    *,
    item_id: str,
    kind: str,
    title: str,
    subtitle: str,
    href: str,
    date_iso: str = "",
    urgency: str = "medium",
) -> dict[str, Any]:
    return {
        "id": item_id,
        "kind": kind,
        "category": "work",
        "status": "open",
        "unread": False,
        "title": title,
        "subtitle": subtitle,
        "from": "Tradeal",
        "date_iso": date_iso,
        "href": href,
        "actionable": True,
        "notice": None,
        "seat_request": None,
        "product_request": None,
        "_urgency": urgency,
    }


def build_trade_inbox_items(state: dict[str, Any]) -> list[dict[str, Any]]:
    orders: list[dict[str, Any]] = list(state.get("tradeOrders") or [])
    lifts: list[dict[str, Any]] = list(state.get("lifts") or [])
    lots: list[dict[str, Any]] = list(state.get("lots") or [])

    actions: list[dict[str, Any]] = []

    po_pending = [
        o for o in orders if o.get("side") == "purchase" and o.get("status") not in ("completed", "cancelled")
    ]
    so_pending = [
        o for o in orders if o.get("side") == "sale" and o.get("status") not in ("completed", "cancelled")
    ]

    for po in po_pending:
        pending = _to_be_lifted(po)
        if pending <= 0:
            continue
        linked = get_sos_for_po(orders, po["ref"])
        stock_q = "&stock=1" if not linked else ""
        actions.append(
            _work_item(
                item_id=f"po-lift-{po['id']}",
                kind="po_lift",
                title=f"Ready to lift {po['ref']}",
                subtitle=f"{format_qty(pending)} unlifted · {po.get('itemName', '')} · {po.get('partyName', '')}",
                href=f"/lifts/new?poRef={quote(str(po['ref']))}{stock_q}",
                date_iso=str(po.get("date") or ""),
                urgency="high" if po.get("status") == "partial" else "medium",
            )
        )

    for so in so_pending:
        pending = _to_be_lifted(so)
        if pending <= 0:
            continue
        po_ref = so.get("poRef")
        if po_ref:
            href = f"/lifts/new?poRef={quote(str(po_ref))}&soRef={quote(str(so['ref']))}"
            subtitle = f"{so.get('itemName', '')} · {so.get('partyName', '')} · against {po_ref}"
            urgency = "medium"
        else:
            href = f"/sales-orders?ref={quote(str(so['ref']))}"
            subtitle = f"{so.get('itemName', '')} · {so.get('partyName', '')} · no PO linked"
            urgency = "high"
        actions.append(
            _work_item(
                item_id=f"so-lift-{so['id']}",
                kind="so_lift",
                title=f"Ready to lift {so['ref']}",
                subtitle=subtitle,
                href=href,
                date_iso=str(so.get("date") or ""),
                urgency=urgency,
            )
        )

    for so in orders:
        if so.get("side") != "sale":
            continue
        if so.get("poRef"):
            continue
        if so.get("status") in ("completed", "cancelled"):
            continue
        actions.append(
            _work_item(
                item_id=f"unlink-{so['id']}",
                kind="unlinked_so",
                title=f"Link {so['ref']} to a PO",
                subtitle=f"{format_qty(float(so.get('orderQty') or 0))} {so.get('itemName', '')} · {so.get('partyName', '')}",
                href=f"/sales-orders/{quote(str(so['ref']))}/edit",
                date_iso=str(so.get("date") or ""),
                urgency="medium",
            )
        )

    for lot in lots:
        available = float(lot.get("available") if lot.get("available") is not None else 0)
        if available >= 20 or available < 0:
            continue
        actions.append(
            _work_item(
                item_id=f"low-{lot['id']}",
                kind="low_stock",
                title=f"Low stock — {lot.get('lotNumber', lot.get('id', ''))}",
                subtitle=f"{format_qty(available)} available · {lot.get('commodity', '')}",
                href=f"/inventory/{quote(str(lot['id']))}",
                date_iso=str(lot.get("purchaseDate") or ""),
                urgency="high" if available == 0 else "low",
            )
        )

    for order in orders:
        scheduled = order.get("deleteScheduledAt")
        if not scheduled:
            continue
        side = order.get("side")
        ref = str(order.get("ref") or "")
        if side == "purchase":
            href = f"/purchase-orders/{quote(ref)}/edit"
        else:
            href = f"/sales-orders/{quote(ref)}/edit"
        actions.append(
            _work_item(
                item_id=f"del-{order['id']}",
                kind="deletion",
                title=f"{ref} scheduled for deletion",
                subtitle=f"Deletes on {format_deletion_date(str(scheduled))}",
                href=href,
                date_iso=str(scheduled),
                urgency="high",
            )
        )

    for lift in lifts:
        if lift.get("status") != "pending":
            continue
        lift_ref = lift.get("liftRef", "")
        actions.append(
            _work_item(
                item_id=f"lift-{lift['id']}",
                kind="delivery",
                title=f"{_format_lift_ref(lift_ref)} in transit",
                subtitle=f"{_format_lift_order_summary(lift)} · {format_qty(float(lift.get('liftedQty') or 0))}",
                href=f"/lifts?ref={quote(str(lift_ref))}",
                date_iso=str(lift.get("date") or ""),
                urgency="medium",
            )
        )

    def sort_key(item: dict[str, Any]) -> tuple[int, str]:
        rank = _URGENCY_RANK.get(str(item.get("_urgency", "medium")), 1)
        return (rank, str(item.get("date_iso") or ""))

    actions.sort(key=sort_key)
    for item in actions:
        item.pop("_urgency", None)
    return actions[:12]


def count_trade_inbox_open(state: dict[str, Any]) -> int:
    return len(build_trade_inbox_items(state))
