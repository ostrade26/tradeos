"""Platform-controlled backup reminder schedule."""

from __future__ import annotations

from ..db import _pg_connect, _sqlite_connect, uses_postgres


def init_backup_reminder_schema() -> None:
    if uses_postgres():
        with _pg_connect() as conn:
            _create_table(conn)
            _seed_defaults(conn)
            conn.commit()
        return
    with _sqlite_connect() as conn:
        _create_table(conn)
        _seed_defaults(conn)
        conn.commit()


def _create_table(conn) -> None:
    pk = "SERIAL PRIMARY KEY" if uses_postgres() else "INTEGER PRIMARY KEY CHECK (id = 1)"
    conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS backup_reminder_settings (
            id {pk},
            enabled INTEGER NOT NULL DEFAULT 1,
            frequency TEXT NOT NULL DEFAULT 'daily',
            send_hour INTEGER NOT NULL DEFAULT 18,
            send_minute INTEGER NOT NULL DEFAULT 0,
            timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
            weekdays TEXT NOT NULL DEFAULT '1,4',
            title TEXT NOT NULL DEFAULT 'Backup reminder',
            body TEXT NOT NULL DEFAULT '',
            recipient_scope TEXT NOT NULL DEFAULT 'all_users',
            exclude_expired_amc INTEGER NOT NULL DEFAULT 1,
            last_sent_at TEXT,
            last_sent_local_date TEXT,
            updated_at TEXT NOT NULL DEFAULT ''
        )
        """
    )


def _seed_defaults(conn) -> None:
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()
    body = (
        "Please export a Tradeal backup from Settings → Data and store it safely. "
        "During early testing this helps you recover quickly if something goes wrong."
    )
    if uses_postgres():
        conn.execute(
            """
            INSERT INTO backup_reminder_settings
            (id, enabled, frequency, send_hour, send_minute, timezone, weekdays,
             title, body, recipient_scope, exclude_expired_amc, updated_at)
            VALUES (1, 1, 'daily', 18, 0, 'Asia/Kolkata', '1,4',
                    'Backup reminder', %s, 'all_users', 1, %s)
            ON CONFLICT (id) DO NOTHING
            """,
            (body, now),
        )
        # Always notify org admins and licensed users for scheduled backups.
        conn.execute(
            """
            UPDATE backup_reminder_settings
            SET recipient_scope = 'all_users'
            WHERE id = 1 AND recipient_scope IS DISTINCT FROM 'all_users'
            """
        )
        return
    row = conn.execute("SELECT id FROM backup_reminder_settings WHERE id = 1").fetchone()
    if row:
        conn.execute(
            "UPDATE backup_reminder_settings SET recipient_scope = 'all_users' WHERE id = 1"
        )
        return
    conn.execute(
        """
        INSERT INTO backup_reminder_settings
        (id, enabled, frequency, send_hour, send_minute, timezone, weekdays,
         title, body, recipient_scope, exclude_expired_amc, updated_at)
        VALUES (1, 1, 'daily', 18, 0, 'Asia/Kolkata', '1,4',
                'Backup reminder', ?, 'all_users', 1, ?)
        """,
        (body, now),
    )
