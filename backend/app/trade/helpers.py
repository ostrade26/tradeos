"""Shared helpers for the trade engine."""

from __future__ import annotations

import re
import time
import random
import string
from datetime import datetime

CURRENT_TRADER = "Shri Kubera Traders"
CURRENT_TRADER_LOCATION = "Kolhapur"
ORDER_DELETE_GRACE_DAYS = 7

LEGAL_SUFFIX_PATTERN = re.compile(
    r"\b(pvt\.?\s*ltd\.?|private\s+limited|limited|ltd\.?|llp|inc\.?|corp\.?|co\.?\s*ltd\.?)\b",
    re.IGNORECASE,
)
LOCATION_TAIL_PATTERN = re.compile(r",\s*[A-Za-z][A-Za-z\s.-]{1,40}$")


def uid() -> str:
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=7))
    return f"{int(time.time() * 1000)}-{suffix}"


def round_qty_mt(qty: float) -> float:
    return round(qty * 1000) / 1000


def format_mt(value: float) -> str:
    if not isinstance(value, (int, float)) or value != value:  # NaN check
        return "0.000"
    return f"{round_qty_mt(value):.3f}"


def format_qty(value: float, unit: str = "MT") -> str:
    return f"{format_mt(value)} {unit}"


def upsert_string(items: list[str], value: str) -> list[str]:
    trimmed = value.strip()
    if not trimmed or trimmed in items:
        return items
    return [*items, trimmed]


ITEM_ALIASES = {
    "soyabeen": "soybean",
    "soya": "soybean",
    "soya bean": "soybean",
    "soyabean": "soybean",
    "palmolein": "palm olein",
    "sunfloweroil": "sunflower oil",
    "coconutoil": "coconut oil",
    "ricebranoil": "rice bran oil",
}

ITEM_STOP_WORDS = {
    "rbd", "refined", "extra", "virgin", "crude", "grade", "oil", "olein", "fat", "fats",
}

ITEM_HIGH_CONFIDENCE_THRESHOLD = 0.85
ITEM_SUGGESTION_THRESHOLD = 0.55


def normalize_item_name(name: str) -> str:
    prepared = re.sub(r"[^a-z0-9\s]", " ", (name or "").lower().replace(".", ""))
    return " ".join(prepared.split())


def _compact_item_key(name: str) -> str:
    return "".join(
        token
        for token in normalize_item_name(name).split(" ")
        if token and token not in ITEM_STOP_WORDS
    )


def _apply_item_alias(name: str) -> str:
    normalized = normalize_item_name(name)
    if normalized in ITEM_ALIASES:
        return ITEM_ALIASES[normalized]
    compact = _compact_item_key(name)
    return ITEM_ALIASES.get(compact, normalized)


def _item_token_set(name: str) -> set[str]:
    return {
        token
        for token in _apply_item_alias(name).split(" ")
        if len(token) > 1 and token not in ITEM_STOP_WORDS
    }


def _jaccard_similarity(a: str, b: str) -> float:
    set_a = _item_token_set(a)
    set_b = _item_token_set(b)
    if not set_a and not set_b:
        return 1.0
    if not set_a or not set_b:
        return 0.0
    intersection = len(set_a & set_b)
    return intersection / (len(set_a) + len(set_b) - intersection)


def _levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    row = list(range(len(b) + 1))
    for i, char_a in enumerate(a, start=1):
        prev = i
        for j, char_b in enumerate(b, start=1):
            val = row[j - 1] if char_a == char_b else min(row[j] + 1, row[j - 1] + 1, prev + 1)
            row[j - 1] = prev
            prev = val
        row[len(b)] = prev
    return row[len(b)]


def _item_fuzzy_score(extracted: str, candidate: str) -> float:
    norm_a = normalize_item_name(extracted)
    norm_b = normalize_item_name(candidate)
    if not norm_a or not norm_b:
        return 0.0
    if norm_a == norm_b:
        return 1.0

    alias_a = _apply_item_alias(extracted)
    alias_b = _apply_item_alias(candidate)
    if alias_a == alias_b:
        return 0.98

    compact_a = _compact_item_key(alias_a)
    compact_b = _compact_item_key(alias_b)
    if compact_a == compact_b:
        return 0.98

    token_score = _jaccard_similarity(extracted, candidate)
    max_len = max(len(compact_a), len(compact_b))
    edit_score = 0.0 if max_len == 0 else 1 - (_levenshtein(compact_a, compact_b) / max_len)

    shorter, longer = (compact_a, compact_b) if len(compact_a) <= len(compact_b) else (compact_b, compact_a)
    if len(shorter) >= 4 and shorter in longer:
        return max(0.92, token_score, edit_score)
    if compact_a in compact_b or compact_b in compact_a:
        return max(0.88, token_score, edit_score)

    return token_score * 0.5 + edit_score * 0.5


def item_matches(name: str, candidate: str) -> bool:
    left = normalize_item_name(name)
    right = normalize_item_name(candidate)
    if not left or not right:
        return False
    if left == right:
        return True
    return _compact_item_key(left) == _compact_item_key(right)


def collect_item_names(data: dict) -> list[str]:
    seen: set[str] = set()
    for name in data.get("items") or []:
        trimmed = (name or "").strip()
        if trimmed:
            seen.add(trimmed)
    for order in data.get("tradeOrders") or []:
        trimmed = (order.get("itemName") or "").strip()
        if trimmed:
            seen.add(trimmed)
    for lot in data.get("lots") or []:
        trimmed = (lot.get("commodity") or "").strip()
        if trimmed:
            seen.add(trimmed)
    return sorted(seen)


def canonical_item_name(extracted: str, candidates: list[str]) -> str:
    trimmed = (extracted or "").strip()
    if not trimmed:
        return trimmed

    for candidate in candidates:
        if item_matches(trimmed, candidate):
            return candidate

    best: tuple[str, float] | None = None
    for candidate in candidates:
        score = _item_fuzzy_score(trimmed, candidate)
        if score >= ITEM_SUGGESTION_THRESHOLD and (not best or score > best[1]):
            best = (candidate, score)

    if best and best[1] >= ITEM_HIGH_CONFIDENCE_THRESHOLD:
        return best[0]

    return trimmed


def prepare_name_for_matching(name: str) -> str:
    text = re.sub(r"\([^)]*\)", " ", name)
    text = LOCATION_TAIL_PATTERN.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip()


def normalize_company_name(name: str) -> str:
    prepared = prepare_name_for_matching(name).lower()
    prepared = prepared.replace(".", "").replace(",", " ")
    prepared = LEGAL_SUFFIX_PATTERN.sub("", prepared)
    prepared = re.sub(r"[^a-z0-9\s&]", " ", prepared)
    return " ".join(prepared.split())


def _format_delivery_period_date(iso: str) -> str:
    day = iso[:10]
    d = datetime.fromisoformat(day)
    return f"{d.day} {d.strftime('%b')}"


def format_delivery_period(order: dict) -> str:
    if order.get("deliveryType") == "ready":
        return "Ready"
    start = order["deliveryPeriodStart"][:10]
    end = order["deliveryPeriodEnd"][:10]
    if start == end:
        return _format_delivery_period_date(start)
    return f"{_format_delivery_period_date(start)} – {_format_delivery_period_date(end)}"


def format_contract_rate(rate: float) -> str:
    per_10 = rate / 100 if rate else 0
    if not per_10:
        return "—"
    formatted = f"{per_10:,.2f}"
    return f"₹{formatted}/10 KG"


def deletion_date_from_now(from_dt: datetime | None = None) -> str:
    d = from_dt or datetime.utcnow()
    from datetime import timedelta

    return (d + timedelta(days=ORDER_DELETE_GRACE_DAYS)).isoformat() + "Z"


def format_deletion_date(iso: str) -> str:
    d = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return d.strftime("%d %b %Y").lstrip("0")


def is_deletion_due(iso: str, now: datetime | None = None) -> bool:
    now = now or datetime.utcnow()
    target = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    if target.tzinfo:
        target = target.replace(tzinfo=None)
    return target <= now


def find_account_company(companies: list[dict]) -> dict:
    for c in companies:
        if normalize_company_name(c.get("officialName", "")) == normalize_company_name(CURRENT_TRADER):
            return c
    return {
        "id": "",
        "officialName": CURRENT_TRADER,
        "aliases": [],
        "types": ["buyer", "seller"],
        "location": CURRENT_TRADER_LOCATION,
    }


def format_sales_invoice_no(seq: int, year: int | None = None) -> str:
    year = year or datetime.utcnow().year
    return f"INV-{year}-{seq:04d}"


def parse_products(products: str | None) -> list[str]:
    if not products:
        return []
    return [p.strip() for p in products.split(",") if p.strip()]
