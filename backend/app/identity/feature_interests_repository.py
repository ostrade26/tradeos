"""User interest in new features and platform approve / reject."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from ..db import row_dict, uses_postgres
from .notifications_repository import (
    create_notification,
    mark_notifications_read_for_feature_interest,
    normalize_feature_key,
)
from .repository import append_audit_log

OPEN_STATUS = "interested"
APPROVED_STATUS = "approved"
REJECTED_STATUS = "rejected"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row(row: Any) -> dict[str, Any]:
    data = dict(row_dict(row))
    data["id"] = int(data["id"])
    data["organisation_id"] = int(data["organisation_id"])
    data["requested_by_user_id"] = int(data["requested_by_user_id"])
    return data


def _enrich(conn, item: dict[str, Any]) -> dict[str, Any]:
    oid = item["organisation_id"]
    uid = item["requested_by_user_id"]
    if uses_postgres():
        org = conn.execute("SELECT name FROM organisations WHERE id = %s", (oid,)).fetchone()
        user = conn.execute("SELECT name, username FROM users WHERE id = %s", (uid,)).fetchone()
    else:
        org = conn.execute("SELECT name FROM organisations WHERE id = ?", (oid,)).fetchone()
        user = conn.execute("SELECT name, username FROM users WHERE id = ?", (uid,)).fetchone()
    if org:
        item["organisation_name"] = str(dict(row_dict(org)).get("name") or "")
    if user:
        u = dict(row_dict(user))
        item["requested_by_name"] = str(u.get("name") or "")
        item["requested_by_username"] = str(u.get("username") or "")
    from .feature_offers_repository import get_offer_by_key

    offer = get_offer_by_key(conn, str(item.get("feature_key") or ""))
    if offer:
        title = str(offer.get("title") or "").strip()
        detail = str(offer.get("description") or "").strip()
        if title:
            item["feature_title"] = title
        if detail:
            item["feature_detail"] = detail
        item["card_tone"] = str(offer.get("card_tone") or "")
        item["card_image_url"] = str(offer.get("card_image_url") or "")
        item["card_bg_hex"] = str(offer.get("card_bg_hex") or "")
        item["card_tag"] = str(offer.get("card_tag") or "")
        item["pricing_type"] = str(offer.get("pricing_type") or "")
        item["price_cents"] = int(offer.get("price_cents") or 0)
    else:
        item["card_tone"] = ""
        item["card_image_url"] = ""
        item["card_bg_hex"] = ""
        item["card_tag"] = ""
    return item


def list_open_interests_platform(conn, *, limit: int = 100) -> list[dict[str, Any]]:
    q = """
        SELECT * FROM feature_launch_interests
        WHERE status = ?
        ORDER BY created_at DESC
        LIMIT ?
    """
    if uses_postgres():
        q = q.replace("?", "%s")
        rows = conn.execute(q, (OPEN_STATUS, limit)).fetchall()
    else:
        rows = conn.execute(q, (OPEN_STATUS, limit)).fetchall()
    return [_enrich(conn, _row(r)) for r in rows]


def list_interests_platform(
    conn,
    *,
    status: str | None = None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    if status:
        q = """
            SELECT * FROM feature_launch_interests
            WHERE status = ?
            ORDER BY created_at DESC
            LIMIT ?
        """
        params: tuple[Any, ...] = (status, limit)
    else:
        q = """
            SELECT * FROM feature_launch_interests
            ORDER BY created_at DESC
            LIMIT ?
        """
        params = (limit,)
    if uses_postgres():
        q = q.replace("?", "%s")
        rows = conn.execute(q, params).fetchall()
    else:
        rows = conn.execute(q, params).fetchall()
    return [_enrich(conn, _row(r)) for r in rows]


def count_open_interests_platform(conn) -> int:
    q = "SELECT COUNT(*) AS n FROM feature_launch_interests WHERE status = ?"
    if uses_postgres():
        q = q.replace("?", "%s")
        row = conn.execute(q, (OPEN_STATUS,)).fetchone()
    else:
        row = conn.execute(q, (OPEN_STATUS,)).fetchone()
    return int(dict(row_dict(row))["n"])


def get_interest(conn, interest_id: int) -> dict[str, Any]:
    if uses_postgres():
        row = conn.execute(
            "SELECT * FROM feature_launch_interests WHERE id = %s",
            (interest_id,),
        ).fetchone()
    else:
        row = conn.execute(
            "SELECT * FROM feature_launch_interests WHERE id = ?",
            (interest_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Feature interest not found")
    return _enrich(conn, _row(row))


def express_interest_from_notification(
    conn,
    *,
    notification_id: int,
    user_id: int,
    organisation_id: int,
    feature_keys: list[str],
) -> dict[str, Any]:
    from .notifications_repository import _feature_keys_from_notification, _row as notif_row

    if uses_postgres():
        row = conn.execute(
            "SELECT * FROM user_notifications WHERE id = %s AND recipient_user_id = %s",
            (notification_id, user_id),
        ).fetchone()
    else:
        row = conn.execute(
            "SELECT * FROM user_notifications WHERE id = ? AND recipient_user_id = ?",
            (notification_id, user_id),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Notification not found")
    notice = notif_row(row)
    payload = notice.get("payload") or {}
    cta = str(payload.get("cta") or "")
    if notice.get("kind") != "feature_launch" or cta != "interest":
        raise HTTPException(status_code=400, detail="This notice is not a feature launch offer")
    allowed = set(_feature_keys_from_notification(notice))
    if not allowed:
        raise HTTPException(status_code=400, detail="No features listed on this notice")

    picked = [
        normalize_feature_key(k, k)
        for k in feature_keys
        if normalize_feature_key(k, k) in allowed
    ]
    if not picked:
        raise HTTPException(status_code=400, detail="Select at least one feature")

    changelog = payload.get("changelog") or "[]"
    titles: dict[str, str] = {}
    details: dict[str, str] = {}
    try:
        import json

        entries = json.loads(changelog) if isinstance(changelog, str) else changelog
        if isinstance(entries, list):
            for entry in entries:
                key = normalize_feature_key(str(entry.get("feature_key") or ""), str(entry.get("title") or ""))
                if key:
                    titles[key] = str(entry.get("title") or key)
                    details[key] = str(entry.get("detail") or "")
    except Exception:
        pass

    now = _now()
    created: list[dict[str, Any]] = []
    for key in picked:
        if uses_postgres():
            existing = conn.execute(
                """
                SELECT id FROM feature_launch_interests
                WHERE organisation_id = %s AND feature_key = %s AND status = %s
                """,
                (organisation_id, key, OPEN_STATUS),
            ).fetchone()
        else:
            existing = conn.execute(
                """
                SELECT id FROM feature_launch_interests
                WHERE organisation_id = ? AND feature_key = ? AND status = ?
                """,
                (organisation_id, key, OPEN_STATUS),
            ).fetchone()
        if existing:
            continue
        title = titles.get(key, key)
        detail = details.get(key, "")
        if uses_postgres():
            ins = conn.execute(
                """
                INSERT INTO feature_launch_interests
                (organisation_id, requested_by_user_id, feature_key, feature_title, feature_detail,
                 source_notification_id, status, platform_note, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, '', %s, %s)
                RETURNING *
                """,
                (organisation_id, user_id, key, title, detail, notification_id, OPEN_STATUS, now, now),
            ).fetchone()
            item = _enrich(conn, _row(ins))
        else:
            cur = conn.execute(
                """
                INSERT INTO feature_launch_interests
                (organisation_id, requested_by_user_id, feature_key, feature_title, feature_detail,
                 source_notification_id, status, platform_note, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?)
                """,
                (organisation_id, user_id, key, title, detail, notification_id, OPEN_STATUS, now, now),
            )
            item = get_interest(conn, int(cur.lastrowid))
        created.append(item)

    if not created:
        raise HTTPException(status_code=400, detail="Interest was already submitted for these features")

    append_audit_log(
        organisation_id=organisation_id,
        actor_user_id=user_id,
        action="feature_interest.submitted",
        entity_type="feature_launch_interest",
        entity_id=str(created[0]["id"]),
        new_value={"feature_keys": picked, "notification_id": notification_id},
    )
    return {"interests": created, "submitted": len(created)}


def _notify_org_decision(
    conn,
    *,
    organisation_id: int,
    feature_key: str,
    feature_title: str,
    approved: bool,
    note: str,
    actor_user_id: int,
    requester_user_id: int | None = None,
) -> None:
    from .org_members_repository import find_primary_admin_user

    recipient_ids: list[int] = []
    if requester_user_id:
        recipient_ids.append(int(requester_user_id))
    admin = find_primary_admin_user(conn, organisation_id)
    admin_id = int(admin["user_id"]) if admin else None
    if admin_id and admin_id not in recipient_ids:
        recipient_ids.append(admin_id)
    if not recipient_ids:
        return

    title = f"Add-on {'approved' if approved else 'declined'} · {feature_title}"
    body = note.strip() or (
        f"Your organisation can now use {feature_title}."
        if approved
        else f"We could not enable {feature_title} for your organisation at this time."
    )
    href = "/app/addons"
    payload = {
        "cta": "decision",
        "decision": "approved" if approved else "rejected",
        "feature_key": feature_key,
        "feature_title": feature_title,
    }
    for recipient_id in recipient_ids:
        create_notification(
            conn,
            organisation_id=organisation_id,
            recipient_user_id=recipient_id,
            kind="feature_launch",
            title=title,
            body=body,
            payload=payload,
            href=href,
            actor_user_id=actor_user_id,
        )


def _clear_inbox_notices_for_interest(conn, interest_id: int) -> None:
    mark_notifications_read_for_feature_interest(conn, interest_id)


def _remove_org_applied_key(conn, organisation_id: int, feature_key: str) -> None:
    if uses_postgres():
        conn.execute(
            """
            DELETE FROM organisation_applied_updates
            WHERE organisation_id = %s AND feature_key = %s
            """,
            (organisation_id, feature_key),
        )
        return
    conn.execute(
        """
        DELETE FROM organisation_applied_updates
        WHERE organisation_id = ? AND feature_key = ?
        """,
        (organisation_id, feature_key),
    )


def _mark_interest_reviewed(
    conn,
    *,
    interest_id: int,
    organisation_id: int,
    feature_key: str,
    status: str,
    note: str,
    actor_user_id: int,
    now: str,
) -> None:
    """Apply review status and clear marketplace Pending for this org+feature."""
    if uses_postgres():
        # Drop older rows with the same reviewed status (legacy UNIQUE org+feature+status).
        conn.execute(
            """
            DELETE FROM feature_launch_interests
            WHERE organisation_id = %s AND feature_key = %s AND status = %s AND id <> %s
            """,
            (organisation_id, feature_key, status, interest_id),
        )
        # Drop any other open requests so Pending cannot stick after decline.
        conn.execute(
            """
            DELETE FROM feature_launch_interests
            WHERE organisation_id = %s AND feature_key = %s AND status = %s AND id <> %s
            """,
            (organisation_id, feature_key, OPEN_STATUS, interest_id),
        )
        conn.execute(
            """
            UPDATE feature_launch_interests
            SET status = %s, platform_note = %s, reviewed_by_user_id = %s, reviewed_at = %s, updated_at = %s
            WHERE id = %s
            """,
            (status, note, actor_user_id, now, now, interest_id),
        )
        return
    conn.execute(
        """
        DELETE FROM feature_launch_interests
        WHERE organisation_id = ? AND feature_key = ? AND status = ? AND id <> ?
        """,
        (organisation_id, feature_key, status, interest_id),
    )
    conn.execute(
        """
        DELETE FROM feature_launch_interests
        WHERE organisation_id = ? AND feature_key = ? AND status = ? AND id <> ?
        """,
        (organisation_id, feature_key, OPEN_STATUS, interest_id),
    )
    conn.execute(
        """
        UPDATE feature_launch_interests
        SET status = ?, platform_note = ?, reviewed_by_user_id = ?, reviewed_at = ?, updated_at = ?
        WHERE id = ?
        """,
        (status, note, actor_user_id, now, now, interest_id),
    )


def approve_interest(
    conn,
    *,
    interest_id: int,
    actor_user_id: int,
    note: str = "",
) -> dict[str, Any]:
    from .notifications_repository import _insert_applied_key

    item = get_interest(conn, interest_id)
    status = str(item["status"])
    now = _now()
    note = (note or "").strip()
    org_id = int(item["organisation_id"])
    feature_key = str(item["feature_key"])
    notification_id = int(item["source_notification_id"]) if item.get("source_notification_id") else None

    if status == APPROVED_STATUS:
        raise HTTPException(status_code=400, detail="Organisation already has access for this request")
    if status == REJECTED_STATUS:
        _insert_applied_key(
            conn,
            scope="org",
            organisation_id=org_id,
            user_id=actor_user_id,
            feature_key=feature_key,
            version="",
            release_id=None,
            notification_id=notification_id,
            now=now,
        )
        _mark_interest_reviewed(
            conn,
            interest_id=interest_id,
            organisation_id=org_id,
            feature_key=feature_key,
            status=APPROVED_STATUS,
            note=note,
            actor_user_id=actor_user_id,
            now=now,
        )
        _notify_org_decision(
            conn,
            organisation_id=org_id,
            feature_key=feature_key,
            feature_title=str(item["feature_title"]),
            approved=True,
            note=note,
            actor_user_id=actor_user_id,
            requester_user_id=item.get("requested_by_user_id"),
        )
        append_audit_log(
            organisation_id=org_id,
            actor_user_id=actor_user_id,
            action="feature_interest.reapproved",
            entity_type="feature_launch_interest",
            entity_id=str(interest_id),
            new_value={"feature_key": feature_key},
        )
        _clear_inbox_notices_for_interest(conn, interest_id)
        return get_interest(conn, interest_id)

    if status != OPEN_STATUS:
        raise HTTPException(status_code=400, detail="This interest cannot be approved")

    _mark_interest_reviewed(
        conn,
        interest_id=interest_id,
        organisation_id=org_id,
        feature_key=feature_key,
        status=APPROVED_STATUS,
        note=note,
        actor_user_id=actor_user_id,
        now=now,
    )
    _insert_applied_key(
        conn,
        scope="org",
        organisation_id=org_id,
        user_id=actor_user_id,
        feature_key=feature_key,
        version="",
        release_id=None,
        notification_id=notification_id,
        now=now,
    )
    _notify_org_decision(
        conn,
        organisation_id=org_id,
        feature_key=feature_key,
        feature_title=str(item["feature_title"]),
        approved=True,
        note=note,
        actor_user_id=actor_user_id,
        requester_user_id=item.get("requested_by_user_id"),
    )
    append_audit_log(
        organisation_id=org_id,
        actor_user_id=actor_user_id,
        action="feature_interest.approved",
        entity_type="feature_launch_interest",
        entity_id=str(interest_id),
        new_value={"feature_key": feature_key},
    )
    _clear_inbox_notices_for_interest(conn, interest_id)
    return get_interest(conn, interest_id)


def reject_interest(
    conn,
    *,
    interest_id: int,
    actor_user_id: int,
    note: str = "",
) -> dict[str, Any]:
    item = get_interest(conn, interest_id)
    status = str(item["status"])
    now = _now()
    note = (note or "").strip()
    org_id = int(item["organisation_id"])
    feature_key = str(item["feature_key"])

    if status == REJECTED_STATUS:
        raise HTTPException(status_code=400, detail="Request is already declined")
    if status == APPROVED_STATUS:
        _remove_org_applied_key(conn, org_id, feature_key)
        _mark_interest_reviewed(
            conn,
            interest_id=interest_id,
            organisation_id=org_id,
            feature_key=feature_key,
            status=REJECTED_STATUS,
            note=note,
            actor_user_id=actor_user_id,
            now=now,
        )
        # Revoking access — org should know they lost the feature.
        _notify_org_decision(
            conn,
            organisation_id=org_id,
            feature_key=feature_key,
            feature_title=str(item["feature_title"]),
            approved=False,
            note=note,
            actor_user_id=actor_user_id,
            requester_user_id=item.get("requested_by_user_id"),
        )
        append_audit_log(
            organisation_id=org_id,
            actor_user_id=actor_user_id,
            action="feature_interest.revoked",
            entity_type="feature_launch_interest",
            entity_id=str(interest_id),
            new_value={"feature_key": feature_key, "note": note},
        )
        _clear_inbox_notices_for_interest(conn, interest_id)
        return get_interest(conn, interest_id)

    if status != OPEN_STATUS:
        raise HTTPException(status_code=400, detail="This interest cannot be declined")

    _mark_interest_reviewed(
        conn,
        interest_id=interest_id,
        organisation_id=org_id,
        feature_key=feature_key,
        status=REJECTED_STATUS,
        note=note,
        actor_user_id=actor_user_id,
        now=now,
    )
    # Declining an open request is quiet — no org inbox notice.
    append_audit_log(
        organisation_id=org_id,
        actor_user_id=actor_user_id,
        action="feature_interest.rejected",
        entity_type="feature_launch_interest",
        entity_id=str(interest_id),
        new_value={"feature_key": feature_key, "note": note},
    )
    _clear_inbox_notices_for_interest(conn, interest_id)
    return get_interest(conn, interest_id)
