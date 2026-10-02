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
            organisation_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE,
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
    # Outbox header — one row per broadcast/send for Inbox → Sent.
    conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS notification_sends (
            id {pk},
            actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            kind TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT NOT NULL DEFAULT '',
            audience TEXT NOT NULL DEFAULT '',
            recipient_scope TEXT NOT NULL DEFAULT '',
            organisation_id INTEGER REFERENCES organisations(id) ON DELETE SET NULL,
            sent_count INTEGER NOT NULL DEFAULT 0,
            skipped_expired_amc INTEGER NOT NULL DEFAULT 0,
            source TEXT NOT NULL DEFAULT 'manual',
            href TEXT NOT NULL DEFAULT '',
            payload_json TEXT NOT NULL DEFAULT '{{}}',
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_notification_sends_actor_created
            ON notification_sends(actor_user_id, created_at DESC)
        """
    )
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_notification_sends_created
            ON notification_sends(created_at DESC)
        """
    )
    conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS broker_contract_shares (
            id {pk},
            sender_organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
            sender_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            buyer_organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
            seller_organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
            contract_ref TEXT NOT NULL,
            note TEXT NOT NULL DEFAULT '',
            filename TEXT NOT NULL DEFAULT '',
            pdf_data TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
        )
        """
    )
    for name, ddl in (
        ("item_name", "TEXT NOT NULL DEFAULT ''"),
        ("quantity", "TEXT NOT NULL DEFAULT ''"),
        ("rate", "TEXT NOT NULL DEFAULT ''"),
        ("brokerage", "TEXT NOT NULL DEFAULT ''"),
        ("delivery_period", "TEXT NOT NULL DEFAULT ''"),
        ("payment_terms", "TEXT NOT NULL DEFAULT ''"),
        ("buyer_order_ref", "TEXT NOT NULL DEFAULT ''"),
        ("seller_order_ref", "TEXT NOT NULL DEFAULT ''"),
        ("buyer_confirmed_at", "TEXT NOT NULL DEFAULT ''"),
        ("seller_confirmed_at", "TEXT NOT NULL DEFAULT ''"),
        ("deleted_at", "TEXT NOT NULL DEFAULT ''"),
        ("edited_at", "TEXT NOT NULL DEFAULT ''"),
    ):
        try:
            conn.execute(f"ALTER TABLE broker_contract_shares ADD COLUMN {name} {ddl}")
        except Exception as exc:
            message = str(exc).lower()
            if "duplicate" in message or "already exists" in message:
                continue
            raise
    conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS broker_contract_share_lift_events (
            id {pk},
            share_id INTEGER NOT NULL REFERENCES broker_contract_shares(id) ON DELETE CASCADE,
            organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
            party_role TEXT NOT NULL,
            lift_id TEXT NOT NULL,
            lift_ref INTEGER NOT NULL DEFAULT 0,
            order_ref TEXT NOT NULL DEFAULT '',
            qty_mt REAL NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending',
            event_at TEXT NOT NULL DEFAULT '',
            delivered_at TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL DEFAULT '',
            UNIQUE (share_id, organisation_id, lift_id)
        )
        """
    )
    try:
        conn.execute(
            "ALTER TABLE broker_contract_share_lift_events ADD COLUMN delivered_at TEXT NOT NULL DEFAULT ''"
        )
    except Exception as exc:
        message = str(exc).lower()
        if "duplicate" not in message and "already exists" not in message:
            raise
    try:
        conn.execute(
            "ALTER TABLE broker_contract_share_lift_events ADD COLUMN tankers_json TEXT NOT NULL DEFAULT '[]'"
        )
    except Exception as exc:
        message = str(exc).lower()
        if "duplicate" not in message and "already exists" not in message:
            raise
    try:
        conn.execute(
            "ALTER TABLE broker_contract_share_lift_events ADD COLUMN broker_lift_ref INTEGER NOT NULL DEFAULT 0"
        )
    except Exception as exc:
        message = str(exc).lower()
        if "duplicate" not in message and "already exists" not in message:
            raise
    from datetime import datetime, timezone

    seen_at = datetime.now(timezone.utc).isoformat()
    ph = "%s" if uses_postgres() else "?"
    for name, ddl, mark_seen in (
        ("broker_read_at", "TEXT NOT NULL DEFAULT ''", True),
        ("broker_completed_at", "TEXT NOT NULL DEFAULT ''", False),
        ("tanker_changes_json", "TEXT NOT NULL DEFAULT '[]'", False),
    ):
        try:
            conn.execute(
                f"ALTER TABLE broker_contract_share_lift_events ADD COLUMN {name} {ddl}"
            )
        except Exception as exc:
            message = str(exc).lower()
            if "duplicate" in message or "already exists" in message:
                continue
            raise
        if mark_seen:
            conn.execute(
                f"UPDATE broker_contract_share_lift_events SET broker_read_at = {ph} WHERE broker_read_at = ''",
                (seen_at,),
            )
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_broker_share_lift_events_share
            ON broker_contract_share_lift_events(share_id, updated_at DESC)
        """
    )
    _migrate_broker_share_external_parties(conn)


def _migrate_broker_share_external_parties(conn) -> None:
    """External buyer/seller contacts and nullable party org ids (off-Tradeal parties)."""
    for name, ddl in (
        ("buyer_external_name", "TEXT NOT NULL DEFAULT ''"),
        ("buyer_external_email", "TEXT NOT NULL DEFAULT ''"),
        ("buyer_external_phone", "TEXT NOT NULL DEFAULT ''"),
        ("seller_external_name", "TEXT NOT NULL DEFAULT ''"),
        ("seller_external_email", "TEXT NOT NULL DEFAULT ''"),
        ("seller_external_phone", "TEXT NOT NULL DEFAULT ''"),
        ("buyer_invite_token", "TEXT NOT NULL DEFAULT ''"),
        ("seller_invite_token", "TEXT NOT NULL DEFAULT ''"),
        ("buyer_email_sent_at", "TEXT NOT NULL DEFAULT ''"),
        ("seller_email_sent_at", "TEXT NOT NULL DEFAULT ''"),
    ):
        try:
            conn.execute(f"ALTER TABLE broker_contract_shares ADD COLUMN {name} {ddl}")
        except Exception as exc:
            message = str(exc).lower()
            if "duplicate" in message or "already exists" in message:
                continue
            raise

    if uses_postgres():
        for col in ("buyer_organisation_id", "seller_organisation_id"):
            try:
                conn.execute(
                    f"ALTER TABLE broker_contract_shares ALTER COLUMN {col} DROP NOT NULL"
                )
            except Exception:
                pass
        return

    rows = conn.execute("PRAGMA table_info(broker_contract_shares)").fetchall()
    by_name = {str(r[1]): r for r in rows}
    buyer = by_name.get("buyer_organisation_id")
    if not buyer or int(buyer[3] or 0) == 0:
        return

    conn.execute("PRAGMA foreign_keys=OFF")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS broker_contract_shares__ext (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
            sender_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            buyer_organisation_id INTEGER REFERENCES organisations(id) ON DELETE SET NULL,
            seller_organisation_id INTEGER REFERENCES organisations(id) ON DELETE SET NULL,
            contract_ref TEXT NOT NULL,
            note TEXT NOT NULL DEFAULT '',
            filename TEXT NOT NULL DEFAULT '',
            pdf_data TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            item_name TEXT NOT NULL DEFAULT '',
            quantity TEXT NOT NULL DEFAULT '',
            rate TEXT NOT NULL DEFAULT '',
            brokerage TEXT NOT NULL DEFAULT '',
            delivery_period TEXT NOT NULL DEFAULT '',
            payment_terms TEXT NOT NULL DEFAULT '',
            buyer_order_ref TEXT NOT NULL DEFAULT '',
            seller_order_ref TEXT NOT NULL DEFAULT '',
            buyer_confirmed_at TEXT NOT NULL DEFAULT '',
            seller_confirmed_at TEXT NOT NULL DEFAULT '',
            deleted_at TEXT NOT NULL DEFAULT '',
            edited_at TEXT NOT NULL DEFAULT '',
            buyer_external_name TEXT NOT NULL DEFAULT '',
            buyer_external_email TEXT NOT NULL DEFAULT '',
            buyer_external_phone TEXT NOT NULL DEFAULT '',
            seller_external_name TEXT NOT NULL DEFAULT '',
            seller_external_email TEXT NOT NULL DEFAULT '',
            seller_external_phone TEXT NOT NULL DEFAULT '',
            buyer_invite_token TEXT NOT NULL DEFAULT '',
            seller_invite_token TEXT NOT NULL DEFAULT '',
            buyer_email_sent_at TEXT NOT NULL DEFAULT '',
            seller_email_sent_at TEXT NOT NULL DEFAULT ''
        )
        """
    )
    conn.execute(
        """
        INSERT INTO broker_contract_shares__ext (
            id, sender_organisation_id, sender_user_id, buyer_organisation_id, seller_organisation_id,
            contract_ref, note, filename, pdf_data, created_at,
            item_name, quantity, rate, brokerage, delivery_period, payment_terms,
            buyer_order_ref, seller_order_ref, buyer_confirmed_at, seller_confirmed_at,
            deleted_at, edited_at,
            buyer_external_name, buyer_external_email, buyer_external_phone,
            seller_external_name, seller_external_email, seller_external_phone,
            buyer_invite_token, seller_invite_token, buyer_email_sent_at, seller_email_sent_at
        )
        SELECT
            id, sender_organisation_id, sender_user_id, buyer_organisation_id, seller_organisation_id,
            contract_ref, note, filename, pdf_data, created_at,
            item_name, quantity, rate, brokerage, delivery_period, payment_terms,
            buyer_order_ref, seller_order_ref, buyer_confirmed_at, seller_confirmed_at,
            deleted_at, edited_at,
            buyer_external_name, buyer_external_email, buyer_external_phone,
            seller_external_name, seller_external_email, seller_external_phone,
            buyer_invite_token, seller_invite_token, buyer_email_sent_at, seller_email_sent_at
        FROM broker_contract_shares
        """
    )
    conn.execute("DROP TABLE broker_contract_shares")
    conn.execute("ALTER TABLE broker_contract_shares__ext RENAME TO broker_contract_shares")
    conn.execute("PRAGMA foreign_keys=ON")
