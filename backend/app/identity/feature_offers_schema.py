"""Catalog of optional product features (Add-ons marketplace)."""

from __future__ import annotations

from datetime import datetime, timezone

from ..db import _pg_connect, _sqlite_connect, uses_postgres

TRADEAL_AI_FEATURE_KEY = "tradeal-ai"


def init_feature_offers_schema() -> None:
    if uses_postgres():
        with _pg_connect() as conn:
            _create_tables(conn)
            _ensure_card_tone_column(conn)
            _seed_tradeal_ai_offer(conn)
            conn.commit()
        return
    with _sqlite_connect() as conn:
        _create_tables(conn)
        _ensure_card_tone_column(conn)
        _seed_tradeal_ai_offer(conn)
        conn.commit()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_card_tone_column(conn) -> None:
    if uses_postgres():
        conn.execute(
            "ALTER TABLE platform_feature_offers ADD COLUMN IF NOT EXISTS card_tone TEXT NOT NULL DEFAULT ''"
        )
        return
    cols = {str(r[1]) for r in conn.execute("PRAGMA table_info(platform_feature_offers)").fetchall()}
    if "card_tone" not in cols:
        conn.execute(
            "ALTER TABLE platform_feature_offers ADD COLUMN card_tone TEXT NOT NULL DEFAULT ''"
        )


def _create_tables(conn) -> None:
    pk = "SERIAL PRIMARY KEY" if uses_postgres() else "INTEGER PRIMARY KEY AUTOINCREMENT"
    conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS platform_feature_offers (
            id {pk},
            feature_key TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            pricing_type TEXT NOT NULL DEFAULT 'free',
            price_cents INTEGER NOT NULL DEFAULT 0,
            currency TEXT NOT NULL DEFAULT 'INR',
            catalog_status TEXT NOT NULL DEFAULT 'draft',
            sort_order INTEGER NOT NULL DEFAULT 0,
            card_tone TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            listed_at TEXT,
            listed_by_user_id INTEGER REFERENCES users(id)
        )
        """
    )
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_platform_feature_offers_status
        ON platform_feature_offers(catalog_status, sort_order, id)
        """
    )


def _seed_tradeal_ai_offer(conn) -> None:
    """List Tradeal AI on Features as paid — orgs only get access after purchase/approval."""
    now = _now()
    ph = "%s" if uses_postgres() else "?"
    existing = conn.execute(
        f"SELECT id, pricing_type FROM platform_feature_offers WHERE feature_key = {ph}",
        (TRADEAL_AI_FEATURE_KEY,),
    ).fetchone()
    if not existing:
        conn.execute(
            f"""
            INSERT INTO platform_feature_offers (
                feature_key, title, description, pricing_type, price_cents, currency,
                catalog_status, sort_order, created_at, updated_at, listed_at, listed_by_user_id
            ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, NULL)
            """,
            (
                TRADEAL_AI_FEATURE_KEY,
                "Tradeal AI",
                "Ask about earnings, balances, and pending orders — or create a PO, sales order, or lift from chat.",
                "paid",
                0,
                "INR",
                "listed",
                10,
                now,
                now,
                now,
            ),
        )
        return

    # Existing installs: keep catalog row but ensure it is not free/auto-enabled.
    conn.execute(
        f"""
        UPDATE platform_feature_offers
        SET pricing_type = {ph}, updated_at = {ph}
        WHERE feature_key = {ph} AND pricing_type = {ph}
        """,
        ("paid", now, TRADEAL_AI_FEATURE_KEY, "free"),
    )
