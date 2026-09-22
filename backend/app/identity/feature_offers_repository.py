"""Feature catalog for org Add-ons marketplace."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from ..db import row_dict, uses_postgres
from .notifications_repository import normalize_feature_key
from .repository import append_audit_log

PRICING_TYPES = frozenset({"free", "paid", "contact"})
CATALOG_STATUSES = frozenset({"draft", "listed", "retired"})
CARD_TONES = frozenset({"neutral", "ai", "analytics", "connect", "ops", "spark"})
# ~500KB binary as base64 data URL
MAX_CARD_IMAGE_CHARS = 700_000
_HEX3_RE = re.compile(r"^#[0-9a-fA-F]{3}$")
_HEX6_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_card_tone(raw: str | None) -> str:
    tone = (raw or "").strip().lower()
    return tone if tone in CARD_TONES else ""


def _normalize_card_bg_hex(raw: str | None) -> str:
    value = (raw or "").strip()
    if not value:
        return ""
    if not value.startswith("#"):
        value = f"#{value}"
    if _HEX3_RE.fullmatch(value):
        value = "#" + "".join(ch * 2 for ch in value[1:])
    if not _HEX6_RE.fullmatch(value):
        raise HTTPException(status_code=400, detail="Invalid card background colour")
    return value.lower()


def _normalize_card_image_url(raw: str | None) -> str:
    value = (raw or "").strip()
    if not value:
        return ""
    if len(value) > MAX_CARD_IMAGE_CHARS:
        raise HTTPException(status_code=400, detail="Card image is too large (max ~500KB)")
    lower = value.lower()
    if lower.startswith("data:image/"):
        if ";base64," not in lower[:80]:
            raise HTTPException(status_code=400, detail="Invalid card image data")
        return value
    if lower.startswith("https://") or lower.startswith("http://"):
        return value
    raise HTTPException(status_code=400, detail="Card image must be an http(s) URL or image data URL")


def _default_card_tone(feature_key: str, title: str = "") -> str:
    """Match frontend addOnIllustrationForOffer / KEY_RULES so empty tones stay consistent."""
    probe = f"{feature_key} {title}".lower()
    if any(token in probe for token in ("brand", "appearance", "colour", "color", "theme", "custom-branding")):
        return "spark"
    if any(token in probe for token in ("chat", "bot", "assistant", "ai", "copilot", "gpt")):
        return "ai"
    if any(token in probe for token in ("report", "analytic", "dashboard", "insight", "chart")):
        return "analytics"
    if any(token in probe for token in ("integrat", "api", "webhook", "sync", "connect", "whatsapp", "message", "sms")):
        return "connect"
    if any(token in probe for token in ("lift", "inventory", "stock", "warehouse", "truck", "logistic", "scheduler")):
        return "ops"
    if any(token in probe for token in ("notif", "alert", "inbox", "bell")):
        return "analytics"
    if any(token in probe for token in ("security", "compliance", "audit", "shield")):
        return "spark"
    return "neutral"


def _offer_row(row: Any) -> dict[str, Any]:
    data = dict(row_dict(row))
    data["id"] = int(data["id"])
    tone = _normalize_card_tone(str(data.get("card_tone") or ""))
    if not tone:
        tone = _default_card_tone(str(data.get("feature_key") or ""), str(data.get("title") or ""))
    data["card_tone"] = tone
    data["card_image_url"] = str(data.get("card_image_url") or "").strip()
    data["card_featured"] = bool(int(data.get("card_featured") or 0))
    try:
        data["card_bg_hex"] = _normalize_card_bg_hex(str(data.get("card_bg_hex") or ""))
    except HTTPException:
        data["card_bg_hex"] = ""
    return data


def list_offers_platform(conn, *, status: str | None = None) -> list[dict[str, Any]]:
    if status:
        q = """
            SELECT * FROM platform_feature_offers
            WHERE catalog_status = ?
            ORDER BY card_featured DESC, sort_order, id
        """
        params = (status,)
    else:
        q = "SELECT * FROM platform_feature_offers ORDER BY card_featured DESC, sort_order, id"
        params = ()
    if uses_postgres():
        q = q.replace("?", "%s")
        rows = conn.execute(q, params).fetchall() if params else conn.execute(q).fetchall()
    else:
        rows = conn.execute(q, params).fetchall() if params else conn.execute(q).fetchall()
    return [_offer_row(r) for r in rows]


def _counts_for_offer(conn, feature_key: str) -> dict[str, int]:
    active = 0
    pending = 0
    if uses_postgres():
        active = conn.execute(
            "SELECT COUNT(*) AS n FROM organisation_applied_updates WHERE feature_key = %s",
            (feature_key,),
        ).fetchone()
        pending = conn.execute(
            """
            SELECT COUNT(*) AS n FROM feature_launch_interests
            WHERE feature_key = %s AND status = 'interested'
            """,
            (feature_key,),
        ).fetchone()
    else:
        active = conn.execute(
            "SELECT COUNT(*) AS n FROM organisation_applied_updates WHERE feature_key = ?",
            (feature_key,),
        ).fetchone()
        pending = conn.execute(
            """
            SELECT COUNT(*) AS n FROM feature_launch_interests
            WHERE feature_key = ? AND status = 'interested'
            """,
            (feature_key,),
        ).fetchone()
    return {
        "active_orgs": int(dict(row_dict(active))["n"]),
        "pending_requests": int(dict(row_dict(pending))["n"]),
    }


def list_offers_platform_enriched(conn) -> list[dict[str, Any]]:
    offers = list_offers_platform(conn)
    for offer in offers:
        offer.update(_counts_for_offer(conn, str(offer["feature_key"])))
    return offers


def get_offer(conn, offer_id: int) -> dict[str, Any]:
    if uses_postgres():
        row = conn.execute("SELECT * FROM platform_feature_offers WHERE id = %s", (offer_id,)).fetchone()
    else:
        row = conn.execute("SELECT * FROM platform_feature_offers WHERE id = ?", (offer_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Feature offer not found")
    return _offer_row(row)


def get_offer_usage(conn, offer_id: int) -> dict[str, Any]:
    """Offer details plus organisations with access and open purchase requests."""
    offer = get_offer(conn, offer_id)
    offer.update(_counts_for_offer(conn, str(offer["feature_key"])))
    key = str(offer["feature_key"])
    ph = "%s" if uses_postgres() else "?"
    active_rows = conn.execute(
        f"""
        SELECT o.id AS organisation_id, o.name AS organisation_name, o.org_code,
               a.applied_at, a.version
        FROM organisation_applied_updates a
        JOIN organisations o ON o.id = a.organisation_id
        WHERE a.feature_key = {ph}
        ORDER BY a.applied_at DESC, o.name
        """,
        (key,),
    ).fetchall()
    pending_rows = conn.execute(
        f"""
        SELECT i.id AS interest_id, o.id AS organisation_id, o.name AS organisation_name,
               o.org_code, i.created_at, i.status,
               COALESCE(u.name, u.username, '') AS requested_by_name
        FROM feature_launch_interests i
        JOIN organisations o ON o.id = i.organisation_id
        LEFT JOIN users u ON u.id = i.requested_by_user_id
        WHERE i.feature_key = {ph} AND i.status = 'interested'
        ORDER BY i.created_at DESC, o.name
        """,
        (key,),
    ).fetchall()
    organisations = []
    for row in active_rows:
        data = dict(row_dict(row))
        organisations.append(
            {
                "organisation_id": int(data["organisation_id"]),
                "organisation_name": str(data.get("organisation_name") or ""),
                "org_code": str(data.get("org_code") or ""),
                "applied_at": str(data.get("applied_at") or ""),
                "version": str(data.get("version") or ""),
            }
        )
    pending = []
    for row in pending_rows:
        data = dict(row_dict(row))
        pending.append(
            {
                "interest_id": int(data["interest_id"]),
                "organisation_id": int(data["organisation_id"]),
                "organisation_name": str(data.get("organisation_name") or ""),
                "org_code": str(data.get("org_code") or ""),
                "created_at": str(data.get("created_at") or ""),
                "status": str(data.get("status") or "interested"),
                "requested_by_name": str(data.get("requested_by_name") or ""),
            }
        )
    return {"offer": offer, "organisations": organisations, "pending_requests": pending}


def get_offer_by_key(conn, feature_key: str) -> dict[str, Any] | None:
    key = normalize_feature_key(feature_key, feature_key)
    if uses_postgres():
        row = conn.execute("SELECT * FROM platform_feature_offers WHERE feature_key = %s", (key,)).fetchone()
    else:
        row = conn.execute("SELECT * FROM platform_feature_offers WHERE feature_key = ?", (key,)).fetchone()
    if not row:
        return None
    return _offer_row(row)


def upsert_offer(
    conn,
    *,
    offer_id: int | None,
    feature_key: str,
    title: str,
    description: str,
    pricing_type: str,
    price_cents: int,
    currency: str,
    sort_order: int,
    actor_user_id: int,
    card_tone: str = "",
    card_image_url: str = "",
    card_featured: bool = False,
    card_bg_hex: str = "",
) -> dict[str, Any]:
    key = normalize_feature_key(feature_key, title)
    title = title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    pricing = (pricing_type or "free").strip().lower()
    if pricing not in PRICING_TYPES:
        raise HTTPException(status_code=400, detail="Invalid pricing type")
    tone = _normalize_card_tone(card_tone) or _default_card_tone(key, title)
    image_url = _normalize_card_image_url(card_image_url)
    bg_hex = _normalize_card_bg_hex(card_bg_hex)
    featured = 1 if card_featured else 0
    now = _now()
    if offer_id:
        current = get_offer(conn, offer_id)
        if str(current["feature_key"]) != key:
            clash = get_offer_by_key(conn, key)
            if clash and int(clash["id"]) != offer_id:
                raise HTTPException(status_code=400, detail="Feature key already in use")
        if featured:
            if uses_postgres():
                conn.execute(
                    "UPDATE platform_feature_offers SET card_featured = 0 WHERE id <> %s",
                    (offer_id,),
                )
            else:
                conn.execute(
                    "UPDATE platform_feature_offers SET card_featured = 0 WHERE id <> ?",
                    (offer_id,),
                )
        if uses_postgres():
            conn.execute(
                """
                UPDATE platform_feature_offers
                SET feature_key = %s, title = %s, description = %s, pricing_type = %s,
                    price_cents = %s, currency = %s, sort_order = %s, card_tone = %s,
                    card_image_url = %s, card_featured = %s, card_bg_hex = %s, updated_at = %s
                WHERE id = %s
                """,
                (
                    key,
                    title,
                    description.strip(),
                    pricing,
                    price_cents,
                    currency.strip() or "INR",
                    sort_order,
                    tone,
                    image_url,
                    featured,
                    bg_hex,
                    now,
                    offer_id,
                ),
            )
        else:
            conn.execute(
                """
                UPDATE platform_feature_offers
                SET feature_key = ?, title = ?, description = ?, pricing_type = ?,
                    price_cents = ?, currency = ?, sort_order = ?, card_tone = ?,
                    card_image_url = ?, card_featured = ?, card_bg_hex = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    key,
                    title,
                    description.strip(),
                    pricing,
                    price_cents,
                    currency.strip() or "INR",
                    sort_order,
                    tone,
                    image_url,
                    featured,
                    bg_hex,
                    now,
                    offer_id,
                ),
            )
        offer = get_offer(conn, offer_id)
    else:
        if get_offer_by_key(conn, key):
            raise HTTPException(status_code=400, detail="Feature key already exists")
        if featured:
            if uses_postgres():
                conn.execute("UPDATE platform_feature_offers SET card_featured = 0")
            else:
                conn.execute("UPDATE platform_feature_offers SET card_featured = 0")
        if uses_postgres():
            row = conn.execute(
                """
                INSERT INTO platform_feature_offers
                (feature_key, title, description, pricing_type, price_cents, currency,
                 catalog_status, sort_order, card_tone, card_image_url, card_featured,
                 card_bg_hex, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, 'draft', %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    key,
                    title,
                    description.strip(),
                    pricing,
                    price_cents,
                    currency.strip() or "INR",
                    sort_order,
                    tone,
                    image_url,
                    featured,
                    bg_hex,
                    now,
                    now,
                ),
            ).fetchone()
            offer = _offer_row(row)
        else:
            cur = conn.execute(
                """
                INSERT INTO platform_feature_offers
                (feature_key, title, description, pricing_type, price_cents, currency,
                 catalog_status, sort_order, card_tone, card_image_url, card_featured,
                 card_bg_hex, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    key,
                    title,
                    description.strip(),
                    pricing,
                    price_cents,
                    currency.strip() or "INR",
                    sort_order,
                    tone,
                    image_url,
                    featured,
                    bg_hex,
                    now,
                    now,
                ),
            )
            offer = get_offer(conn, int(cur.lastrowid))
    append_audit_log(
        organisation_id=None,
        actor_user_id=actor_user_id,
        action="feature_offer.upserted",
        entity_type="platform_feature_offer",
        entity_id=str(offer["id"]),
        new_value={
            "feature_key": key,
            "pricing_type": pricing,
            "card_tone": tone,
            "card_bg_hex": bg_hex,
            "card_featured": bool(featured),
        },
    )
    return offer


def delete_offer(conn, offer_id: int, *, actor_user_id: int) -> dict[str, Any]:
    offer = get_offer(conn, offer_id)
    status = str(offer.get("catalog_status") or "")
    if status == "listed":
        raise HTTPException(
            status_code=400,
            detail="Unpublish this feature before deleting it from the catalog.",
        )
    if uses_postgres():
        conn.execute("DELETE FROM platform_feature_offers WHERE id = %s", (offer_id,))
    else:
        conn.execute("DELETE FROM platform_feature_offers WHERE id = ?", (offer_id,))
    append_audit_log(
        organisation_id=None,
        actor_user_id=actor_user_id,
        action="feature_offer.deleted",
        entity_type="platform_feature_offer",
        entity_id=str(offer_id),
        new_value={"feature_key": offer.get("feature_key"), "title": offer.get("title"), "was_status": status},
    )
    return offer


def set_catalog_status(
    conn,
    offer_id: int,
    *,
    catalog_status: str,
    actor_user_id: int,
) -> dict[str, Any]:
    status = (catalog_status or "").strip().lower()
    if status not in CATALOG_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid catalog status")
    offer = get_offer(conn, offer_id)
    previous = str(offer.get("catalog_status") or "")
    now = _now()
    listed_at = offer.get("listed_at")
    listed_by = offer.get("listed_by_user_id")
    if status == "listed":
        listed_at = now
        listed_by = actor_user_id
    if uses_postgres():
        conn.execute(
            """
            UPDATE platform_feature_offers
            SET catalog_status = %s, updated_at = %s,
                listed_at = COALESCE(%s, listed_at),
                listed_by_user_id = COALESCE(%s, listed_by_user_id)
            WHERE id = %s
            """,
            (status, now, listed_at if status == "listed" else None, listed_by if status == "listed" else None, offer_id),
        )
    else:
        conn.execute(
            """
            UPDATE platform_feature_offers
            SET catalog_status = ?, updated_at = ?,
                listed_at = COALESCE(?, listed_at),
                listed_by_user_id = COALESCE(?, listed_by_user_id)
            WHERE id = ?
            """,
            (status, now, listed_at if status == "listed" else None, listed_by if status == "listed" else None, offer_id),
        )
    append_audit_log(
        organisation_id=None,
        actor_user_id=actor_user_id,
        action=f"feature_offer.{status}",
        entity_type="platform_feature_offer",
        entity_id=str(offer_id),
        new_value={"catalog_status": status},
    )
    updated = get_offer(conn, offer_id)
    notified = 0
    if status == "listed" and previous != "listed":
        notified = _notify_orgs_feature_published(conn, offer=updated, actor_user_id=actor_user_id)
    updated["orgs_notified"] = notified
    return updated


def _notify_orgs_feature_published(conn, *, offer: dict[str, Any], actor_user_id: int) -> int:
    """Broadcast to licensed orgs when a feature is published to the Features page."""
    from .notifications_repository import create_notifications_for_audience

    title = str(offer.get("title") or "New feature").strip()
    description = str(offer.get("description") or "").strip()
    key = str(offer.get("feature_key") or "")
    pricing = str(offer.get("pricing_type") or "free")
    body = description or f"{title} is now available on Features. Open Features to enable or request access."
    try:
        result = create_notifications_for_audience(
            conn,
            audience="active_licences",
            organisation_id=None,
            recipient_user_id=None,
            recipient_scope="all_users",
            exclude_expired_amc=True,
            kind="feature_launch",
            title=f"New on Features · {title}",
            body=body,
            payload={
                "cta": "browse",
                "feature_key": key,
                "feature_title": title,
                "pricing_type": pricing,
                "source": "feature_catalog",
            },
            href="/app/features",
            actor_user_id=actor_user_id,
            source="feature_catalog",
        )
        return int(result.get("sent") or 0)
    except HTTPException as exc:
        # Empty tenant set should not block publish.
        if exc.status_code == 400:
            return 0
        raise


def ensure_draft_offers_from_deploy_items(
    conn,
    *,
    items: list[dict[str, Any]],
    deploy_sha: str,
    actor_user_id: int,
) -> list[dict[str, Any]]:
    """
    Upsert draft catalog offers for gated deploy items.
    Never lists offers and never overwrites listed/retired rows.
    """
    touched: list[dict[str, Any]] = []
    now = _now()
    sha = (deploy_sha or "").strip()[:40]
    for raw in items or []:
        key = str(raw.get("feature_key") or "").strip()
        title = str(raw.get("title") or "").strip()
        if not key or not title:
            continue
        key = normalize_feature_key(key, title)
        detail = str(raw.get("detail") or "").strip()
        existing = get_offer_by_key(conn, key)
        if existing:
            status = str(existing.get("catalog_status") or "")
            if status in ("listed", "retired"):
                touched.append(existing)
                continue
            if uses_postgres():
                conn.execute(
                    """
                    UPDATE platform_feature_offers
                    SET title = %s, description = %s, updated_at = %s
                    WHERE id = %s AND catalog_status = 'draft'
                    """,
                    (title, detail or str(existing.get("description") or ""), now, int(existing["id"])),
                )
            else:
                conn.execute(
                    """
                    UPDATE platform_feature_offers
                    SET title = ?, description = ?, updated_at = ?
                    WHERE id = ? AND catalog_status = 'draft'
                    """,
                    (title, detail or str(existing.get("description") or ""), now, int(existing["id"])),
                )
            offer = get_offer(conn, int(existing["id"]))
            append_audit_log(
                organisation_id=None,
                actor_user_id=actor_user_id,
                action="feature_offer.deploy_draft_updated",
                entity_type="platform_feature_offer",
                entity_id=str(offer["id"]),
                new_value={"feature_key": key, "deploy_sha": sha},
            )
            touched.append(offer)
            continue

        default_tone = _default_card_tone(key, title)
        if uses_postgres():
            row = conn.execute(
                """
                INSERT INTO platform_feature_offers
                (feature_key, title, description, pricing_type, price_cents, currency,
                 catalog_status, sort_order, card_tone, created_at, updated_at)
                VALUES (%s, %s, %s, 'paid', 0, 'INR', 'draft', 100, %s, %s, %s)
                RETURNING *
                """,
                (key, title, detail, default_tone, now, now),
            ).fetchone()
            offer = _offer_row(row)
        else:
            cur = conn.execute(
                """
                INSERT INTO platform_feature_offers
                (feature_key, title, description, pricing_type, price_cents, currency,
                 catalog_status, sort_order, card_tone, created_at, updated_at)
                VALUES (?, ?, ?, 'paid', 0, 'INR', 'draft', 100, ?, ?, ?)
                """,
                (key, title, detail, default_tone, now, now),
            )
            offer = get_offer(conn, int(cur.lastrowid))
        append_audit_log(
            organisation_id=None,
            actor_user_id=actor_user_id,
            action="feature_offer.deploy_draft_created",
            entity_type="platform_feature_offer",
            entity_id=str(offer["id"]),
            new_value={"feature_key": key, "deploy_sha": sha},
        )
        touched.append(offer)
    return touched


def _org_has_feature(conn, organisation_id: int, feature_key: str) -> bool:
    if uses_postgres():
        row = conn.execute(
            """
            SELECT 1 FROM organisation_applied_updates
            WHERE organisation_id = %s AND feature_key = %s LIMIT 1
            """,
            (organisation_id, feature_key),
        ).fetchone()
    else:
        row = conn.execute(
            """
            SELECT 1 FROM organisation_applied_updates
            WHERE organisation_id = ? AND feature_key = ? LIMIT 1
            """,
            (organisation_id, feature_key),
        ).fetchone()
    return row is not None


def _org_pending_feature(conn, organisation_id: int, feature_key: str) -> bool:
    if uses_postgres():
        row = conn.execute(
            """
            SELECT 1 FROM feature_launch_interests
            WHERE organisation_id = %s AND feature_key = %s AND status = 'interested' LIMIT 1
            """,
            (organisation_id, feature_key),
        ).fetchone()
    else:
        row = conn.execute(
            """
            SELECT 1 FROM feature_launch_interests
            WHERE organisation_id = ? AND feature_key = ? AND status = 'interested' LIMIT 1
            """,
            (organisation_id, feature_key),
        ).fetchone()
    return row is not None


def list_marketplace_for_org(conn, organisation_id: int) -> list[dict[str, Any]]:
    offers = list_offers_platform(conn, status="listed")
    out: list[dict[str, Any]] = []
    for offer in offers:
        key = str(offer["feature_key"])
        if _org_has_feature(conn, organisation_id, key):
            entitle = "active"
        elif _org_pending_feature(conn, organisation_id, key):
            entitle = "pending"
        else:
            entitle = "available"
        item = dict(offer)
        item["entitlement_status"] = entitle
        out.append(item)
    return out


def enable_free_for_org(
    conn,
    *,
    organisation_id: int,
    user_id: int,
    feature_key: str,
    actor_user_id: int,
) -> dict[str, Any]:
    from .notifications_repository import _insert_applied_key

    offer = get_offer_by_key(conn, feature_key)
    if not offer or offer.get("catalog_status") != "listed":
        raise HTTPException(status_code=404, detail="Add-on is not available")
    if str(offer.get("pricing_type")) != "free":
        raise HTTPException(status_code=400, detail="This add-on requires a request — it is not free")
    key = str(offer["feature_key"])
    if _org_has_feature(conn, organisation_id, key):
        return offer
    now = _now()
    _insert_applied_key(
        conn,
        scope="org",
        organisation_id=organisation_id,
        user_id=actor_user_id,
        feature_key=key,
        version="",
        release_id=None,
        notification_id=None,
        now=now,
    )
    append_audit_log(
        organisation_id=organisation_id,
        actor_user_id=actor_user_id,
        action="feature_offer.enabled",
        entity_type="platform_feature_offer",
        entity_id=str(offer["id"]),
        new_value={"feature_key": key, "requested_by": user_id},
    )
    return offer


def request_paid_for_org(
    conn,
    *,
    organisation_id: int,
    user_id: int,
    feature_key: str,
) -> dict[str, Any]:
    from .feature_interests_repository import OPEN_STATUS

    offer = get_offer_by_key(conn, feature_key)
    if not offer or offer.get("catalog_status") != "listed":
        raise HTTPException(status_code=404, detail="Add-on is not available")
    pricing = str(offer.get("pricing_type"))
    if pricing == "free":
        raise HTTPException(status_code=400, detail="Use enable for free add-ons")
    key = str(offer["feature_key"])
    if _org_has_feature(conn, organisation_id, key):
        raise HTTPException(status_code=400, detail="Already enabled for your organisation")
    if _org_pending_feature(conn, organisation_id, key):
        raise HTTPException(status_code=400, detail="Request already pending")
    now = _now()
    title = str(offer.get("title") or key)
    detail = str(offer.get("description") or "")
    if uses_postgres():
        row = conn.execute(
            """
            INSERT INTO feature_launch_interests
            (organisation_id, requested_by_user_id, feature_key, feature_title, feature_detail,
             source_notification_id, status, platform_note, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, NULL, %s, '', %s, %s)
            RETURNING *
            """,
            (organisation_id, user_id, key, title, detail, OPEN_STATUS, now, now),
        ).fetchone()
        interest_id = int(dict(row_dict(row))["id"])
    else:
        cur = conn.execute(
            """
            INSERT INTO feature_launch_interests
            (organisation_id, requested_by_user_id, feature_key, feature_title, feature_detail,
             source_notification_id, status, platform_note, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, NULL, ?, '', ?, ?)
            """,
            (organisation_id, user_id, key, title, detail, OPEN_STATUS, now, now),
        )
        interest_id = int(cur.lastrowid)
    # Inbox work items are built from open interests — no separate admin notice.
    append_audit_log(
        organisation_id=organisation_id,
        actor_user_id=user_id,
        action="feature_offer.requested",
        entity_type="platform_feature_offer",
        entity_id=str(offer["id"]),
        new_value={"feature_key": key, "interest_id": interest_id},
    )
    return {"offer": offer, "interest_id": interest_id}
