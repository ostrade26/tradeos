"""SO remaining-to-lift must not subtract lifts on a PO with the same number."""

from __future__ import annotations

import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.trade.helpers import refs_match  # noqa: E402
from app.trade.lift_logic import remaining_on_order, remaining_on_po_for_dispatch  # noqa: E402
from app.trade.loader import (  # noqa: E402
    apply_lift_totals,
    get_remaining_sell_qty,
    get_sos_for_po,
    orders_drawing_lot,
)


def _po(ref: str, qty: float) -> dict:
    return {"ref": ref, "side": "purchase", "orderQty": qty, "buyBacks": []}


def _so(ref: str, qty: float, po_ref: str | None = None) -> dict:
    row = {"ref": ref, "side": "sale", "orderQty": qty}
    if po_ref:
        row["poRef"] = po_ref
    return row


def _lift(*, lift_id: str, po_ref: str, so_ref: str | None, qty: float, status: str = "delivered") -> dict:
    return {
        "id": lift_id,
        "poRef": po_ref,
        "soRef": so_ref,
        "liftedQty": qty,
        "status": status,
        "allocations": [{"poRef": po_ref, "soRef": so_ref, "qtyMt": qty}],
    }


class RemainingOnOrderTests(unittest.TestCase):
    def test_so_ignores_po_lifts_with_same_ref(self) -> None:
        so = _so("24", 100)
        lifts = [_lift(lift_id="L1", po_ref="24", so_ref=None, qty=99.07)]
        self.assertEqual(remaining_on_order(so, lifts), 100.0)

    def test_so_subtracts_prefixed_so_ref_on_lift(self) -> None:
        so = _so("24", 100)
        lifts = [_lift(lift_id="L1", po_ref="1", so_ref="SO24", qty=10)]
        self.assertEqual(remaining_on_order(so, lifts), 90.0)

    def test_over_delivery_balance_is_negative(self) -> None:
        so = _so("24", 30)
        lifts = [_lift(lift_id="L1", po_ref="1", so_ref="24", qty=31.09)]
        self.assertEqual(remaining_on_order(so, lifts), -1.09)

    def test_so_subtracts_its_own_lifts(self) -> None:
        so = _so("24", 100)
        lifts = [_lift(lift_id="L1", po_ref="1", so_ref="24", qty=10)]
        self.assertEqual(remaining_on_order(so, lifts), 90.0)

    def test_po_still_uses_own_stock_lifts(self) -> None:
        po = _po("24", 100)
        lifts = [_lift(lift_id="L1", po_ref="24", so_ref=None, qty=40)]
        self.assertEqual(remaining_on_order(po, lifts), 60.0)

    def test_stock_in_does_not_block_so_dispatch_from_that_stock(self) -> None:
        po = _po("24", 100)
        lifts = [_lift(lift_id="L1", po_ref="24", so_ref=None, qty=55)]
        self.assertEqual(remaining_on_po_for_dispatch(po, lifts), 100.0)
        self.assertEqual(remaining_on_order(po, lifts), 45.0)

    def test_cross_order_dispatch_reduces_dispatch_po_not_booked_po(self) -> None:
        booked = _po("10", 100)
        dispatch = _po("24", 100)
        lifts = [_lift(lift_id="L1", po_ref="24", so_ref="SO88", qty=20)]
        self.assertEqual(remaining_on_po_for_dispatch(booked, lifts), 100.0)
        self.assertEqual(remaining_on_po_for_dispatch(dispatch, lifts), 80.0)

    def test_apply_lift_totals_does_not_mix_po24_into_so24(self) -> None:
        data = apply_lift_totals(
            {
                "tradeOrders": [_po("24", 100), _so("24", 100)],
                "lifts": [_lift(lift_id="L1", po_ref="PO24", so_ref=None, qty=99.07)],
                "lots": [],
            }
        )
        by_side = {(o["side"], o["ref"]): o for o in data["tradeOrders"]}
        self.assertEqual(by_side[("purchase", "24")]["liftedQty"], 99.07)
        self.assertEqual(by_side[("sale", "24")]["liftedQty"], 0)
        self.assertEqual(by_side[("sale", "24")]["committedLiftQty"], 0)

    def test_so_po_link_matches_prefixed_refs(self) -> None:
        orders = [_po("24", 100), _so("88", 40, po_ref="PO24")]
        self.assertEqual(len(get_sos_for_po(orders, "24")), 1)
        self.assertEqual(get_remaining_sell_qty(orders, "24"), 60.0)

    def test_stock_lift_reduces_avail_to_sell(self) -> None:
        orders = [_po("24", 100)]
        lifts = [_lift(lift_id="L1", po_ref="24", so_ref=None, qty=40)]
        self.assertEqual(get_remaining_sell_qty(orders, "24", lifts), 60.0)

    def test_closed_po_shortfall_is_not_avail_to_sell(self) -> None:
        po = {**_po("1", 50), "status": "completed", "completionType": "short_closed"}
        lifts = [_lift(lift_id="L1", po_ref="1", so_ref=None, qty=49.8)]
        self.assertEqual(get_remaining_sell_qty([po], "1", lifts), 0.0)

    def test_stock_sale_does_not_rebook_closed_po(self) -> None:
        po = {
            **_po("1", 50),
            "id": "po1",
            "status": "completed",
            "completionType": "short_closed",
            "itemName": "Oil",
            "rate": 100,
            "partyName": "Mill",
            "brokerName": "",
            "date": "2026-01-01",
        }
        so = {**_so("2", 49.8), "id": "so2", "stockPoRef": "1", "liftedQty": 0}
        lifts = [_lift(lift_id="L1", po_ref="1", so_ref=None, qty=49.8)]
        data = apply_lift_totals(
            {
                "tradeOrders": [po, so],
                "lifts": lifts,
                "lots": [{
                    "id": "lot1",
                    "lotNumber": "LOT-1",
                    "margin": 0,
                }],
            }
        )
        saved_so = next(o for o in data["tradeOrders"] if o["side"] == "sale")
        self.assertIsNone(saved_so.get("poRef"))
        self.assertEqual(saved_so.get("stockPoRef"), "1")
        self.assertEqual(get_remaining_sell_qty(data["tradeOrders"], "1", data["lifts"]), 0.0)
        self.assertEqual(len(get_sos_for_po(data["tradeOrders"], "1", data["lifts"])), 0)
        self.assertEqual(data["lots"][0]["remaining"], 49.8)
        self.assertEqual(data["lots"][0]["available"], 0.0)

    def test_contract_so_does_not_reduce_godown_available(self) -> None:
        po = {
            **_po("PO1", 50),
            "id": "po1",
            "itemName": "Oil",
            "rate": 100,
            "partyName": "Mill",
            "brokerName": "",
            "date": "2026-01-01",
        }
        contract_so = {**_so("SO1", 10, "PO1"), "id": "so1", "liftedQty": 10}
        lifts = [
            _lift(lift_id="L1", po_ref="PO1", so_ref=None, qty=15),
            _lift(lift_id="L2", po_ref="PO1", so_ref="SO1", qty=10),
        ]
        data = apply_lift_totals(
            {
                "tradeOrders": [po, contract_so],
                "lifts": lifts,
                "lots": [{"id": "lot1", "lotNumber": "LOT-PO1", "margin": 0}],
            }
        )
        lot = data["lots"][0]
        self.assertEqual(lot["remaining"], 15.0)
        self.assertEqual(lot["allocated"], 0.0)
        self.assertEqual(lot["available"], 15.0)
        self.assertEqual(get_remaining_sell_qty(data["tradeOrders"], "PO1", data["lifts"]), 25.0)
        self.assertEqual(len(get_sos_for_po(data["tradeOrders"], "PO1", data["lifts"])), 1)
        self.assertEqual(orders_drawing_lot(data["tradeOrders"], "PO1", data["lifts"]), [])

    def test_lift_does_not_book_so_onto_closed_po(self) -> None:
        po = {**_po("1", 50), "completionType": "short_closed", "status": "completed"}
        so = _so("2", 10)
        lifts = [_lift(lift_id="L1", po_ref="1", so_ref="2", qty=10)]
        data = apply_lift_totals({"tradeOrders": [po, so], "lifts": lifts, "lots": []})
        saved_so = next(o for o in data["tradeOrders"] if o["side"] == "sale")
        self.assertIsNone(saved_so.get("poRef"))

    def test_unlinked_so_stays_unlinked_and_counts_lift_qty(self) -> None:
        po = _po("24", 100)
        so = _so("88", 40)
        lifts = [_lift(lift_id="L1", po_ref="24", so_ref="88", qty=10)]
        data = apply_lift_totals({"tradeOrders": [po, so], "lifts": lifts, "lots": []})
        by_side = {(o["side"], o["ref"]): o for o in data["tradeOrders"]}
        self.assertIsNone(by_side[("sale", "88")].get("poRef"))
        self.assertEqual(len(get_sos_for_po(data["tradeOrders"], "24", data["lifts"])), 1)
        self.assertEqual(get_remaining_sell_qty(data["tradeOrders"], "24", data["lifts"]), 90.0)

    def test_short_sale_counts_each_lift_on_its_purchase(self) -> None:
        po1 = _po("1", 50)
        po2 = _po("2", 30)
        so = _so("9", 200)
        lifts = [
            _lift(lift_id="L1", po_ref="1", so_ref="9", qty=15),
            _lift(lift_id="L2", po_ref="2", so_ref="9", qty=10),
        ]
        data = apply_lift_totals({"tradeOrders": [po1, po2, so], "lifts": lifts, "lots": []})
        saved = next(o for o in data["tradeOrders"] if o["side"] == "sale")
        self.assertIsNone(saved.get("poRef"))
        self.assertEqual(get_remaining_sell_qty(data["tradeOrders"], "1", data["lifts"]), 35.0)
        self.assertEqual(get_remaining_sell_qty(data["tradeOrders"], "2", data["lifts"]), 20.0)

    def test_full_lift_stays_open_until_marked_complete(self) -> None:
        po = _po("1", 10)
        lifts = [_lift(lift_id="L1", po_ref="1", so_ref=None, qty=10)]
        data = apply_lift_totals({"tradeOrders": [po], "lifts": lifts, "lots": []})
        saved = data["tradeOrders"][0]
        self.assertEqual(saved["status"], "partial")
        self.assertIsNone(saved.get("completionType"))

    def test_booked_so_does_not_fill_other_purchases(self) -> None:
        po_booked = _po("1", 100)
        po_other = _po("2", 50)
        so = _so("9", 200, po_ref="1")
        lifts = [
            _lift(lift_id="L1", po_ref="1", so_ref="9", qty=40),
            _lift(lift_id="L2", po_ref="2", so_ref="9", qty=15),
        ]
        orders = [po_booked, po_other, so]
        self.assertEqual(get_remaining_sell_qty(orders, "1", lifts), 0.0)
        self.assertEqual(get_remaining_sell_qty(orders, "2", lifts), 35.0)

    def test_booked_so_still_counts_in_full(self) -> None:
        po = _po("1", 50)
        so = _so("9", 10, po_ref="1")
        lifts = [_lift(lift_id="L1", po_ref="1", so_ref="9", qty=4)]
        self.assertEqual(get_remaining_sell_qty([po, so], "1", lifts), 40.0)

    def test_refs_match_keeps_po_and_so_apart(self) -> None:
        self.assertTrue(refs_match("PO24", "24", "purchase"))
        self.assertTrue(refs_match("SO24", "24", "sale"))
        self.assertFalse(refs_match("PO24", "SO24"))
        self.assertFalse(refs_match("PO24", "24", "sale"))
        self.assertFalse(refs_match("SO24", "24", "purchase"))

    def test_so_ignores_lift_so_ref_that_is_actually_a_po(self) -> None:
        so = _so("24", 100)
        lifts = [_lift(lift_id="L1", po_ref="1", so_ref="PO24", qty=40)]
        self.assertEqual(remaining_on_order(so, lifts), 100.0)

    def test_so_remaining_subtracts_buy_backs(self) -> None:
        so = _so("24", 100)
        so["buyBacks"] = [{"qtyMt": 15}]
        lifts = [_lift(lift_id="L1", po_ref="1", so_ref="24", qty=10)]
        self.assertEqual(remaining_on_order(so, lifts), 75.0)


if __name__ == "__main__":
    unittest.main()
