"""Organisation-scoped team members (licensed users)."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from ..db import uses_postgres
from .billing_repository import (
    _mapping,
    _now,
    create_org_user_with_seat,
    generate_temp_password,
    upsert_organisation_member,
)
from .repository import append_audit_log, hash_password


def list_organisation_members(conn, organisation_id: int) -> list[dict[str, Any]]:
    now = _now()
    if uses_postgres():
        rows = conn.execute(
            """
            SELECT
                u.id,
                u.username,
                u.email,
                u.name,
                u.status AS user_status,
                u.last_login_at,
                u.last_activity_at,
                r.slug AS role_slug,
                r.name AS role_name,
                m.status AS membership_status,
                m.seat_id,
                s.seat_label,
                s.seat_type,
                EXISTS (
                    SELECT 1 FROM auth_sessions a
                    WHERE a.user_id = u.id
                      AND (a.expires_at IS NULL OR a.expires_at > %s)
                ) AS signed_in
            FROM users u
            JOIN roles r ON r.id = u.role_id
            LEFT JOIN organisation_members m
                ON m.user_id = u.id AND m.organisation_id = u.organisation_id
            LEFT JOIN organisation_seats s ON s.id = m.seat_id
            WHERE u.organisation_id = %s
              AND r.scope = 'organisation'
            ORDER BY r.slug, u.email, u.username
            """,
            (now, organisation_id),
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT
                u.id,
                u.username,
                u.email,
                u.name,
                u.status AS user_status,
                u.last_login_at,
                u.last_activity_at,
                r.slug AS role_slug,
                r.name AS role_name,
                m.status AS membership_status,
                m.seat_id,
                s.seat_label,
                s.seat_type,
                EXISTS (
                    SELECT 1 FROM auth_sessions a
                    WHERE a.user_id = u.id
                      AND (a.expires_at IS NULL OR a.expires_at > ?)
                ) AS signed_in
            FROM users u
            JOIN roles r ON r.id = u.role_id
            LEFT JOIN organisation_members m
                ON m.user_id = u.id AND m.organisation_id = u.organisation_id
            LEFT JOIN organisation_seats s ON s.id = m.seat_id
            WHERE u.organisation_id = ?
              AND r.scope = 'organisation'
            ORDER BY r.slug, u.email, u.username
            """,
            (now, organisation_id),
        ).fetchall()
    out: list[dict[str, Any]] = []
    for row in rows:
        d = dict(_mapping(row))
        d["signed_in"] = bool(d.get("signed_in"))
        out.append(d)
    return out


def _get_org_member(conn, organisation_id: int, user_id: int) -> dict[str, Any]:
    if uses_postgres():
        row = conn.execute(
            """
            SELECT u.id, u.organisation_id, u.role_id, u.status, r.slug AS role_slug
            FROM users u
            JOIN roles r ON r.id = u.role_id
            WHERE u.id = %s AND u.organisation_id = %s AND r.scope = 'organisation'
            """,
            (user_id, organisation_id),
        ).fetchone()
    else:
        row = conn.execute(
            """
            SELECT u.id, u.organisation_id, u.role_id, u.status, r.slug AS role_slug
            FROM users u
            JOIN roles r ON r.id = u.role_id
            WHERE u.id = ? AND u.organisation_id = ? AND r.scope = 'organisation'
            """,
            (user_id, organisation_id),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(_mapping(row))


def set_organisation_member_status(
    conn,
    *,
    organisation_id: int,
    user_id: int,
    status: str,
    actor_user_id: int,
) -> None:
    if status not in ("active", "inactive"):
        raise HTTPException(status_code=400, detail="status must be active or inactive")
    if user_id == actor_user_id and status == "inactive":
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")

    member = _get_org_member(conn, organisation_id, user_id)
    now = _now()
    active = status == "active"

    if uses_postgres():
        conn.execute(
            "UPDATE users SET status = %s, updated_at = %s WHERE id = %s",
            (status, now, user_id),
        )
    else:
        conn.execute(
            "UPDATE users SET status = ?, updated_at = ? WHERE id = ?",
            (status, now, user_id),
        )

    upsert_organisation_member(
        conn,
        organisation_id=organisation_id,
        user_id=user_id,
        role_id=int(member["role_id"]),
        active=active,
    )

    if uses_postgres():
        conn.execute("DELETE FROM auth_sessions WHERE user_id = %s", (user_id,))
    else:
        conn.execute("DELETE FROM auth_sessions WHERE user_id = ?", (user_id,))

    append_audit_log(
        organisation_id=organisation_id,
        actor_user_id=actor_user_id,
        action="user.status_changed",
        entity_type="user",
        entity_id=str(user_id),
        old_value={"status": member["status"]},
        new_value={"status": status},
    )


def set_organisation_member_password(
    conn,
    *,
    organisation_id: int,
    user_id: int,
    password: str,
    actor_user_id: int,
) -> None:
    if len(password.strip()) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    _get_org_member(conn, organisation_id, user_id)
    now = _now()
    pwd = hash_password(password)
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
        organisation_id=organisation_id,
        actor_user_id=actor_user_id,
        action="user.password_reset",
        entity_type="user",
        entity_id=str(user_id),
    )


def create_organisation_member(
    conn,
    *,
    organisation_id: int,
    email: str,
    name: str,
    password: str,
    role_slug: str,
    phone: str,
    account_type: str,
    actor_user_id: int,
) -> int:
    ident = email.strip().lower()
    if not ident or "@" not in ident:
        raise HTTPException(status_code=400, detail="A valid email is required")
    if role_slug not in ("organisation_admin", "operator", "view_only"):
        raise HTTPException(status_code=400, detail="Invalid role")

    if uses_postgres():
        dup = conn.execute(
            "SELECT id FROM users WHERE lower(username) = %s OR lower(email) = %s",
            (ident, ident),
        ).fetchone()
    else:
        dup = conn.execute(
            "SELECT id FROM users WHERE lower(username) = ? OR lower(email) = ?",
            (ident, ident),
        ).fetchone()
    if dup:
        raise HTTPException(status_code=400, detail="A user with this email already exists")

    user_id = create_org_user_with_seat(
        conn,
        username=ident,
        password=password,
        name=name.strip() or ident,
        email=ident,
        phone=phone.strip(),
        organisation_id=organisation_id,
        role_slug=role_slug,
        account_type=account_type,
    )
    append_audit_log(
        organisation_id=organisation_id,
        actor_user_id=actor_user_id,
        action="user.created",
        entity_type="user",
        entity_id=str(user_id),
        new_value={"email": ident, "role": role_slug},
    )
    return user_id


def _login_identifier(username: str, email: str) -> str:
    ident = (email or "").strip() or (username or "").strip()
    return ident


def reset_organisation_member_sign_in(
    conn,
    *,
    organisation_id: int,
    user_id: int,
    actor_user_id: int,
) -> dict[str, Any]:
    """Generate a temporary password and invalidate existing sessions."""
    member = _get_org_member(conn, organisation_id, user_id)
    if member.get("role_slug") == "platform_admin":
        raise HTTPException(status_code=400, detail="Cannot reset platform admin sign-in here")
    if uses_postgres():
        profile = conn.execute(
            "SELECT username, email, name FROM users WHERE id = %s",
            (user_id,),
        ).fetchone()
    else:
        profile = conn.execute(
            "SELECT username, email, name FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    prof = dict(_mapping(profile))
    temp = generate_temp_password()
    set_organisation_member_password(
        conn,
        organisation_id=organisation_id,
        user_id=user_id,
        password=temp,
        actor_user_id=actor_user_id,
    )
    username = str(prof.get("username") or "")
    email = str(prof.get("email") or "")
    name = str(prof.get("name") or "")
    return {
        "user_id": user_id,
        "username": username,
        "email": email,
        "name": name,
        "login_id": _login_identifier(username, email),
        "temporary_password": temp,
    }


def find_primary_admin_user(conn, organisation_id: int) -> dict[str, Any] | None:
    q = """
        SELECT u.id, u.username, u.email, u.name, u.status
        FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE u.organisation_id = ?
          AND r.slug = 'organisation_admin'
          AND u.status = 'active'
        ORDER BY u.id ASC
        LIMIT 1
    """
    if uses_postgres():
        q = q.replace("?", "%s")
        row = conn.execute(q, (organisation_id,)).fetchone()
    else:
        row = conn.execute(q, (organisation_id,)).fetchone()
    if not row:
        return None
    r = dict(_mapping(row))
    return {
        "user_id": int(r["id"]),
        "username": r.get("username") or "",
        "email": r.get("email") or "",
        "name": r.get("name") or "",
        "login_id": _login_identifier(str(r.get("username") or ""), str(r.get("email") or "")),
    }
