"""Trade state storage — SQLite locally, PostgreSQL on Railway when DATABASE_URL is set."""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DB_PATH = Path(
    os.environ.get("TRADEAL_DB_PATH")
    or os.environ.get("TRADEOS_DB_PATH")
    or Path(__file__).resolve().parent.parent / "data" / "trade.db",
)

DEFAULT_STATE: dict[str, Any] = {
    "tradeOrders": [],
    "lifts": [],
    "contracts": [],
    "lots": [],
    "payments": [],
    "deliveries": [],
    "brokers": [],
    "producers": [],
    "retailers": [],
    "companies": [],
    "activities": [],
    "balanceSettlements": [],
    "spots": [],
    "items": [],
    "counters": {"po": 0, "so": 0, "lift": 0, "invoice": 0},
}


def row_dict(row: Any) -> dict[str, Any]:
    """Normalize sqlite3.Row, psycopg dict_row, or a mapping to a plain dict.

    Never index rows by integer position — Postgres dict rows raise KeyError: 0.
    """
    if row is None:
        return {}
    if isinstance(row, dict):
        return dict(row)
    keys_fn = getattr(row, "keys", None)
    if callable(keys_fn):
        return {str(k): row[k] for k in keys_fn()}
    try:
        return dict(row)
    except (TypeError, ValueError):
        return {}


def row_get(row: Any, key: str, default: Any = None) -> Any:
    data = row_dict(row)
    if key in data:
        return data[key]
    return default


def _database_url() -> str:
    return (os.environ.get("DATABASE_URL") or "").strip()


def uses_postgres() -> bool:
    url = _database_url().lower()
    return url.startswith("postgres://") or url.startswith("postgresql://")


def running_on_railway() -> bool:
    return bool(os.environ.get("RAILWAY_ENVIRONMENT") or os.environ.get("RAILWAY_PROJECT_ID"))


def _pg_dsn() -> str:
    url = _database_url()
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    lower = url.lower()
    local = "localhost" in lower or "127.0.0.1" in lower
    railway_private = "railway.internal" in lower
    if "sslmode=" not in lower and not local and not railway_private:
        url += ("&" if "?" in url else "?") + "sslmode=require"
    return url


def _pg_connect():
    import psycopg
    from psycopg.rows import dict_row

    return psycopg.connect(_pg_dsn(), row_factory=dict_row, connect_timeout=10)


def begin_transaction(conn) -> None:
    """Start an explicit transaction (required for SQLite autocommit connections)."""
    if uses_postgres():
        conn.execute("BEGIN")
    else:
        conn.execute("BEGIN IMMEDIATE")


def rollback_transaction(conn) -> None:
    if uses_postgres():
        conn.rollback()
    else:
        conn.execute("ROLLBACK")


def set_pg_organisation_context(conn, organisation_id: int) -> None:
    """Set session var for optional trade_state RLS (see migrations/001_org_rbac_rls.sql)."""
    if not uses_postgres():
        return
    conn.execute(
        "SELECT set_config('app.organisation_id', %s, true)",
        (str(int(organisation_id)),),
    )


def _sqlite_connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.isolation_level = None
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    return conn


def _row_data(row: Any) -> dict[str, Any]:
    raw = row["data"] if row is not None else None
    if raw is None:
        return dict(DEFAULT_STATE)
    if isinstance(raw, dict):
        return raw
    return json.loads(raw)


def ping_db() -> str:
    """Lightweight DB probe for /health — does not run migrations (startup init_db only)."""
    if uses_postgres():
        with _pg_connect() as conn:
            conn.execute("SELECT 1")
        return "postgres"
    with _sqlite_connect() as conn:
        conn.execute("SELECT 1")
    return "sqlite"


def init_db() -> None:
    from .identity.schema import init_identity_schema

    if running_on_railway() and not uses_postgres():
        raise RuntimeError(
            "DATABASE_URL is not set. Attach Railway Postgres and set "
            "DATABASE_URL=${{Postgres.DATABASE_URL}}. SQLite on Railway is ephemeral "
            "and would lose all data on every deploy."
        )

    if uses_postgres():
        with _pg_connect() as conn:
            legacy_ts = conn.execute(
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'trade_state' AND column_name = 'id'
                """
            ).fetchone()
            org_ts = conn.execute(
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'trade_state' AND column_name = 'organisation_id'
                """
            ).fetchone()
            if not legacy_ts and not org_ts:
                conn.execute(
                    """
                    CREATE TABLE trade_state (
                        id INTEGER PRIMARY KEY CHECK (id = 1),
                        data JSONB NOT NULL
                    )
                    """
                )
                conn.execute(
                    """
                    INSERT INTO trade_state (id, data)
                    VALUES (1, %s::jsonb)
                    ON CONFLICT (id) DO NOTHING
                    """,
                    (json.dumps(DEFAULT_STATE),),
                )
            elif legacy_ts and not org_ts:
                conn.execute(
                    """
                    INSERT INTO trade_state (id, data)
                    VALUES (1, %s::jsonb)
                    ON CONFLICT (id) DO NOTHING
                    """,
                    (json.dumps(DEFAULT_STATE),),
                )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS demo_requests (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    company TEXT NOT NULL,
                    phone TEXT NOT NULL DEFAULT '',
                    email TEXT NOT NULL DEFAULT '',
                    message TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL
                )
                """
            )
            conn.commit()
        init_identity_schema()
        return

    with _sqlite_connect() as conn:
        ts_cols = [r[1] for r in conn.execute("PRAGMA table_info(trade_state)").fetchall()]
        if not ts_cols:
            conn.execute(
                """
                CREATE TABLE trade_state (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    data TEXT NOT NULL
                )
                """
            )
            conn.execute(
                "INSERT INTO trade_state (id, data) VALUES (1, ?)",
                (json.dumps(DEFAULT_STATE),),
            )
        elif "id" in ts_cols and "organisation_id" not in ts_cols:
            row = conn.execute("SELECT data FROM trade_state WHERE id = 1").fetchone()
            if row is None:
                conn.execute(
                    "INSERT INTO trade_state (id, data) VALUES (1, ?)",
                    (json.dumps(DEFAULT_STATE),),
                )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS demo_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                company TEXT NOT NULL,
                phone TEXT NOT NULL DEFAULT '',
                email TEXT NOT NULL DEFAULT '',
                message TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()
    init_identity_schema()


def get_state(organisation_id: int) -> dict[str, Any]:
    init_db()
    if uses_postgres():
        with _pg_connect() as conn:
            set_pg_organisation_context(conn, organisation_id)
            row = conn.execute(
                "SELECT data FROM trade_state WHERE organisation_id = %s",
                (organisation_id,),
            ).fetchone()
            return _row_data(row)

    with _sqlite_connect() as conn:
        row = conn.execute(
            "SELECT data FROM trade_state WHERE organisation_id = ?",
            (organisation_id,),
        ).fetchone()
        return _row_data(row)


def save_state(data: dict[str, Any], organisation_id: int) -> None:
    init_db()
    payload = json.dumps(data)
    if uses_postgres():
        with _pg_connect() as conn:
            conn.execute("BEGIN")
            set_pg_organisation_context(conn, organisation_id)
            conn.execute(
                """
                INSERT INTO trade_state (organisation_id, data)
                VALUES (%s, %s::jsonb)
                ON CONFLICT (organisation_id) DO UPDATE SET data = EXCLUDED.data
                """,
                (organisation_id, payload),
            )
            conn.commit()
        return

    with _sqlite_connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute(
            """
            INSERT INTO trade_state (organisation_id, data) VALUES (?, ?)
            ON CONFLICT(organisation_id) DO UPDATE SET data = excluded.data
            """,
            (organisation_id, payload),
        )
        conn.commit()


def insert_demo_request(
    *,
    name: str,
    company: str,
    phone: str,
    email: str,
    message: str,
) -> dict[str, Any]:
    init_db()
    created_at = datetime.now(timezone.utc).isoformat()
    if uses_postgres():
        with _pg_connect() as conn:
            row = conn.execute(
                """
                INSERT INTO demo_requests (name, company, phone, email, message, created_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (name, company, phone, email, message, created_at),
            ).fetchone()
            conn.commit()
            return {"id": row["id"] if row else None, "createdAt": created_at}

    with _sqlite_connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO demo_requests (name, company, phone, email, message, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (name, company, phone, email, message, created_at),
        )
        conn.commit()
        return {"id": cur.lastrowid, "createdAt": created_at}
