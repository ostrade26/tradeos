"""Notification campaigns: one platform send with deferred per-user fan-out."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from ..db import row_dict, uses_postgres
from .notifications_repository import (
    NOTIFICATION_KINDS,
    UPDATE_KINDS,
    _insert_notification,
    normalize_feature_key,
    resolve_audience_recipients,
)
from .repository import append_audit_log

CAMPAIGN_STATUSES = ("pending", "processing", "complete", "failed")


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


def _redact_payload(payload: dict[str, Any]) -> dict[str, Any]:
    data = dict(payload or {})
    if "temporary_password" in data:
        data["temporary_password"] = "[redacted]"
    return data


def _campaign_row(row: Any, *, redact: bool = True) -> dict[str, Any]:
    item = dict(row_dict(row))
    payload = _parse_payload(item.pop("payload_json", None))
    item["payload"] = _redact_payload(payload) if redact else payload
    item["exclude_expired_amc"] = bool(int(item.get("exclude_expired_amc") or 0))
    for key in ("id", "organisation_id", "recipient_user_id", "target_count", "sent_count", "skipped_expired_amc", "source_id", "created_by_user_id"):
        if item.get(key) in (None, ""):
            item[key] = None
        else:
            try:
                item[key] = int(item[key])
            except (TypeError, ValueError):
                pass
    item["queued"] = item.get("status") in ("pending", "processing")
    return item


def get_campaign(conn, campaign_id: int, *, redact: bool = True) -> dict[str, Any]:
    if uses_postgres():
        row = conn.execute(
            "SELECT * FROM notification_campaigns WHERE id = %s",
            (campaign_id,),
        ).fetchone()
    else:
        row = conn.execute(
            "SELECT * FROM notification_campaigns WHERE id = ?",
            (campaign_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return _campaign_row(row, redact=redact)


def list_campaigns(conn, *, limit: int = 50) -> list[dict[str, Any]]:
    limit = max(1, min(int(limit), 200))
    if uses_postgres():
        rows = conn.execute(
            """
            SELECT * FROM notification_campaigns
            ORDER BY id DESC
            LIMIT %s
            """,
            (limit,),
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT * FROM notification_campaigns
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [_campaign_row(r) for r in rows]


def _insert_campaign(
    conn,
    *,
    kind: str,
    title: str,
    body: str,
    payload: dict[str, Any],
    href: str,
    feature_key: str,
    audience: str,
    organisation_id: int | None,
    recipient_user_id: int | None,
    recipient_scope: str,
    exclude_expired_amc: bool,
    source: str,
    source_id: int | None,
    actor_user_id: int,
    status: str = "pending",
) -> dict[str, Any]:
    now = _now_iso()
    started = now if status == "processing" else None
    vals = (
        kind,
        title,
        body.strip(),
        json.dumps(payload),
        href or "",
        feature_key or "",
        audience,
        organisation_id,
        recipient_user_id,
        recipient_scope,
        1 if exclude_expired_amc else 0,
        status,
        source,
        source_id,
        actor_user_id,
        now,
        started,
    )
    if uses_postgres():
        row = conn.execute(
            """
            INSERT INTO notification_campaigns
            (kind, title, body, payload_json, href, feature_key, audience, organisation_id,
             recipient_user_id, recipient_scope, exclude_expired_amc, status, source, source_id,
             created_by_user_id, created_at, started_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            vals,
        ).fetchone()
        return _campaign_row(row, redact=False)
    cur = conn.execute(
        """
        INSERT INTO notification_campaigns
        (kind, title, body, payload_json, href, feature_key, audience, organisation_id,
         recipient_user_id, recipient_scope, exclude_expired_amc, status, source, source_id,
         created_by_user_id, created_at, started_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        vals,
    )
    return _campaign_row(
        conn.execute("SELECT * FROM notification_campaigns WHERE id = ?", (cur.lastrowid,)).fetchone(),
        redact=False,
    )


def _set_campaign_counts(conn, campaign_id: int, *, target_count: int, skipped_expired_amc: int) -> None:
    if uses_postgres():
        conn.execute(
            """
            UPDATE notification_campaigns
            SET target_count = %s, skipped_expired_amc = %s
            WHERE id = %s
            """,
            (target_count, skipped_expired_amc, campaign_id),
        )
        return
    conn.execute(
        """
        UPDATE notification_campaigns
        SET target_count = ?, skipped_expired_amc = ?
        WHERE id = ?
        """,
        (target_count, skipped_expired_amc, campaign_id),
    )


def _complete_campaign(conn, campaign_id: int, *, sent_count: int, skipped_expired_amc: int, target_count: int) -> None:
    now = _now_iso()
    if uses_postgres():
        conn.execute(
            """
            UPDATE notification_campaigns
            SET status = 'complete', sent_count = %s, skipped_expired_amc = %s,
                target_count = %s, completed_at = %s, error_message = ''
            WHERE id = %s
            """,
            (sent_count, skipped_expired_amc, target_count, now, campaign_id),
        )
        return
    conn.execute(
        """
        UPDATE notification_campaigns
        SET status = 'complete', sent_count = ?, skipped_expired_amc = ?,
            target_count = ?, completed_at = ?, error_message = ''
        WHERE id = ?
        """,
        (sent_count, skipped_expired_amc, target_count, now, campaign_id),
    )


def _fail_campaign(conn, campaign_id: int, message: str) -> None:
    now = _now_iso()
    text = (message or "Fan-out failed")[:500]
    if uses_postgres():
        conn.execute(
            """
            UPDATE notification_campaigns
            SET status = 'failed', error_message = %s, completed_at = %s
            WHERE id = %s
            """,
            (text, now, campaign_id),
        )
        return
    conn.execute(
        """
        UPDATE notification_campaigns
        SET status = 'failed', error_message = ?, completed_at = ?
        WHERE id = ?
        """,
        (text, now, campaign_id),
    )


def _claim_campaign(conn, campaign_id: int) -> dict[str, Any] | None:
    now = _now_iso()
    if uses_postgres():
        row = conn.execute(
            """
            UPDATE notification_campaigns
            SET status = 'processing', started_at = COALESCE(started_at, %s), error_message = ''
            WHERE id = %s AND status IN ('pending', 'failed')
            RETURNING *
            """,
            (now, campaign_id),
        ).fetchone()
        return _campaign_row(row, redact=False) if row else None
    cur = conn.execute(
        """
        UPDATE notification_campaigns
        SET status = 'processing', started_at = COALESCE(started_at, ?), error_message = ''
        WHERE id = ? AND status IN ('pending', 'failed')
        """,
        (now, campaign_id),
    )
    if int(getattr(cur, "rowcount", 0) or 0) <= 0:
        return None
    row = conn.execute("SELECT * FROM notification_campaigns WHERE id = ?", (campaign_id,)).fetchone()
    return _campaign_row(row, redact=False) if row else None


def _list_pending_ids(conn, *, limit: int) -> list[int]:
    if uses_postgres():
        rows = conn.execute(
            """
            SELECT id FROM notification_campaigns
            WHERE status IN ('pending', 'failed')
            ORDER BY id
            LIMIT %s
            """,
            (limit,),
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT id FROM notification_campaigns
            WHERE status IN ('pending', 'failed')
            ORDER BY id
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [int(row_dict(r)["id"]) for r in rows]


def _cheap_audience_guard(
    conn,
    *,
    audience: str,
    organisation_id: int | None,
    recipient_user_id: int | None,
    recipient_scope: str,
    exclude_expired_amc: bool,
) -> None:
    """Fail fast without inserting N recipient rows. Full expansion happens in process_campaign."""
    from .notifications_repository import _active_licence_org_ids

    if audience == "active_licences":
        if not _active_licence_org_ids(conn):
            raise HTTPException(status_code=400, detail="No recipients match this audience")
        return
    targets, skipped = resolve_audience_recipients(
        conn,
        audience=audience,
        organisation_id=organisation_id,
        recipient_user_id=recipient_user_id,
        recipient_scope=recipient_scope,
        exclude_expired_amc=exclude_expired_amc,
    )
    if not targets:
        raise HTTPException(
            status_code=400,
            detail="No recipients match this audience"
            + (" (expired AMC excluded)" if skipped else ""),
        )


def _result_from_campaign(
    campaign: dict[str, Any],
    *,
    notifications: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    items = notifications or []
    queued = campaign.get("status") in ("pending", "processing")
    return {
        "sent": int(campaign.get("sent_count") or 0),
        "skipped_expired_amc": int(campaign.get("skipped_expired_amc") or 0),
        "queued": queued,
        "campaign_id": campaign.get("id"),
        "campaign_status": campaign.get("status"),
        "notifications": items,
        "notification": items[0] if items else None,
        "campaign": _redact_campaign(campaign),
    }


def _redact_campaign(campaign: dict[str, Any]) -> dict[str, Any]:
    item = dict(campaign)
    item["payload"] = _redact_payload(item.get("payload") or {})
    return item


def enqueue_notification_campaign(
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
    if kind not in NOTIFICATION_KINDS:
        raise HTTPException(status_code=400, detail="Invalid notification type")
    title = title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    if recipient_scope not in ("org_admin", "all_users"):
        raise HTTPException(status_code=400, detail="Invalid recipient scope")
    if audience not in ("user", "org", "active_licences"):
        raise HTTPException(status_code=400, detail="Invalid audience")

    payload = dict(payload or {})
    feature_key = str(payload.get("feature_key") or "")
    if kind in UPDATE_KINDS:
        feature_key = normalize_feature_key(feature_key, title)
        payload["cta"] = "update"
        payload["feature_key"] = feature_key

    if organisation_id:
        if uses_postgres():
            org = conn.execute("SELECT id FROM organisations WHERE id = %s", (organisation_id,)).fetchone()
        else:
            org = conn.execute("SELECT id FROM organisations WHERE id = ?", (organisation_id,)).fetchone()
        if not org:
            raise HTTPException(status_code=404, detail="Organisation not found")

    inline = audience == "user" if process_inline is None else bool(process_inline)
    _cheap_audience_guard(
        conn,
        audience=audience,
        organisation_id=organisation_id,
        recipient_user_id=recipient_user_id,
        recipient_scope=recipient_scope,
        exclude_expired_amc=exclude_expired_amc,
    )
    campaign = _insert_campaign(
        conn,
        kind=kind,
        title=title,
        body=body,
        payload=payload,
        href=href,
        feature_key=feature_key,
        audience=audience,
        organisation_id=organisation_id,
        recipient_user_id=recipient_user_id,
        recipient_scope=recipient_scope,
        exclude_expired_amc=exclude_expired_amc,
        source=source,
        source_id=source_id,
        actor_user_id=actor_user_id,
        status="processing" if inline else "pending",
    )
    if inline:
        return process_campaign(conn, int(campaign["id"]), already_claimed=True)
    return _result_from_campaign(campaign)


def process_campaign(conn, campaign_id: int, *, already_claimed: bool = False) -> dict[str, Any]:
    if already_claimed:
        claimed = get_campaign(conn, campaign_id, redact=False)
    else:
        existing = get_campaign(conn, campaign_id, redact=False)
        if existing.get("status") == "complete":
            return _result_from_campaign(existing)
        if existing.get("status") == "processing":
            return _result_from_campaign(existing)
        claimed = _claim_campaign(conn, campaign_id)
        if not claimed:
            return _result_from_campaign(get_campaign(conn, campaign_id, redact=False))

    try:
        targets, skipped = resolve_audience_recipients(
            conn,
            audience=str(claimed["audience"]),
            organisation_id=claimed.get("organisation_id"),
            recipient_user_id=claimed.get("recipient_user_id"),
            recipient_scope=str(claimed.get("recipient_scope") or "org_admin"),
            exclude_expired_amc=bool(claimed.get("exclude_expired_amc")),
        )
        _set_campaign_counts(conn, campaign_id, target_count=len(targets), skipped_expired_amc=skipped)
        items: list[dict[str, Any]] = []
        for oid, uid in targets:
            items.append(
                _insert_notification(
                    conn,
                    organisation_id=oid,
                    recipient_user_id=uid,
                    kind=str(claimed["kind"]),
                    title=str(claimed["title"]),
                    body=str(claimed.get("body") or ""),
                    payload=claimed.get("payload") or {},
                    href=str(claimed.get("href") or ""),
                    actor_user_id=int(claimed.get("created_by_user_id") or 0),
                    campaign_id=campaign_id,
                )
            )
        _complete_campaign(
            conn,
            campaign_id,
            sent_count=len(items),
            skipped_expired_amc=skipped,
            target_count=len(targets),
        )
        audit_payload = _redact_payload(claimed.get("payload") or {})
        append_audit_log(
            organisation_id=claimed.get("organisation_id"),
            actor_user_id=claimed.get("created_by_user_id"),
            action="notification.sent",
            entity_type="notification_campaign",
            entity_id=str(campaign_id),
            new_value={
                "kind": claimed.get("kind"),
                "audience": claimed.get("audience"),
                "recipient_scope": claimed.get("recipient_scope"),
                "exclude_expired_amc": claimed.get("exclude_expired_amc"),
                "sent": len(items),
                "skipped_expired_amc": skipped,
                "title": claimed.get("title"),
                "payload": audit_payload,
            },
        )
        finished = get_campaign(conn, campaign_id, redact=True)
        return _result_from_campaign(finished, notifications=items)
    except HTTPException as exc:
        if exc.status_code == 400:
            _complete_campaign(
                conn,
                campaign_id,
                sent_count=0,
                skipped_expired_amc=int(claimed.get("skipped_expired_amc") or 0),
                target_count=0,
            )
            finished = get_campaign(conn, campaign_id, redact=True)
            return _result_from_campaign(finished)
        _fail_campaign(conn, campaign_id, str(exc.detail))
        raise
    except Exception as exc:
        _fail_campaign(conn, campaign_id, str(exc))
        raise


def process_pending_campaigns(conn, *, limit: int = 5) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for campaign_id in _list_pending_ids(conn, limit=limit):
        results.append(process_campaign(conn, campaign_id))
    return results
