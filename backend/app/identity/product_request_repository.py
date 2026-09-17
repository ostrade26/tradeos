"""Organisation product requests sent to Tradeal."""

from __future__ import annotations

import json
from typing import Any

from fastapi import HTTPException

from ..db import uses_postgres
from .billing_repository import _mapping, _now
from .repository import append_audit_log

KINDS = ("issue", "improvement", "requirement")
STATUSES = ("received", "in_progress", "done")
PRIORITIES = ("p1", "p2", "p3")
ALLOWED_ATTACHMENT_MIME = ("image/png", "image/jpeg", "image/webp", "image/gif")
MAX_ATTACHMENTS = 3
MAX_ATTACHMENT_CHARS = 1_200_000

_LIST_SQL = """
    SELECT pr.*,
           o.name AS organisation_name,
           u.name AS requested_by_name,
           u.username AS requested_by_username
    FROM product_requests pr
    JOIN organisations o ON o.id = pr.organisation_id
    LEFT JOIN users u ON u.id = pr.requested_by_user_id
"""


def _row(row) -> dict[str, Any]:
    d = dict(_mapping(row))
    d["id"] = int(d["id"])
    d["organisation_id"] = int(d["organisation_id"])
    d["requested_by_user_id"] = int(d["requested_by_user_id"])
    if d.get("reviewed_by_user_id") is not None:
        d["reviewed_by_user_id"] = int(d["reviewed_by_user_id"])
    d["priority"] = (d.get("priority") or "p3").strip().lower()
    if d["priority"] not in PRIORITIES:
        d["priority"] = "p3"
    raw = d.get("attachments") or "[]"
    if isinstance(raw, list):
        d["attachments"] = raw
    else:
        try:
            parsed = json.loads(raw)
            d["attachments"] = parsed if isinstance(parsed, list) else []
        except (TypeError, json.JSONDecodeError):
            d["attachments"] = []
    return d


def _normalize_attachments(attachments: list[Any] | None) -> list[dict[str, str]]:
    if not attachments:
        return []
    if len(attachments) > MAX_ATTACHMENTS:
        raise HTTPException(status_code=400, detail="Attach up to 3 screenshots")
    out: list[dict[str, str]] = []
    for item in attachments:
        if not isinstance(item, dict):
            continue
        mime = str(item.get("mime") or "").strip().lower()
        data = str(item.get("data") or "").strip()
        name = str(item.get("name") or "screenshot").strip()[:80] or "screenshot"
        if mime not in ALLOWED_ATTACHMENT_MIME:
            raise HTTPException(status_code=400, detail="Screenshots must be PNG, JPEG, WebP, or GIF")
        if not data.startswith("data:image/"):
            raise HTTPException(status_code=400, detail="Screenshots must be images")
        if len(data) > MAX_ATTACHMENT_CHARS:
            raise HTTPException(status_code=400, detail="A screenshot is too large — try a smaller image")
        out.append({"name": name, "mime": mime, "data": data})
    return out


def create_product_request(
    conn,
    *,
    organisation_id: int,
    user_id: int,
    kind: str,
    message: str,
    page_path: str,
    priority: str = "p3",
    attachments: list[Any] | None = None,
) -> dict[str, Any]:
    kind_key = (kind or "").strip().lower()
    if kind_key not in KINDS:
        raise HTTPException(status_code=400, detail="Choose issue, improvement, or new need")
    priority_key = (priority or "p3").strip().lower()
    if priority_key not in PRIORITIES:
        raise HTTPException(status_code=400, detail="Choose P1, P2, or P3")
    text = (message or "").strip()
    if len(text) < 8:
        raise HTTPException(status_code=400, detail="Add a short description of what you need")
    if len(text) > 2000:
        raise HTTPException(status_code=400, detail="Keep the description under 2,000 characters")
    path = (page_path or "").strip()[:500]
    path_only = path.split("?", 1)[0].rstrip("/") or "/"
    if path_only == "/notifications" or path_only.startswith("/notifications/"):
        path = ""
    elif path_only == "/app/notifications" or path_only.startswith("/app/notifications/"):
        path = ""
    elif path_only == "/platform-admin/notifications" or path_only.startswith(
        "/platform-admin/notifications/"
    ):
        path = ""
    shots = _normalize_attachments(attachments)
    payload = json.dumps(shots)
    now = _now()
    if uses_postgres():
        row = conn.execute(
            """
            INSERT INTO product_requests
            (organisation_id, requested_by_user_id, kind, priority, message, page_path, attachments,
             status, reply, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'received', '', %s, %s)
            RETURNING *
            """,
            (organisation_id, user_id, kind_key, priority_key, text, path, payload, now, now),
        ).fetchone()
        created = _row(row)
    else:
        cur = conn.execute(
            """
            INSERT INTO product_requests
            (organisation_id, requested_by_user_id, kind, priority, message, page_path, attachments,
             status, reply, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'received', '', ?, ?)
            """,
            (organisation_id, user_id, kind_key, priority_key, text, path, payload, now, now),
        )
        created = get_product_request(conn, int(cur.lastrowid))
    append_audit_log(
        organisation_id=organisation_id,
        actor_user_id=user_id,
        action="product_request.created",
        entity_type="product_request",
        entity_id=str(created["id"]),
        new_value={"kind": kind_key, "priority": priority_key, "page_path": path},
        conn=conn,
    )
    return created


def get_product_request(conn, request_id: int) -> dict[str, Any]:
    q = _LIST_SQL + " WHERE pr.id = ?"
    if uses_postgres():
        q = q.replace("?", "%s")
        row = conn.execute(q, (request_id,)).fetchone()
    else:
        row = conn.execute(q, (request_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Request not found")
    return _row(row)


def list_product_requests_for_user(conn, organisation_id: int, user_id: int, *, limit: int = 20) -> list[dict[str, Any]]:
    q = (
        _LIST_SQL
        + """
        WHERE pr.organisation_id = ? AND pr.requested_by_user_id = ?
        ORDER BY pr.id DESC
        LIMIT ?
        """
    )
    if uses_postgres():
        q = q.replace("?", "%s")
        rows = conn.execute(q, (organisation_id, user_id, limit)).fetchall()
    else:
        rows = conn.execute(q, (organisation_id, user_id, limit)).fetchall()
    return [_row(r) for r in rows]


def list_product_requests_platform(conn, *, status: str | None = None, limit: int = 200) -> list[dict[str, Any]]:
    if status:
        if status not in STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status")
        q = _LIST_SQL + " WHERE pr.status = ? ORDER BY pr.id DESC LIMIT ?"
        params: tuple[Any, ...] = (status, limit)
    else:
        q = _LIST_SQL + " ORDER BY pr.id DESC LIMIT ?"
        params = (limit,)
    if uses_postgres():
        q = q.replace("?", "%s")
        rows = conn.execute(q, params).fetchall()
    else:
        rows = conn.execute(q, params).fetchall()
    return [_row(r) for r in rows]


def count_open_product_requests(conn) -> int:
    q = "SELECT COUNT(*) AS n FROM product_requests WHERE status IN ('received', 'in_progress')"
    row = conn.execute(q).fetchone()
    return int(dict(_mapping(row)).get("n") or 0)


def list_open_product_requests_platform(conn, *, limit: int = 20) -> list[dict[str, Any]]:
    q = _LIST_SQL + " WHERE pr.status IN ('received', 'in_progress') ORDER BY pr.id DESC LIMIT ?"
    if uses_postgres():
        q = q.replace("?", "%s")
        rows = conn.execute(q, (limit,)).fetchall()
    else:
        rows = conn.execute(q, (limit,)).fetchall()
    return [_row(r) for r in rows]


def review_product_request(
    conn,
    request_id: int,
    *,
    status: str,
    reply: str,
    actor_user_id: int,
) -> dict[str, Any]:
    status_key = (status or "").strip().lower()
    if status_key not in STATUSES:
        raise HTTPException(status_code=400, detail="Status must be received, in progress, or done")
    note = (reply or "").strip()
    if len(note) > 2000:
        raise HTTPException(status_code=400, detail="Keep the reply under 2,000 characters")
    existing = get_product_request(conn, request_id)
    now = _now()
    if uses_postgres():
        conn.execute(
            """
            UPDATE product_requests
            SET status = %s, reply = %s, reviewed_by_user_id = %s, updated_at = %s
            WHERE id = %s
            """,
            (status_key, note, actor_user_id, now, request_id),
        )
    else:
        conn.execute(
            """
            UPDATE product_requests
            SET status = ?, reply = ?, reviewed_by_user_id = ?, updated_at = ?
            WHERE id = ?
            """,
            (status_key, note, actor_user_id, now, request_id),
        )
    updated = get_product_request(conn, request_id)
    append_audit_log(
        organisation_id=int(existing["organisation_id"]),
        actor_user_id=actor_user_id,
        action="product_request.reviewed",
        entity_type="product_request",
        entity_id=str(request_id),
        old_value={"status": existing.get("status")},
        new_value={"status": status_key},
        conn=conn,
    )

    status_label = {"received": "Received", "in_progress": "In progress", "done": "Done"}[status_key]
    body = note or f"Your request is now {status_label.lower()}."
    from .notifications_repository import create_notifications_for_audience

    create_notifications_for_audience(
        conn,
        audience="user",
        organisation_id=int(existing["organisation_id"]),
        recipient_user_id=int(existing["requested_by_user_id"]),
        recipient_scope="all_users",
        exclude_expired_amc=False,
        kind="product_request",
        title="Tradeal replied",
        body=body,
        payload={"product_request_id": str(request_id), "status": status_key},
        href="",
        actor_user_id=actor_user_id,
    )
    return updated
