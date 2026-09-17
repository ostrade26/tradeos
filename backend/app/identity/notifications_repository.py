"""Create and list in-app notifications for organisation users."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from ..db import row_dict, uses_postgres
from .org_members_repository import find_primary_admin_user
from .repository import append_audit_log

NOTIFICATION_KINDS = frozenset(
    {"credentials", "payment_reminder", "product_update", "feature_launch", "release_notes"}
)
UPDATE_KINDS = frozenset({"product_update", "feature_launch"})


def normalize_feature_key(raw: str, title: str = "") -> str:
    source = (raw or title or "").strip().lower()
    key = re.sub(r"[^a-z0-9]+", "-", source).strip("-")
    if not key:
        raise HTTPException(status_code=400, detail="Feature key is required for product updates")
    return key[:80]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_payload(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except (TypeError, json.JSONDecodeError):
        return {}


def _row(row: Any) -> dict[str, Any]:
    item = dict(row_dict(row))
    item["payload"] = _parse_payload(item.pop("payload_json", None))
    item["unread"] = item.get("read_at") in (None, "")
    item["applied"] = bool(item.get("applied_at"))
    item["feature_key"] = str(item.get("feature_key") or item["payload"].get("feature_key") or "")
    campaign_id = item.get("campaign_id")
    if campaign_id in (None, ""):
        item["campaign_id"] = None
    else:
        try:
            item["campaign_id"] = int(campaign_id)
        except (TypeError, ValueError):
            item["campaign_id"] = None
    return item


def _resolve_recipient(conn, organisation_id: int, recipient_user_id: int | None) -> int:
    if recipient_user_id:
        if uses_postgres():
            row = conn.execute(
                "SELECT id, organisation_id FROM users WHERE id = %s",
                (recipient_user_id,),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT id, organisation_id FROM users WHERE id = ?",
                (recipient_user_id,),
            ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Recipient not found")
        data = dict(row_dict(row))
        if int(data.get("organisation_id") or 0) != organisation_id:
            raise HTTPException(status_code=400, detail="Recipient is not in this organisation")
        return int(data["id"])
    admin = find_primary_admin_user(conn, organisation_id)
    if not admin:
        raise HTTPException(status_code=400, detail="No organisation admin to notify")
    return int(admin["user_id"])


def _fetch_campaign_notification(conn, campaign_id: int, recipient_user_id: int) -> dict[str, Any] | None:
    if uses_postgres():
        row = conn.execute(
            """
            SELECT * FROM user_notifications
            WHERE campaign_id = %s AND recipient_user_id = %s
            """,
            (campaign_id, recipient_user_id),
        ).fetchone()
    else:
        row = conn.execute(
            """
            SELECT * FROM user_notifications
            WHERE campaign_id = ? AND recipient_user_id = ?
            """,
            (campaign_id, recipient_user_id),
        ).fetchone()
    return _row(row) if row else None


def _insert_notification(
    conn,
    *,
    organisation_id: int,
    recipient_user_id: int,
    kind: str,
    title: str,
    body: str,
    payload: dict[str, Any] | None,
    href: str,
    actor_user_id: int,
    campaign_id: int | None = None,
) -> dict[str, Any]:
    now = _now_iso()
    payload = dict(payload or {})
    feature_key = str(payload.get("feature_key") or "")
    payload_json = json.dumps(payload)
    vals = (
        organisation_id,
        recipient_user_id,
        kind,
        title,
        body.strip(),
        payload_json,
        href or "",
        now,
        actor_user_id,
        feature_key,
        campaign_id,
    )
    if uses_postgres():
        row = conn.execute(
            """
            INSERT INTO user_notifications
            (organisation_id, recipient_user_id, kind, title, body, payload_json, href, created_at, created_by_user_id, feature_key, campaign_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (campaign_id, recipient_user_id) DO NOTHING
            RETURNING *
            """,
            vals,
        ).fetchone()
        if row:
            return _row(row)
        if campaign_id:
            existing = _fetch_campaign_notification(conn, campaign_id, recipient_user_id)
            if existing:
                return existing
        raise HTTPException(status_code=500, detail="Could not create notification")
    cur = conn.execute(
        """
        INSERT INTO user_notifications
        (organisation_id, recipient_user_id, kind, title, body, payload_json, href, created_at, created_by_user_id, feature_key, campaign_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (campaign_id, recipient_user_id) DO NOTHING
        """,
        vals,
    )
    if int(getattr(cur, "rowcount", 0) or 0) > 0 and cur.lastrowid:
        return _row(conn.execute("SELECT * FROM user_notifications WHERE id = ?", (cur.lastrowid,)).fetchone())
    if campaign_id:
        existing = _fetch_campaign_notification(conn, campaign_id, recipient_user_id)
        if existing:
            return existing
    raise HTTPException(status_code=500, detail="Could not create notification")


def _org_has_active_licence(conn, organisation_id: int) -> bool:
    if uses_postgres():
        row = conn.execute(
            "SELECT 1 FROM organisation_licenses WHERE organisation_id = %s AND status = 'active' LIMIT 1",
            (organisation_id,),
        ).fetchone()
    else:
        row = conn.execute(
            "SELECT 1 FROM organisation_licenses WHERE organisation_id = ? AND status = 'active' LIMIT 1",
            (organisation_id,),
        ).fetchone()
    return row is not None


def _amc_expired(conn, organisation_id: int) -> bool:
    from .licence_repository import get_current_amc, get_current_licence

    licence = get_current_licence(conn, organisation_id)
    if not licence:
        return False
    amc = get_current_amc(conn, int(licence["id"]))
    return bool(amc) and amc.get("status") == "expired"


def _users_in_org(conn, organisation_id: int, *, admins_only: bool) -> list[int]:
    admin_filter = "AND r.slug = 'organisation_admin'" if admins_only else ""
    q = f"""
        SELECT DISTINCT u.id
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN organisation_members m
          ON m.user_id = u.id AND m.organisation_id = u.organisation_id
        WHERE u.organisation_id = ?
          AND u.status = 'active'
          AND r.scope = 'organisation'
          AND (m.id IS NULL OR m.status = 'active')
          {admin_filter}
        ORDER BY u.id
    """
    if uses_postgres():
        q = q.replace("?", "%s")
        rows = conn.execute(q, (organisation_id,)).fetchall()
    else:
        rows = conn.execute(q, (organisation_id,)).fetchall()
    return [int(row_dict(r)["id"]) for r in rows]


def _active_licence_org_ids(conn) -> list[int]:
    rows = conn.execute(
        """
        SELECT DISTINCT organisation_id
        FROM organisation_licenses
        WHERE status = 'active'
        ORDER BY organisation_id
        """
    ).fetchall()
    return [int(row_dict(r)["organisation_id"]) for r in rows]


def resolve_audience_recipients(
    conn,
    *,
    audience: str,
    organisation_id: int | None,
    recipient_user_id: int | None,
    recipient_scope: str,
    exclude_expired_amc: bool,
) -> tuple[list[tuple[int, int]], int]:
    """Return ((org_id, user_id), ...), skipped_expired_amc."""
    admins_only = recipient_scope != "all_users"
    skipped_amc = 0
    org_ids: list[int] = []

    if audience == "user":
        if not organisation_id:
            raise HTTPException(status_code=400, detail="Organisation is required")
        user_id = _resolve_recipient(conn, organisation_id, recipient_user_id)
        if exclude_expired_amc and _amc_expired(conn, organisation_id):
            return [], 1
        return [(organisation_id, user_id)], 0

    if audience == "org":
        if not organisation_id:
            raise HTTPException(status_code=400, detail="Organisation is required")
        org_ids = [organisation_id]
    elif audience == "active_licences":
        org_ids = _active_licence_org_ids(conn)
    else:
        raise HTTPException(status_code=400, detail="Invalid audience")

    targets: list[tuple[int, int]] = []
    for oid in org_ids:
        if audience == "active_licences" and not _org_has_active_licence(conn, oid):
            continue
        if exclude_expired_amc and _amc_expired(conn, oid):
            skipped_amc += 1
            continue
        for uid in _users_in_org(conn, oid, admins_only=admins_only):
            targets.append((oid, uid))
    return targets, skipped_amc


def create_notification(
    conn,
    *,
    organisation_id: int,
    recipient_user_id: int | None,
    kind: str,
    title: str,
    body: str,
    payload: dict[str, Any] | None,
    href: str,
    actor_user_id: int,
) -> dict[str, Any]:
    result = create_notifications_for_audience(
        conn,
        audience="user",
        organisation_id=organisation_id,
        recipient_user_id=recipient_user_id,
        recipient_scope="org_admin",
        exclude_expired_amc=False,
        kind=kind,
        title=title,
        body=body,
        payload=payload,
        href=href,
        actor_user_id=actor_user_id,
    )
    items = result.get("notifications") or []
    if not items:
        raise HTTPException(status_code=400, detail="No recipients match this audience")
    return items[0]


def create_notifications_for_audience(
    conn,
    *,
    audience: str,
    organisation_id: int | None,
    recipient_user_id: int | None,
    recipient_scope: str,
    exclude_expired_amc: bool,
    kind: str,
    title: str,
    body: str,
    payload: dict[str, Any] | None,
    href: str,
    actor_user_id: int,
    process_inline: bool | None = None,
    source: str = "manual",
    source_id: int | None = None,
) -> dict[str, Any]:
    from .notification_campaigns_repository import enqueue_notification_campaign

    return enqueue_notification_campaign(
        conn,
        audience=audience,
        organisation_id=organisation_id,
        recipient_user_id=recipient_user_id,
        recipient_scope=recipient_scope,
        exclude_expired_amc=exclude_expired_amc,
        kind=kind,
        title=title,
        body=body,
        payload=payload,
        href=href,
        actor_user_id=actor_user_id,
        process_inline=process_inline,
        source=source,
        source_id=source_id,
    )


def list_notifications_for_user(conn, user_id: int, limit: int = 50) -> list[dict[str, Any]]:
    if uses_postgres():
        rows = conn.execute(
            """
            SELECT * FROM user_notifications
            WHERE recipient_user_id = %s
            ORDER BY id DESC
            LIMIT %s
            """,
            (user_id, limit),
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT * FROM user_notifications
            WHERE recipient_user_id = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (user_id, limit),
        ).fetchall()
    return [_row(r) for r in rows]


def unread_count_for_user(conn, user_id: int) -> int:
    if uses_postgres():
        row = conn.execute(
            """
            SELECT COUNT(*) AS n FROM user_notifications
            WHERE recipient_user_id = %s AND (read_at IS NULL OR read_at = '')
            """,
            (user_id,),
        ).fetchone()
    else:
        row = conn.execute(
            """
            SELECT COUNT(*) AS n FROM user_notifications
            WHERE recipient_user_id = ? AND (read_at IS NULL OR read_at = '')
            """,
            (user_id,),
        ).fetchone()
    data = dict(row_dict(row)) if row else {}
    return int(data.get("n") or 0)


def mark_notification_read(conn, notification_id: int, user_id: int) -> dict[str, Any]:
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
    item = _row(row)
    if item.get("read_at"):
        return item
    now = _now_iso()
    if uses_postgres():
        conn.execute("UPDATE user_notifications SET read_at = %s WHERE id = %s", (now, notification_id))
        row = conn.execute("SELECT * FROM user_notifications WHERE id = %s", (notification_id,)).fetchone()
    else:
        conn.execute("UPDATE user_notifications SET read_at = ? WHERE id = ?", (now, notification_id))
        row = conn.execute("SELECT * FROM user_notifications WHERE id = ?", (notification_id,)).fetchone()
    return _row(row)


def mark_all_read_for_user(conn, user_id: int) -> int:
    now = _now_iso()
    if uses_postgres():
        cur = conn.execute(
            """
            UPDATE user_notifications SET read_at = %s
            WHERE recipient_user_id = %s AND (read_at IS NULL OR read_at = '')
            """,
            (now, user_id),
        )
    else:
        cur = conn.execute(
            """
            UPDATE user_notifications SET read_at = ?
            WHERE recipient_user_id = ? AND (read_at IS NULL OR read_at = '')
            """,
            (now, user_id),
        )
    return int(getattr(cur, "rowcount", 0) or 0)


def list_applied_feature_keys(conn, user_id: int, organisation_id: int | None = None) -> list[str]:
    keys: list[str] = []
    if uses_postgres():
        rows = conn.execute(
            "SELECT feature_key FROM user_applied_updates WHERE user_id = %s ORDER BY applied_at",
            (user_id,),
        ).fetchall()
        if organisation_id:
            org_rows = conn.execute(
                "SELECT feature_key FROM organisation_applied_updates WHERE organisation_id = %s",
                (organisation_id,),
            ).fetchall()
        else:
            org_rows = []
    else:
        rows = conn.execute(
            "SELECT feature_key FROM user_applied_updates WHERE user_id = ? ORDER BY applied_at",
            (user_id,),
        ).fetchall()
        if organisation_id:
            org_rows = conn.execute(
                "SELECT feature_key FROM organisation_applied_updates WHERE organisation_id = ?",
                (organisation_id,),
            ).fetchall()
        else:
            org_rows = []
    seen: set[str] = set()
    for row in list(rows) + list(org_rows):
        key = str(dict(row_dict(row)).get("feature_key") or "")
        if key and key not in seen:
            seen.add(key)
            keys.append(key)
    return keys


def list_applied_versions(conn, user_id: int, organisation_id: int | None = None) -> list[str]:
    versions: list[str] = []
    if uses_postgres():
        rows = conn.execute(
            "SELECT version FROM user_applied_updates WHERE user_id = %s AND version <> ''",
            (user_id,),
        ).fetchall()
        if organisation_id:
            org_rows = conn.execute(
                "SELECT version FROM organisation_applied_updates WHERE organisation_id = %s AND version <> ''",
                (organisation_id,),
            ).fetchall()
        else:
            org_rows = []
    else:
        rows = conn.execute(
            "SELECT version FROM user_applied_updates WHERE user_id = ? AND version <> ''",
            (user_id,),
        ).fetchall()
        if organisation_id:
            org_rows = conn.execute(
                "SELECT version FROM organisation_applied_updates WHERE organisation_id = ? AND version <> ''",
                (organisation_id,),
            ).fetchall()
        else:
            org_rows = []
    for row in list(rows) + list(org_rows):
        value = str(dict(row_dict(row)).get("version") or "")
        if value:
            versions.append(value)
    return versions


def applied_feature_keys_for_user(user_id: int, organisation_id: int | None = None) -> list[str]:
    from ..db import _pg_connect, _sqlite_connect

    try:
        if uses_postgres():
            with _pg_connect() as conn:
                return list_applied_feature_keys(conn, user_id, organisation_id)
        with _sqlite_connect() as conn:
            return list_applied_feature_keys(conn, user_id, organisation_id)
    except Exception:
        return []


def applied_version_for_user(user_id: int, organisation_id: int | None = None) -> str:
    from ..db import _pg_connect, _sqlite_connect
    from .releases_repository import max_version

    try:
        if uses_postgres():
            with _pg_connect() as conn:
                return max_version(list_applied_versions(conn, user_id, organisation_id))
        with _sqlite_connect() as conn:
            return max_version(list_applied_versions(conn, user_id, organisation_id))
    except Exception:
        return ""


def _is_org_admin(conn, user_id: int) -> bool:
    if uses_postgres():
        row = conn.execute(
            """
            SELECT r.slug FROM users u
            JOIN roles r ON r.id = u.role_id
            WHERE u.id = %s
            """,
            (user_id,),
        ).fetchone()
    else:
        row = conn.execute(
            """
            SELECT r.slug FROM users u
            JOIN roles r ON r.id = u.role_id
            WHERE u.id = ?
            """,
            (user_id,),
        ).fetchone()
    if not row:
        return False
    return str(dict(row_dict(row)).get("slug") or "") == "organisation_admin"


def _feature_keys_from_notification(item: dict[str, Any]) -> list[str]:
    payload = item.get("payload") or {}
    raw = payload.get("feature_keys") or item.get("feature_key") or payload.get("feature_key") or ""
    if isinstance(raw, list):
        parts = [str(x) for x in raw]
    else:
        parts = str(raw).replace(",", "\n").split("\n")
    keys = [normalize_feature_key(part, part) for part in parts if str(part).strip()]
    if keys:
        return keys
    return [normalize_feature_key(str(item.get("feature_key") or ""), str(item.get("title") or "update"))]


def _insert_applied_key(
    conn,
    *,
    scope: str,
    organisation_id: int,
    user_id: int,
    feature_key: str,
    version: str,
    release_id: int | None,
    notification_id: int,
    now: str,
) -> None:
    if uses_postgres():
        if scope == "org":
            conn.execute(
                """
                INSERT INTO organisation_applied_updates
                (organisation_id, feature_key, version, release_id, notification_id, applied_by_user_id, applied_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (organisation_id, feature_key) DO NOTHING
                """,
                (organisation_id, feature_key, version, release_id, notification_id, user_id, now),
            )
            return
        conn.execute(
            """
            INSERT INTO user_applied_updates
            (organisation_id, user_id, feature_key, notification_id, applied_at, version, release_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id, feature_key) DO NOTHING
            """,
            (organisation_id, user_id, feature_key, notification_id, now, version, release_id),
        )
        return
    if scope == "org":
        conn.execute(
            """
            INSERT OR IGNORE INTO organisation_applied_updates
            (organisation_id, feature_key, version, release_id, notification_id, applied_by_user_id, applied_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (organisation_id, feature_key, version, release_id, notification_id, user_id, now),
        )
        return
    conn.execute(
        """
        INSERT OR IGNORE INTO user_applied_updates
        (organisation_id, user_id, feature_key, notification_id, applied_at, version, release_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (organisation_id, user_id, feature_key, notification_id, now, version, release_id),
    )


def apply_notification_update(conn, notification_id: int, user_id: int) -> dict[str, Any]:
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
    item = _row(row)
    payload = item.get("payload") or {}
    if item["kind"] not in UPDATE_KINDS and payload.get("cta") != "update":
        raise HTTPException(status_code=400, detail="This notice cannot be applied as an update")
    now = _now_iso()
    if item.get("applied_at"):
        return item

    org_id = int(item["organisation_id"])
    apply_scope = str(payload.get("apply_scope") or "user")
    if apply_scope == "org" and not _is_org_admin(conn, user_id):
        raise HTTPException(status_code=403, detail="Ask your organisation admin to apply this update")
    version = str(payload.get("version") or "")
    release_raw = payload.get("release_id")
    try:
        release_id = int(release_raw) if release_raw else None
    except (TypeError, ValueError):
        release_id = None
    keys = _feature_keys_from_notification(item)
    primary = keys[0]
    for key in keys:
        _insert_applied_key(
            conn,
            scope=apply_scope if apply_scope in ("org", "user") else "user",
            organisation_id=org_id,
            user_id=user_id,
            feature_key=key,
            version=version,
            release_id=release_id,
            notification_id=notification_id,
            now=now,
        )
    if uses_postgres():
        conn.execute(
            """
            UPDATE user_notifications
            SET applied_at = %s, read_at = COALESCE(NULLIF(read_at, ''), %s), feature_key = %s
            WHERE id = %s
            """,
            (now, now, primary, notification_id),
        )
        row = conn.execute("SELECT * FROM user_notifications WHERE id = %s", (notification_id,)).fetchone()
    else:
        conn.execute(
            """
            UPDATE user_notifications
            SET applied_at = ?, read_at = COALESCE(NULLIF(read_at, ''), ?), feature_key = ?
            WHERE id = ?
            """,
            (now, now, primary, notification_id),
        )
        row = conn.execute("SELECT * FROM user_notifications WHERE id = ?", (notification_id,)).fetchone()

    append_audit_log(
        organisation_id=org_id,
        actor_user_id=user_id,
        action="notification.update_applied",
        entity_type="user_applied_update",
        entity_id=primary,
        new_value={
            "notification_id": notification_id,
            "feature_keys": keys,
            "version": version,
            "apply_scope": apply_scope,
        },
    )
    return _row(row)
