"""Create identity tables and migrate legacy single-tenant trade_state."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Callable

from ..db import DEFAULT_STATE, _pg_connect, _sqlite_connect, uses_postgres
from .billing_schema import PRE_REBRAND_LEGACY_ORG_NAME, init_billing_schema
from .permissions_data import PERMISSIONS, ROLE_DEFS, ROLE_PERMISSION_SLUGS
from .security import hash_password

DEFAULT_ORG_NAME = "Test Organisation"
LEGACY_DEFAULT_ORG_NAME = "Existing Tradeal Organisation"

_LEGACY_ORG_NAMES = (DEFAULT_ORG_NAME, LEGACY_DEFAULT_ORG_NAME, PRE_REBRAND_LEGACY_ORG_NAME)
# Legacy migrated org — demo load / clear allowed (sandbox_tools = 1).


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _seed_roles_permissions(conn, execute: Callable, fetchone: Callable, commit: Callable) -> None:
    for slug, name, scope in ROLE_DEFS:
        if uses_postgres():
            execute(
                """
                INSERT INTO roles (slug, name, scope)
                VALUES (%s, %s, %s)
                ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, scope = EXCLUDED.scope
                """,
                (slug, name, scope),
            )
        else:
            execute(
                """
                INSERT INTO roles (slug, name, scope) VALUES (?, ?, ?)
                ON CONFLICT(slug) DO UPDATE SET name = excluded.name, scope = excluded.scope
                """,
                (slug, name, scope),
            )

    for slug, description in PERMISSIONS:
        if uses_postgres():
            execute(
                """
                INSERT INTO permissions (slug, description)
                VALUES (%s, %s)
                ON CONFLICT (slug) DO UPDATE SET description = EXCLUDED.description
                """,
                (slug, description),
            )
        else:
            execute(
                """
                INSERT INTO permissions (slug, description) VALUES (?, ?)
                ON CONFLICT(slug) DO UPDATE SET description = excluded.description
                """,
                (slug, description),
            )

    _sync_role_permissions(execute)
    commit()


def _sync_role_permissions(execute: Callable) -> None:
    """Replace role permission rows so code changes to the matrix apply on restart."""
    for role_slug, perm_slugs in ROLE_PERMISSION_SLUGS.items():
        if uses_postgres():
            execute(
                """
                DELETE FROM role_permissions
                WHERE role_id = (SELECT id FROM roles WHERE slug = %s)
                """,
                (role_slug,),
            )
            for perm_slug in perm_slugs:
                execute(
                    """
                    INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id FROM roles r, permissions p
                    WHERE r.slug = %s AND p.slug = %s
                    ON CONFLICT DO NOTHING
                    """,
                    (role_slug, perm_slug),
                )
            continue

        execute(
            """
            DELETE FROM role_permissions
            WHERE role_id = (SELECT id FROM roles WHERE slug = ?)
            """,
            (role_slug,),
        )
        for perm_slug in perm_slugs:
            execute(
                """
                INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
                SELECT r.id, p.id FROM roles r, permissions p
                WHERE r.slug = ? AND p.slug = ?
                """,
                (role_slug, perm_slug),
            )


def _migrate_org_sandbox_tools(execute: Callable) -> None:
    if uses_postgres():
        execute(
            """
            ALTER TABLE organisations
            ADD COLUMN IF NOT EXISTS sandbox_tools INTEGER NOT NULL DEFAULT 0
            """
        )
        execute(
            """
            UPDATE organisations SET sandbox_tools = 1
            WHERE name IN (%s, %s, %s) OR id = 1
            """,
            _LEGACY_ORG_NAMES,
        )
        return

    pragma = execute("PRAGMA table_info(organisations)")
    cols = [r[1] for r in (pragma.fetchall() if hasattr(pragma, "fetchall") else pragma)]
    if "sandbox_tools" not in cols:
        execute(
            "ALTER TABLE organisations ADD COLUMN sandbox_tools INTEGER NOT NULL DEFAULT 0"
        )
    execute(
        """
        UPDATE organisations SET sandbox_tools = 1
        WHERE name IN (?, ?, ?) OR id = 1
        """,
        _LEGACY_ORG_NAMES,
    )


def _rename_legacy_default_org(execute: Callable, commit: Callable) -> None:
    now = _now()
    if uses_postgres():
        execute(
            """
            UPDATE organisations SET name = %s, updated_at = %s
            WHERE name IN (%s, %s)
            """,
            (DEFAULT_ORG_NAME, now, LEGACY_DEFAULT_ORG_NAME, PRE_REBRAND_LEGACY_ORG_NAME),
        )
    else:
        execute(
            """
            UPDATE organisations SET name = ?, updated_at = ?
            WHERE name IN (?, ?)
            """,
            (DEFAULT_ORG_NAME, now, LEGACY_DEFAULT_ORG_NAME, PRE_REBRAND_LEGACY_ORG_NAME),
        )
    commit()


def _ensure_default_org(conn, execute: Callable, fetchone: Callable) -> int:
    if uses_postgres():
        row = fetchone(
            "SELECT id FROM organisations WHERE name IN (%s, %s, %s) ORDER BY id LIMIT 1",
            _LEGACY_ORG_NAMES,
        )
        if row:
            return int(row["id"])
        now = _now()
        row = fetchone(
            """
            INSERT INTO organisations (name, account_type, status, sandbox_tools, created_at, updated_at)
            VALUES (%s, 'wholesaler_retailer', 'active', 1, %s, %s)
            RETURNING id
            """,
            (DEFAULT_ORG_NAME, now, now),
        )
        return int(row["id"])

    row = fetchone(
        "SELECT id FROM organisations WHERE name IN (?, ?, ?) ORDER BY id LIMIT 1",
        _LEGACY_ORG_NAMES,
    )
    if row:
        return int(row["id"])
    now = _now()
    cur = execute(
        """
        INSERT INTO organisations (name, account_type, status, sandbox_tools, created_at, updated_at)
        VALUES (?, 'wholesaler_retailer', 'active', 1, ?, ?)
        """,
        (DEFAULT_ORG_NAME, now, now),
    )
    return int(cur.lastrowid)


def _migrate_trade_state_pg(conn) -> None:
    row = conn.execute(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'trade_state' AND column_name = 'organisation_id'
        """
    ).fetchone()
    if row:
        return

    legacy = conn.execute("SELECT data FROM trade_state WHERE id = 1").fetchone()
    payload = legacy["data"] if legacy else DEFAULT_STATE
    if isinstance(payload, str):
        payload = json.loads(payload)

    conn.execute("DROP TABLE IF EXISTS trade_state")
    conn.execute(
        """
        CREATE TABLE trade_state (
            organisation_id INTEGER PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
            data JSONB NOT NULL
        )
        """
    )
    org_id = _ensure_default_org(
        conn,
        conn.execute,
        lambda q, p: conn.execute(q, p).fetchone(),
    )
    conn.execute(
        "INSERT INTO trade_state (organisation_id, data) VALUES (%s, %s::jsonb)",
        (org_id, json.dumps(payload)),
    )


def _migrate_trade_state_sqlite(conn) -> None:
    cols = [r[1] for r in conn.execute("PRAGMA table_info(trade_state)").fetchall()]
    if "organisation_id" in cols:
        return

    legacy = conn.execute("SELECT data FROM trade_state WHERE id = 1").fetchone()
    raw = legacy[0] if legacy else json.dumps(DEFAULT_STATE)

    conn.execute("DROP TABLE trade_state")
    conn.execute(
        """
        CREATE TABLE trade_state (
            organisation_id INTEGER PRIMARY KEY,
            data TEXT NOT NULL,
            FOREIGN KEY (organisation_id) REFERENCES organisations(id)
        )
        """
    )
    org_id = _ensure_default_org(
        conn,
        conn.execute,
        lambda q, p: conn.execute(q, p).fetchone(),
    )
    conn.execute(
        "INSERT INTO trade_state (organisation_id, data) VALUES (?, ?)",
        (org_id, raw if isinstance(raw, str) else json.dumps(raw)),
    )


def _load_env_users() -> list[tuple[str, str, str, str]]:
    """username, password, role_slug, display name."""
    users: list[tuple[str, str, str, str]] = []
    raw = (os.environ.get("TRADEAL_USERS") or os.environ.get("TRADEOS_USERS") or "").strip()
    if raw:
        for part in raw.split(","):
            part = part.strip()
            if not part:
                continue
            bits = part.split(":")
            if len(bits) < 3:
                continue
            username, password, role = bits[0], bits[1], bits[2]
            name = bits[3] if len(bits) > 3 else username.replace("_", " ").title()
            if role == "admin":
                role_slug = "organisation_admin"
            elif role == "operator":
                role_slug = "operator"
            else:
                role_slug = role
            users.append((username, password, role_slug, name))
    if not users:
        users = [
            ("admin", "admin", "organisation_admin", "Admin"),
            ("operator", "operator", "operator", "Operator"),
        ]
    return users


def _seed_users(conn, execute: Callable, fetchone: Callable, commit: Callable, default_org_id: int) -> None:
    if uses_postgres():
        existing = fetchone("SELECT COUNT(*) AS c FROM users", ())
    else:
        existing = fetchone("SELECT COUNT(*) AS c FROM users", ())
    if existing and int(existing["c"] if isinstance(existing, dict) else existing[0]) > 0:
        return

    platform_raw = (
        os.environ.get("TRADEAL_PLATFORM_ADMIN")
        or os.environ.get("TRADEOS_PLATFORM_ADMIN")
        or "platform:platform:Tradeal Admin"
    ).strip()
    pb = platform_raw.split(":")
    if len(pb) >= 2:
        p_user, p_pass = pb[0], pb[1]
        p_name = pb[2] if len(pb) > 2 else "Tradeal Admin"
        _upsert_user(
            execute,
            fetchone,
            username=p_user,
            password=p_pass,
            name=p_name,
            email=f"{p_user}@tradeal.local",
            role_slug="platform_admin",
            organisation_id=None,
            account_type="wholesaler_retailer",
        )

    for username, password, role_slug, name in _load_env_users():
        _upsert_user(
            execute,
            fetchone,
            username=username,
            password=password,
            name=name,
            email=f"{username}@tradeal.local",
            role_slug=role_slug,
            organisation_id=default_org_id,
            account_type="wholesaler_retailer",
        )
    commit()


def _upsert_user(
    execute: Callable,
    fetchone: Callable,
    *,
    username: str,
    password: str,
    name: str,
    email: str,
    role_slug: str,
    organisation_id: int | None,
    account_type: str,
) -> None:
    now = _now()
    pwd = hash_password(password)
    if uses_postgres():
        execute(
            """
            INSERT INTO users (username, email, name, password_hash, organisation_id, account_type, role_id, status, created_at, updated_at)
            SELECT %s, %s, %s, %s, %s, %s, r.id, 'active', %s, %s
            FROM roles r WHERE r.slug = %s
            ON CONFLICT (username) DO UPDATE SET
                name = EXCLUDED.name,
                password_hash = EXCLUDED.password_hash,
                organisation_id = EXCLUDED.organisation_id,
                account_type = EXCLUDED.account_type,
                role_id = EXCLUDED.role_id,
                updated_at = EXCLUDED.updated_at
            """,
            (username, email, name, pwd, organisation_id, account_type, now, now, role_slug),
        )
        return

    row = fetchone("SELECT id FROM roles WHERE slug = ?", (role_slug,))
    if not row:
        return
    execute(
        """
        INSERT INTO users (username, email, name, password_hash, organisation_id, account_type, role_id, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
        ON CONFLICT(username) DO UPDATE SET
            name = excluded.name,
            password_hash = excluded.password_hash,
            organisation_id = excluded.organisation_id,
            account_type = excluded.account_type,
            role_id = excluded.role_id,
            updated_at = excluded.updated_at
        """,
        (username, email, name, pwd, organisation_id, account_type, row["id"], now, now),
    )


def init_identity_schema() -> None:
    if uses_postgres():
        with _pg_connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS organisations (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    account_type TEXT NOT NULL DEFAULT 'wholesaler_retailer'
                        CHECK (account_type IN ('wholesaler_retailer', 'broker')),
                    status TEXT NOT NULL DEFAULT 'active',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS roles (
                    id SERIAL PRIMARY KEY,
                    slug TEXT NOT NULL UNIQUE,
                    name TEXT NOT NULL,
                    scope TEXT NOT NULL DEFAULT 'organisation'
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS permissions (
                    id SERIAL PRIMARY KEY,
                    slug TEXT NOT NULL UNIQUE,
                    description TEXT NOT NULL DEFAULT ''
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS role_permissions (
                    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
                    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
                    PRIMARY KEY (role_id, permission_id)
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username TEXT NOT NULL UNIQUE,
                    email TEXT NOT NULL DEFAULT '',
                    name TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    organisation_id INTEGER REFERENCES organisations(id),
                    account_type TEXT NOT NULL DEFAULT 'wholesaler_retailer'
                        CHECK (account_type IN ('wholesaler_retailer', 'broker')),
                    role_id INTEGER NOT NULL REFERENCES roles(id),
                    status TEXT NOT NULL DEFAULT 'active',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS auth_sessions (
                    token TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    created_at TEXT NOT NULL,
                    expires_at TEXT
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id SERIAL PRIMARY KEY,
                    organisation_id INTEGER REFERENCES organisations(id),
                    actor_user_id INTEGER REFERENCES users(id),
                    action TEXT NOT NULL,
                    entity_type TEXT NOT NULL,
                    entity_id TEXT NOT NULL DEFAULT '',
                    old_value JSONB,
                    new_value JSONB,
                    created_at TEXT NOT NULL
                )
                """
            )
            _seed_roles_permissions(conn.execute, conn.execute, lambda q, p: conn.execute(q, p).fetchone(), conn.commit)
            _migrate_trade_state_pg(conn)
            org_id = _ensure_default_org(conn, conn.execute, lambda q, p: conn.execute(q, p).fetchone())
            _seed_users(conn, conn.execute, lambda q, p: conn.execute(q, p).fetchone(), conn.commit, org_id)
            from ..db import set_pg_organisation_context

            set_pg_organisation_context(conn, org_id)
            conn.execute(
                """
                INSERT INTO trade_state (organisation_id, data)
                VALUES (%s, %s::jsonb)
                ON CONFLICT (organisation_id) DO NOTHING
                """,
                (org_id, json.dumps(DEFAULT_STATE)),
            )
            _migrate_org_sandbox_tools(conn.execute)
            _rename_legacy_default_org(conn.execute, conn.commit)
            conn.commit()
        init_billing_schema()
        return

    with _sqlite_connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS organisations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                account_type TEXT NOT NULL DEFAULT 'wholesaler_retailer'
                    CHECK (account_type IN ('wholesaler_retailer', 'broker')),
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS roles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                scope TEXT NOT NULL DEFAULT 'organisation'
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT NOT NULL UNIQUE,
                description TEXT NOT NULL DEFAULT ''
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS role_permissions (
                role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
                permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
                PRIMARY KEY (role_id, permission_id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL DEFAULT '',
                name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                organisation_id INTEGER REFERENCES organisations(id),
                account_type TEXT NOT NULL DEFAULT 'wholesaler_retailer'
                    CHECK (account_type IN ('wholesaler_retailer', 'broker')),
                role_id INTEGER NOT NULL REFERENCES roles(id),
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS auth_sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL,
                expires_at TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                organisation_id INTEGER REFERENCES organisations(id),
                actor_user_id INTEGER REFERENCES users(id),
                action TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL DEFAULT '',
                old_value TEXT,
                new_value TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        _seed_roles_permissions(conn.execute, conn.execute, lambda q, p: conn.execute(q, p).fetchone(), conn.commit)
        _migrate_trade_state_sqlite(conn)
        org_id = _ensure_default_org(conn, conn.execute, lambda q, p: conn.execute(q, p).fetchone())
        _seed_users(conn, conn.execute, lambda q, p: conn.execute(q, p).fetchone(), conn.commit, org_id)
        conn.execute(
            """
            INSERT OR IGNORE INTO trade_state (organisation_id, data) VALUES (?, ?)
            """,
            (org_id, json.dumps(DEFAULT_STATE)),
        )
        _migrate_org_sandbox_tools(conn.execute)
        _rename_legacy_default_org(conn.execute, conn.commit)
        conn.commit()
    init_billing_schema()
