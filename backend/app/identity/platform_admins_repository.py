"""Tradeal platform-admin accounts (operator staff, not organisation users)."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from ..db import uses_postgres
from .billing_repository import (
    _mapping,
    _now,
    generate_temp_password,
    login_identity_in_use,
    set_user_login_username,
)
from .login_username import require_login_username
from .repository import append_audit_log
from .security import hash_password

_LIST_SQL = """
    SELECT u.id, u.username, u.email, u.name, u.status, u.created_at
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE r.slug = 'platform_admin'
    ORDER BY u.id
"""


def _row(row) -> dict[str, Any]:
    d = dict(_mapping(row))
    d["id"] = int(d["id"])
    d["login_id"] = (d.get("username") or "").strip() or (d.get("email") or "").strip()
    return d


def list_platform_admins(conn) -> list[dict[str, Any]]:
    rows = conn.execute(_LIST_SQL).fetchall()
    return [_row(r) for r in rows]


def _role_id(conn) -> int:
    q = "SELECT id FROM roles WHERE slug = ?"
    if uses_postgres():
        q = q.replace("?", "%s")
    row = conn.execute(q, ("platform_admin",)).fetchone()
    if not row:
        raise HTTPException(status_code=500, detail="Platform admin role is missing")
    return int(_mapping(row)["id"])


def _get_admin(conn, user_id: int) -> dict[str, Any]:
    q = _LIST_SQL.replace("ORDER BY u.id", "AND u.id = ? ORDER BY u.id")
    if uses_postgres():
        q = q.replace("?", "%s")
    row = conn.execute(q, (user_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Tradeal Admin not found")
    return _row(row)


def create_platform_admin(
    conn,
    *,
    username: str,
    name: str,
    actor_user_id: int,
) -> dict[str, Any]:
    login = require_login_username(username)
    display = (name or "").strip()
    if len(display) < 2:
        raise HTTPException(status_code=400, detail="Add a name")
    if login_identity_in_use(conn, login, ""):
        raise HTTPException(status_code=400, detail="That username is already in use")
    temp = generate_temp_password()
    now = _now()
    pwd = hash_password(temp)
    role_id = _role_id(conn)
    if uses_postgres():
        row = conn.execute(
            """
            INSERT INTO users
            (username, email, name, password_hash, organisation_id, account_type, role_id, status, created_at, updated_at)
            VALUES (%s, %s, %s, %s, NULL, 'wholesaler_retailer', %s, 'active', %s, %s)
            RETURNING id, username, email, name, status, created_at
            """,
            (login, "", display, pwd, role_id, now, now),
        ).fetchone()
        created = _row(row)
    else:
        cur = conn.execute(
            """
            INSERT INTO users
            (username, email, name, password_hash, organisation_id, account_type, role_id, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, NULL, 'wholesaler_retailer', ?, 'active', ?, ?)
            """,
            (login, "", display, pwd, role_id, now, now),
        )
        created = _get_admin(conn, int(cur.lastrowid))
    append_audit_log(
        organisation_id=None,
        actor_user_id=actor_user_id,
        action="platform_admin.created",
        entity_type="user",
        entity_id=str(created["id"]),
        new_value={"username": login},
        conn=conn,
    )
    created["temporary_password"] = temp
    created["login_id"] = login
    return created


def reset_platform_admin_sign_in(
    conn,
    *,
    user_id: int,
    actor_user_id: int,
    username: str | None = None,
) -> dict[str, Any]:
    if user_id == actor_user_id:
        raise HTTPException(
            status_code=400,
            detail="You cannot reset your own sign-in. Change your password while signed in, or add another Tradeal Admin first.",
        )
    admin = _get_admin(conn, user_id)
    if username and username.strip():
        login = set_user_login_username(conn, user_id, username)
        admin["username"] = login
        admin["login_id"] = login
    temp = generate_temp_password()
    now = _now()
    pwd = hash_password(temp)
    if uses_postgres():
        conn.execute(
            "UPDATE users SET password_hash = %s, updated_at = %s WHERE id = %s",
            (pwd, now, user_id),
        )
        conn.execute("DELETE FROM auth_sessions WHERE user_id = %s", (user_id,))
    else:
        conn.execute(
            "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
            (pwd, now, user_id),
        )
        conn.execute("DELETE FROM auth_sessions WHERE user_id = ?", (user_id,))
    append_audit_log(
        organisation_id=None,
        actor_user_id=actor_user_id,
        action="platform_admin.password_reset",
        entity_type="user",
        entity_id=str(user_id),
        conn=conn,
    )
    admin["temporary_password"] = temp
    admin["user_id"] = admin["id"]
    return admin
