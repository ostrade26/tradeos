"""Organisation interest in platform feature launches (sales / approval flow)."""

from __future__ import annotations

from ..db import _pg_connect, _sqlite_connect, row_dict, uses_postgres


def init_feature_interests_schema() -> None:
    if uses_postgres():
        with _pg_connect() as conn:
            _create_tables(conn)
            _migrate_open_interest_unique(conn)
            conn.commit()
        return
    with _sqlite_connect() as conn:
        _create_tables(conn)
        _migrate_open_interest_unique(conn)
        conn.commit()


def _create_tables(conn) -> None:
    pk = "SERIAL PRIMARY KEY" if uses_postgres() else "INTEGER PRIMARY KEY AUTOINCREMENT"
    # One open request per org+feature; approved/rejected history may repeat.
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
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_feature_launch_interests_status
        ON feature_launch_interests(status, created_at DESC)
        """
    )
    conn.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_launch_interests_one_open
        ON feature_launch_interests(organisation_id, feature_key)
        WHERE status = 'interested'
        """
    )


def _migrate_open_interest_unique(conn) -> None:
    """Replace UNIQUE(org, feature_key, status) — it blocked re-decline after a prior rejection."""
    if uses_postgres():
        row = conn.execute(
            """
            SELECT c.conname
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            WHERE t.relname = 'feature_launch_interests'
              AND c.contype = 'u'
              AND pg_get_constraintdef(c.oid) ILIKE '%organisation_id%feature_key%status%'
            """
        ).fetchone()
        if row:
            name = str(row_dict(row).get("conname") or "")
            if name:
                conn.execute(f'ALTER TABLE feature_launch_interests DROP CONSTRAINT IF EXISTS "{name}"')
        conn.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_launch_interests_one_open
            ON feature_launch_interests(organisation_id, feature_key)
            WHERE status = 'interested'
            """
        )
        return

    # SQLite: table-level UNIQUE lives on the table; recreate without it if still present.
    indexes = conn.execute("PRAGMA index_list(feature_launch_interests)").fetchall()
    has_legacy_unique = False
    for idx in indexes:
        # (seq, name, unique, origin, partial)
        name = idx[1]
        is_unique = bool(idx[2])
        origin = idx[3] if len(idx) > 3 else ""
        if is_unique and origin == "u" and name != "idx_feature_launch_interests_one_open":
            cols = [r[2] for r in conn.execute(f"PRAGMA index_info('{name}')").fetchall()]
            if cols == ["organisation_id", "feature_key", "status"]:
                has_legacy_unique = True
                break
    if not has_legacy_unique:
        conn.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_launch_interests_one_open
            ON feature_launch_interests(organisation_id, feature_key)
            WHERE status = 'interested'
            """
        )
        return

    conn.execute(
        """
        CREATE TABLE feature_launch_interests__open_unique (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        INSERT INTO feature_launch_interests__open_unique
        (id, organisation_id, requested_by_user_id, feature_key, feature_title, feature_detail,
         source_notification_id, status, platform_note, reviewed_by_user_id, reviewed_at,
         created_at, updated_at)
        SELECT id, organisation_id, requested_by_user_id, feature_key, feature_title, feature_detail,
               source_notification_id, status, platform_note, reviewed_by_user_id, reviewed_at,
               created_at, updated_at
        FROM feature_launch_interests
        """
    )
    conn.execute("DROP TABLE feature_launch_interests")
    conn.execute("ALTER TABLE feature_launch_interests__open_unique RENAME TO feature_launch_interests")
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_feature_launch_interests_status
        ON feature_launch_interests(status, created_at DESC)
        """
    )
    conn.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_launch_interests_one_open
        ON feature_launch_interests(organisation_id, feature_key)
        WHERE status = 'interested'
        """
    )
