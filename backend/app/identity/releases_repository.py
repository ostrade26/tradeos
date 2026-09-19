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
    {
        "ui_and_fixes",
        "feature_enhancement",
        "bug_fix",
        "improvement",
        "cosmetic",
        "new_feature",
        "product_update",
    }
)
INFORM_CATEGORIES = frozenset({"ui_and_fixes", "bug_fix", "improvement", "cosmetic"})
GATED_CATEGORIES = frozenset({"feature_enhancement", "new_feature", "product_update"})


def is_inform_release_category(category: str) -> bool:
    return category in INFORM_CATEGORIES


def is_gated_release_category(category: str) -> bool:
    return category in GATED_CATEGORIES
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
    item["gated"] = is_gated_release_category(str(item.get("category") or ""))
    return item


def _release_row(row: Any, items: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    data = dict(row_dict(row))
    data["items"] = items if items is not None else []
    data["gated"] = any(is_gated_release_category(str(i.get("category") or "")) for i in data["items"])
    data.setdefault("source", "manual")
    data.setdefault("deploy_commit_sha", "")
    data.setdefault("deploy_environment", "")
    return data


def _normalize_commit_sha(value: str) -> str:
    sha = (value or "").strip().lower()
    if not sha:
        raise HTTPException(status_code=400, detail="commit_sha is required")
    if not re.fullmatch(r"[0-9a-f]{7,40}", sha):
        raise HTTPException(status_code=400, detail="commit_sha must be a git SHA (7–40 hex chars)")
    return sha


def latest_deploy_commit_sha(conn) -> str:
    if uses_postgres():
        row = conn.execute(
            """
            SELECT deploy_commit_sha FROM platform_releases
            WHERE deploy_commit_sha IS NOT NULL AND deploy_commit_sha <> ''
            ORDER BY id DESC LIMIT 1
            """
        ).fetchone()
    else:
        row = conn.execute(
            """
            SELECT deploy_commit_sha FROM platform_releases
            WHERE deploy_commit_sha IS NOT NULL AND deploy_commit_sha <> ''
            ORDER BY id DESC LIMIT 1
            """
        ).fetchone()
    if not row:
        return ""
    return str(dict(row_dict(row)).get("deploy_commit_sha") or "").strip()


def infer_category_from_commit_subject(subject: str) -> str:
    text = (subject or "").strip()
    lower = text.lower()
    if not text:
        return "ui_and_fixes"
    if lower.startswith("fix") or lower.startswith("bugfix") or lower.startswith("ui:") or lower.startswith("style"):
        return "ui_and_fixes"
    if "[feature]" in lower or lower.startswith("feat") or "[enhancement]" in lower:
        return "feature_enhancement"
    if lower.startswith("chore") or lower.startswith("docs") or lower.startswith("ci") or lower.startswith("test"):
        return "ui_and_fixes"
    return "ui_and_fixes"


def _summary_from_items(items: list[dict[str, Any]], *, env: str, sha: str) -> str:
    lines = [f"Environment: {env}", f"Commit: {sha}", ""]
    for item in items:
        label = _category_label(str(item.get("category") or "improvement"))
        title = str(item.get("title") or "").strip()
        if title:
            lines.append(f"• {label}: {title}")
    lines.append("")
    lines.append("Review this draft, then publish to organisations when ready.")
    return "\n".join(lines)


def get_release_by_deploy_commit(conn, commit_sha: str) -> dict[str, Any] | None:
    sha = _normalize_commit_sha(commit_sha)
    if uses_postgres():
        row = conn.execute(
            "SELECT * FROM platform_releases WHERE deploy_commit_sha = %s LIMIT 1",
            (sha,),
        ).fetchone()
    else:
        row = conn.execute(
            "SELECT * FROM platform_releases WHERE deploy_commit_sha = ? LIMIT 1",
            (sha,),
        ).fetchone()
    if not row:
        return None
    data = dict(row_dict(row))
    return _release_row(data, _items_for_release(conn, int(data["id"])))


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
        if is_gated_release_category(category):
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


def create_deploy_draft_release(
    conn,
    *,
    commit_sha: str,
    environment: str,
    title: str,
    summary: str,
    items: list[dict[str, Any]],
    actor_user_id: int,
    notify_platform_admins: bool = False,
) -> dict[str, Any]:
    sha = _normalize_commit_sha(commit_sha)
    existing = get_release_by_deploy_commit(conn, sha)
    if existing:
        return {"release": existing, "created": False, "notified": 0, "draft_features": []}

    env = (environment or "production").strip() or "production"
    latest = latest_published_version(conn)
    raw_items = items or []
    if not raw_items:
        short = sha[:7]
        raw_items = [
            {
                "category": "improvement",
                "title": f"Production deploy {short}",
                "detail": f"Deployed to {env}. Edit this draft before publishing to organisations.",
            }
        ]
    cleaned = _normalize_items(raw_items)
    version = suggest_next_version(latest, [i["category"] for i in cleaned])
    _assert_unique_version(conn, version)
    release_title = (title or "").strip() or f"Production deploy · {sha[:7]}"
    summary_text = (summary or "").strip()
    if not summary_text:
        summary_text = _summary_from_items(cleaned, env=env, sha=sha)
    now = _now_iso()
    if uses_postgres():
        row = conn.execute(
            """
            INSERT INTO platform_releases
            (version, title, summary, status, source, deploy_commit_sha, deploy_environment,
             created_at, updated_at, created_by_user_id)
            VALUES (%s, %s, %s, 'draft', 'deploy', %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (version, release_title, summary_text, sha, env, now, now, actor_user_id),
        ).fetchone()
        release_id = int(dict(row_dict(row))["id"])
    else:
        cur = conn.execute(
            """
            INSERT INTO platform_releases
            (version, title, summary, status, source, deploy_commit_sha, deploy_environment,
             created_at, updated_at, created_by_user_id)
            VALUES (?, ?, ?, 'draft', 'deploy', ?, ?, ?, ?, ?)
            """,
            (version, release_title, summary_text, sha, env, now, now, actor_user_id),
        )
        release_id = int(cur.lastrowid)
    _replace_items(conn, release_id, cleaned)
    append_audit_log(
        organisation_id=None,
        actor_user_id=actor_user_id,
        action="release.deploy_draft",
        entity_type="platform_release",
        entity_id=str(release_id),
        new_value={"version": version, "commit_sha": sha, "environment": env},
    )

    from .feature_offers_repository import ensure_draft_offers_from_deploy_items
    from .notifications_repository import notify_platform_admins as send_platform_admin_notices

    gated_items = [i for i in cleaned if is_gated_release_category(str(i.get("category") or ""))]
    draft_offers = ensure_draft_offers_from_deploy_items(
        conn,
        items=gated_items,
        deploy_sha=sha,
        actor_user_id=actor_user_id,
    )
    draft_keys = [str(o.get("feature_key") or "") for o in draft_offers if o.get("feature_key")]

    notified = 0
    if notify_platform_admins:
        inform_items = [i for i in cleaned if is_inform_release_category(str(i.get("category") or ""))]
        titles = [str(i.get("title") or "") for i in cleaned if str(i.get("title") or "").strip()]
        body_lines = [f"• {t}" for t in titles]
        if gated_items:
            href = "/platform-admin/add-ons"
            title = f"New feature(s) from deploy · {sha[:7]}"
            body = (
                f"Production deploy {sha[:7]} included marketplace feature(s).\n\n"
                + "\n".join(body_lines)
                + "\n\nReview pricing and Publish from Features & Access when ready."
            )
            if inform_items:
                body += "\nUI & fix notes are drafted under Releases — publish there to notify organisations."
            cta = "review_features"
        else:
            href = f"/platform-admin/releases?releaseId={release_id}"
            title = f"Release draft from deploy · {sha[:7]}"
            body = (
                f"Production deploy {sha[:7]} created draft {version}.\n\n"
                + ("\n".join(body_lines) + "\n\n" if body_lines else "")
                + "Review and Publish from Releases to notify organisations."
            )
            cta = "review_release"
        result = send_platform_admin_notices(
            conn,
            kind="deploy_review",
            title=title,
            body=body,
            payload={
                "cta": cta,
                "release_id": str(release_id),
                "commit_sha": sha,
                "version": version,
                "draft_feature_keys": "\n".join(draft_keys),
                "feature_titles": "\n".join(str(i.get("title") or "") for i in gated_items),
            },
            href=href,
            actor_user_id=actor_user_id,
            source="deploy",
        )
        notified = int(result.get("sent") or 0)

    release = _get_release(conn, release_id)
    return {
        "release": release,
        "created": True,
        "notified": notified,
        "draft_features": draft_keys,
    }


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


def _changelog_payload(items: list[dict[str, Any]]) -> str:
    return json.dumps(
        [
            {
                "category": i["category"],
                "title": i["title"],
                "detail": i.get("detail") or "",
                "feature_key": i.get("feature_key") or "",
            }
            for i in items
        ]
    )


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
    notify_organisations: bool = True,
) -> dict[str, Any]:
    from .notifications_repository import create_notifications_for_audience

    release = _get_release(conn, release_id)
    if str(release.get("status") or "") == "published":
        raise HTTPException(status_code=400, detail="Release is already published")
    items = release["items"]
    inform_items = [i for i in items if is_inform_release_category(str(i.get("category") or ""))]
    feature_items = [i for i in items if is_gated_release_category(str(i.get("category") or ""))]
    if not inform_items and not feature_items:
        raise HTTPException(status_code=400, detail="Release has no publishable items")

    lines = [f"{_category_label(i['category'])}: {i['title']}" for i in items]
    base_title = f"Tradeal {release['version']}"
    default_body = release.get("summary") or "\n".join(lines)
    sent_total = 0
    skipped_amc = 0
    should_notify = bool(notify_organisations)

    if should_notify and inform_items:
        inform_body = default_body
        inform_lines = [f"{_category_label(i['category'])}: {i['title']}" for i in inform_items]
        if len(inform_items) < len(items):
            inform_body = "\n".join(inform_lines)
        inform_result = create_notifications_for_audience(
            conn,
            audience=audience,
            organisation_id=organisation_id,
            recipient_user_id=recipient_user_id,
            recipient_scope=recipient_scope if audience != "user" else "org_admin",
            exclude_expired_amc=exclude_expired_amc,
            kind="release_notes",
            title=f"{base_title} · Updates",
            body=inform_body,
            payload={
                "cta": "acknowledge",
                "items": "\n".join(i["title"] for i in inform_items),
                "changelog": _changelog_payload(inform_items),
                "release_id": str(release_id),
                "version": release["version"],
            },
            href="",
            actor_user_id=actor_user_id,
        )
        sent_total += int(inform_result.get("sent") or 0)
        skipped_amc = max(skipped_amc, int(inform_result.get("skipped_expired_amc") or 0))

    # Gated marketplace features are published from Features & Access (catalog list),
    # not via release publish. Keep them on the release record for deploy history only.
    _ = feature_items

    result = {
        "sent": sent_total,
        "skipped_expired_amc": skipped_amc,
        "notified": should_notify,
    }
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
            "audience": audience if should_notify else None,
            "sent": result.get("sent"),
            "notify_organisations": should_notify,
            "gated": bool(feature_items),
            "inform": bool(inform_items),
        },
    )
    updated = _get_release(conn, release_id)
    updated["sent"] = result.get("sent")
    updated["skipped_expired_amc"] = result.get("skipped_expired_amc")
    updated["notified"] = should_notify
    return updated


def _category_label(category: str) -> str:
    return {
        "ui_and_fixes": "Bug fix & UI uplift",
        "feature_enhancement": "Feature enhancement",
        "bug_fix": "Bug fix",
        "improvement": "Improvement",
        "cosmetic": "Cosmetic",
        "new_feature": "New feature",
        "product_update": "Product update",
    }.get(category, category)
