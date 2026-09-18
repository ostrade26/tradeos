"""Feature catalog for org Add-ons marketplace."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from ..db import row_dict, uses_postgres
from .notifications_repository import normalize_feature_key
from .repository import append_audit_log

PRICING_TYPES = frozenset({"free", "paid", "contact"})
CATALOG_STATUSES = frozenset({"draft", "listed", "retired"})


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _offer_row(row: Any) -> dict[str, Any]:
    data = dict(row_dict(row))
    data["id"] = int(data["id"])
    return data


def list_offers_platform(conn, *, status: str | None = None) -> list[dict[str, Any]]:
    if status:
        q = """
            SELECT * FROM platform_feature_offers
            WHERE catalog_status = ?
            ORDER BY sort_order, id
        """
        params = (status,)
    else:
        q = "SELECT * FROM platform_feature_offers ORDER BY sort_order, id"
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
) -> dict[str, Any]:
    key = normalize_feature_key(feature_key, title)
    title = title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    pricing = (pricing_type or "free").strip().lower()
    if pricing not in PRICING_TYPES:
        raise HTTPException(status_code=400, detail="Invalid pricing type")
    now = _now()
    if offer_id:
        current = get_offer(conn, offer_id)
        if str(current["feature_key"]) != key:
            clash = get_offer_by_key(conn, key)
            if clash and int(clash["id"]) != offer_id:
                raise HTTPException(status_code=400, detail="Feature key already in use")
        if uses_postgres():
            conn.execute(
                """
                UPDATE platform_feature_offers
                SET feature_key = %s, title = %s, description = %s, pricing_type = %s,
                    price_cents = %s, currency = %s, sort_order = %s, updated_at = %s
                WHERE id = %s
                """,
                (key, title, description.strip(), pricing, price_cents, currency.strip() or "INR", sort_order, now, offer_id),
            )
        else:
            conn.execute(
                """
                UPDATE platform_feature_offers
                SET feature_key = ?, title = ?, description = ?, pricing_type = ?,
                    price_cents = ?, currency = ?, sort_order = ?, updated_at = ?
                WHERE id = ?
                """,
                (key, title, description.strip(), pricing, price_cents, currency.strip() or "INR", sort_order, now, offer_id),
            )
        offer = get_offer(conn, offer_id)
    else:
        if get_offer_by_key(conn, key):
            raise HTTPException(status_code=400, detail="Feature key already exists")
        if uses_postgres():
            row = conn.execute(
                """
                INSERT INTO platform_feature_offers
                (feature_key, title, description, pricing_type, price_cents, currency,
                 catalog_status, sort_order, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, 'draft', %s, %s, %s)
                RETURNING *
                """,
                (key, title, description.strip(), pricing, price_cents, currency.strip() or "INR", sort_order, now, now),
            ).fetchone()
            offer = _offer_row(row)
        else:
            cur = conn.execute(
                """
                INSERT INTO platform_feature_offers
                (feature_key, title, description, pricing_type, price_cents, currency,
                 catalog_status, sort_order, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)
                """,
                (key, title, description.strip(), pricing, price_cents, currency.strip() or "INR", sort_order, now, now),
            )
            offer = get_offer(conn, int(cur.lastrowid))
    append_audit_log(
        organisation_id=None,
        actor_user_id=actor_user_id,
        action="feature_offer.upserted",
        entity_type="platform_feature_offer",
        entity_id=str(offer["id"]),
        new_value={"feature_key": key, "pricing_type": pricing},
    )
    return offer


def delete_offer(conn, offer_id: int, *, actor_user_id: int) -> dict[str, Any]:
    offer = get_offer(conn, offer_id)
    counts = _counts_for_offer(conn, str(offer["feature_key"]))
    if counts["active_orgs"] > 0 or counts["pending_requests"] > 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "Cannot delete while organisations have this feature or open requests. "
                "Retire the offer or resolve access first."
            ),
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
        new_value={"feature_key": offer.get("feature_key"), "title": offer.get("title")},
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
    return get_offer(conn, offer_id)


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


def production_updates_summary(conn) -> dict[str, Any]:
    from .releases_repository import GATED_CATEGORIES, is_gated_release_category

    release = None
    items: list[dict[str, Any]] = []
    if uses_postgres():
        row = conn.execute(
            """
            SELECT * FROM platform_releases
            WHERE source = 'deploy' OR status = 'draft'
            ORDER BY id DESC LIMIT 1
            """
        ).fetchone()
    else:
        row = conn.execute(
            """
            SELECT * FROM platform_releases
            WHERE source = 'deploy' OR status = 'draft'
            ORDER BY id DESC LIMIT 1
            """
        ).fetchone()
    if row:
        release = dict(row_dict(row))
        rid = int(release["id"])
        if uses_postgres():
            irows = conn.execute(
                "SELECT * FROM platform_release_items WHERE release_id = %s ORDER BY sort_order, id",
                (rid,),
            ).fetchall()
        else:
            irows = conn.execute(
                "SELECT * FROM platform_release_items WHERE release_id = ? ORDER BY sort_order, id",
                (rid,),
            ).fetchall()
        for ir in irows:
            item = dict(row_dict(ir))
            cat = str(item.get("category") or "")
            fk = str(item.get("feature_key") or "").strip()
            if cat in GATED_CATEGORIES or is_gated_release_category(cat):
                catalog = get_offer_by_key(conn, fk) if fk else None
                items.append(
                    {
                        "category": cat,
                        "title": item.get("title"),
                        "detail": item.get("detail"),
                        "feature_key": fk,
                        "catalog_status": catalog.get("catalog_status") if catalog else None,
                        "catalog_offer_id": catalog.get("id") if catalog else None,
                    }
                )
    ui_items: list[dict[str, Any]] = []
    if release:
        rid = int(release["id"])
        if uses_postgres():
            irows = conn.execute(
                "SELECT category, title FROM platform_release_items WHERE release_id = %s ORDER BY sort_order, id",
                (rid,),
            ).fetchall()
        else:
            irows = conn.execute(
                "SELECT category, title FROM platform_release_items WHERE release_id = ? ORDER BY sort_order, id",
                (rid,),
            ).fetchall()
        from .releases_repository import is_inform_release_category

        for ir in irows:
            item = dict(row_dict(ir))
            if is_inform_release_category(str(item.get("category") or "")):
                ui_items.append({"title": item.get("title")})
    return {
        "release": release,
        "feature_items": items,
        "ui_items": ui_items,
    }
