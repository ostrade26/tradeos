"""Persisted in-app notifications for organisation users."""

from __future__ import annotations

from ..db import _pg_connect, _sqlite_connect, uses_postgres


def init_notifications_schema() -> None:
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
        CREATE TABLE IF NOT EXISTS user_notifications (
            id {pk},
            organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
            recipient_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            kind TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT NOT NULL DEFAULT '',
            payload_json TEXT NOT NULL DEFAULT '{{}}',
            href TEXT NOT NULL DEFAULT '',
            read_at TEXT,
            created_at TEXT NOT NULL,
            created_by_user_id INTEGER REFERENCES users(id)
        )
        """
    )
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_user_notifications_recipient
            ON user_notifications(recipient_user_id, created_at DESC)
        """
    )
    if uses_postgres():
        conn.execute(
            "ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS applied_at TEXT"
        )
        conn.execute(
            "ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS feature_key TEXT NOT NULL DEFAULT ''"
        )
    else:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(user_notifications)").fetchall()}
        if "applied_at" not in cols:
            conn.execute("ALTER TABLE user_notifications ADD COLUMN applied_at TEXT")
        if "feature_key" not in cols:
            conn.execute("ALTER TABLE user_notifications ADD COLUMN feature_key TEXT NOT NULL DEFAULT ''")
    _create_campaign_tables(conn)
    conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS user_applied_updates (
            id {pk},
            organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            feature_key TEXT NOT NULL,
            notification_id INTEGER REFERENCES user_notifications(id) ON DELETE SET NULL,
            applied_at TEXT NOT NULL,
            UNIQUE (user_id, feature_key)
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_user_applied_updates_user ON user_applied_updates(user_id)"
    )


def _create_campaign_tables(conn) -> None:
    """Parent send + durable link from each user_notifications row."""
    pk = "SERIAL PRIMARY KEY" if uses_postgres() else "INTEGER PRIMARY KEY AUTOINCREMENT"
    conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS notification_campaigns (
            id {pk},
            kind TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT NOT NULL DEFAULT '',
            payload_json TEXT NOT NULL DEFAULT '{{}}',
            href TEXT NOT NULL DEFAULT '',
            feature_key TEXT NOT NULL DEFAULT '',
            audience TEXT NOT NULL,
            organisation_id INTEGER REFERENCES organisations(id) ON DELETE SET NULL,
            recipient_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            recipient_scope TEXT NOT NULL DEFAULT 'org_admin',
            exclude_expired_amc INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending',
            target_count INTEGER NOT NULL DEFAULT 0,
            sent_count INTEGER NOT NULL DEFAULT 0,
            skipped_expired_amc INTEGER NOT NULL DEFAULT 0,
            error_message TEXT NOT NULL DEFAULT '',
            source TEXT NOT NULL DEFAULT 'manual',
            source_id INTEGER,
            created_by_user_id INTEGER REFERENCES users(id),
            created_at TEXT NOT NULL,
            started_at TEXT,
            completed_at TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_notification_campaigns_status
            ON notification_campaigns(status, id)
        """
    )
    if uses_postgres():
        conn.execute(
            """
            ALTER TABLE user_notifications
            ADD COLUMN IF NOT EXISTS campaign_id INTEGER
                REFERENCES notification_campaigns(id) ON DELETE SET NULL
            """
        )
    else:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(user_notifications)").fetchall()}
        if "campaign_id" not in cols:
            conn.execute(
                "ALTER TABLE user_notifications ADD COLUMN campaign_id INTEGER "
                "REFERENCES notification_campaigns(id) ON DELETE SET NULL"
            )
    conn.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_user_notifications_campaign_recipient
            ON user_notifications(campaign_id, recipient_user_id)
        """
    )
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_user_notifications_campaign
            ON user_notifications(campaign_id)
        """
    )
