"""TradeService — mutations ported from TradeStore.tsx."""

from __future__ import annotations

import copy
from datetime import datetime
from typing import Any

from ..db import DEFAULT_STATE, get_state, save_state
from .helpers import (
    canonical_item_name,
    collect_item_names,
    deletion_date_from_now,
    find_account_company,
    format_contract_rate,
    format_deletion_date,
    format_delivery_period,
    format_qty,
    item_matches,
    normalize_company_name,
    organisation_trader_name,
    parse_products,
    round_qty_mt,
    uid,
    upsert_string,
)
from .lift_logic import (
    allocation_actual_key,
    allocation_total,
    apply_allocation_actuals,
    compute_balance_qty,
    format_allocations_summary,
    get_lift_allocations,
    get_lift_planned_qty,
    get_outstanding_balance,
    get_seller_outstanding_balance,
    remaining_carry_pair,
    lift_touches_ref,
    assign_sales_invoices_to_tankers,
    normalize_lift_tankers,
    resolve_lift_qty,
    scale_allocations,
    unique_party_names,
    validate_allocation_actuals,
    validate_lift_allocations,
    validate_stock_lift_allocations,
)
from .loader import (
    apply_lift_totals,
    build_lot_from_po,
    get_sos_for_po,
    load_and_normalize,
    load_seed_state,
    lot_number_for_po,
    order_status,
)


class TradeService:
    def __init__(self, organisation_id: int) -> None:
        self.organisation_id = organisation_id
        self._account_trader_name: str | None = None

    def _trader_name(self) -> str:
        if self._account_trader_name is None:
            self._account_trader_name = organisation_trader_name(self.organisation_id)
        return self._account_trader_name

    def _read(self) -> dict:
        return apply_lift_totals(load_and_normalize(get_state(self.organisation_id)))

    def _write(self, data: dict) -> dict:
        normalized = apply_lift_totals(load_and_normalize(data))
        save_state(normalized, self.organisation_id)
        return normalized

    def get_state(self) -> dict:
        return self._read()

    def seed(self) -> dict:
        return self._write(load_seed_state())

    def reset(self) -> dict:
        return self._write(copy.deepcopy(DEFAULT_STATE))

    def import_state(self, payload: dict) -> dict:
        raw = payload.get("data") if isinstance(payload.get("data"), dict) else payload
        if not isinstance(raw, dict):
            raise ValueError("Import payload must be a JSON object")
        if not isinstance(raw.get("tradeOrders"), list):
            raise ValueError("Import must include a tradeOrders array")
        version = payload.get("version")
        if version is not None and not isinstance(version, int):
            raise ValueError("Invalid backup version")
        if isinstance(version, int) and version > 1:
            raise ValueError(f"Backup version {version} is newer than this app supports")
        return self._write(raw)

    def _order_commission(self, order: dict) -> float:
        if order.get("brokeragePerTon") and order["brokeragePerTon"] > 0:
            return order["orderQty"] * order["brokeragePerTon"]
        return order["orderQty"] * order["rate"] * (order.get("brokeragePct", 0) / 100)

    def _producer_to_company(self, producer: dict) -> dict:
        return {
            "id": producer["id"],
            "officialName": producer["name"],
            "aliases": [],
            "types": ["seller"],
            "location": producer.get("location"),
        }

    def _retailer_to_company(self, retailer: dict) -> dict:
        return {
            "id": retailer["id"],
            "officialName": retailer["name"],
            "aliases": [],
            "types": ["buyer"],
            "location": retailer.get("location"),
        }

    def _upsert_directory_company(self, companies: list[dict], company: dict) -> list[dict]:
        idx = next((i for i, c in enumerate(companies) if c.get("id") == company.get("id")), -1)
        if idx < 0:
            return [*companies, company]
        existing = companies[idx]
        types = list(dict.fromkeys([*existing.get("types", []), *company.get("types", [])]))
        updated = {
            **existing,
            "officialName": company["officialName"],
            "location": company.get("location") or existing.get("location"),
            "types": types,
        }
        return [updated if i == idx else c for i, c in enumerate(companies)]

    def _remove_directory_company(self, companies: list[dict], company_id: str, company_type: str) -> list[dict]:
        existing = next((c for c in companies if c.get("id") == company_id), None)
        if not existing:
            return companies
        remaining_types = [t for t in existing.get("types", []) if t != company_type]
        if not remaining_types:
            return [c for c in companies if c.get("id") != company_id]
        return [
            {**c, "types": remaining_types} if c.get("id") == company_id else c for c in companies
        ]

    def _should_store_alias(self, official_name: str, extracted_name: str, aliases: list[str]) -> bool:
        trimmed = extracted_name.strip()
        if not trimmed:
            return False
        if normalize_company_name(trimmed) == normalize_company_name(official_name):
            return False
        return not any(normalize_company_name(a) == normalize_company_name(trimmed) for a in aliases)

    def _sync_producer_retailer_from_company(
        self, prev: dict, company: dict, item_name: str | None = None, rate: float | None = None
    ) -> dict[str, list]:
        producers = prev.get("producers") or []
        retailers = prev.get("retailers") or []
        types = company.get("types") or []

        if "seller" in types or "both" in types:
            if not any(p.get("id") == company["id"] or p.get("name") == company["officialName"] for p in producers):
                producers = [
                    *producers,
                    {
                        "id": company["id"],
                        "name": company["officialName"],
                        "location": company.get("location") or "",
                        "products": [item_name] if item_name else [],
                        "contracts": 0,
                        "avgRate": rate or 0,
                        "rating": 0,
                    },
                ]

        if "buyer" in types or "both" in types:
            if not any(r.get("id") == company["id"] or r.get("name") == company["officialName"] for r in retailers):
                retailers = [
                    *retailers,
                    {
                        "id": company["id"],
                        "name": company["officialName"],
                        "location": company.get("location") or "",
                        "products": [item_name] if item_name else [],
                        "totalPurchases": 0,
                        "outstanding": 0,
                        "lastOrder": "",
                    },
                ]

        return {"producers": producers, "retailers": retailers}

    def _build_order_from_input(self, input_data: dict, snapshot: dict, existing: dict | None = None) -> dict:
        companies = snapshot.get("companies") or []
        seller_company = next((c for c in companies if c.get("id") == input_data.get("sellerCompanyId")), None)
        buyer_company = next((c for c in companies if c.get("id") == input_data.get("buyerCompanyId")), None)
        party_company = next((c for c in companies if c.get("id") == input_data.get("partyCompanyId")), None)

        resolved_party_name = (party_company or {}).get("officialName") or (input_data.get("partyName") or "").strip()
        resolved_seller_name = (seller_company or {}).get("officialName") or (input_data.get("sellerName") or "").strip() or None
        resolved_buyer_name = (buyer_company or {}).get("officialName") or (input_data.get("buyerName") or "").strip() or None
        seller_company_id = input_data.get("sellerCompanyId")
        buyer_company_id = input_data.get("buyerCompanyId")

        account = find_account_company(companies, self._trader_name())
        if input_data.get("side") == "purchase":
            resolved_buyer_name = self._trader_name()
            buyer_company_id = account.get("id") or buyer_company_id
        if input_data.get("side") == "sale":
            resolved_seller_name = self._trader_name()
            seller_company_id = account.get("id") or seller_company_id

        lifted_qty = existing.get("liftedQty", 0) if existing else 0
        order = {
            "id": existing["id"] if existing else uid(),
            "ref": existing["ref"] if existing else (input_data.get("ref") or "").strip(),
            "side": input_data["side"],
            "poRef": input_data.get("poRef", "").strip() or None if input_data.get("side") == "sale" else None,
            "brokerContractRef": input_data.get("brokerContractRef"),
            "date": input_data["date"],
            "partyName": resolved_party_name,
            "partyCompanyId": input_data.get("partyCompanyId"),
            "sellerCompanyId": seller_company_id,
            "buyerCompanyId": buyer_company_id,
            "extractedPartyName": input_data.get("extractedPartyName"),
            "extractedSellerName": input_data.get("extractedSellerName"),
            "extractedBuyerName": input_data.get("extractedBuyerName"),
            "itemName": canonical_item_name(
                (input_data.get("itemName") or "").strip(),
                collect_item_names(snapshot),
            ),
            "spot": (input_data.get("spot") or "").strip(),
            "deliveryType": input_data["deliveryType"],
            "deliveryPeriodStart": input_data["deliveryPeriodStart"],
            "deliveryPeriodEnd": input_data["deliveryPeriodEnd"],
            "deliveryPeriodVerified": input_data.get(
                "deliveryPeriodVerified",
                existing.get("deliveryPeriodVerified") if existing else False,
            ),
            "rate": input_data["rate"],
            "taxRate": input_data["taxRate"],
            "orderQty": input_data["orderQty"],
            "liftedQty": lifted_qty,
            "committedLiftQty": existing.get("committedLiftQty", lifted_qty) if existing else lifted_qty,
            "unit": "MT",
            "brokerName": (input_data.get("brokerName") or "").strip(),
            "brokeragePct": input_data.get("brokeragePct", 0),
            "brokeragePerTon": input_data.get("brokeragePerTon"),
            "sellerName": resolved_seller_name,
            "buyerName": resolved_buyer_name,
            "partyConfirmedBy": (input_data.get("partyConfirmedBy") or "").strip() or None,
            "sellerConfirmedBy": (input_data.get("sellerConfirmedBy") or "").strip() or None,
            "buyerConfirmedBy": (input_data.get("buyerConfirmedBy") or "").strip() or None,
            "contractRateDisplay": input_data.get("contractRateDisplay"),
            "sellerGst": input_data.get("sellerGst"),
            "buyerGst": input_data.get("buyerGst"),
            "brand": (input_data.get("brand") or "").strip() or None,
            "rateBasis": input_data.get("rateBasis"),
            "ratePerBasis": input_data.get("ratePerBasis"),
            "paymentTerms": (input_data.get("paymentTerms") or "").strip() or None,
            "remarks": (input_data.get("remarks") or "").strip() or None,
            "status": "pending",
            "deleteScheduledAt": existing.get("deleteScheduledAt") if existing else None,
        }
        if input_data.get("side") == "purchase":
            order["orderQtyIsContract"] = (
                existing.get("orderQtyIsContract", True) if existing else True
            )
            if existing:
                order["buyBacks"] = list(existing.get("buyBacks") or [])
        if existing:
            order["status"] = order_status(
                {
                    **existing,
                    **order,
                    "orderQty": input_data["orderQty"],
                    "liftedQty": lifted_qty,
                },
            )
        return order

    def _activity(self, activity_type: str, title: str, description: str, entity_ref: str | None = None) -> dict:
        return {
            "id": uid(),
            "type": activity_type,
            "title": title,
            "description": description,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "user": self._trader_name(),
            "entityRef": entity_ref,
        }

    def add_contract(self, input_data: dict) -> tuple[dict, dict]:
        data = self._read()
        buyer = (input_data.get("buyer") or "").strip()
        seller = (input_data.get("seller") or "").strip()
        commodity = (input_data.get("commodity") or "").strip()
        if not buyer or not seller or not commodity:
            raise ValueError("Buyer, seller, and commodity are required")
        try:
            qty = float(input_data.get("quantity") or 0)
            rate = float(input_data.get("rate") or 0)
        except (TypeError, ValueError) as exc:
            raise ValueError("Quantity and rate must be numbers") from exc
        if qty <= 0 or rate <= 0:
            raise ValueError("Quantity and rate must be greater than zero")

        contracts = list(data.get("contracts") or [])
        n = 1
        existing_nums = []
        for c in contracts:
            ref = str(c.get("ref") or "")
            if ref.upper().startswith("CC-"):
                try:
                    existing_nums.append(int(ref.split("-", 1)[1]))
                except ValueError:
                    pass
        if existing_nums:
            n = max(existing_nums) + 1
        else:
            n = len(contracts) + 1
        ref = (input_data.get("ref") or "").strip() or f"CC-{n}"
        if any(str(c.get("ref")) == ref for c in contracts):
            ref = f"CC-{n}"

        contract = {
            "id": uid(),
            "ref": ref,
            "status": (input_data.get("status") or "confirmed"),
            "buyer": buyer,
            "seller": seller,
            "commodity": commodity,
            "quantity": qty,
            "unit": (input_data.get("unit") or "MT"),
            "rate": rate,
            "value": round(qty * rate, 2),
            "broker": (input_data.get("broker") or "").strip(),
            "deliveryDate": (input_data.get("deliveryDate") or ""),
            "paymentStatus": (input_data.get("paymentStatus") or "outstanding"),
            "createdAt": datetime.utcnow().isoformat() + "Z",
            "location": (input_data.get("location") or "").strip(),
        }
        contracts.append(contract)
        data["contracts"] = contracts
        activities = list(data.get("activities") or [])
        activities.insert(0, self._activity(
            "contract_created",
            f"Contract {ref} created",
            f"{commodity} · {qty} {contract['unit']} · {buyer} ↔ {seller}",
            ref,
        ))
        data["activities"] = activities
        self._write(data)
        return contract, data

    def add_order(self, input_data: dict) -> tuple[dict, dict]:
        data = self._read()
        side = input_data["side"]
        key = "po" if side == "purchase" else "so"
        counter_next = data["counters"][key] + 1
        ref = (input_data.get("ref") or "").strip() or (f"PO-{counter_next}" if side == "purchase" else f"SO-{counter_next}")

        po_ref = (input_data.get("poRef") or "").strip() if side == "sale" else None
        if side == "sale" and po_ref:
            po = next((o for o in data["tradeOrders"] if o["ref"] == po_ref and o["side"] == "purchase"), None)
            if not po:
                raise ValueError("Linked PO not found")

        order = self._build_order_from_input(input_data, data)
        order.update(
            {
                "ref": ref,
                "poRef": po_ref,
                "liftedQty": 0,
                "committedLiftQty": 0,
                "status": "pending",
                "deleteScheduledAt": None,
            }
        )

        producers = list(data.get("producers") or [])
        retailers = list(data.get("retailers") or [])
        lots = list(data.get("lots") or [])
        companies = list(data.get("companies") or [])

        def touch_company(company_id: str | None) -> None:
            nonlocal producers, retailers
            if not company_id:
                return
            company = next((c for c in companies if c.get("id") == company_id), None)
            if not company:
                return
            synced = self._sync_producer_retailer_from_company(
                {"producers": producers, "retailers": retailers, "companies": companies},
                company,
                order["itemName"],
                order["rate"],
            )
            producers = synced["producers"]
            retailers = synced["retailers"]

        def party_named(rows: list[dict], name: str) -> bool:
            key = (name or "").strip().lower()
            return bool(key) and any((r.get("name") or "").strip().lower() == key for r in rows)

        touch_company(order.get("partyCompanyId"))
        touch_company(order.get("sellerCompanyId"))
        touch_company(order.get("buyerCompanyId"))

        party_already_listed = party_named(producers, order["partyName"]) or party_named(
            retailers, order["partyName"]
        )

        if side == "purchase":
            if order["partyName"] and not party_already_listed:
                producer = {
                    "id": order.get("partyCompanyId") or uid(),
                    "name": order["partyName"],
                    "location": order["spot"],
                    "products": [order["itemName"]],
                    "contracts": 1,
                    "avgRate": order["rate"],
                    "rating": 0,
                }
                producers.append(producer)
                companies = self._upsert_directory_company(companies, self._producer_to_company(producer))
            else:
                producers = [
                    {
                        **p,
                        "contracts": p.get("contracts", 0) + 1,
                        "products": upsert_string(p.get("products") or [], order["itemName"]),
                    }
                    if p.get("name") == order["partyName"]
                    else p
                    for p in producers
                ]
            lots.append(build_lot_from_po(order))
        else:
            if order["partyName"] and not party_already_listed:
                retailer = {
                    "id": order.get("partyCompanyId") or uid(),
                    "name": order["partyName"],
                    "location": order["spot"],
                    "totalPurchases": order["orderQty"] * order["rate"],
                    "outstanding": 0,
                    "products": [order["itemName"]],
                    "lastOrder": order["date"],
                }
                retailers.append(retailer)
                companies = self._upsert_directory_company(companies, self._retailer_to_company(retailer))
            else:
                retailers = [
                    {
                        **r,
                        "totalPurchases": r.get("totalPurchases", 0) + order["orderQty"] * order["rate"],
                        "products": upsert_string(r.get("products") or [], order["itemName"]),
                        "lastOrder": order["date"],
                    }
                    if r.get("name") == order["partyName"]
                    else r
                    for r in retailers
                ]
            if order.get("poRef"):
                lot_no = lot_number_for_po(order["poRef"])
                if not any(l.get("lotNumber") == lot_no for l in lots):
                    po = next(o for o in data["tradeOrders"] if o["ref"] == order["poRef"])
                    lots.append(build_lot_from_po(po))
                lots = [
                    {
                        **l,
                        "allocated": l.get("allocated", 0) + order["orderQty"],
                        "available": l.get("available", 0) - order["orderQty"],
                        "margin": (
                            ((order["rate"] - l["purchasePrice"]) / l["purchasePrice"]) * 100
                            if order["rate"] > l.get("purchasePrice", 0)
                            else l.get("margin", 0)
                        ),
                    }
                    if l.get("lotNumber") == lot_no
                    else l
                    for l in lots
                ]

        brokers = list(data.get("brokers") or [])
        if order["brokerName"]:
            if any(b.get("name") == order["brokerName"] for b in brokers):
                brokers = [
                    {
                        **b,
                        "contracts": b.get("contracts", 0) + 1,
                        "commissionEarned": b.get("commissionEarned", 0) + self._order_commission(order),
                    }
                    if b.get("name") == order["brokerName"]
                    else b
                    for b in brokers
                ]
            else:
                brokers.append(
                    {
                        "id": uid(),
                        "name": order["brokerName"],
                        "email": "",
                        "phone": "",
                        "contracts": 1,
                        "commissionEarned": self._order_commission(order),
                        "successRate": 100,
                        "network": 1,
                    }
                )

        desc = (
            f"{ref} — {format_qty(order['orderQty'])} {order['itemName']} @ {format_contract_rate(order['rate'])} with {order['partyName']}"
            if side == "purchase"
            else (
                f"{ref} against {order['poRef']} — {format_qty(order['orderQty'])} to {order['partyName']} @ {format_contract_rate(order['rate'])}"
                if order.get("poRef")
                else f"{ref} — {format_qty(order['orderQty'])} to {order['partyName']} @ {format_contract_rate(order['rate'])} (no PO linked yet)"
            )
        )

        next_data = {
            **data,
            "tradeOrders": [*data["tradeOrders"], order],
            "producers": producers,
            "retailers": retailers,
            "companies": companies,
            "lots": lots,
            "brokers": brokers,
            "spots": upsert_string(data.get("spots") or [], order["spot"]),
            "items": upsert_string(data.get("items") or [], order["itemName"]),
            "counters": {**data["counters"], key: counter_next},
            "activities": [
                self._activity(
                    "po_created" if side == "purchase" else "so_created",
                    "PO created" if side == "purchase" else "SO created",
                    desc,
                    ref,
                ),
                *(data.get("activities") or []),
            ],
        }
        return order, self._write(next_data)

    def update_order(self, order_id: str, input_data: dict) -> tuple[dict, dict]:
        data = self._read()
        existing = next((o for o in data["tradeOrders"] if o.get("id") == order_id), None)
        if not existing:
            raise ValueError("Order not found")
        if existing["side"] != input_data["side"]:
            raise ValueError("Cannot change order type")
        if input_data["orderQty"] < existing.get("liftedQty", 0):
            raise ValueError(f"Quantity cannot be less than lifted qty ({format_qty(existing['liftedQty'])})")
        if existing.get("side") == "purchase":
            from .buy_back import total_buy_back_qty

            min_qty = existing.get("liftedQty", 0) + total_buy_back_qty(existing)
            if input_data["orderQty"] < min_qty:
                raise ValueError(
                    f"PO quantity cannot be less than lifted plus buy back "
                    f"({format_qty(min_qty)})",
                )

        resolved_po_ref = existing.get("poRef") or (input_data.get("poRef") or "").strip() or None
        if input_data["side"] == "sale" and resolved_po_ref:
            po = next((o for o in data["tradeOrders"] if o["ref"] == resolved_po_ref and o["side"] == "purchase"), None)
            if not po:
                raise ValueError("Linked PO not found")

        updated = self._build_order_from_input(input_data, data, existing)
        updated["ref"] = existing["ref"]
        updated["poRef"] = resolved_po_ref
        updated["id"] = existing["id"]

        lots = list(data.get("lots") or [])
        qty_delta = updated["orderQty"] - existing["orderQty"]

        if updated["side"] == "purchase":
            lot_no = lot_number_for_po(updated["ref"])
            lots = [
                {
                    **l,
                    "commodity": updated["itemName"],
                    "purchasePrice": updated["rate"],
                    "quantityPurchased": updated["orderQty"],
                    "remaining": max(0, updated["orderQty"] - updated.get("liftedQty", 0)),
                    "available": updated["orderQty"] - l.get("allocated", 0),
                    "producer": updated["partyName"],
                    "broker": updated["brokerName"],
                    "purchaseDate": updated["date"],
                }
                if l.get("lotNumber") == lot_no
                else l
                for l in lots
            ]
        elif updated.get("poRef"):
            lot_no = lot_number_for_po(updated["poRef"])
            if not existing.get("poRef"):
                if not any(l.get("lotNumber") == lot_no for l in lots):
                    po = next(o for o in data["tradeOrders"] if o["ref"] == updated["poRef"])
                    lots.append(build_lot_from_po(po))
                lots = [
                    {
                        **l,
                        "allocated": l.get("allocated", 0) + updated["orderQty"],
                        "available": l.get("available", 0) - updated["orderQty"],
                        "margin": (
                            ((updated["rate"] - l["purchasePrice"]) / l["purchasePrice"]) * 100
                            if updated["rate"] > l.get("purchasePrice", 0)
                            else l.get("margin", 0)
                        ),
                    }
                    if l.get("lotNumber") == lot_no
                    else l
                    for l in lots
                ]
            elif qty_delta != 0:
                lots = [
                    {
                        **l,
                        "allocated": l.get("allocated", 0) + qty_delta,
                        "available": l.get("available", 0) - qty_delta,
                        "margin": (
                            ((updated["rate"] - l["purchasePrice"]) / l["purchasePrice"]) * 100
                            if updated["rate"] > l.get("purchasePrice", 0)
                            else l.get("margin", 0)
                        ),
                    }
                    if l.get("lotNumber") == lot_no
                    else l
                    for l in lots
                ]

        next_data = {
            **data,
            "tradeOrders": [updated if o.get("id") == order_id else o for o in data["tradeOrders"]],
            "lots": lots,
            "spots": upsert_string(data.get("spots") or [], updated["spot"]),
            "items": upsert_string(data.get("items") or [], updated["itemName"]),
            "activities": [
                self._activity(
                    "order_updated",
                    "PO updated" if updated["side"] == "purchase" else "SO updated",
                    f"{updated['ref']} — {format_qty(updated['orderQty'])} {updated['itemName']}",
                    updated["ref"],
                ),
                *(data.get("activities") or []),
            ],
        }
        return updated, self._write(next_data)

    def buy_back_po(self, order_id: str, input_data: dict) -> tuple[dict, dict]:
        data = self._read()
        po = next((o for o in data["tradeOrders"] if o.get("id") == order_id), None)
        if not po or po.get("side") != "purchase":
            raise ValueError("Purchase order not found")

        from .buy_back import effective_po_qty, max_buy_back_qty

        linked_sos = get_sos_for_po(data["tradeOrders"], po["ref"])
        allocated = sum(o.get("orderQty", 0) for o in linked_sos)
        lifted = po.get("liftedQty", 0) or 0
        max_buy_back = max_buy_back_qty(po, linked_sos)
        if any(lift_touches_ref(l, po["ref"]) for l in data.get("lifts") or [] if l.get("status") == "pending"):
            raise ValueError("Remove or complete scheduled lifts before recording a buy back")

        qty = round_qty_mt(float(input_data.get("qtyMt") or 0))
        rate = float(input_data.get("rate") or 0)
        if qty <= 0:
            raise ValueError("Quantity must be greater than zero")
        if rate <= 0:
            raise ValueError("Enter a valid buy-back rate")
        if qty > max_buy_back:
            if allocated > 0 or lifted > 0:
                raise ValueError(
                    f"Cannot buy back more than {format_qty(max_buy_back)} — "
                    f"{format_qty(allocated)} allocated to sales orders"
                    + (f", {format_qty(lifted)} already lifted" if lifted > 0 else "")
                )
            raise ValueError(f"Cannot buy back more than {format_qty(max_buy_back)}")

        buy_back = {
            "id": uid(),
            "date": (input_data.get("date") or datetime.utcnow().date().isoformat()),
            "qtyMt": qty,
            "rate": rate,
            "rateBasis": input_data.get("rateBasis") or po.get("rateBasis"),
            "ratePerBasis": input_data.get("ratePerBasis") or po.get("ratePerBasis"),
            "remarks": (input_data.get("remarks") or "").strip() or None,
        }

        buy_backs = list(po.get("buyBacks") or [])
        buy_backs.append(buy_back)
        effective_after = round_qty_mt(effective_po_qty(po) - qty)
        status_po = {**po, "buyBacks": buy_backs, "liftedQty": lifted}
        updated_po = {
            **po,
            "buyBacks": buy_backs,
            "status": "cancelled" if effective_after <= 0 else order_status(status_po),
        }

        orders = [updated_po if o.get("id") == order_id else o for o in data["tradeOrders"]]
        next_data = load_and_normalize({**data, "tradeOrders": orders})
        desc = (
            f"{po['ref']} — {format_qty(qty)} bought back by {po['partyName']} "
            f"@ {format_contract_rate(rate)}"
        )
        next_data["activities"] = [
            self._activity("po_buy_back", "Buy back", desc, po["ref"]),
            *(next_data.get("activities") or []),
        ]
        return updated_po, self._write(next_data)

    def close_order(self, order_id: str, input_data: dict) -> tuple[dict, dict]:
        data = self._read()
        order = next((o for o in data["tradeOrders"] if o.get("id") == order_id), None)
        if not order:
            raise ValueError("Order not found")
        if order.get("status") in ("completed", "cancelled"):
            raise ValueError("Order is already closed")

        if any(
            lift_touches_ref(l, order["ref"])
            for l in data.get("lifts") or []
            if l.get("status") == "pending"
        ):
            raise ValueError("Complete or remove pending lifts before closing")

        method = (input_data.get("method") or "").strip()
        if method not in ("cash", "carried_forward", "short_closed"):
            raise ValueError("Choose how to close this order")

        settlements = list(data.get("balanceSettlements") or [])
        from .buy_back import effective_po_qty

        lifted = order.get("liftedQty", 0) or 0
        committed = order.get("committedLiftQty", lifted) or lifted
        qty_cap = (
            effective_po_qty(order)
            if order.get("side") == "purchase"
            else float(order.get("orderQty", 0) or 0)
        )
        to_be_lifted = round_qty_mt(max(0, qty_cap - committed))

        po_ref = None
        so_ref = None
        balance_owed = 0.0

        if order.get("side") == "sale" and order.get("poRef"):
            po_ref = order["poRef"]
            so_ref = order["ref"]
            balance_owed = get_outstanding_balance(data["lifts"], po_ref, so_ref, settlements)
        elif order.get("side") == "purchase":
            linked = [
                o
                for o in get_sos_for_po(data["tradeOrders"], order["ref"])
                if o.get("status") not in ("completed", "cancelled")
            ]
            with_balance = [
                (so, get_outstanding_balance(data["lifts"], order["ref"], so["ref"], settlements))
                for so in linked
            ]
            with_balance = [(so, bal) for so, bal in with_balance if bal > 0]
            if len(with_balance) == 1:
                po_ref = order["ref"]
                so_ref = with_balance[0][0]["ref"]
                balance_owed = with_balance[0][1]

        carry_pair = remaining_carry_pair(order, data["tradeOrders"], po_ref, so_ref)

        if method == "cash":
            if balance_owed <= 0 and to_be_lifted <= 0:
                raise ValueError("Nothing to settle in cash")
        elif method == "carried_forward":
            if balance_owed <= 0 and to_be_lifted <= 0:
                raise ValueError("Nothing to carry to the next delivery")
            if balance_owed > 0 and (not po_ref or not so_ref) and to_be_lifted <= 0:
                raise ValueError("No delivery balance to settle on this order")
            if to_be_lifted > 0 and not carry_pair:
                raise ValueError("Link a purchase order before carrying remaining qty to the next delivery")
        elif method == "short_closed":
            if to_be_lifted <= 0 and balance_owed <= 0:
                raise ValueError("Nothing to write off")
        else:
            raise ValueError("Invalid close method")

        notes = (input_data.get("notes") or "").strip() or None
        settled_at = (input_data.get("settledAt") or datetime.utcnow().date().isoformat()).strip()
        now_iso = datetime.utcnow().isoformat() + "Z"

        updated = {**order}
        activities: list[dict] = []

        if method == "short_closed":
            if to_be_lifted > 0:
                updated["orderQty"] = lifted
            if balance_owed > 0 and po_ref and so_ref:
                po = next(
                    (o for o in data["tradeOrders"] if o.get("ref") == po_ref and o.get("side") == "purchase"),
                    None,
                )
                rate = order.get("rate") or (po.get("rate") if po else 0) or 0
                settlements.append(
                    {
                        "id": uid(),
                        "poRef": po_ref,
                        "soRef": so_ref,
                        "qtyMt": balance_owed,
                        "rate": rate,
                        "amount": round(rate * balance_owed, 2),
                        "method": "cash",
                        "settledAt": settled_at,
                        "notes": notes or "Written off — no further delivery",
                    }
                )
            write_off_qty = to_be_lifted or balance_owed
            updated.update(
                {
                    "status": "completed",
                    "completionType": "short_closed",
                    "closedAt": now_iso,
                    "closedNotes": notes,
                }
            )
            desc = (
                f"{order['ref']} — wrote off {format_qty(write_off_qty)} {order.get('itemName', '')}"
                + (f" · {notes}" if notes else "")
            )
            activities.append(self._activity("order_short_closed", "Order short closed", desc, order["ref"]))
        else:
            po_lookup = po_ref or (carry_pair[0] if carry_pair else None)
            po = next(
                (o for o in data["tradeOrders"] if o.get("ref") == po_lookup and o.get("side") == "purchase"),
                None,
            )
            rate = order.get("rate") or (po.get("rate") if po else 0) or 0
            completion_type = "cash_settled" if method == "cash" else "carried_forward"

            if balance_owed > 0 and po_ref and so_ref:
                settlements.append(
                    {
                        "id": uid(),
                        "poRef": po_ref,
                        "soRef": so_ref,
                        "qtyMt": balance_owed,
                        "rate": rate,
                        "amount": round(rate * balance_owed, 2),
                        "method": "cash" if method == "cash" else "carried_forward",
                        "settledAt": settled_at,
                        "notes": notes,
                    }
                )

            if to_be_lifted > 0:
                if carry_pair:
                    carry_po, carry_so = carry_pair
                    settlements.append(
                        {
                            "id": uid(),
                            "poRef": carry_po,
                            "soRef": carry_so,
                            "qtyMt": to_be_lifted,
                            "rate": rate,
                            "amount": round(rate * to_be_lifted, 2),
                            "method": "cash" if method == "cash" else "carried_forward",
                            "source": "unlifted",
                            "settledAt": settled_at,
                            "notes": notes,
                        }
                    )
                updated["orderQty"] = lifted

            updated.update(
                {
                    "status": "completed",
                    "completionType": completion_type,
                    "closedAt": now_iso,
                    "closedNotes": notes,
                }
            )
            closed_qty = round_qty_mt((balance_owed or 0) + (to_be_lifted or 0))
            if method == "cash":
                desc = (
                    f"{order['ref']} — {format_qty(closed_qty)} settled in cash "
                    f"@ {format_contract_rate(rate)}"
                    + (f" · {notes}" if notes else "")
                )
                activities.append(self._activity("balance_cash_settled", "Settled in cash", desc, order["ref"]))
            else:
                desc = (
                    f"{order['ref']} — {format_qty(closed_qty)} to adjust on next delivery"
                    + (f" · {notes}" if notes else "")
                )
                activities.append(self._activity("order_closed_carried", "Adjust in next delivery", desc, order["ref"]))

        orders = [updated if o.get("id") == order_id else o for o in data["tradeOrders"]]
        next_data = {
            **data,
            "tradeOrders": orders,
            "balanceSettlements": settlements,
            "activities": [*activities, *(data.get("activities") or [])],
        }
        return updated, self._write(next_data)

    def add_lift(self, input_data: dict) -> tuple[dict, dict]:
        data = self._read()
        stock_lift = bool(input_data.get("stockLift"))
        allocations_in = []
        for a in input_data.get("allocations") or []:
            entry = {
                "poRef": a["poRef"].strip(),
                "qtyMt": round_qty_mt(a["qtyMt"]),
            }
            if not stock_lift:
                entry["soRef"] = a["soRef"].strip()
            allocations_in.append(entry)

        if stock_lift:
            alloc_error = validate_stock_lift_allocations(allocations_in, data["tradeOrders"], data["lifts"])
        else:
            alloc_error = validate_lift_allocations(allocations_in, data["tradeOrders"], data["lifts"])
        if alloc_error:
            raise ValueError(alloc_error)

        tankers = normalize_lift_tankers(input_data.get("tankers") or [])
        tanker_qty = resolve_lift_qty(tankers)
        if tanker_qty <= 0:
            raise ValueError("Enter planned quantity for at least one tanker")

        alloc_sum = allocation_total(allocations_in)
        if tanker_qty != alloc_sum:
            raise ValueError(
                f"Tanker qty ({format_qty(tanker_qty)}) must match the {'PO' if stock_lift else 'SO'} total ({format_qty(alloc_sum)})"
            )

        balance_applied = (
            round_qty_mt(input_data.get("balanceAppliedQtyMt") or 0)
            if not stock_lift and len(allocations_in) == 1
            else 0
        )
        if balance_applied < 0:
            raise ValueError("Balance adjustment cannot be negative")
        if balance_applied > 0:
            po_for_balance = next(
                o for o in data["tradeOrders"] if o["ref"] == allocations_in[0]["poRef"] and o["side"] == "purchase"
            )
            seller_name = po_for_balance.get("sellerName") or po_for_balance.get("partyName") or ""
            outstanding = get_seller_outstanding_balance(
                data["lifts"],
                data["tradeOrders"],
                seller_name,
                data.get("balanceSettlements"),
            )
            if balance_applied > outstanding:
                raise ValueError(
                    f"Balance adjustment cannot exceed {format_qty(outstanding)} outstanding for this seller"
                )

        allocations = (
            [{**allocations_in[0], "qtyMt": round_qty_mt(allocations_in[0]["qtyMt"] + balance_applied)}]
            if balance_applied > 0
            else allocations_in
        )

        first = allocations[0]
        po = next(o for o in data["tradeOrders"] if o["ref"] == first["poRef"] and o["side"] == "purchase")
        if stock_lift:
            buyer_name = self._trader_name()
            seller_name = po["partyName"]
            so_rate = po["rate"]
            so_ref = ""
        else:
            so = next(o for o in data["tradeOrders"] if o["ref"] == first["soRef"] and o["side"] == "sale")
            buyer_name = unique_party_names(
                [
                    next((o["partyName"] for o in data["tradeOrders"] if o["ref"] == a["soRef"]), "")
                    for a in allocations
                ]
            )
            seller_name = unique_party_names(
                [
                    next((o["partyName"] for o in data["tradeOrders"] if o["ref"] == a["poRef"]), "")
                    for a in allocations
                ]
            )
            so_rate = so["rate"]
            so_ref = first["soRef"]

        lifted_qty = allocation_total(allocations)
        lift_ref = data["counters"]["lift"] + 1
        lift = {
            "id": uid(),
            "liftRef": lift_ref,
            "poRef": first["poRef"],
            "soRef": so_ref,
            "allocations": allocations,
            "date": input_data["date"],
            "status": "pending",
            "buyerName": buyer_name or self._trader_name(),
            "sellerName": seller_name or po["partyName"],
            "itemName": po["itemName"],
            "deliveryPeriod": format_delivery_period(po),
            "deliveryPeriodStart": po["deliveryPeriodStart"],
            "deliveryPeriodEnd": po["deliveryPeriodEnd"],
            "deliveryPeriodVerified": po.get("deliveryPeriodVerified", False),
            "rate": so_rate,
            "liftedQty": lifted_qty,
            "plannedQtyMt": lifted_qty,
            "balanceAppliedQtyMt": balance_applied if balance_applied > 0 else None,
            "tankerNo": tankers[0]["tankerNo"] if tankers else "",
            "tankers": tankers,
            "isSelfLift": input_data.get("isSelfLift", False),
            "stockLift": stock_lift,
            "loadOnRisk": bool(input_data.get("loadOnRisk")),
            "remarks": (input_data.get("remarks") or "").strip() or None,
        }

        order_summary = format_allocations_summary(allocations, stock_lift=stock_lift)
        desc = (
            f"Lift #{lift_ref} — {format_qty(lifted_qty)} planned ({format_qty(balance_applied)} prior balance) · in transit ({order_summary})"
            if balance_applied > 0
            else f"Lift #{lift_ref} — {format_qty(lifted_qty)} planned · in transit ({order_summary})"
        )

        next_data = apply_lift_totals(
            {
                **data,
                "lifts": [*data["lifts"], lift],
                "counters": {**data["counters"], "lift": lift_ref},
                "activities": [
                    self._activity("lift_recorded", "Lift recorded", desc, f"Lift-{lift_ref}"),
                    *(data.get("activities") or []),
                ],
            }
        )
        return lift, self._write(next_data)

    def update_lift(self, lift_id: str, input_data: dict) -> tuple[dict, dict]:
        data = self._read()
        existing = next((l for l in data["lifts"] if l.get("id") == lift_id), None)
        if not existing:
            raise ValueError("Lift not found")

        stock_lift = bool(input_data.get("stockLift", existing.get("stockLift", False)))
        tankers = normalize_lift_tankers(input_data.get("tankers") or [])
        tanker_qty = resolve_lift_qty(tankers)
        qty_label = "actual weighed quantity" if existing.get("status") == "delivered" else "planned quantity"
        if tanker_qty <= 0:
            raise ValueError(f"Enter {qty_label} for at least one tanker")

        if existing.get("status") == "pending":
            if input_data.get("allocations"):
                allocations = []
                for a in input_data["allocations"]:
                    entry = {"poRef": a["poRef"].strip(), "qtyMt": round_qty_mt(a["qtyMt"])}
                    if not stock_lift:
                        entry["soRef"] = a["soRef"].strip()
                    allocations.append(entry)
            else:
                allocations = get_lift_allocations(existing)
        else:
            allocations = scale_allocations(get_lift_allocations(existing), tanker_qty)

        balance_applied = (
            round_qty_mt(input_data.get("balanceAppliedQtyMt") or existing.get("balanceAppliedQtyMt") or 0)
            if existing.get("status") == "pending" and not stock_lift and len(allocations) == 1
            else 0
        )

        if existing.get("status") == "pending":
            alloc_sum = allocation_total(allocations)
            if tanker_qty != alloc_sum:
                raise ValueError(
                    f"Tanker qty ({format_qty(tanker_qty)}) must match the {'PO' if stock_lift else 'SO'} total ({format_qty(alloc_sum)})"
                )
            if balance_applied < 0:
                raise ValueError("Balance adjustment cannot be negative")
            if balance_applied > 0:
                po_for_balance = next(
                    o for o in data["tradeOrders"] if o["ref"] == allocations[0]["poRef"] and o["side"] == "purchase"
                )
                seller_name = po_for_balance.get("sellerName") or po_for_balance.get("partyName") or ""
                outstanding = get_seller_outstanding_balance(
                    data["lifts"],
                    data["tradeOrders"],
                    seller_name,
                    data.get("balanceSettlements"),
                    exclude_lift_id=lift_id,
                )
                if balance_applied > outstanding:
                    raise ValueError(
                        f"Balance adjustment cannot exceed {format_qty(outstanding)} outstanding for this seller"
                    )
                allocations = [{**allocations[0], "qtyMt": round_qty_mt(allocations[0]["qtyMt"] + balance_applied)}]

        if stock_lift:
            alloc_error = validate_stock_lift_allocations(allocations, data["tradeOrders"], data["lifts"], lift_id)
        else:
            alloc_error = validate_lift_allocations(allocations, data["tradeOrders"], data["lifts"], lift_id)
        if alloc_error:
            raise ValueError(alloc_error)

        first = allocations[0]
        po = next(o for o in data["tradeOrders"] if o["ref"] == first["poRef"] and o["side"] == "purchase")
        if stock_lift:
            buyer_name = self._trader_name()
            seller_name = po["partyName"]
            so_rate = po["rate"]
            so_ref = ""
        else:
            so = next(o for o in data["tradeOrders"] if o["ref"] == first["soRef"] and o["side"] == "sale")
            buyer_name = unique_party_names(
                [next((o.get("partyName", "") for o in data["tradeOrders"] if o["ref"] == a["soRef"]), "") for a in allocations]
            )
            seller_name = unique_party_names(
                [next((o.get("partyName", "") for o in data["tradeOrders"] if o["ref"] == a["poRef"]), "") for a in allocations]
            )
            so_rate = so["rate"]
            so_ref = first["soRef"]

        lifted_qty = allocation_total(allocations) if existing.get("status") == "pending" else tanker_qty
        planned_qty_mt = lifted_qty if existing.get("status") == "pending" else (existing.get("plannedQtyMt") or get_lift_planned_qty(existing))
        balance_qty_mt = (
            compute_balance_qty(planned_qty_mt, lifted_qty)
            if existing.get("status") == "delivered"
            else existing.get("balanceQtyMt")
        )

        updated = {
            **existing,
            "poRef": first["poRef"],
            "soRef": so_ref,
            "allocations": allocations,
            "date": input_data["date"],
            "buyerName": buyer_name or self._trader_name(),
            "sellerName": seller_name or po["partyName"],
            "itemName": po["itemName"],
            "deliveryPeriod": format_delivery_period(po),
            "deliveryPeriodStart": po["deliveryPeriodStart"],
            "deliveryPeriodEnd": po["deliveryPeriodEnd"],
            "deliveryPeriodVerified": po.get("deliveryPeriodVerified", False),
            "rate": so_rate,
            "liftedQty": lifted_qty,
            "plannedQtyMt": planned_qty_mt,
            "balanceQtyMt": balance_qty_mt,
            "balanceAppliedQtyMt": (
                balance_applied
                if existing.get("status") == "pending" and balance_applied > 0
                else (None if existing.get("status") == "pending" else existing.get("balanceAppliedQtyMt"))
            ),
            "tankerNo": tankers[0]["tankerNo"] if tankers else "",
            "tankers": tankers,
            "isSelfLift": input_data.get("isSelfLift", False),
            "stockLift": stock_lift,
            "loadOnRisk": bool(input_data.get("loadOnRisk", existing.get("loadOnRisk", False))),
            "remarks": (input_data.get("remarks") or "").strip() or existing.get("remarks"),
        }
        if existing.get("status") == "delivered" and "salesInvoiceNo" in input_data:
            inv = (input_data.get("salesInvoiceNo") or "").strip()
            updated["salesInvoiceNo"] = inv or existing.get("salesInvoiceNo")

        title = "Lift PO reassigned" if first["poRef"] != existing.get("poRef") else "Lift quantity updated"
        next_data = apply_lift_totals(
            {
                **data,
                "lifts": [updated if l.get("id") == lift_id else l for l in data["lifts"]],
                "activities": [
                    self._activity(
                        "lift_recorded",
                        title,
                        f"Lift #{updated['liftRef']} — {format_qty(lifted_qty)} ({format_allocations_summary(allocations, stock_lift=stock_lift)})",
                        f"Lift-{updated['liftRef']}",
                    ),
                    *(data.get("activities") or []),
                ],
            }
        )
        return updated, self._write(next_data)

    def mark_lift_delivered(self, lift_id: str, input_data: dict) -> tuple[dict, dict]:
        data = self._read()
        existing = next((l for l in data["lifts"] if l.get("id") == lift_id), None)
        if not existing:
            raise ValueError("Lift not found")
        if existing.get("status") == "delivered":
            raise ValueError("Lift is already delivered")

        tankers = normalize_lift_tankers(input_data.get("tankers") or [])
        planned_allocations = get_lift_allocations(existing)
        allocations = planned_allocations
        tankers_resolved = tankers
        lifted_qty = resolve_lift_qty(tankers)

        if input_data.get("allocations"):
            actual_by_key = {allocation_actual_key(a): a["qtyMt"] for a in input_data["allocations"]}
            actual_error = validate_allocation_actuals(planned_allocations, actual_by_key)
            if actual_error:
                raise ValueError(actual_error)
            same_pairs = all(
                any(
                    p.get("soRef") == a.get("soRef") and p["poRef"] == a["poRef"]
                    for p in planned_allocations
                )
                for a in input_data["allocations"]
            )
            if not same_pairs or len(input_data["allocations"]) != len(planned_allocations):
                raise ValueError("Delivery quantities must match the orders on this lift")
            allocations = apply_allocation_actuals(planned_allocations, actual_by_key)
            alloc_total = allocation_total(allocations)
            if alloc_total <= 0:
                raise ValueError("Enter actual weighed quantity for each order on this lift")
            if len(tankers) == 1:
                tankers_resolved = [{**tankers[0], "actualQtyMt": alloc_total}]
                lifted_qty = alloc_total
            else:
                lifted_qty = resolve_lift_qty(tankers)
                if lifted_qty != alloc_total:
                    raise ValueError(
                        f"Tanker actual ({format_qty(lifted_qty)}) must match SO actual total ({format_qty(alloc_total)})"
                    )
        else:
            if lifted_qty <= 0:
                raise ValueError("Enter actual weighed quantity for at least one tanker")
            allocations = scale_allocations(planned_allocations, lifted_qty)

        stock_lift = bool(existing.get("stockLift"))
        if stock_lift:
            alloc_error = validate_stock_lift_allocations(allocations, data["tradeOrders"], data["lifts"], lift_id)
        else:
            alloc_error = validate_lift_allocations(allocations, data["tradeOrders"], data["lifts"], lift_id)
        if alloc_error:
            raise ValueError(alloc_error)

        planned_qty_mt = existing.get("plannedQtyMt") or existing.get("liftedQty", 0)
        balance_qty_mt = compute_balance_qty(planned_qty_mt, lifted_qty)
        delivered_at = input_data.get("deliveredAt") or datetime.utcnow().isoformat() + "Z"
        lift_level_invoice = (input_data.get("salesInvoiceNo") or "").strip() or None
        tankers_resolved, sales_invoice_no, counters = assign_sales_invoices_to_tankers(
            tankers_resolved,
            data["counters"],
            delivered_at,
            lift_level_invoice=lift_level_invoice,
        )
        order_summary = format_allocations_summary(allocations, stock_lift=stock_lift)

        updated = {
            **existing,
            "status": "delivered",
            "deliveredAt": delivered_at,
            "salesInvoiceNo": sales_invoice_no or None,
            "liftedQty": lifted_qty,
            "plannedQtyMt": planned_qty_mt,
            "allocations": allocations,
            "balanceQtyMt": balance_qty_mt if balance_qty_mt > 0 else None,
            "tankerNo": tankers_resolved[0]["tankerNo"] if tankers_resolved else "",
            "tankers": tankers_resolved,
        }

        invoice_bit = f" · {sales_invoice_no}" if sales_invoice_no else ""
        desc = (
            f"Lift #{updated['liftRef']} — {format_qty(lifted_qty)} actual ({format_qty(balance_qty_mt)} balance owed){invoice_bit} ({order_summary})"
            if balance_qty_mt > 0
            else f"Lift #{updated['liftRef']} — {format_qty(lifted_qty)} actual{invoice_bit} ({order_summary})"
        )

        next_data = apply_lift_totals(
            {
                **data,
                "lifts": [updated if l.get("id") == lift_id else l for l in data["lifts"]],
                "counters": counters,
                "activities": [
                    self._activity("lift_recorded", "Lift delivered", desc, f"Lift-{updated['liftRef']}"),
                    *(data.get("activities") or []),
                ],
            }
        )
        return updated, self._write(next_data)

    def _get_delete_block_reason(self, order: dict, orders: list[dict], lifts: list[dict]) -> str | None:
        if order.get("deleteScheduledAt"):
            return f"Deletion already scheduled for {format_deletion_date(order['deleteScheduledAt'])}."
        if order.get("liftedQty", 0) > 0:
            return f"This order has {format_qty(order['liftedQty'])} lifted. Remove lift records first."
        if any(lift_touches_ref(l, order["ref"]) for l in lifts):
            return "This order has lift records linked to it. Delete those lifts first."
        if order.get("side") == "purchase":
            from .loader import get_sos_for_po

            linked = get_sos_for_po(orders, order["ref"])
            if linked:
                return f"This PO has linked SO(s): {', '.join(s['ref'] for s in linked)}. Delete those first."
        return None

    def can_delete_order(self, order_id: str) -> dict:
        data = self._read()
        order = next((o for o in data["tradeOrders"] if o.get("id") == order_id), None)
        if not order:
            return {"ok": False, "reason": "Order not found"}
        reason = self._get_delete_block_reason(order, data["tradeOrders"], data["lifts"])
        return {"ok": False, "reason": reason} if reason else {"ok": True}

    def schedule_order_deletion(self, order_id: str) -> tuple[None, dict]:
        data = self._read()
        order = next((o for o in data["tradeOrders"] if o.get("id") == order_id), None)
        if not order:
            raise ValueError("Order not found")
        reason = self._get_delete_block_reason(order, data["tradeOrders"], data["lifts"])
        if reason:
            raise ValueError(reason)

        delete_scheduled_at = deletion_date_from_now()
        next_data = {
            **data,
            "tradeOrders": [
                {**o, "deleteScheduledAt": delete_scheduled_at} if o.get("id") == order_id else o
                for o in data["tradeOrders"]
            ],
            "activities": [
                self._activity(
                    "order_deletion_scheduled",
                    "PO deletion scheduled" if order["side"] == "purchase" else "SO deletion scheduled",
                    f"{order['ref']} will be deleted on {format_deletion_date(delete_scheduled_at)}",
                    order["ref"],
                ),
                *(data.get("activities") or []),
            ],
        }
        return None, self._write(next_data)

    def cancel_order_deletion(self, order_id: str) -> tuple[None, dict]:
        data = self._read()
        order = next((o for o in data["tradeOrders"] if o.get("id") == order_id), None)
        if not order:
            raise ValueError("Order not found")
        if not order.get("deleteScheduledAt"):
            raise ValueError("No deletion scheduled for this order")

        next_data = {
            **data,
            "tradeOrders": [
                {**o, "deleteScheduledAt": None} if o.get("id") == order_id else o for o in data["tradeOrders"]
            ],
            "activities": [
                self._activity(
                    "order_updated",
                    "PO deletion cancelled" if order["side"] == "purchase" else "SO deletion cancelled",
                    f"{order['ref']} will no longer be deleted",
                    order["ref"],
                ),
                *(data.get("activities") or []),
            ],
        }
        return None, self._write(next_data)

    def confirm_company_link(self, input_data: dict) -> tuple[dict, dict]:
        data = self._read()
        extracted = (input_data.get("extractedName") or "").strip()
        if not extracted:
            raise ValueError("Extracted company name is required")

        companies = list(data.get("companies") or [])
        company: dict

        if input_data.get("companyId"):
            existing = next((c for c in companies if c.get("id") == input_data["companyId"]), None)
            if not existing:
                raise ValueError("Company not found")
            aliases = (
                [*existing.get("aliases", []), extracted]
                if self._should_store_alias(existing["officialName"], extracted, existing.get("aliases") or [])
                else existing.get("aliases") or []
            )
            types = existing.get("types") or []
            if input_data["type"] not in types:
                types = [*types, input_data["type"]]
            company = {
                **existing,
                "aliases": aliases,
                "types": types,
                "gst": input_data.get("gst") or existing.get("gst"),
                "location": (input_data.get("location") or "").strip() or existing.get("location"),
            }
            synced = self._sync_producer_retailer_from_company(data, company)
            next_data = {
                **data,
                "companies": [company if c.get("id") == company["id"] else c for c in companies],
                **synced,
            }
        else:
            official_name = (input_data.get("officialName") or extracted).strip()
            if not official_name:
                raise ValueError("Official company name is required")
            if any(
                normalize_company_name(c.get("officialName", "")) == normalize_company_name(official_name)
                for c in companies
            ):
                raise ValueError("A company with this official name already exists")
            company = {
                "id": uid(),
                "officialName": official_name,
                "aliases": [extracted] if self._should_store_alias(official_name, extracted, []) else [],
                "types": [input_data["type"]],
                "gst": input_data.get("gst"),
                "location": (input_data.get("location") or "").strip() or None,
            }
            synced = self._sync_producer_retailer_from_company(data, company)
            next_data = {**data, "companies": [*companies, company], **synced}

        return company, self._write(next_data)

    def link_high_confidence_company(self, result: dict, company_type: str) -> tuple[dict, dict]:
        if not result.get("match") or result.get("confidence") != "high":
            raise ValueError("No high-confidence company match")
        return self.confirm_company_link(
            {
                "extractedName": result.get("extractedName"),
                "companyId": result["match"]["company"]["id"],
                "type": company_type,
            }
        )

    def add_broker(self, input_data: dict) -> tuple[dict, dict]:
        data = self._read()
        name = (input_data.get("name") or "").strip()
        if not name:
            raise ValueError("Name is required")
        if any(b.get("name", "").lower() == name.lower() for b in data.get("brokers") or []):
            raise ValueError("A broker with this name already exists")
        broker = {
            "id": uid(),
            "name": name,
            "email": (input_data.get("email") or "").strip(),
            "phone": (input_data.get("phone") or "").strip(),
            "contracts": 0,
            "commissionEarned": 0,
            "successRate": 0,
            "network": 0,
            "purchaseBrokerage": input_data.get("purchaseBrokerage"),
            "saleBrokerage": input_data.get("saleBrokerage"),
            "itemBrokerages": input_data.get("itemBrokerages") or None,
        }
        next_data = {**data, "brokers": [*(data.get("brokers") or []), broker]}
        return broker, self._write(next_data)

    def update_broker(self, broker_id: str, input_data: dict) -> tuple[dict, dict]:
        data = self._read()
        broker = next((b for b in data.get("brokers") or [] if b.get("id") == broker_id), None)
        if not broker:
            raise ValueError("Broker not found")
        name = (input_data.get("name") or "").strip()
        if not name:
            raise ValueError("Name is required")
        if any(
            b.get("id") != broker_id and b.get("name", "").lower() == name.lower()
            for b in data.get("brokers") or []
        ):
            raise ValueError("A broker with this name already exists")
        old_name = broker["name"]
        updated = {
            **broker,
            "name": name,
            "email": (input_data.get("email") or "").strip(),
            "phone": (input_data.get("phone") or "").strip(),
            "purchaseBrokerage": input_data.get("purchaseBrokerage"),
            "saleBrokerage": input_data.get("saleBrokerage"),
            "itemBrokerages": input_data.get("itemBrokerages") or None,
        }
        next_data = {
            **data,
            "brokers": [updated if b.get("id") == broker_id else b for b in data.get("brokers") or []],
            "tradeOrders": [
                {**o, "brokerName": name} if o.get("brokerName") == old_name else o
                for o in data.get("tradeOrders") or []
            ],
            "lots": [{**l, "broker": name} if l.get("broker") == old_name else l for l in data.get("lots") or []],
        }
        return updated, self._write(next_data)

    def can_delete_broker(self, broker_id: str) -> dict:
        data = self._read()
        broker = next((b for b in data.get("brokers") or [] if b.get("id") == broker_id), None)
        if not broker:
            return {"ok": False, "reason": "Broker not found"}
        if any(o.get("brokerName") == broker["name"] for o in data.get("tradeOrders") or []):
            return {"ok": False, "reason": "Linked to one or more orders"}
        return {"ok": True}

    def delete_broker(self, broker_id: str) -> tuple[None, dict]:
        check = self.can_delete_broker(broker_id)
        if not check.get("ok"):
            raise ValueError(check.get("reason") or "Cannot delete broker")
        data = self._read()
        next_data = {**data, "brokers": [b for b in data.get("brokers") or [] if b.get("id") != broker_id]}
        return None, self._write(next_data)

    def add_producer(self, input_data: dict) -> tuple[dict, dict]:
        data = self._read()
        name = (input_data.get("name") or "").strip()
        if not name:
            raise ValueError("Name is required")
        if any(p.get("name", "").lower() == name.lower() for p in data.get("producers") or []):
            raise ValueError("A producer with this name already exists")
        products = parse_products(input_data.get("products"))
        producer = {
            "id": uid(),
            "name": name,
            "location": (input_data.get("location") or "").strip(),
            "products": products,
            "contracts": 0,
            "avgRate": 0,
            "rating": 0,
        }
        next_data = {
            **data,
            "producers": [*(data.get("producers") or []), producer],
            "companies": self._upsert_directory_company(data.get("companies") or [], self._producer_to_company(producer)),
        }
        return producer, self._write(next_data)

    def update_producer(self, producer_id: str, input_data: dict) -> tuple[dict, dict]:
        data = self._read()
        producer = next((p for p in data.get("producers") or [] if p.get("id") == producer_id), None)
        if not producer:
            raise ValueError("Producer not found")
        name = (input_data.get("name") or "").strip()
        if not name:
            raise ValueError("Name is required")
        if any(
            p.get("id") != producer_id and p.get("name", "").lower() == name.lower()
            for p in data.get("producers") or []
        ):
            raise ValueError("A producer with this name already exists")
        products = parse_products(input_data.get("products"))
        old_name = producer["name"]
        updated = {**producer, "name": name, "location": (input_data.get("location") or "").strip(), "products": products}
        company = self._producer_to_company(updated)
        next_data = {
            **data,
            "producers": [updated if p.get("id") == producer_id else p for p in data.get("producers") or []],
            "companies": self._upsert_directory_company(data.get("companies") or [], company),
            "tradeOrders": [
                {**o, "partyName": name}
                if o.get("side") == "purchase" and o.get("partyName") == old_name
                else o
                for o in data.get("tradeOrders") or []
            ],
            "lots": [{**l, "producer": name} if l.get("producer") == old_name else l for l in data.get("lots") or []],
        }
        return updated, self._write(next_data)

    def can_delete_producer(self, producer_id: str) -> dict:
        data = self._read()
        producer = next((p for p in data.get("producers") or [] if p.get("id") == producer_id), None)
        if not producer:
            return {"ok": False, "reason": "Producer not found"}
        if any(o.get("side") == "purchase" and o.get("partyName") == producer["name"] for o in data.get("tradeOrders") or []):
            return {"ok": False, "reason": "Linked to one or more purchase orders"}
        if any(l.get("producer") == producer["name"] for l in data.get("lots") or []):
            return {"ok": False, "reason": "Linked to inventory lots"}
        return {"ok": True}

    def delete_producer(self, producer_id: str) -> tuple[None, dict]:
        check = self.can_delete_producer(producer_id)
        if not check.get("ok"):
            raise ValueError(check.get("reason") or "Cannot delete producer")
        data = self._read()
        next_data = {
            **data,
            "producers": [p for p in data.get("producers") or [] if p.get("id") != producer_id],
            "companies": self._remove_directory_company(data.get("companies") or [], producer_id, "seller"),
        }
        return None, self._write(next_data)

    def add_retailer(self, input_data: dict) -> tuple[dict, dict]:
        data = self._read()
        name = (input_data.get("name") or "").strip()
        if not name:
            raise ValueError("Name is required")
        if any(r.get("name", "").lower() == name.lower() for r in data.get("retailers") or []):
            raise ValueError("A retailer with this name already exists")
        products = parse_products(input_data.get("products"))
        retailer = {
            "id": uid(),
            "name": name,
            "location": (input_data.get("location") or "").strip(),
            "products": products,
            "totalPurchases": 0,
            "outstanding": 0,
            "lastOrder": "",
        }
        next_data = {
            **data,
            "retailers": [*(data.get("retailers") or []), retailer],
            "companies": self._upsert_directory_company(data.get("companies") or [], self._retailer_to_company(retailer)),
        }
        return retailer, self._write(next_data)

    def update_retailer(self, retailer_id: str, input_data: dict) -> tuple[dict, dict]:
        data = self._read()
        retailer = next((r for r in data.get("retailers") or [] if r.get("id") == retailer_id), None)
        if not retailer:
            raise ValueError("Retailer not found")
        name = (input_data.get("name") or "").strip()
        if not name:
            raise ValueError("Name is required")
        if any(
            r.get("id") != retailer_id and r.get("name", "").lower() == name.lower()
            for r in data.get("retailers") or []
        ):
            raise ValueError("A retailer with this name already exists")
        products = parse_products(input_data.get("products"))
        old_name = retailer["name"]
        updated = {**retailer, "name": name, "location": (input_data.get("location") or "").strip(), "products": products}
        company = self._retailer_to_company(updated)
        next_data = {
            **data,
            "retailers": [updated if r.get("id") == retailer_id else r for r in data.get("retailers") or []],
            "companies": self._upsert_directory_company(data.get("companies") or [], company),
            "tradeOrders": [
                {**o, "partyName": name}
                if o.get("side") == "sale" and o.get("partyName") == old_name
                else o
                for o in data.get("tradeOrders") or []
            ],
        }
        return updated, self._write(next_data)

    def can_delete_retailer(self, retailer_id: str) -> dict:
        data = self._read()
        retailer = next((r for r in data.get("retailers") or [] if r.get("id") == retailer_id), None)
        if not retailer:
            return {"ok": False, "reason": "Retailer not found"}
        if any(o.get("side") == "sale" and o.get("partyName") == retailer["name"] for o in data.get("tradeOrders") or []):
            return {"ok": False, "reason": "Linked to one or more sales orders"}
        return {"ok": True}

    def delete_retailer(self, retailer_id: str) -> tuple[None, dict]:
        check = self.can_delete_retailer(retailer_id)
        if not check.get("ok"):
            raise ValueError(check.get("reason") or "Cannot delete retailer")
        data = self._read()
        next_data = {
            **data,
            "retailers": [r for r in data.get("retailers") or [] if r.get("id") != retailer_id],
            "companies": self._remove_directory_company(data.get("companies") or [], retailer_id, "buyer"),
        }
        return None, self._write(next_data)

    def add_item(self, name: str) -> tuple[str, dict]:
        data = self._read()
        trimmed = (name or "").strip()
        if not trimmed:
            raise ValueError("Item name is required")
        candidates = collect_item_names(data)
        canonical = canonical_item_name(trimmed, candidates)
        for existing in data.get("items") or []:
            if item_matches(existing, canonical):
                return existing, data
        next_data = {**data, "items": upsert_string(data.get("items") or [], canonical)}
        return canonical, self._write(next_data)

    def add_spot(self, name: str) -> tuple[str, dict]:
        data = self._read()
        trimmed = (name or "").strip()
        if not trimmed:
            raise ValueError("Spot location is required")
        if any(s.lower() == trimmed.lower() for s in data.get("spots") or []):
            raise ValueError("This spot already exists")
        next_data = {**data, "spots": upsert_string(data.get("spots") or [], trimmed)}
        return trimmed, self._write(next_data)
