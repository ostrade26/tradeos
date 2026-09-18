"""Organisation interest in platform feature launches (sales / approval flow)."""

from __future__ import annotations

from ..db import _pg_connect, _sqlite_connect, uses_postgres


def init_feature_interests_schema() -> None:
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
        CREATE TABLE IF NOT EXISTS feature_launch_interests (
            id {pk},
            organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
            requested_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            feature_key TEXT NOT NULL,
            feature_title TEXT NOT NULL DEFAULT '',
            feature_detail TEXT NOT NULL DEFAULT '',
            source_notification_id INTEGER REFERENCES user_notifications(id) ON DELETE SET NULL,
            status TEXT NOT NULL DEFAULT 'interested',
            platform_note TEXT NOT NULL DEFAULT '',
            reviewed_by_user_id INTEGER REFERENCES users(id),
            reviewed_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE (organisation_id, feature_key, status)
        )
        """
    )
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_feature_launch_interests_status
        ON feature_launch_interests(status, created_at DESC)
        """
    )
