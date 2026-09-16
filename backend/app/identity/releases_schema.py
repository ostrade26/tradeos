"""Versioned product releases published by platform admin."""

from __future__ import annotations

from ..db import _pg_connect, _sqlite_connect, uses_postgres


def init_releases_schema() -> None:
    if uses_postgres():
        with _pg_connect() as conn:
            _create_tables(conn)
            conn.commit()
        return
    with _sqlite_connect() as conn:
        _create_tables(conn)
        conn.commit()


def _create_tables(conn) -> None:
    pk = "SERIAL PRIMARY KEY" if uses_postgres() else "INTEGER PRIMARY KEY AUTOINCREMENT"
    conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS platform_releases (
            id {pk},
            version TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            summary TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'draft',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            created_by_user_id INTEGER REFERENCES users(id),
            published_at TEXT,
            published_by_user_id INTEGER REFERENCES users(id)
        )
        """
    )
    conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS platform_release_items (
            id {pk},
            release_id INTEGER NOT NULL REFERENCES platform_releases(id) ON DELETE CASCADE,
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            detail TEXT NOT NULL DEFAULT '',
            feature_key TEXT NOT NULL DEFAULT '',
            sort_order INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_platform_release_items_release ON platform_release_items(release_id, sort_order)"
    )
    conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS organisation_applied_updates (
            id {pk},
            organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
            feature_key TEXT NOT NULL,
            version TEXT NOT NULL DEFAULT '',
            release_id INTEGER REFERENCES platform_releases(id) ON DELETE SET NULL,
            notification_id INTEGER REFERENCES user_notifications(id) ON DELETE SET NULL,
            applied_by_user_id INTEGER REFERENCES users(id),
            applied_at TEXT NOT NULL,
            UNIQUE (organisation_id, feature_key)
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_org_applied_updates_org ON organisation_applied_updates(organisation_id)"
    )
    _add_column(conn, "user_applied_updates", "version", "TEXT NOT NULL DEFAULT ''")
    _add_column(conn, "user_applied_updates", "release_id", "INTEGER")


def _add_column(conn, table: str, name: str, ddl: str) -> None:
    if uses_postgres():
        conn.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {name} {ddl}")
        return
    cols = {r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    if name not in cols:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")
