"""Seed data for demo / initial state."""

from __future__ import annotations

from datetime import datetime, timedelta

from .helpers import CURRENT_TRADER, format_contract_rate, format_delivery_period, format_qty, round_qty_mt, uid


def _date_offset(days_ago: int) -> str:
    d = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    d = d - timedelta(days=days_ago)
    return d.date().isoformat()


def _order_status(order_qty: float, lifted_qty: float) -> str:
    if lifted_qty >= order_qty:
        return "completed"
    if lifted_qty > 0:
        return "partial"
    return "pending"


def _lot_number_for_po(po_ref: str) -> str:
    return f"LOT-{po_ref}"


def build_seed_data() -> dict:
    spots = ["Kolhapur", "Mumbai", "Surat", "Navi Mumbai", "Pune", "Ahmedabad", "Nagpur", "Indore"]
    items = ["Palm Oil", "Soybean Oil", "Coconut Oil", "RBD Palmolein", "Sunflower Oil", "Rice Bran Oil"]

    broker_seed = [
        {"name": "SHREE GURUKRUPA BROKER'S", "email": "gurukrupa@broker.in", "phone": "+91 98220 44102"},
        {"name": "Amogh Paragi & Co.", "email": "amogh@apbroker.com", "phone": "+91 94220 11880"},
        {"name": "Kolhapur Commodity Brokers", "email": "office@kcbrokers.in", "phone": "+91 231 265 4421"},
        {"name": "Western India Oils Brokerage", "email": "trade@wibroker.com", "phone": "+91 98901 22334"},
    ]

    producer_seed = [
        {"name": "DVC Process Tech Pvt Ltd", "location": "Navi Mumbai", "products": ["Palm Oil", "RBD Palmolein"]},
        {"name": "Patanjali Foods Ltd", "location": "Haridwar", "products": ["Soybean Oil", "Sunflower Oil"]},
        {"name": "Adani Wilmar Ltd", "location": "Ahmedabad", "products": ["Palm Oil", "Soybean Oil"]},
        {"name": "Gemini Edibles & Fats", "location": "Kakinada", "products": ["Palm Oil", "Coconut Oil"]},
        {"name": "Liberty Oil Mills", "location": "Mumbai", "products": ["RBD Palmolein", "Rice Bran Oil"]},
    ]

    retailer_seed = [
        {"name": "Haldiram Foods International", "location": "Nagpur", "products": ["Palm Oil", "Rice Bran Oil"]},
        {"name": "Britannia Industries Ltd", "location": "Bangalore", "products": ["Palm Oil", "Coconut Oil"]},
        {"name": "Parle Products Pvt Ltd", "location": "Mumbai", "products": ["Palm Oil", "Soybean Oil"]},
        {"name": "ITC Limited — Foods Division", "location": "Kolkata", "products": ["Sunflower Oil", "Soybean Oil"]},
        {"name": "Bikano Foods Pvt Ltd", "location": "Delhi", "products": ["Palm Oil", "RBD Palmolein"]},
    ]

    brokers = [
        {
            "id": uid(),
            "name": b["name"],
            "email": b["email"],
            "phone": b["phone"],
            "contracts": 0,
            "commissionEarned": 0,
            "successRate": 88 + (i % 4) * 3,
            "network": 12 + i * 4,
            "purchaseBrokerage": {"mode": "perTon", "value": 70 + (i % 3) * 5},
            "saleBrokerage": {"mode": "perTon", "value": 60 + (i % 3) * 5},
        }
        for i, b in enumerate(broker_seed)
    ]

    producers = [
        {
            "id": uid(),
            "name": p["name"],
            "location": p["location"],
            "products": p["products"],
            "contracts": 0,
            "avgRate": 0,
            "rating": 4 + (i % 2) * 0.5,
        }
        for i, p in enumerate(producer_seed)
    ]

    retailers = [
        {
            "id": uid(),
            "name": r["name"],
            "location": r["location"],
            "products": r["products"],
            "totalPurchases": 0,
            "outstanding": 0,
            "lastOrder": "",
        }
        for r in retailer_seed
    ]

    account_id = uid()
    companies = [
        *[
            {
                "id": p["id"],
                "officialName": p["name"],
                "aliases": ["DVC", "DCV"] if i == 0 else [],
                "types": ["seller"],
                "location": p["location"],
            }
            for i, p in enumerate(producers)
        ],
        *[
            {
                "id": r["id"],
                "officialName": r["name"],
                "aliases": [],
                "types": ["buyer"],
                "location": r["location"],
            }
            for r in retailers
        ],
        {
            "id": account_id,
            "officialName": CURRENT_TRADER,
            "aliases": [],
            "types": ["buyer", "seller"],
            "location": "Kolhapur",
        },
    ]

    po_configs = [
        {"qty": 100, "item": "Palm Oil", "producer": 0, "rateMt": 98500, "lifted": 25, "daysAgo": 145, "spot": 0, "broker": 0},
        {"qty": 80, "item": "Soybean Oil", "producer": 1, "rateMt": 92000, "lifted": 80, "daysAgo": 130, "spot": 1, "broker": 1},
        {"qty": 120, "item": "RBD Palmolein", "producer": 0, "rateMt": 148000, "lifted": 40, "daysAgo": 115, "spot": 2, "broker": 0},
        {"qty": 60, "item": "Coconut Oil", "producer": 3, "rateMt": 112000, "lifted": 0, "daysAgo": 100, "spot": 3, "broker": 2},
        {"qty": 90, "item": "Palm Oil", "producer": 2, "rateMt": 97800, "lifted": 0, "daysAgo": 90, "spot": 4, "broker": 3},
        {"qty": 75, "item": "Sunflower Oil", "producer": 1, "rateMt": 89500, "lifted": 30, "daysAgo": 75, "spot": 5, "broker": 1},
        {"qty": 110, "item": "Soybean Oil", "producer": 4, "rateMt": 93100, "lifted": 0, "daysAgo": 65, "spot": 0, "broker": 2},
        {"qty": 50, "item": "Rice Bran Oil", "producer": 4, "rateMt": 76500, "lifted": 0, "daysAgo": 55, "spot": 6, "broker": 2},
        {"qty": 95, "item": "Palm Oil", "producer": 5 % len(producers), "rateMt": 99000, "lifted": 95, "daysAgo": 48, "spot": 1, "broker": 0},
        {"qty": 85, "item": "RBD Palmolein", "producer": 0, "rateMt": 146000, "lifted": 0, "daysAgo": 42, "spot": 2, "broker": 3},
    ]

    trade_orders: list[dict] = []
    for i, c in enumerate(po_configs):
        n = i + 1
        producer = producers[c["producer"]]
        broker = brokers[c["broker"]]
        order_date = _date_offset(c["daysAgo"])
        end_date = _date_offset(max(0, c["daysAgo"] - 20))
        trade_orders.append(
            {
                "id": uid(),
                "ref": f"PO-{n}",
                "side": "purchase",
                "brokerContractRef": str(700 + n),
                "date": order_date,
                "partyName": producer["name"],
                "partyCompanyId": producer["id"],
                "sellerCompanyId": producer["id"],
                "buyerCompanyId": account_id,
                "itemName": c["item"],
                "spot": spots[c["spot"] % len(spots)],
                "deliveryType": "period",
                "deliveryPeriodStart": order_date,
                "deliveryPeriodEnd": end_date,
                "deliveryPeriodVerified": n % 3 != 0,
                "rate": c["rateMt"],
                "ratePerBasis": c["rateMt"] / 100,
                "rateBasis": "PER 10 KG",
                "contractRateDisplay": f"{c['rateMt'] / 100:,.2f} PER 10 KG",
                "taxRate": 5,
                "orderQty": c["qty"],
                "liftedQty": c["lifted"],
                "committedLiftQty": c["lifted"],
                "unit": "MT",
                "brokerName": broker["name"],
                "brokeragePct": 0,
                "brokeragePerTon": 75,
                "sellerName": producer["name"],
                "buyerName": CURRENT_TRADER,
                "paymentTerms": "Advance" if n % 2 == 0 else "Against delivery",
                "status": _order_status(c["qty"], c["lifted"]),
            }
        )
        producer["contracts"] += 1
        producer["avgRate"] = c["rateMt"]
        broker["contracts"] += 1
        broker["commissionEarned"] += c["qty"] * 75

    po2 = next((o for o in trade_orders if o["ref"] == "PO-2"), None)
    if po2:
        po2["freightCost"] = 4000
        po2["loadingCost"] = 1000
        po2["otherCost"] = 500
        po2["brokeragePerTon"] = 15

    so_configs = [
        {"po": 1, "qty": 50, "retailer": 0, "premium": 1200, "lifted": 25, "daysAgo": 120},
        {"po": 2, "qty": 80, "retailer": 1, "premium": 900, "lifted": 80, "daysAgo": 110},
        {"po": 3, "qty": 60, "retailer": 2, "premium": 1100, "lifted": 40, "daysAgo": 95},
        {"po": 4, "qty": 40, "retailer": 3, "premium": 1500, "lifted": 0, "daysAgo": 85},
        {"po": 6, "qty": 45, "retailer": 4, "premium": 950, "lifted": 30, "daysAgo": 60},
    ]

    for i, c in enumerate(so_configs):
        n = i + 1
        retailer = retailers[c["retailer"]]
        po = next(o for o in trade_orders if o["ref"] == f"PO-{c['po']}")
        rate_mt = po["rate"] + c["premium"]
        order_date = _date_offset(c["daysAgo"])
        end_date = _date_offset(max(0, c["daysAgo"] - 15))
        broker_name = po["brokerName"]
        trade_orders.append(
            {
                "id": uid(),
                "ref": f"SO-{n}",
                "side": "sale",
                "poRef": po["ref"],
                "brokerContractRef": str(800 + n),
                "date": order_date,
                "partyName": retailer["name"],
                "partyCompanyId": retailer["id"],
                "buyerCompanyId": retailer["id"],
                "sellerCompanyId": account_id,
                "itemName": po["itemName"],
                "spot": po["spot"],
                "deliveryType": "period",
                "deliveryPeriodStart": order_date,
                "deliveryPeriodEnd": end_date,
                "deliveryPeriodVerified": n % 2 == 0,
                "rate": rate_mt,
                "ratePerBasis": rate_mt / 100,
                "rateBasis": "PER 10 KG",
                "taxRate": 5,
                "orderQty": c["qty"],
                "liftedQty": c["lifted"],
                "committedLiftQty": c["lifted"],
                "unit": "MT",
                "brokerName": broker_name,
                "brokeragePct": 0,
                "brokeragePerTon": 65,
                "sellerName": CURRENT_TRADER,
                "buyerName": retailer["name"],
                "paymentTerms": "Against delivery",
                "status": _order_status(c["qty"], c["lifted"]),
            }
        )
        retailer["totalPurchases"] += c["qty"] * rate_mt
        retailer["lastOrder"] = order_date
        broker = next(b for b in brokers if b["name"] == broker_name)
        broker["contracts"] += 1
        broker["commissionEarned"] += c["qty"] * 65

    lift_seed = [
        {
            "po": 1,
            "so": 1,
            "qty": 24.875,
            "daysAgo": 100,
            "invoice": "INV-2026-0142",
            "self": False,
            "tankers": [
                {
                    "tankerNo": "MH-12-AB-4521",
                    "transportName": "Shree Transport",
                    "driverMobile": "9876543210",
                    "lrNo": "LR-2026-0142",
                    "actualQtyMt": 24.875,
                }
            ],
        },
        {
            "po": 2,
            "so": 2,
            "qty": 79.640,
            "daysAgo": 95,
            "invoice": "INV-2026-0156",
            "self": False,
            "tankers": [
                {
                    "tankerNo": "GJ-05-CD-8834",
                    "transportName": "Gujarat Cargo Movers",
                    "driverMobile": "9825012345",
                    "lrNo": "LR-2026-0156A",
                    "actualQtyMt": 39.820,
                },
                {
                    "tankerNo": "GJ-05-CD-8835",
                    "transportName": "Gujarat Cargo Movers",
                    "driverMobile": "9825012346",
                    "lrNo": "LR-2026-0156B",
                    "actualQtyMt": 39.820,
                },
            ],
        },
        {
            "po": 3,
            "so": 3,
            "qty": 39.950,
            "daysAgo": 80,
            "invoice": "INV-2026-0188",
            "self": True,
            "tankers": [
                {
                    "tankerNo": "MH-04-EF-2210",
                    "transportName": "Self — buyer fleet",
                    "driverMobile": "9898989898",
                    "lrNo": "LR-2026-0188",
                    "actualQtyMt": 39.950,
                }
            ],
        },
        {
            "po": 6,
            "so": 5,
            "qty": 29.740,
            "daysAgo": 50,
            "invoice": "INV-2026-0210",
            "self": False,
            "tankers": [
                {
                    "tankerNo": "KA-41-GH-9901",
                    "transportName": "Karnataka Hauliers",
                    "driverMobile": "9900112233",
                    "lrNo": "LR-2026-0210",
                    "actualQtyMt": 29.740,
                }
            ],
        },
    ]

    lifts = []
    for i, l in enumerate(lift_seed):
        po = next(o for o in trade_orders if o["ref"] == f"PO-{l['po']}")
        so = next(o for o in trade_orders if o["ref"] == f"SO-{l['so']}")
        lift_date = _date_offset(l["daysAgo"])
        lifts.append(
            {
                "id": uid(),
                "liftRef": i + 1,
                "poRef": po["ref"],
                "soRef": so["ref"],
                "date": lift_date,
                "status": "delivered",
                "deliveredAt": lift_date,
                "buyerName": so["partyName"],
                "sellerName": po["partyName"],
                "itemName": po["itemName"],
                "deliveryPeriod": format_delivery_period(po),
                "deliveryPeriodStart": po["deliveryPeriodStart"],
                "deliveryPeriodEnd": po["deliveryPeriodEnd"],
                "deliveryPeriodVerified": po["deliveryPeriodVerified"],
                "rate": so["rate"],
                "liftedQty": l["qty"],
                "tankerNo": l["tankers"][0]["tankerNo"],
                "tankers": l["tankers"],
                "salesInvoiceNo": l["invoice"],
                "isSelfLift": l["self"],
            }
        )

    lots = []
    for po in [o for o in trade_orders if o["side"] == "purchase"]:
        linked_sos = [o for o in trade_orders if o.get("side") == "sale" and o.get("poRef") == po["ref"]]
        allocated = sum(o["orderQty"] for o in linked_sos)
        avg_so_rate = sum(o["rate"] for o in linked_sos) / len(linked_sos) if linked_sos else 0
        margin = ((avg_so_rate - po["rate"]) / po["rate"]) * 100 if avg_so_rate > po["rate"] else 0
        lots.append(
            {
                "id": uid(),
                "lotNumber": _lot_number_for_po(po["ref"]),
                "commodity": po["itemName"],
                "purchasePrice": po["rate"],
                "quantityPurchased": po["orderQty"],
                "remaining": max(0, po["orderQty"] - po["liftedQty"]),
                "allocated": allocated,
                "available": round_qty_mt(po["orderQty"] - allocated),
                "unit": "MT",
                "producer": po["partyName"],
                "broker": po["brokerName"],
                "purchaseDate": po["date"],
                "contractId": po["id"],
                "margin": round(margin * 10) / 10,
            }
        )

    activities = [
        *[
            {
                "id": uid(),
                "type": "lift_recorded",
                "title": "Lift recorded",
                "description": (
                    f"Lift #{l['liftRef']} — {format_qty(l['liftedQty'])} {l['itemName']} "
                    f"({l['poRef']} → {l['soRef']})"
                ),
                "timestamp": f"{l['date']}T10:00:00Z",
                "user": CURRENT_TRADER,
                "entityRef": f"Lift-{l['liftRef']}",
            }
            for l in lifts
        ],
        *[
            {
                "id": uid(),
                "type": "po_created" if o["side"] == "purchase" else "so_created",
                "title": "PO created" if o["side"] == "purchase" else "SO created",
                "description": f"{o['ref']} — {format_qty(o['orderQty'])} {o['itemName']} @ {format_contract_rate(o['rate'])}",
                "timestamp": f"{o['date']}T09:00:00Z",
                "user": CURRENT_TRADER,
                "entityRef": o["ref"],
            }
            for o in trade_orders[:5]
        ],
    ]
    activities.sort(key=lambda a: a["timestamp"], reverse=True)

    return {
        "tradeOrders": trade_orders,
        "lifts": lifts,
        "lots": lots,
        "brokers": brokers,
        "producers": producers,
        "retailers": retailers,
        "companies": companies,
        "deliveries": [],
        "activities": activities,
        "payments": [],
        "contracts": [],
        "spots": spots,
        "items": items,
        "counters": {"po": 10, "so": 5, "lift": 4, "invoice": 210},
    }
