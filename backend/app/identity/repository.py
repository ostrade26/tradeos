"""Database access for users, sessions, and permissions."""

from __future__ import annotations

import json
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, Request

from ..db import _pg_connect, _sqlite_connect, row_dict, row_get, uses_postgres
from .billing_repository import assert_user_org_access, user_has_org_seat_access
from .permissions_data import ROLE_PERMISSION_SLUGS
from .security import hash_password, verify_password


@dataclass(frozen=True)
class AuthUser:
    id: int
    username: str
    name: str
    email: str
    phone: str
    location: str
    preferences_raw: str
    role_slug: str
    role_name: str
    organisation_id: int | None
    organisation_name: str | None
    account_type: str
    organisation_sandbox_tools: bool
    permissions: frozenset[str]


def parse_user_preferences(raw: str | None) -> dict[str, Any]:
    if not raw or not str(raw).strip():
        return {}
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        return {}


@dataclass(frozen=True)
class Session:
    token: str
    user: AuthUser
    created_at: float


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _mapping(row: Any) -> dict[str, Any]:
    return row_dict(row)


def _permissions_for_role(role_id: int, conn) -> frozenset[str]:
    if uses_postgres():
        role_row = conn.execute("SELECT slug FROM roles WHERE id = %s", (role_id,)).fetchone()
        rows = conn.execute(
            """
            SELECT p.slug FROM permissions p
            JOIN role_permissions rp ON rp.permission_id = p.id
            WHERE rp.role_id = %s
            """,
            (role_id,),
        ).fetchall()
    else:
        role_row = conn.execute("SELECT slug FROM roles WHERE id = ?", (role_id,)).fetchone()
        rows = conn.execute(
            """
            SELECT p.slug FROM permissions p
            JOIN role_permissions rp ON rp.permission_id = p.id
            WHERE rp.role_id = ?
            """,
            (role_id,),
        ).fetchall()
    role_slug = str(row_get(role_row, "slug") or "") if role_row else ""
    db_perms = frozenset(str(row_get(r, "slug") or "") for r in rows)
    code_perms = ROLE_PERMISSION_SLUGS.get(role_slug, set())
    return db_perms | frozenset(code_perms)


def _validate_org_membership(user_id: int, role_slug: str, conn, *, strict: bool) -> None:
    if user_has_org_seat_access(conn, user_id, role_slug):
        return
    if strict:
        assert_user_org_access(conn, user_id, role_slug)


def _row_to_user(row: Any, permissions: frozenset[str]) -> AuthUser:
    r = _mapping(row)
    org_id = r.get("organisation_id")
    return AuthUser(
        id=int(r["id"]),
        username=r["username"],
        name=r["name"],
        email=(r.get("email") or "") or "",
        phone=str(r.get("phone") or ""),
        location=str(r.get("location") or ""),
        preferences_raw=str(r.get("preferences") or "{}"),
        role_slug=r["role_slug"],
        role_name=r["role_name"],
        organisation_id=int(org_id) if org_id is not None else None,
        organisation_name=r.get("organisation_name"),
        account_type=r["account_type"],
        organisation_sandbox_tools=bool(r.get("sandbox_tools")),
        permissions=permissions,
    )


def _fetch_user_by_username(username: str) -> AuthUser | None:
    q = """
        SELECT u.id, u.username, u.name, u.email, u.password_hash, u.organisation_id,
               u.account_type, u.status, u.role_id,
               u.phone, u.location, u.preferences,
               r.slug AS role_slug, r.name AS role_name,
               o.name AS organisation_name, o.sandbox_tools AS sandbox_tools
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN organisations o ON o.id = u.organisation_id
        WHERE u.username = ?
    """
    if uses_postgres():
        q = q.replace("?", "%s")
        with _pg_connect() as conn:
            row = conn.execute(q, (username.strip(),)).fetchone()
            if not row:
                return None
            if row["status"] != "active":
                return None
            perms = _permissions_for_role(int(row["role_id"]), conn)
            user = _row_to_user(row, perms)
            if not user_has_org_seat_access(conn, user.id, user.role_slug):
                return None
            return user

    with _sqlite_connect() as conn:
        row = conn.execute(q, (username.strip(),)).fetchone()
        if not row:
            return None
        if row["status"] != "active":
            return None
        perms = _permissions_for_role(int(row["role_id"]), conn)
        user = _row_to_user(row, perms)
        if not user_has_org_seat_access(conn, user.id, user.role_slug):
            return None
        return user


def _fetch_user_by_id(user_id: int) -> AuthUser | None:
    q = """
        SELECT u.id, u.username, u.name, u.email, u.organisation_id,
               u.account_type, u.status, u.role_id,
               u.phone, u.location, u.preferences,
               r.slug AS role_slug, r.name AS role_name,
               o.name AS organisation_name, o.sandbox_tools AS sandbox_tools
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN organisations o ON o.id = u.organisation_id
        WHERE u.id = ?
    """
    if uses_postgres():
        q = q.replace("?", "%s")
        with _pg_connect() as conn:
            row = conn.execute(q, (user_id,)).fetchone()
            if not row or row["status"] != "active":
                return None
            perms = _permissions_for_role(int(row["role_id"]), conn)
            user = _row_to_user(row, perms)
            if not user_has_org_seat_access(conn, user.id, user.role_slug):
                return None
            return user

    with _sqlite_connect() as conn:
        row = conn.execute(q, (user_id,)).fetchone()
        if not row or row["status"] != "active":
            return None
        perms = _permissions_for_role(int(row["role_id"]), conn)
        user = _row_to_user(row, perms)
        if not user_has_org_seat_access(conn, user.id, user.role_slug):
            return None
        return user


def authenticate(username: str, password: str) -> AuthUser:
    ident = username.strip().lower()
    q = """
        SELECT u.id, u.username, u.name, u.email, u.password_hash, u.organisation_id,
               u.account_type, u.status, u.role_id,
               u.phone, u.location, u.preferences,
               r.slug AS role_slug, r.name AS role_name,
               o.name AS organisation_name, o.sandbox_tools AS sandbox_tools
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN organisations o ON o.id = u.organisation_id
        WHERE lower(u.username) = ? OR lower(u.email) = ?
    """
    if uses_postgres():
        q = q.replace("?", "%s")
        with _pg_connect() as conn:
            row = conn.execute(q, (ident, ident)).fetchone()
            if not row or row["status"] != "active":
                raise HTTPException(status_code=401, detail="Invalid email or password")
            if not verify_password(password, row["password_hash"]):
                raise HTTPException(status_code=401, detail="Invalid email or password")
            perms = _permissions_for_role(int(row["role_id"]), conn)
            user = _row_to_user(row, perms)
            _validate_org_membership(user.id, user.role_slug, conn, strict=True)
            return user

    with _sqlite_connect() as conn:
        row = conn.execute(q, (ident, ident)).fetchone()
        if not row or row["status"] != "active":
            raise HTTPException(status_code=401, detail="Invalid email or password")
        if not verify_password(password, row["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        perms = _permissions_for_role(int(row["role_id"]), conn)
        user = _row_to_user(row, perms)
        _validate_org_membership(user.id, user.role_slug, conn, strict=True)
        return user


def change_user_password(user_id: int, current_password: str, new_password: str) -> None:
    if len(new_password.strip()) < 4:
        raise HTTPException(status_code=400, detail="New password must be at least 4 characters")
    if uses_postgres():
        with _pg_connect() as conn:
            row = conn.execute(
                "SELECT password_hash FROM users WHERE id = %s AND status = 'active'",
                (user_id,),
            ).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="User not found")
            if not verify_password(current_password, row["password_hash"]):
                raise HTTPException(status_code=400, detail="Current password is incorrect")
            conn.execute(
                "UPDATE users SET password_hash = %s, updated_at = %s WHERE id = %s",
                (hash_password(new_password), _now_iso(), user_id),
            )
            conn.commit()
        return

    with _sqlite_connect() as conn:
        row = conn.execute(
            "SELECT password_hash FROM users WHERE id = ? AND status = 'active'",
            (user_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        if not verify_password(current_password, row["password_hash"]):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        conn.execute(
            "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
            (hash_password(new_password), _now_iso(), user_id),
        )
        conn.commit()


def touch_user_login(user_id: int) -> None:
    now = _now_iso()
    if uses_postgres():
        with _pg_connect() as conn:
            conn.execute(
                "UPDATE users SET last_login_at = %s, last_activity_at = %s, updated_at = %s WHERE id = %s",
                (now, now, now, user_id),
            )
            conn.commit()
    else:
        with _sqlite_connect() as conn:
            conn.execute(
                "UPDATE users SET last_login_at = ?, last_activity_at = ?, updated_at = ? WHERE id = ?",
                (now, now, now, user_id),
            )
            conn.commit()


def touch_user_activity(user_id: int) -> None:
    from datetime import timedelta

    now = datetime.now(timezone.utc)
    threshold = (now - timedelta(minutes=5)).isoformat()
    now_s = now.isoformat()
    if uses_postgres():
        with _pg_connect() as conn:
            conn.execute(
                """
                UPDATE users SET last_activity_at = %s, updated_at = %s
                WHERE id = %s AND (last_activity_at IS NULL OR last_activity_at < %s)
                """,
                (now_s, now_s, user_id, threshold),
            )
            conn.commit()
    else:
        with _sqlite_connect() as conn:
            conn.execute(
                """
                UPDATE users SET last_activity_at = ?, updated_at = ?
                WHERE id = ? AND (last_activity_at IS NULL OR last_activity_at < ?)
                """,
                (now_s, now_s, user_id, threshold),
            )
            conn.commit()


def create_session(user: AuthUser) -> tuple[str, Session]:
    import time

    token = secrets.token_urlsafe(32)
    created = _now_iso()
    expires = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()
    if uses_postgres():
        with _pg_connect() as conn:
            conn.execute(
                "INSERT INTO auth_sessions (token, user_id, created_at, expires_at) VALUES (%s, %s, %s, %s)",
                (token, user.id, created, expires),
            )
            conn.commit()
    else:
        with _sqlite_connect() as conn:
            conn.execute(
                "INSERT INTO auth_sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
                (token, user.id, created, expires),
            )
            conn.commit()
    return token, Session(token=token, user=user, created_at=time.time())


def update_user_profile(
    user_id: int,
    *,
    name: str | None = None,
    phone: str | None = None,
    location: str | None = None,
) -> AuthUser:
    fields: list[str] = []
    params: list[Any] = []
    if name is not None:
        trimmed = name.strip()
        if not trimmed:
            raise HTTPException(status_code=400, detail="Name is required")
        fields.append("name = ?" if not uses_postgres() else "name = %s")
        params.append(trimmed)
    if phone is not None:
        fields.append("phone = ?" if not uses_postgres() else "phone = %s")
        params.append(phone.strip())
    if location is not None:
        fields.append("location = ?" if not uses_postgres() else "location = %s")
        params.append(location.strip())
    if not fields:
        raise HTTPException(status_code=400, detail="Nothing to update")
    now = _now_iso()
    fields.append("updated_at = ?" if not uses_postgres() else "updated_at = %s")
    params.append(now)
    params.append(user_id)
    q = f"UPDATE users SET {', '.join(fields)} WHERE id = ?"
    if uses_postgres():
        q = q.replace("?", "%s")
        with _pg_connect() as conn:
            conn.execute(q, tuple(params))
            conn.commit()
    else:
        with _sqlite_connect() as conn:
            conn.execute(q, tuple(params))
            conn.commit()
    user = _fetch_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def merge_user_preferences(user_id: int, patch: dict[str, Any]) -> AuthUser:
    if not patch:
        raise HTTPException(status_code=400, detail="Nothing to update")
    allowed = {"theme", "accentId", "customHex", "tableDensity"}
    clean = {k: v for k, v in patch.items() if k in allowed and v is not None}
    if not clean:
        raise HTTPException(status_code=400, detail="No valid preference keys")
    if uses_postgres():
        with _pg_connect() as conn:
            row = conn.execute("SELECT preferences FROM users WHERE id = %s", (user_id,)).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="User not found")
            merged = {**parse_user_preferences(row["preferences"]), **clean}
            now = _now_iso()
            conn.execute(
                "UPDATE users SET preferences = %s, updated_at = %s WHERE id = %s",
                (json.dumps(merged), now, user_id),
            )
            conn.commit()
    else:
        with _sqlite_connect() as conn:
            row = conn.execute("SELECT preferences FROM users WHERE id = ?", (user_id,)).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="User not found")
            merged = {**parse_user_preferences(row["preferences"]), **clean}
            now = _now_iso()
            conn.execute(
                "UPDATE users SET preferences = ?, updated_at = ? WHERE id = ?",
                (json.dumps(merged), now, user_id),
            )
            conn.commit()
    user = _fetch_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def delete_session(token: str) -> None:
    if not token:
        return
    if uses_postgres():
        with _pg_connect() as conn:
            conn.execute("DELETE FROM auth_sessions WHERE token = %s", (token,))
            conn.commit()
    else:
        with _sqlite_connect() as conn:
            conn.execute("DELETE FROM auth_sessions WHERE token = ?", (token,))
            conn.commit()


def get_session(token: str) -> Session | None:
    import time

    if not token:
        return None
    if uses_postgres():
        with _pg_connect() as conn:
            row = conn.execute(
                "SELECT user_id, expires_at FROM auth_sessions WHERE token = %s",
                (token,),
            ).fetchone()
            if not row:
                return None
            if row["expires_at"]:
                exp = datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00"))
                if exp < datetime.now(timezone.utc):
                    conn.execute("DELETE FROM auth_sessions WHERE token = %s", (token,))
                    conn.commit()
                    return None
            user = _fetch_user_by_id(int(row["user_id"]))
            if not user:
                return None
            return Session(token=token, user=user, created_at=time.time())

    with _sqlite_connect() as conn:
        row = conn.execute(
            "SELECT user_id, expires_at FROM auth_sessions WHERE token = ?",
            (token,),
        ).fetchone()
        if not row:
            return None
        if row["expires_at"]:
            exp = datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00"))
            if exp < datetime.now(timezone.utc):
                conn.execute("DELETE FROM auth_sessions WHERE token = ?", (token,))
                conn.commit()
                return None
        user = _fetch_user_by_id(int(row["user_id"]))
        if not user:
            return None
        return Session(token=token, user=user, created_at=time.time())


def resolve_organisation_id(session: Session, request: Request) -> int:
    """Never trust client body; optional header only for platform admins."""
    user = session.user
    if user.organisation_id is not None:
        return user.organisation_id
    if user.role_slug != "platform_admin":
        raise HTTPException(status_code=403, detail="No organisation membership")
    header = (
        request.headers.get("x-tradeal-organisation-id")
        or request.headers.get("x-tradeos-organisation-id")
        or ""
    ).strip()
    if header.isdigit():
        return int(header)
    default = get_default_organisation_id()
    if default is None:
        raise HTTPException(status_code=403, detail="No organisation context")
    return default


def organisation_has_sandbox_tools(organisation_id: int) -> bool:
    if uses_postgres():
        with _pg_connect() as conn:
            row = conn.execute(
                "SELECT sandbox_tools FROM organisations WHERE id = %s",
                (organisation_id,),
            ).fetchone()
            return bool(row and row["sandbox_tools"])
    with _sqlite_connect() as conn:
        row = conn.execute(
            "SELECT sandbox_tools FROM organisations WHERE id = ?",
            (organisation_id,),
        ).fetchone()
        return bool(row and row["sandbox_tools"])


def get_default_organisation_id() -> int | None:
    if uses_postgres():
        with _pg_connect() as conn:
            row = conn.execute("SELECT id FROM organisations ORDER BY id LIMIT 1").fetchone()
            return int(row["id"]) if row else None
    with _sqlite_connect() as conn:
        row = conn.execute("SELECT id FROM organisations ORDER BY id LIMIT 1").fetchone()
        return int(row["id"]) if row else None


def user_has_permission(session: Session, permission: str) -> bool:
    return permission in session.user.permissions


def require_permission(session: Session, permission: str) -> None:
    if not user_has_permission(session, permission):
        raise HTTPException(status_code=403, detail=f"Permission required: {permission}")


def append_audit_log(
    *,
    organisation_id: int | None,
    actor_user_id: int | None,
    action: str,
    entity_type: str,
    entity_id: str = "",
    old_value: Any = None,
    new_value: Any = None,
) -> None:
    created = _now_iso()
    old_j = json.dumps(old_value, default=str) if old_value is not None else None
    new_j = json.dumps(new_value, default=str) if new_value is not None else None
    if uses_postgres():
        with _pg_connect() as conn:
            conn.execute(
                """
                INSERT INTO audit_logs
                (organisation_id, actor_user_id, action, entity_type, entity_id, old_value, new_value, created_at)
                VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s)
                """,
                (organisation_id, actor_user_id, action, entity_type, entity_id, old_j, new_j, created),
            )
            conn.commit()
        return
    with _sqlite_connect() as conn:
        conn.execute(
            """
            INSERT INTO audit_logs
            (organisation_id, actor_user_id, action, entity_type, entity_id, old_value, new_value, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (organisation_id, actor_user_id, action, entity_type, entity_id, old_j, new_j, created),
        )
        conn.commit()
