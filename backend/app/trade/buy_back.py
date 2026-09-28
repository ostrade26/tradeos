"""Purchase order buy-back quantity helpers."""

from __future__ import annotations

from typing import Any

from .helpers import round_qty_mt


def total_buy_back_qty(po: dict[str, Any]) -> float:
    return round_qty_mt(sum(float(b.get("qtyMt") or 0) for b in po.get("buyBacks") or []))


def effective_po_qty(po: dict[str, Any]) -> float:
    """Qty still active on the PO after buy backs (contract qty minus bought back)."""
    return round_qty_mt(max(0.0, float(po.get("orderQty", 0) or 0) - total_buy_back_qty(po)))


def max_buy_back_qty(order: dict[str, Any], linked_sos: list[dict] | None = None) -> float:
    """Unlifted quantity still available for another buy back."""
    lifted = float(order.get("liftedQty", 0) or 0)
    contract = float(order.get("orderQty", 0) or 0)
    already = total_buy_back_qty(order)
    leftover = contract - already - lifted
    if order.get("side") == "sale":
        return round_qty_mt(max(0.0, leftover))
    allocated = sum(float(o.get("orderQty", 0) or 0) for o in (linked_sos or []))
    return round_qty_mt(max(0.0, leftover - allocated))
