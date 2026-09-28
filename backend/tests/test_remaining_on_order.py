"""SO remaining-to-lift must not subtract lifts on a PO with the same number."""

from __future__ import annotations

import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.trade.lift_logic import remaining_on_order  # noqa: E402


def _po(ref: str, qty: float) -> dict:
    return {"ref": ref, "side": "purchase", "orderQty": qty, "buyBacks": []}


def _so(ref: str, qty: float) -> dict:
    return {"ref": ref, "side": "sale", "orderQty": qty}


def _lift(*, lift_id: str, po_ref: str, so_ref: str | None, qty: float) -> dict:
    return {
        "id": lift_id,
        "poRef": po_ref,
        "soRef": so_ref,
        "liftedQty": qty,
        "allocations": [{"poRef": po_ref, "soRef": so_ref, "qtyMt": qty}],
    }


class RemainingOnOrderTests(unittest.TestCase):
    def test_so_ignores_po_lifts_with_same_ref(self) -> None:
        so = _so("24", 100)
        lifts = [_lift(lift_id="L1", po_ref="24", so_ref=None, qty=99.07)]
        self.assertEqual(remaining_on_order(so, lifts), 100.0)

    def test_so_subtracts_its_own_lifts(self) -> None:
        so = _so("24", 100)
        lifts = [_lift(lift_id="L1", po_ref="1", so_ref="24", qty=10)]
        self.assertEqual(remaining_on_order(so, lifts), 90.0)

    def test_po_still_uses_own_stock_lifts(self) -> None:
        po = _po("24", 100)
        lifts = [_lift(lift_id="L1", po_ref="24", so_ref=None, qty=40)]
        self.assertEqual(remaining_on_order(po, lifts), 60.0)


if __name__ == "__main__":
    unittest.main()
