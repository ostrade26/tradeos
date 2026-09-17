"""Create, version, and publish curated Tradeal releases."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from ..db import row_dict, uses_postgres
from .repository import append_audit_log

RELEASE_CATEGORIES = frozenset(
    {"bug_fix", "improvement", "cosmetic", "new_feature", "product_update"}
)
GATED_CATEGORIES = frozenset({"new_feature", "product_update"})
VERSION_RE = re.compile(r"^\d+\.\d+\.\d+$")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_semver(value: str) -> tuple[int, int, int]:
    text = (value or "").strip().lstrip("v")
    parts = text.split(".")
    nums: list[int] = []
    for i in range(3):
        try:
            nums.append(int(parts[i]) if i < len(parts) else 0)
        except ValueError:
            nums.append(0)
    return nums[0], nums[1], nums[2]


def max_version(versions: list[str]) -> str:
    cleaned = [v for v in versions if v]
    if not cleaned:
        return ""
    return max(cleaned, key=parse_semver)


def suggest_next_version(latest: str, categories: list[str] | None = None) -> str:
    cats = set(categories or [])
    gated = bool(cats & GATED_CATEGORIES)
    if not latest:
        return "1.0.0"
    major, minor, patch = parse_semver(latest)
    if gated:
        return f"{major}.{minor + 1}.0"
    return f"{major}.{minor}.{patch + 1}"


def _validate_version(version: str) -> str:
    value = version.strip()
    if not VERSION_RE.match(value):
        raise HTTPException(status_code=400, detail="Version must look like 1.4.0")
    return value


def _item_row(row: Any) -> dict[str, Any]:
    item = dict(row_dict(row))
    item["gated"] = item.get("category") in GATED_CATEGORIES
    return item


def _release_row(row: Any, items: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    data = dict(row_dict(row))
    data["items"] = items if items is not None else []
    data["gated"] = any(i.get("category") in GATED_CATEGORIES for i in data["items"])
    return data


def latest_published_version(conn) -> str:
    if uses_postgres():
        row = conn.execute(
            "SELECT version FROM platform_releases WHERE status = 'published' ORDER BY published_at DESC, id DESC LIMIT 1"
        ).fetchone()
    else:
        row = conn.execute(
            "SELECT version FROM platform_releases WHERE status = 'published' ORDER BY published_at DESC, id DESC LIMIT 1"
        ).fetchone()
    if not row:
        return ""
    return str(dict(row_dict(row)).get("version") or "")


def _items_for_release(conn, release_id: int) -> list[dict[str, Any]]:
    if uses_postgres():
        rows = conn.execute(
            "SELECT * FROM platform_release_items WHERE release_id = %s ORDER BY sort_order, id",
            (release_id,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM platform_release_items WHERE release_id = ? ORDER BY sort_order, id",
            (release_id,),
        ).fetchall()
    return [_item_row(r) for r in rows]


def _get_release(conn, release_id: int) -> dict[str, Any]:
    if uses_postgres():
        row = conn.execute("SELECT * FROM platform_releases WHERE id = %s", (release_id,)).fetchone()
    else:
        row = conn.execute("SELECT * FROM platform_releases WHERE id = ?", (release_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Release not found")
    return _release_row(row, _items_for_release(conn, release_id))


def list_releases(conn) -> dict[str, Any]:
    if uses_postgres():
        rows = conn.execute("SELECT * FROM platform_releases ORDER BY id DESC").fetchall()
    else:
        rows = conn.execute("SELECT * FROM platform_releases ORDER BY id DESC").fetchall()
    releases = []
    for row in rows:
        data = dict(row_dict(row))
        items = _items_for_release(conn, int(data["id"]))
        releases.append(_release_row(data, items))
    latest = latest_published_version(conn)
    return {
        "releases": releases,
        "latest_version": latest or None,
        "next_version": suggest_next_version(latest),
    }


def _normalize_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    from .notifications_repository import normalize_feature_key

    cleaned: list[dict[str, Any]] = []
    for index, raw in enumerate(items or []):
        category = str(raw.get("category") or "").strip()
        if category not in RELEASE_CATEGORIES:
            raise HTTPException(status_code=400, detail="Invalid release category")
        title = str(raw.get("title") or "").strip()
        if not title:
            raise HTTPException(status_code=400, detail="Each change needs a title")
        detail = str(raw.get("detail") or "").strip()
        feature_key = str(raw.get("feature_key") or "").strip()
        if category in GATED_CATEGORIES:
            feature_key = normalize_feature_key(feature_key, title)
        else:
            feature_key = ""
        cleaned.append(
            {
                "category": category,
                "title": title,
                "detail": detail,
                "feature_key": feature_key,
                "sort_order": index,
            }
        )
    if not cleaned:
        raise HTTPException(status_code=400, detail="Add at least one change")
    return cleaned


def _replace_items(conn, release_id: int, items: list[dict[str, Any]]) -> None:
    if uses_postgres():
        conn.execute("DELETE FROM platform_release_items WHERE release_id = %s", (release_id,))
        for item in items:
            conn.execute(
                """
                INSERT INTO platform_release_items
                (release_id, category, title, detail, feature_key, sort_order)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (release_id, item["category"], item["title"], item["detail"], item["feature_key"], item["sort_order"]),
            )
        return
    conn.execute("DELETE FROM platform_release_items WHERE release_id = ?", (release_id,))
    for item in items:
        conn.execute(
            """
            INSERT INTO platform_release_items
            (release_id, category, title, detail, feature_key, sort_order)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (release_id, item["category"], item["title"], item["detail"], item["feature_key"], item["sort_order"]),
        )


def _assert_unique_version(conn, version: str, exclude_id: int | None = None) -> None:
    if uses_postgres():
        row = conn.execute("SELECT id FROM platform_releases WHERE version = %s", (version,)).fetchone()
    else:
        row = conn.execute("SELECT id FROM platform_releases WHERE version = ?", (version,)).fetchone()
    if not row:
        return
    found = int(dict(row_dict(row))["id"])
    if exclude_id is None or found != exclude_id:
        raise HTTPException(status_code=400, detail=f"Version {version} already exists")


def create_release(
    conn,
    *,
    version: str,
    title: str,
    summary: str,
    items: list[dict[str, Any]],
    actor_user_id: int,
) -> dict[str, Any]:
    version = _validate_version(version)
    title = title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    cleaned = _normalize_items(items)
    _assert_unique_version(conn, version)
    now = _now_iso()
    if uses_postgres():
        row = conn.execute(
            """
            INSERT INTO platform_releases
            (version, title, summary, status, created_at, updated_at, created_by_user_id)
            VALUES (%s, %s, %s, 'draft', %s, %s, %s)
            RETURNING *
            """,
            (version, title, summary.strip(), now, now, actor_user_id),
        ).fetchone()
        release_id = int(dict(row_dict(row))["id"])
    else:
        cur = conn.execute(
            """
            INSERT INTO platform_releases
            (version, title, summary, status, created_at, updated_at, created_by_user_id)
            VALUES (?, ?, ?, 'draft', ?, ?, ?)
            """,
            (version, title, summary.strip(), now, now, actor_user_id),
        )
        release_id = int(cur.lastrowid)
    _replace_items(conn, release_id, cleaned)
    append_audit_log(
        organisation_id=None,
        actor_user_id=actor_user_id,
        action="release.created",
        entity_type="platform_release",
        entity_id=str(release_id),
        new_value={"version": version, "title": title},
    )
    return _get_release(conn, release_id)


def update_release(
    conn,
    release_id: int,
    *,
    version: str,
    title: str,
    summary: str,
    items: list[dict[str, Any]],
    actor_user_id: int,
) -> dict[str, Any]:
    current = _get_release(conn, release_id)
    if current.get("status") != "draft":
        raise HTTPException(status_code=400, detail="Published releases cannot be edited")
    version = _validate_version(version)
    title = title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    cleaned = _normalize_items(items)
    _assert_unique_version(conn, version, exclude_id=release_id)
    now = _now_iso()
    if uses_postgres():
        conn.execute(
            """
            UPDATE platform_releases
            SET version = %s, title = %s, summary = %s, updated_at = %s
            WHERE id = %s
            """,
            (version, title, summary.strip(), now, release_id),
        )
    else:
        conn.execute(
            """
            UPDATE platform_releases
            SET version = ?, title = ?, summary = ?, updated_at = ?
            WHERE id = ?
            """,
            (version, title, summary.strip(), now, release_id),
        )
    _replace_items(conn, release_id, cleaned)
    append_audit_log(
        organisation_id=None,
        actor_user_id=actor_user_id,
        action="release.updated",
        entity_type="platform_release",
        entity_id=str(release_id),
        new_value={"version": version, "title": title},
    )
    return _get_release(conn, release_id)


def publish_release(
    conn,
    release_id: int,
    *,
    audience: str,
    organisation_id: int | None,
    recipient_user_id: int | None,
    recipient_scope: str,
    exclude_expired_amc: bool,
    actor_user_id: int,
) -> dict[str, Any]:
    from .notifications_repository import create_notifications_for_audience

    release = _get_release(conn, release_id)
    items = release["items"]
    gated = [i for i in items if i.get("category") in GATED_CATEGORIES]
    feature_keys = [i["feature_key"] for i in gated if i.get("feature_key")]
    lines = [f"{_category_label(i['category'])}: {i['title']}" for i in items]
    apply_scope = "user" if audience == "user" else "org"
    if gated:
        kind = "product_update"
        payload = {
            "cta": "update",
            "feature_key": feature_keys[0] if feature_keys else f"release-{release['version']}",
            "feature_keys": "\n".join(feature_keys),
            "items": "\n".join(i["title"] for i in items),
            "changelog": json.dumps(
                [{"category": i["category"], "title": i["title"], "detail": i.get("detail") or ""} for i in items]
            ),
            "release_id": str(release_id),
            "version": release["version"],
            "apply_scope": apply_scope,
        }
    else:
        kind = "release_notes"
        payload = {
            "cta": "",
            "items": "\n".join(i["title"] for i in items),
            "changelog": json.dumps(
                [{"category": i["category"], "title": i["title"], "detail": i.get("detail") or ""} for i in items]
            ),
            "release_id": str(release_id),
            "version": release["version"],
            "apply_scope": apply_scope,
        }

    body = release.get("summary") or "\n".join(lines)
    title = f"Tradeal {release['version']}"
    result = create_notifications_for_audience(
        conn,
        audience=audience,
        organisation_id=organisation_id,
        recipient_user_id=recipient_user_id,
        recipient_scope=recipient_scope if audience != "user" else "org_admin",
        exclude_expired_amc=exclude_expired_amc,
        kind=kind,
        title=title,
        body=body,
        payload=payload,
        href="",
        actor_user_id=actor_user_id,
        process_inline=audience == "user",
        source="release",
        source_id=release_id,
    )
    now = _now_iso()
    if uses_postgres():
        conn.execute(
            """
            UPDATE platform_releases
            SET status = 'published', published_at = COALESCE(published_at, %s),
                published_by_user_id = COALESCE(published_by_user_id, %s), updated_at = %s
            WHERE id = %s
            """,
            (now, actor_user_id, now, release_id),
        )
    else:
        conn.execute(
            """
            UPDATE platform_releases
            SET status = 'published', published_at = COALESCE(published_at, ?),
                published_by_user_id = COALESCE(published_by_user_id, ?), updated_at = ?
            WHERE id = ?
            """,
            (now, actor_user_id, now, release_id),
        )
    append_audit_log(
        organisation_id=organisation_id,
        actor_user_id=actor_user_id,
        action="release.published",
        entity_type="platform_release",
        entity_id=str(release_id),
        new_value={
            "version": release["version"],
            "audience": audience,
            "sent": result.get("sent"),
            "queued": result.get("queued"),
            "campaign_id": result.get("campaign_id"),
            "gated": bool(gated),
        },
    )
    updated = _get_release(conn, release_id)
    updated["sent"] = result.get("sent")
    updated["skipped_expired_amc"] = result.get("skipped_expired_amc")
    updated["queued"] = result.get("queued")
    updated["campaign_id"] = result.get("campaign_id")
    updated["campaign_status"] = result.get("campaign_status")
    return updated


def _category_label(category: str) -> str:
    return {
        "bug_fix": "Bug fix",
        "improvement": "Improvement",
        "cosmetic": "Cosmetic",
        "new_feature": "New feature",
        "product_update": "Product update",
    }.get(category, category)
