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
    _add_column(conn, "platform_releases", "source", "TEXT NOT NULL DEFAULT 'manual'")
    _add_column(conn, "platform_releases", "deploy_commit_sha", "TEXT")
    _add_column(conn, "platform_releases", "deploy_environment", "TEXT")
    _add_column(conn, "platform_releases", "ready_to_ship", "INTEGER NOT NULL DEFAULT 0")
    _add_column(conn, "platform_releases", "target_ship_date", "TEXT NOT NULL DEFAULT ''")
    _add_column(conn, "platform_releases", "ship_notes", "TEXT NOT NULL DEFAULT ''")
    conn.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_releases_deploy_sha
        ON platform_releases(deploy_commit_sha)
        WHERE deploy_commit_sha IS NOT NULL AND deploy_commit_sha <> ''
        """
    )
    _backfill_draft_release_ship_notes(conn)
    _relax_notifications_nullable_org(conn)


DRAFT_RELEASE_SHIP_NOTE = (
    "Draft release — not published to organisations yet. Review in Ship queue before publishing."
)


def _backfill_draft_release_ship_notes(conn) -> None:
    ph = "%s" if uses_postgres() else "?"
    conn.execute(
        f"""
        UPDATE platform_releases
        SET ship_notes = {ph}
        WHERE status = 'draft'
          AND (ship_notes IS NULL OR TRIM(ship_notes) = '')
        """,
        (DRAFT_RELEASE_SHIP_NOTE,),
    )


def _relax_notifications_nullable_org(conn) -> None:
    if uses_postgres():
        conn.execute("ALTER TABLE user_notifications ALTER COLUMN organisation_id DROP NOT NULL")
        return
    cols = conn.execute("PRAGMA table_info(user_notifications)").fetchall()
    org_col = next((c for c in cols if c[1] == "organisation_id"), None)
    if not org_col or org_col[3] == 0:
        return
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS user_notifications__nullable_org (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            organisation_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE,
            recipient_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            kind TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT NOT NULL DEFAULT '',
            payload_json TEXT NOT NULL DEFAULT '{}',
            href TEXT NOT NULL DEFAULT '',
            read_at TEXT,
            created_at TEXT NOT NULL,
            created_by_user_id INTEGER REFERENCES users(id),
            applied_at TEXT,
            feature_key TEXT NOT NULL DEFAULT ''
        )
        """
    )
    conn.execute(
        """
        INSERT INTO user_notifications__nullable_org
        (id, organisation_id, recipient_user_id, kind, title, body, payload_json, href,
         read_at, created_at, created_by_user_id, applied_at, feature_key)
        SELECT id, organisation_id, recipient_user_id, kind, title, body, payload_json, href,
               read_at, created_at, created_by_user_id, applied_at, feature_key
        FROM user_notifications
        """
    )
    conn.execute("DROP TABLE user_notifications")
    conn.execute("ALTER TABLE user_notifications__nullable_org RENAME TO user_notifications")
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_user_notifications_recipient
            ON user_notifications(recipient_user_id, created_at DESC)
        """
    )


def _add_column(conn, table: str, name: str, ddl: str) -> None:
    if uses_postgres():
        conn.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {name} {ddl}")
        return
    cols = {r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    if name not in cols:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")
