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
    normalize_company_name,
    round_qty_mt,
    attach_order_prefix,
    refs_match,
    uid,
)
from .lift_logic import (
    compute_balance_qty,
    get_lift_allocations,
    link_unlinked_sales_orders_from_lifts,
    normalize_lift_tankers,
    po_manually_closed,
    qty_of_so_on_po,
    qty_so_dispatch_on_po,
    qty_stock_on_po,
    resolve_lift_qty,
    sales_order_on_po,
)
from .buy_back import effective_po_qty
from .seed import build_seed_data


def order_status(order: dict) -> str:
    if order.get("status") == "cancelled":
        return "cancelled"
    if order.get("completionType") in ("cash_settled", "carried_forward", "short_closed", "delivered"):
        return "completed"
    # Fully lifted orders stay visible until the user marks them complete.
    if order.get("liftedQty", 0) > 0:
        return "partial"
    return "pending"


def get_sos_for_po(orders: list[dict], po_ref: str, lifts: list[dict] | None = None) -> list[dict]:
    return [
        o
        for o in orders
        if o.get("side") == "sale"
        and sales_order_on_po(o, po_ref, lifts)
        and o.get("status") != "cancelled"
    ]


def orders_drawing_lot(orders: list[dict], po_ref: str, lifts: list[dict] | None = None) -> list[dict]:
    """Sales made from godown stock. Contract SOs booked on the PO stay on the purchase."""
    _ = lifts
    return [
        o
        for o in orders
        if o.get("side") == "sale"
        and o.get("status") != "cancelled"
        and not o.get("deleteScheduledAt")
        and o.get("stockPoRef")
        and not o.get("poRef")
        and refs_match(o.get("stockPoRef"), po_ref, "purchase")
    ]


def get_remaining_sell_qty(orders: list[dict], po_ref: str, lifts: list[dict] | None = None) -> float:
    """Open PO qty still allocatable to new SOs. Own-stock lifts consume the same cap.

    A manually closed PO has nothing left to book — a short delivery that was
    written off or settled is not available to sell.
    """
    po = next(
        (o for o in orders if o.get("side") == "purchase" and refs_match(o.get("ref"), po_ref, "purchase")),
        None,
    )
    if not po or po_manually_closed(po) or po.get("status") == "cancelled":
        return 0
    sold = 0.0
    for order in get_sos_for_po(orders, po_ref, lifts):
        if order.get("status") == "cancelled" or order.get("deleteScheduledAt"):
            continue
        # Whole SO only on the purchase it is booked on. A lift against
        # another purchase counts just the tonnes on that lift.
        if order.get("poRef") and refs_match(order.get("poRef"), po_ref, "purchase"):
            sold += order.get("orderQty", 0)
        else:
            sold += qty_of_so_on_po(lifts or [], po_ref, order.get("ref"))
    stocked = qty_stock_on_po(lifts or [], po_ref)
    moved = qty_so_dispatch_on_po(lifts or [], po_ref, None, orders) + stocked
    return round_qty_mt(effective_po_qty(po) - max(sold + stocked, moved))


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
    """Sum lift allocations onto PO/SO orders.

    Stock-in and SO-dispatch are tracked in separate maps keyed by
    prefixed refs (``attach_order_prefix``), so PO24 and SO24 never share a bucket.

    For POs, own-stock lifts and later SO dispatches from that stock must not
    double-count against ``liftedQty`` (qty that left the seller):
    ``lifted_from_seller = max(stock_in, so_dispatch)``.
    """
    # Per PO: stock-in vs SO-dispatch, committed (all) and delivered-only
    po_stock_committed: dict[str, float] = {}
    po_so_committed: dict[str, float] = {}
    po_stock_delivered: dict[str, float] = {}
    po_so_delivered: dict[str, float] = {}
    so_committed: dict[str, float] = {}
    so_delivered: dict[str, float] = {}
    lot_sale_refs = {
        attach_order_prefix(o.get("ref"), "sale")
        for o in (data.get("tradeOrders") or [])
        if o.get("side") == "sale" and o.get("stockPoRef") and not o.get("poRef")
    }
    lot_sale_refs.discard("")

    for lift in data.get("lifts") or []:
        if lift.get("deletedAt"):
            continue
        delivered = (lift.get("status") or "delivered") == "delivered"
        for a in get_lift_allocations(lift):
            po_ref = attach_order_prefix(a.get("poRef"), "purchase")
            qty = float(a.get("qtyMt") or 0)
            so_ref = attach_order_prefix(a.get("soRef"), "sale") if a.get("soRef") else ""
            if not po_ref or qty <= 0:
                continue
            if so_ref:
                so_committed[so_ref] = so_committed.get(so_ref, 0) + qty
                if delivered:
                    so_delivered[so_ref] = so_delivered.get(so_ref, 0) + qty
                # A sale from the godown already consumed the purchase when stock came in.
                if so_ref in lot_sale_refs:
                    continue
                po_so_committed[po_ref] = po_so_committed.get(po_ref, 0) + qty
                if delivered:
                    po_so_delivered[po_ref] = po_so_delivered.get(po_ref, 0) + qty
            else:
                po_stock_committed[po_ref] = po_stock_committed.get(po_ref, 0) + qty
                if delivered:
                    po_stock_delivered[po_ref] = po_stock_delivered.get(po_ref, 0) + qty

    trade_orders = []
    source_orders = link_unlinked_sales_orders_from_lifts(data.get("tradeOrders") or [], data.get("lifts") or [])
    for o in source_orders:
        ref = attach_order_prefix(o.get("ref"), o.get("side") or "purchase")
        if o.get("side") == "purchase":
            stock_c = po_stock_committed.get(ref, 0)
            so_c = po_so_committed.get(ref, 0)
            stock_d = po_stock_delivered.get(ref, 0)
            so_d = po_so_delivered.get(ref, 0)
            # max(stock, so_dispatch) == stock + max(0, so_dispatch - stock)
            committed = round_qty_mt(max(stock_c, so_c))
            lifted = round_qty_mt(max(stock_d, so_d))
        else:
            committed = round_qty_mt(so_committed.get(ref, 0))
            lifted = round_qty_mt(so_delivered.get(ref, 0))
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
    lifts = data.get("lifts") or []
    po_by_key: dict[str, dict] = {}
    so_by_key: dict[str, dict] = {}
    stock_sales_by_po: dict[str, list[dict]] = {}
    for order in orders:
        side = order.get("side")
        key = attach_order_prefix(order.get("ref"), "purchase" if side != "sale" else "sale")
        if side == "purchase":
            if key:
                po_by_key.setdefault(key, order)
            continue
        if side != "sale":
            continue
        if key:
            so_by_key.setdefault(key, order)
        if (
            order.get("stockPoRef")
            and not order.get("poRef")
            and order.get("status") != "cancelled"
            and not order.get("deleteScheduledAt")
        ):
            stock_key = attach_order_prefix(order.get("stockPoRef"), "purchase")
            if stock_key:
                stock_sales_by_po.setdefault(stock_key, []).append(order)

    stock_in: dict[str, float] = {}
    so_out: dict[str, float] = {}
    for lift in lifts:
        if lift.get("deletedAt"):
            continue
        if (lift.get("status") or "delivered") != "delivered":
            continue
        for allocation in get_lift_allocations(lift):
            po_key = attach_order_prefix(allocation.get("poRef"), "purchase")
            if not po_key:
                continue
            qty = float(allocation.get("qtyMt") or 0)
            so_ref = allocation.get("soRef")
            if not so_ref:
                stock_in[po_key] = stock_in.get(po_key, 0.0) + qty
                continue
            so = so_by_key.get(attach_order_prefix(so_ref, "sale"))
            if (
                so
                and so.get("stockPoRef")
                and not so.get("poRef")
                and attach_order_prefix(so.get("stockPoRef"), "purchase") == po_key
            ):
                so_out[po_key] = so_out.get(po_key, 0.0) + qty

    lots = []
    for lot in data.get("lots") or []:
        po_ref = lot["lotNumber"].replace("LOT-", "", 1)
        po_key = attach_order_prefix(po_ref, "purchase")
        po = po_by_key.get(po_key) if po_key else None
        if not po:
            lots.append(lot)
            continue
        linked_sos = stock_sales_by_po.get(po_key, [])
        allocated = sum(o.get("orderQty", 0) for o in linked_sos)
        # On hand = delivered own-stock minus delivered lot-sale dispatches.
        stock_in_delivered = round_qty_mt(stock_in.get(po_key, 0.0))
        so_out_delivered = round_qty_mt(so_out.get(po_key, 0.0))
        on_hand = round_qty_mt(max(0.0, stock_in_delivered - so_out_delivered))

        avg_so_rate = sum(o.get("rate", 0) for o in linked_sos) / len(linked_sos) if linked_sos else 0
        margin = lot.get("margin", 0)
        if avg_so_rate > po.get("rate", 0):
            margin = ((avg_so_rate - po["rate"]) / po["rate"]) * 100

        # Godown avail = on hand − lot sales still to dispatch.
        # A contract SO booked on the PO does not reduce this.
        so_unlifted = sum(
            max(0.0, float(so.get("orderQty") or 0) - float(so.get("liftedQty") or 0))
            for so in linked_sos
            if so.get("status") != "cancelled" and not so.get("deleteScheduledAt")
        )
        available = max(0.0, on_hand - round_qty_mt(so_unlifted)) if stock_in_delivered > 0 else 0.0

        lots.append(
            {
                **lot,
                "commodity": po["itemName"],
                "purchasePrice": po["rate"],
                "quantityPurchased": round_qty_mt(po["orderQty"]),
                "remaining": round_qty_mt(on_hand),
                "allocated": round_qty_mt(allocated),
                "available": round_qty_mt(available),
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
    existing = {l.get("lotNumber") for l in lots}
    missing = [
        o
        for o in orders
        if o.get("side") == "purchase"
        and lot_number_for_po(o["ref"]) not in existing
    ]
    if not missing:
        return data
    for po in missing:
        lots.append(
            {
                **build_lot_from_po(po),
                "allocated": 0,
                "available": 0,
                # No own-stock received yet — on hand is 0 until a stock lift.
                "remaining": 0,
            }
        )
    return {**data, "lots": lots}


def apply_remove_order(data: dict, order_id: str) -> dict:
    order = next((o for o in data.get("tradeOrders") or [] if o.get("id") == order_id), None)
    if not order:
        return data

    lots = list(data.get("lots") or [])
    if order.get("side") == "purchase":
        lots = [l for l in lots if l.get("lotNumber") != lot_number_for_po(order["ref"])]
    elif order.get("stockPoRef") and not order.get("poRef"):
        lot_no = lot_number_for_po(order["stockPoRef"])
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
            next_data = apply_remove_order(next_data, order["id"])
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


def _prefer_directory_name(a: str, b: str) -> str:
    a_comma = "," in (a or "")
    b_comma = "," in (b or "")
    if a_comma != b_comma:
        return b if a_comma else a
    return a if len((a or "").strip()) >= len((b or "").strip()) else b


def _pick_nonempty(*values: str | None) -> str:
    for value in values:
        text = (value or "").strip()
        if text:
            return text
    return ""


def _prefer_location(a: str | None, b: str | None) -> str:
    """Prefer fuller place strings (city + state over state alone)."""
    left = (a or "").strip()
    right = (b or "").strip()
    if not left:
        return right
    if not right:
        return left
    l = left.lower()
    r = right.lower()
    if l != r and l.find(r) >= 0:
        return left
    if l != r and r.find(l) >= 0:
        return right
    left_parts = len([p for p in left.split(",") if p.strip()])
    right_parts = len([p for p in right.split(",") if p.strip()])
    if left_parts != right_parts:
        return left if left_parts > right_parts else right
    return left if len(left) >= len(right) else right


def _merge_products(left: list | None, right: list | None) -> list:
    out: list[str] = []
    seen: set[str] = set()
    for item in [*(left or []), *(right or [])]:
        text = str(item or "").strip()
        key = text.lower()
        if not text or key in seen:
            continue
        seen.add(key)
        out.append(text)
    return out


def _dedupe_named_rows(rows: list[dict], kind: str) -> list[dict]:
    by_key: dict[str, dict] = {}
    for row in rows:
        key = normalize_company_name(row.get("name") or "")
        if not key:
            continue
        existing = by_key.get(key)
        if not existing:
            by_key[key] = dict(row)
            continue
        merged = {
            **existing,
            **{k: v for k, v in row.items() if v not in (None, "", [], {})},
            "id": existing.get("id") or row.get("id"),
            "name": _prefer_directory_name(existing.get("name") or "", row.get("name") or ""),
        }
        if kind == "broker":
            merged["contracts"] = int(existing.get("contracts") or 0) + int(row.get("contracts") or 0)
            merged["commissionEarned"] = float(existing.get("commissionEarned") or 0) + float(
                row.get("commissionEarned") or 0
            )
            merged["email"] = _pick_nonempty(existing.get("email"), row.get("email"))
            merged["phone"] = _pick_nonempty(existing.get("phone"), row.get("phone"))
        elif kind == "producer":
            merged["contracts"] = int(existing.get("contracts") or 0) + int(row.get("contracts") or 0)
            merged["products"] = _merge_products(existing.get("products"), row.get("products"))
            location = _prefer_location(
                existing.get("city") or existing.get("location"),
                row.get("city") or row.get("location"),
            )
            merged["location"] = location
            merged["city"] = location or None
        else:
            merged["totalPurchases"] = float(existing.get("totalPurchases") or 0) + float(
                row.get("totalPurchases") or 0
            )
            merged["outstanding"] = float(existing.get("outstanding") or 0) + float(row.get("outstanding") or 0)
            merged["products"] = _merge_products(existing.get("products"), row.get("products"))
            location = _prefer_location(
                existing.get("city") or existing.get("location"),
                row.get("city") or row.get("location"),
            )
            merged["location"] = location
            merged["city"] = location or None
            left_last = existing.get("lastOrder") or ""
            right_last = row.get("lastOrder") or ""
            merged["lastOrder"] = left_last if left_last >= right_last else right_last
        by_key[key] = merged
    return list(by_key.values())


def dedupe_directory(data: dict) -> dict:
    """Collapse near-identical brokers / producers / retailers (case, suffix, location tail)."""
    return {
        **data,
        "brokers": _dedupe_named_rows(list(data.get("brokers") or []), "broker"),
        "producers": _dedupe_named_rows(list(data.get("producers") or []), "producer"),
        "retailers": _dedupe_named_rows(list(data.get("retailers") or []), "retailer"),
    }


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
    return dedupe_directory(pipeline)


def load_seed_state() -> dict:
    seed = build_seed_data()
    from ..db import DEFAULT_STATE

    return load_and_normalize({**DEFAULT_STATE, **seed})
