"""Lift allocations, tankers, balances, and seller pool validation."""

from __future__ import annotations

import re
from typing import Any

from .helpers import format_qty, normalize_company_name, round_qty_mt

TANKER_CAPACITY_MT = 55


def format_tanker_no(raw: str) -> str:
    rest = re.sub(r"[^A-Z0-9]", "", raw.upper())

    def take(pattern: str, max_len: int) -> str:
        nonlocal rest
        match = re.match(pattern, rest)
        chunk = (match.group(0) if match else "")[:max_len]
        rest = rest[len(chunk) :]
        return chunk

    parts = [
        p
        for p in [
            take(r"^[A-Z]+", 2),
            take(r"^\d+", 2),
            take(r"^[A-Z]+", 2),
            take(r"^\d+", 4),
        ]
        if p
    ]
    return "-".join(parts)


def normalize_lift_tankers(tankers: list[dict]) -> list[dict]:
    result = []
    for t in tankers:
        qty = t.get("actualQtyMt")
        result.append(
            {
                "tankerNo": format_tanker_no(t.get("tankerNo", "")),
                "transportName": (t.get("transportName") or "").strip(),
                "driverMobile": (t.get("driverMobile") or "").strip(),
                "lrNo": (t.get("lrNo") or "").strip().upper(),
                "actualQtyMt": round_qty_mt(qty) if qty is not None else None,
            }
        )
    return result


def resolve_lift_qty(tankers: list[dict]) -> float:
    return round_qty_mt(sum(t.get("actualQtyMt") or 0 for t in tankers))


def get_lift_allocations(lift: dict) -> list[dict]:
    allocations = lift.get("allocations") or []
    if allocations:
        return [
            {
                "poRef": a["poRef"],
                **({"soRef": a["soRef"]} if a.get("soRef") else {}),
                "qtyMt": round_qty_mt(a["qtyMt"]),
            }
            for a in allocations
        ]
    return [
        {
            "poRef": lift["poRef"],
            **({"soRef": lift["soRef"]} if lift.get("soRef") else {}),
            "qtyMt": round_qty_mt(lift.get("liftedQty", 0)),
        }
    ]


def lift_touches_ref(lift: dict, ref: str) -> bool:
    return any(
        a["poRef"] == ref or (a.get("soRef") and a["soRef"] == ref)
        for a in get_lift_allocations(lift)
    )


def allocation_total(allocations: list[dict]) -> float:
    return round_qty_mt(sum(a["qtyMt"] for a in allocations))


def qty_committed_on_ref(lifts: list[dict], ref: str, exclude_lift_id: str | None = None) -> float:
    total = 0.0
    for lift in lifts:
        if lift.get("id") == exclude_lift_id:
            continue
        for a in get_lift_allocations(lift):
            if a["poRef"] == ref or (a.get("soRef") and a["soRef"] == ref):
                total += a["qtyMt"]
    return round_qty_mt(total)


def remaining_on_order(order: dict, lifts: list[dict], exclude_lift_id: str | None = None) -> float:
    remaining = order["orderQty"] - qty_committed_on_ref(lifts, order["ref"], exclude_lift_id)
    return round_qty_mt(max(0, remaining))


def scale_allocations(allocations: list[dict], next_total: float) -> list[dict]:
    current = allocation_total(allocations)
    if current <= 0:
        return allocations
    target = round_qty_mt(next_total)
    if target == current:
        return [{**a, "qtyMt": round_qty_mt(a["qtyMt"])} for a in allocations]

    scaled = [{**a, "qtyMt": round_qty_mt(a["qtyMt"] * (target / current))} for a in allocations]
    drift = round_qty_mt(target - allocation_total(scaled))
    if drift != 0 and scaled:
        last = scaled[-1]
        scaled[-1] = {**last, "qtyMt": round_qty_mt(last["qtyMt"] + drift)}
    return scaled


def allocation_actual_key(a: dict) -> str:
    return a.get("soRef") or f"stock:{a['poRef']}"


def apply_allocation_actuals(planned: list[dict], actual_by_key: dict[str, float]) -> list[dict]:
    return [
        {**a, "qtyMt": round_qty_mt(actual_by_key.get(allocation_actual_key(a), 0))}
        for a in planned
    ]


def validate_allocation_actuals(planned: list[dict], actual_by_key: dict[str, float]) -> str | None:
    for a in planned:
        key = allocation_actual_key(a)
        qty = actual_by_key.get(key)
        label = a.get("soRef") or "Own stock"
        if qty is None or not isinstance(qty, (int, float)) or qty <= 0:
            return f"Enter actual quantity for {label}"
    return None


def unique_party_names(names: list[str]) -> str:
    seen: list[str] = []
    for n in names:
        trimmed = n.strip()
        if trimmed and trimmed not in seen:
            seen.append(trimmed)
    return ", ".join(seen)


def format_allocations_summary(allocations: list[dict], stock_lift: bool = False) -> str:
    pos = list(dict.fromkeys(a["poRef"] for a in allocations))
    sos = list(dict.fromkeys(a["soRef"] for a in allocations if a.get("soRef")))
    if stock_lift or not sos:
        return f"{pos[0]} → Own stock" if len(pos) == 1 else f"{', '.join(pos)} → Own stock"
    if len(pos) == 1 and len(sos) == 1:
        return f"{pos[0]} → {sos[0]}"
    return f"{', '.join(sos)} · {', '.join(pos)}"


def _seller_identity(po: dict) -> tuple[str, str]:
    return (
        (po.get("sellerCompanyId") or po.get("partyCompanyId") or "").strip(),
        normalize_company_name(po.get("sellerName") or po.get("partyName") or ""),
    )


def same_seller_item_pool(a: dict, b: dict) -> bool:
    if a.get("side") != "purchase" or b.get("side") != "purchase":
        return False
    if a.get("itemName") != b.get("itemName"):
        return False
    ia_id, ia_name = _seller_identity(a)
    ib_id, ib_name = _seller_identity(b)
    if ia_id and ib_id:
        return ia_id == ib_id
    if ia_name and ib_name:
        return ia_name == ib_name
    return False


def _linked_purchase_order(so: dict, orders: list[dict]) -> dict | None:
    po_ref = so.get("poRef")
    if not po_ref:
        return None
    return next((o for o in orders if o.get("ref") == po_ref and o.get("side") == "purchase"), None)


def can_lift_so_against_po(so: dict, po: dict, orders: list[dict]) -> bool:
    if so.get("side") != "sale" or po.get("side") != "purchase":
        return False
    if so.get("status") in ("completed", "cancelled"):
        return False
    if po.get("status") in ("completed", "cancelled"):
        return False
    if so.get("itemName") != po.get("itemName"):
        return False
    if not so.get("poRef") or so.get("poRef") == po.get("ref"):
        return True
    booked = _linked_purchase_order(so, orders)
    if not booked:
        return True
    return same_seller_item_pool(booked, po)


def lift_pool_mismatch_message(so: dict, po: dict, orders: list[dict]) -> str:
    booked = _linked_purchase_order(so, orders)
    if not booked:
        return f"{so['ref']} cannot lift against {po['ref']}"
    if booked.get("itemName") != po.get("itemName"):
        return f"{so['ref']} is {so['itemName']}; {po['ref']} is {po['itemName']}"
    return (
        f"{so['ref']} is booked on {booked['ref']} ({booked['partyName']}). "
        f"{po['ref']} is {po['partyName']} — pick a PO from the same seller."
    )


def validate_lift_allocations(
    allocations: list[dict],
    orders: list[dict],
    lifts: list[dict],
    exclude_lift_id: str | None = None,
) -> str | None:
    if not allocations:
        return "Add at least one SO"
    if any(not a.get("soRef") or not a.get("poRef") for a in allocations):
        return "Each line needs an SO and a PO"
    if any(a.get("qtyMt", 0) <= 0 for a in allocations):
        return "Enter a quantity on each SO"

    so_seen: set[str] = set()
    for a in allocations:
        if a["soRef"] in so_seen:
            return f"{a['soRef']} is listed more than once"
        so_seen.add(a["soRef"])

    item_names: set[str] = set()
    used_on_po: dict[str, float] = {}
    used_on_so: dict[str, float] = {}

    for a in allocations:
        po = next((o for o in orders if o.get("ref") == a["poRef"] and o.get("side") == "purchase"), None)
        so = next((o for o in orders if o.get("ref") == a["soRef"] and o.get("side") == "sale"), None)
        if not po or not so:
            return "PO or SO not found"
        if so.get("itemName") != po.get("itemName"):
            return f"{so['ref']} is {so['itemName']}; {po['ref']} is {po['itemName']}"
        if not can_lift_so_against_po(so, po, orders):
            return lift_pool_mismatch_message(so, po, orders)
        item_names.add(so["itemName"])
        used_on_po[a["poRef"]] = round_qty_mt(used_on_po.get(a["poRef"], 0) + a["qtyMt"])
        used_on_so[a["soRef"]] = round_qty_mt(used_on_so.get(a["soRef"], 0) + a["qtyMt"])

    if len(item_names) > 1:
        return "All SOs on one tanker must be the same item"

    for so_ref, qty in used_on_so.items():
        so = next((o for o in orders if o.get("ref") == so_ref and o.get("side") == "sale"), None)
        if not so:
            continue
        remaining = remaining_on_order(so, lifts, exclude_lift_id)
        if qty > remaining:
            return f"{so_ref} only has {format_qty(remaining)} left to lift"

    for po_ref, qty in used_on_po.items():
        po = next((o for o in orders if o.get("ref") == po_ref and o.get("side") == "purchase"), None)
        if not po:
            continue
        remaining = remaining_on_order(po, lifts, exclude_lift_id)
        if qty > remaining:
            return f"{po_ref} only has {format_qty(remaining)} left to lift"

    return None


def validate_stock_lift_allocations(
    allocations: list[dict],
    orders: list[dict],
    lifts: list[dict],
    exclude_lift_id: str | None = None,
) -> str | None:
    if not allocations:
        return "Select a purchase order"
    if len(allocations) > 1:
        return "Stock lift supports one PO at a time"
    a = allocations[0]
    if not a.get("poRef"):
        return "Select a purchase order"
    if a.get("qtyMt", 0) <= 0:
        return "Enter quantity to stock"
    if a.get("soRef"):
        return "Stock lift cannot include a sales order"

    po = next((o for o in orders if o.get("ref") == a["poRef"] and o.get("side") == "purchase"), None)
    if not po:
        return "PO not found"
    remaining = remaining_on_order(po, lifts, exclude_lift_id)
    if a["qtyMt"] > remaining:
        return f"{a['poRef']} only has {format_qty(remaining)} left to lift"
    return None


def get_lift_planned_qty(lift: dict) -> float:
    if lift.get("plannedQtyMt") is not None:
        return lift["plannedQtyMt"]
    if lift.get("status") == "pending":
        return lift.get("liftedQty", 0)
    return round_qty_mt(lift.get("liftedQty", 0) + (lift.get("balanceQtyMt") or 0))


def get_lift_balance_qty(lift: dict) -> float:
    if lift.get("balanceQtyMt") is not None:
        return lift["balanceQtyMt"]
    if lift.get("status") != "delivered":
        return 0
    planned = get_lift_planned_qty(lift)
    return round_qty_mt(max(0, planned - lift.get("liftedQty", 0)))


def compute_balance_qty(planned_qty_mt: float, actual_qty_mt: float) -> float:
    return round_qty_mt(max(0, planned_qty_mt - actual_qty_mt))


def get_outstanding_balance(
    lifts: list[dict], po_ref: str, so_ref: str, settlements: list[dict] | None = None
) -> float:
    pair_lifts = [
        l
        for l in lifts
        if any(a["poRef"] == po_ref and a["soRef"] == so_ref for a in get_lift_allocations(l))
    ]

    def share_for_pair(lift: dict) -> float:
        allocs = get_lift_allocations(lift)
        total = sum(a["qtyMt"] for a in allocs)
        if total <= 0:
            return 0
        pair_qty = sum(a["qtyMt"] for a in allocs if a["poRef"] == po_ref and a["soRef"] == so_ref)
        return pair_qty / total

    total_balance = sum(get_lift_balance_qty(l) * share_for_pair(l) for l in pair_lifts)
    total_applied = sum((l.get("balanceAppliedQtyMt") or 0) * share_for_pair(l) for l in pair_lifts)
    cash_settled = sum(
        s.get("qtyMt", 0)
        for s in (settlements or [])
        if s.get("poRef") == po_ref
        and s.get("soRef") == so_ref
        and s.get("method") == "cash"
        and s.get("source") != "unlifted"
    )
    return round_qty_mt(max(0, total_balance - total_applied - cash_settled))


def _po_seller_name(orders: list[dict], po_ref: str, fallback: str = "") -> str:
    po = next((o for o in orders if o.get("ref") == po_ref and o.get("side") == "purchase"), None)
    if not po:
        return (fallback or "").strip()
    return (po.get("sellerName") or po.get("partyName") or fallback or "").strip()


def remaining_carry_pair(
    order: dict, orders: list[dict], po_ref: str | None, so_ref: str | None
) -> tuple[str, str] | None:
    if po_ref and so_ref:
        return po_ref, so_ref
    if order.get("side") == "sale" and order.get("poRef"):
        return order["poRef"], order["ref"]
    if order.get("side") == "purchase":
        linked = [
            o
            for o in orders
            if o.get("side") == "sale"
            and o.get("poRef") == order.get("ref")
            and o.get("status") not in ("completed", "cancelled")
        ]
        return order["ref"], (linked[0]["ref"] if linked else "")
    return None


def get_seller_outstanding_balance(
    lifts: list[dict],
    orders: list[dict],
    seller_name: str,
    settlements: list[dict] | None = None,
    exclude_lift_id: str | None = None,
) -> float:
    normalized = (seller_name or "").strip().lower()
    if not normalized:
        return 0.0
    settlements = settlements or []
    shortfall = 0.0
    applied = 0.0
    for lift in lifts:
        if exclude_lift_id and lift.get("id") == exclude_lift_id:
            continue
        allocs = get_lift_allocations(lift)
        if not any(
            _po_seller_name(orders, a["poRef"], lift.get("sellerName") or "").lower() == normalized
            for a in allocs
        ):
            continue
        shortfall += get_lift_balance_qty(lift)
        applied += lift.get("balanceAppliedQtyMt") or 0

    def settlement_seller(s: dict) -> str:
        return _po_seller_name(orders, s.get("poRef") or "").lower()

    cash = sum(
        s.get("qtyMt", 0)
        for s in settlements
        if s.get("method") == "cash"
        and s.get("source") != "unlifted"
        and settlement_seller(s) == normalized
    )
    unlifted = sum(
        s.get("qtyMt", 0)
        for s in settlements
        if s.get("method") == "carried_forward"
        and s.get("source") == "unlifted"
        and settlement_seller(s) == normalized
    )
    return round_qty_mt(max(0, shortfall + unlifted - applied - cash))
