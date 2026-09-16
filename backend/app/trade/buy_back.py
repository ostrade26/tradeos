"""Purchase order buy-back quantity helpers."""

from __future__ import annotations

from typing import Any

from .helpers import round_qty_mt


def total_buy_back_qty(po: dict[str, Any]) -> float:
    return round_qty_mt(sum(float(b.get("qtyMt") or 0) for b in po.get("buyBacks") or []))


def effective_po_qty(po: dict[str, Any]) -> float:
    """Qty still active on the PO after buy backs (contract qty minus bought back)."""
    return round_qty_mt(max(0.0, float(po.get("orderQty", 0) or 0) - total_buy_back_qty(po)))


def max_buy_back_qty(po: dict[str, Any], linked_sos: list[dict]) -> float:
    """Unlifted quantity not allocated to SOs — available for another buy back."""
    allocated = sum(float(o.get("orderQty", 0) or 0) for o in linked_sos)
    lifted = float(po.get("liftedQty", 0) or 0)
    contract = float(po.get("orderQty", 0) or 0)
    already = total_buy_back_qty(po)
    return round_qty_mt(max(0.0, contract - already - allocated - lifted))
