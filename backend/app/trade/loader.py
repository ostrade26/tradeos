"""Load pipeline — migrations and normalization."""

from __future__ import annotations

import copy
import re
from typing import Any

from .helpers import (
    CURRENT_TRADER,
    format_deletion_date,
    format_qty,
    is_deletion_due,
    round_qty_mt,
    uid,
)
from .lift_logic import (
    compute_balance_qty,
    get_lift_allocations,
    lift_touches_ref,
    normalize_lift_tankers,
    resolve_lift_qty,
)
from .buy_back import effective_po_qty
from .seed import build_seed_data


def order_status(order: dict) -> str:
    if order.get("status") == "cancelled":
        return "cancelled"
    if order.get("completionType") in ("cash_settled", "carried_forward", "short_closed"):
        return "completed"
    qty_cap = (
        effective_po_qty(order)
        if order.get("side") == "purchase"
        else float(order.get("orderQty", 0) or 0)
    )
    if order.get("liftedQty", 0) >= qty_cap:
        return "completed"
    if order.get("liftedQty", 0) > 0:
        return "partial"
    return "pending"


def get_sos_for_po(orders: list[dict], po_ref: str) -> list[dict]:
    return [
        o
        for o in orders
        if o.get("side") == "sale" and o.get("poRef") == po_ref and o.get("status") != "cancelled"
    ]


def get_remaining_sell_qty(orders: list[dict], po_ref: str) -> float:
    po = next((o for o in orders if o.get("ref") == po_ref and o.get("side") == "purchase"), None)
    if not po:
        return 0
    sold = sum(
        o.get("orderQty", 0)
        for o in orders
        if o.get("side") == "sale" and o.get("poRef") == po_ref and o.get("status") != "cancelled"
    )
    return round_qty_mt(effective_po_qty(po) - sold)


def _producer_to_company(producer: dict) -> dict:
    return {
        "id": producer["id"],
        "officialName": producer["name"],
        "aliases": [],
        "types": ["seller"],
        "location": producer.get("city") or producer.get("location"),
        "gst": producer.get("gst") or "",
        "code": producer.get("code") or "",
    }


def _retailer_to_company(retailer: dict) -> dict:
    return {
        "id": retailer["id"],
        "officialName": retailer["name"],
        "aliases": [],
        "types": ["buyer"],
        "location": retailer.get("city") or retailer.get("location"),
        "gst": retailer.get("gst") or "",
        "code": retailer.get("code") or "",
    }


def _upsert_directory_company(companies: list[dict], company: dict) -> list[dict]:
    idx = next((i for i, c in enumerate(companies) if c.get("id") == company.get("id")), -1)
    if idx < 0:
        return [*companies, company]
    existing = companies[idx]
    types = list(dict.fromkeys([*existing.get("types", []), *company.get("types", [])]))
    updated = {
        **existing,
        "officialName": company["officialName"],
        "location": company.get("location") or existing.get("location"),
        "gst": company.get("gst") if company.get("gst") not in (None, "") else existing.get("gst"),
        "code": company.get("code") if company.get("code") not in (None, "") else existing.get("code"),
        "types": types,
    }
    return [updated if i == idx else c for i, c in enumerate(companies)]


def migrate_companies(data: dict) -> dict:
    companies = list(data.get("companies") or [])
    for p in data.get("producers") or []:
        companies = _upsert_directory_company(companies, _producer_to_company(p))
    for r in data.get("retailers") or []:
        companies = _upsert_directory_company(companies, _retailer_to_company(r))
    return {**data, "companies": companies}


def _migrate_counters(counters: dict, lifts: list[dict]) -> dict:
    invoice = counters.get("invoice") or 0
    for lift in lifts:
        for inv_raw in [lift.get("salesInvoiceNo") or ""]:
            for part in re.split(r",\s*", inv_raw):
                match = re.match(r"^INV-\d{4}-(\d+)$", part.strip())
                if match:
                    invoice = max(invoice, int(match.group(1)))
        for t in lift.get("tankers") or []:
            match = re.match(r"^INV-\d{4}-(\d+)$", (t.get("salesInvoiceNo") or "").strip())
            if match:
                invoice = max(invoice, int(match.group(1)))
    return {**counters, "invoice": invoice}


def apply_lift_totals(data: dict) -> dict:
    committed_by_ref: dict[str, float] = {}
    delivered_by_ref: dict[str, float] = {}
    for lift in data.get("lifts") or []:
        delivered = (lift.get("status") or "delivered") == "delivered"
        for a in get_lift_allocations(lift):
            committed_by_ref[a["poRef"]] = committed_by_ref.get(a["poRef"], 0) + a["qtyMt"]
            so_ref = a.get("soRef") or ""
            if so_ref:
                committed_by_ref[so_ref] = committed_by_ref.get(so_ref, 0) + a["qtyMt"]
            if delivered:
                delivered_by_ref[a["poRef"]] = delivered_by_ref.get(a["poRef"], 0) + a["qtyMt"]
                if so_ref:
                    delivered_by_ref[so_ref] = delivered_by_ref.get(so_ref, 0) + a["qtyMt"]

    trade_orders = []
    for o in data.get("tradeOrders") or []:
        committed = committed_by_ref.get(o["ref"], 0)
        lifted = delivered_by_ref.get(o["ref"], 0)
        updated = {**o, "committedLiftQty": committed, "liftedQty": lifted}
        updated["status"] = order_status(updated)
        trade_orders.append(updated)

    return sync_lot_quantities({**data, "tradeOrders": trade_orders})


def migrate_lifts(data: dict) -> dict:
    lifts = []
    for lift in data.get("lifts") or []:
        status = lift.get("status") or "delivered"
        with_status = {
            **lift,
            "status": status,
            "salesInvoiceNo": lift.get("salesInvoiceNo") if status == "delivered" else None,
        }
        if lift.get("tankers"):
            tankers = []
            tanker_list = lift["tankers"]
            for t in tanker_list:
                tankers.append(
                    {
                        **t,
                        "lrNo": t.get("lrNo") or "",
                        "actualQtyMt": t.get("actualQtyMt")
                        if t.get("actualQtyMt") is not None
                        else (lift.get("liftedQty") if len(tanker_list) == 1 else None),
                    }
                )
            lifted_qty = resolve_lift_qty(tankers) or lift.get("liftedQty", 0)
            planned_qty_mt = lift.get("plannedQtyMt", lifted_qty)
            balance_qty_mt = lift.get("balanceQtyMt")
            if balance_qty_mt is None and status == "delivered":
                balance_qty_mt = compute_balance_qty(planned_qty_mt, lifted_qty)
            lifts.append(
                {
                    **with_status,
                    "tankers": tankers,
                    "liftedQty": lifted_qty,
                    "plannedQtyMt": planned_qty_mt,
                    "balanceQtyMt": balance_qty_mt,
                    "allocations": get_lift_allocations({**lift, "liftedQty": lifted_qty}),
                }
            )
        elif lift.get("tankerNo"):
            tankers = [
                {
                    "tankerNo": lift["tankerNo"],
                    "transportName": "",
                    "driverMobile": "",
                    "lrNo": "",
                    "actualQtyMt": lift.get("liftedQty"),
                }
            ]
            planned_qty_mt = lift.get("plannedQtyMt", lift.get("liftedQty", 0))
            balance_qty_mt = lift.get("balanceQtyMt")
            if balance_qty_mt is None and status == "delivered":
                balance_qty_mt = compute_balance_qty(planned_qty_mt, lift.get("liftedQty", 0))
            lifts.append(
                {
                    **with_status,
                    "tankers": tankers,
                    "plannedQtyMt": planned_qty_mt,
                    "balanceQtyMt": balance_qty_mt,
                    "allocations": get_lift_allocations(lift),
                }
            )
        else:
            lifts.append(
                {
                    **with_status,
                    "tankers": [],
                    "plannedQtyMt": lift.get("plannedQtyMt", lift.get("liftedQty", 0)),
                    "allocations": get_lift_allocations(lift),
                }
            )

    counters = _migrate_counters(data.get("counters") or {}, lifts)
    return apply_lift_totals({**data, "lifts": lifts, "counters": counters})


def lot_number_for_po(po_ref: str) -> str:
    return f"LOT-{po_ref}"


def build_lot_from_po(po: dict) -> dict:
    return {
        "id": uid(),
        "lotNumber": lot_number_for_po(po["ref"]),
        "commodity": po["itemName"],
        "purchasePrice": po["rate"],
        "quantityPurchased": po["orderQty"],
        "remaining": po["orderQty"],
        "allocated": 0,
        "available": po["orderQty"],
        "unit": po.get("unit", "MT"),
        "producer": po["partyName"],
        "broker": po["brokerName"],
        "purchaseDate": po["date"],
        "contractId": po["id"],
        "margin": 0,
    }


def sync_lot_quantities(data: dict) -> dict:
    orders = data.get("tradeOrders") or []
    lots = []
    for lot in data.get("lots") or []:
        po_ref = lot["lotNumber"].replace("LOT-", "", 1)
        po = next((o for o in orders if o.get("ref") == po_ref and o.get("side") == "purchase"), None)
        if not po:
            lots.append(lot)
            continue
        linked_sos = get_sos_for_po(orders, po_ref)
        allocated = sum(o.get("orderQty", 0) for o in linked_sos)
        effective = effective_po_qty(po)
        avg_so_rate = sum(o.get("rate", 0) for o in linked_sos) / len(linked_sos) if linked_sos else 0
        margin = lot.get("margin", 0)
        if avg_so_rate > po.get("rate", 0):
            margin = ((avg_so_rate - po["rate"]) / po["rate"]) * 100
        lots.append(
            {
                **lot,
                "commodity": po["itemName"],
                "purchasePrice": po["rate"],
                "quantityPurchased": round_qty_mt(po["orderQty"]),
                "remaining": round_qty_mt(max(0, effective - po.get("liftedQty", 0))),
                "allocated": round_qty_mt(allocated),
                "available": round_qty_mt(effective - allocated),
                "producer": po["partyName"],
                "broker": po["brokerName"],
                "purchaseDate": po["date"],
                "margin": margin,
            }
        )
    return {**data, "lots": lots}


def ensure_lots_for_pos(data: dict) -> dict:
    orders = data.get("tradeOrders") or []
    lots = list(data.get("lots") or [])
    missing = [
        o
        for o in orders
        if o.get("side") == "purchase"
        and not any(l.get("lotNumber") == lot_number_for_po(o["ref"]) for l in lots)
    ]
    if not missing:
        return data
    for po in missing:
        linked_sos = get_sos_for_po(orders, po["ref"])
        allocated = sum(o.get("orderQty", 0) for o in linked_sos)
        effective = effective_po_qty(po)
        lots.append(
            {
                **build_lot_from_po(po),
                "allocated": allocated,
                "available": round_qty_mt(effective - allocated),
                "remaining": max(0, effective - po.get("liftedQty", 0)),
            }
        )
    return {**data, "lots": lots}


def _apply_remove_order(data: dict, order_id: str) -> dict:
    order = next((o for o in data.get("tradeOrders") or [] if o.get("id") == order_id), None)
    if not order:
        return data

    lots = list(data.get("lots") or [])
    if order.get("side") == "purchase":
        lots = [l for l in lots if l.get("lotNumber") != lot_number_for_po(order["ref"])]
    elif order.get("poRef"):
        lot_no = lot_number_for_po(order["poRef"])
        updated_lots = []
        for l in lots:
            if l.get("lotNumber") == lot_no:
                updated_lots.append(
                    {
                        **l,
                        "allocated": max(0, l.get("allocated", 0) - order.get("orderQty", 0)),
                        "available": l.get("available", 0) + order.get("orderQty", 0),
                    }
                )
            else:
                updated_lots.append(l)
        lots = updated_lots

    activity = {
        "id": uid(),
        "type": "order_deleted",
        "title": "PO deleted" if order.get("side") == "purchase" else "SO deleted",
        "description": (
            f"{order['ref']} — {format_qty(order.get('orderQty', 0))} "
            f"{order.get('itemName')} with {order.get('partyName')}"
        ),
        "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "user": CURRENT_TRADER,
        "entityRef": order["ref"],
    }

    return {
        **data,
        "tradeOrders": [o for o in data.get("tradeOrders") or [] if o.get("id") != order_id],
        "lots": lots,
        "activities": [activity, *(data.get("activities") or [])],
    }


def purge_due_order_deletions(data: dict) -> dict:
    next_data = data
    for order in list(data.get("tradeOrders") or []):
        if order.get("deleteScheduledAt") and is_deletion_due(order["deleteScheduledAt"]):
            next_data = _apply_remove_order(next_data, order["id"])
    return next_data


def migrate_po_contract_qty(data: dict) -> dict:
    """Mark PO orderQty as original contract quantity (buy backs tracked separately)."""
    meta = dict(data.get("meta") or {})
    if meta.get("poContractQtyV2"):
        return data
    orders = []
    for o in data.get("tradeOrders") or []:
        if o.get("side") == "purchase" and o.get("orderQtyIsContract") is not True:
            o = {**o, "orderQtyIsContract": True}
        orders.append(o)
    meta["poContractQtyV2"] = True
    return {**data, "tradeOrders": orders, "meta": meta}


def load_and_normalize(raw: dict | None = None) -> dict:
    from ..db import DEFAULT_STATE

    base = copy.deepcopy(DEFAULT_STATE)
    if raw:
        base.update(raw)
    pipeline = purge_due_order_deletions(
        sync_lot_quantities(
            ensure_lots_for_pos(
                migrate_lifts(migrate_companies(migrate_po_contract_qty(base))),
            ),
        ),
    )
    return pipeline


def load_seed_state() -> dict:
    seed = build_seed_data()
    from ..db import DEFAULT_STATE

    return load_and_normalize({**DEFAULT_STATE, **seed})
