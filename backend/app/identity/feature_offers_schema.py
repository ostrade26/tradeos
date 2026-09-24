"""Catalog of optional product features (Add-ons marketplace)."""

from __future__ import annotations

from datetime import datetime, timezone

from ..db import _pg_connect, _sqlite_connect, uses_postgres

TRADEAL_AI_FEATURE_KEY = "tradeal-ai"
CUSTOM_BRANDING_FEATURE_KEY = "custom-branding"


def init_feature_offers_schema() -> None:
    if uses_postgres():
        with _pg_connect() as conn:
            _create_tables(conn)
            _ensure_card_tone_column(conn)
            _ensure_card_image_column(conn)
            _ensure_card_featured_column(conn)
            _ensure_card_bg_hex_column(conn)
            _ensure_card_tag_column(conn)
            _ensure_ship_planning_columns(conn)
            _seed_tradeal_ai_offer(conn)
            _seed_custom_branding_offer(conn)
            _backfill_draft_ship_notes(conn)
            conn.commit()
        return
    with _sqlite_connect() as conn:
        _create_tables(conn)
        _ensure_card_tone_column(conn)
        _ensure_card_image_column(conn)
        _ensure_card_featured_column(conn)
        _ensure_card_bg_hex_column(conn)
        _ensure_card_tag_column(conn)
        _ensure_ship_planning_columns(conn)
        _seed_tradeal_ai_offer(conn)
        _seed_custom_branding_offer(conn)
        _backfill_draft_ship_notes(conn)
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


def _ensure_card_image_column(conn) -> None:
    if uses_postgres():
        conn.execute(
            "ALTER TABLE platform_feature_offers ADD COLUMN IF NOT EXISTS card_image_url TEXT NOT NULL DEFAULT ''"
        )
        return
    cols = {str(r[1]) for r in conn.execute("PRAGMA table_info(platform_feature_offers)").fetchall()}
    if "card_image_url" not in cols:
        conn.execute(
            "ALTER TABLE platform_feature_offers ADD COLUMN card_image_url TEXT NOT NULL DEFAULT ''"
        )


def _ensure_card_featured_column(conn) -> None:
    if uses_postgres():
        conn.execute(
            "ALTER TABLE platform_feature_offers ADD COLUMN IF NOT EXISTS card_featured INTEGER NOT NULL DEFAULT 0"
        )
        return
    cols = {str(r[1]) for r in conn.execute("PRAGMA table_info(platform_feature_offers)").fetchall()}
    if "card_featured" not in cols:
        conn.execute(
            "ALTER TABLE platform_feature_offers ADD COLUMN card_featured INTEGER NOT NULL DEFAULT 0"
        )


def _ensure_card_bg_hex_column(conn) -> None:
    if uses_postgres():
        conn.execute(
            "ALTER TABLE platform_feature_offers ADD COLUMN IF NOT EXISTS card_bg_hex TEXT NOT NULL DEFAULT ''"
        )
        return
    cols = {str(r[1]) for r in conn.execute("PRAGMA table_info(platform_feature_offers)").fetchall()}
    if "card_bg_hex" not in cols:
        conn.execute(
            "ALTER TABLE platform_feature_offers ADD COLUMN card_bg_hex TEXT NOT NULL DEFAULT ''"
        )


def _ensure_card_tag_column(conn) -> None:
    if uses_postgres():
        conn.execute(
            "ALTER TABLE platform_feature_offers ADD COLUMN IF NOT EXISTS card_tag TEXT NOT NULL DEFAULT ''"
        )
        return
    cols = {str(r[1]) for r in conn.execute("PRAGMA table_info(platform_feature_offers)").fetchall()}
    if "card_tag" not in cols:
        conn.execute(
            "ALTER TABLE platform_feature_offers ADD COLUMN card_tag TEXT NOT NULL DEFAULT ''"
        )


def _ensure_ship_planning_columns(conn) -> None:
    if uses_postgres():
        conn.execute(
            "ALTER TABLE platform_feature_offers ADD COLUMN IF NOT EXISTS ready_to_ship INTEGER NOT NULL DEFAULT 0"
        )
        conn.execute(
            "ALTER TABLE platform_feature_offers ADD COLUMN IF NOT EXISTS target_ship_date TEXT NOT NULL DEFAULT ''"
        )
        conn.execute(
            "ALTER TABLE platform_feature_offers ADD COLUMN IF NOT EXISTS ship_notes TEXT NOT NULL DEFAULT ''"
        )
        return
    cols = {str(r[1]) for r in conn.execute("PRAGMA table_info(platform_feature_offers)").fetchall()}
    if "ready_to_ship" not in cols:
        conn.execute(
            "ALTER TABLE platform_feature_offers ADD COLUMN ready_to_ship INTEGER NOT NULL DEFAULT 0"
        )
    if "target_ship_date" not in cols:
        conn.execute(
            "ALTER TABLE platform_feature_offers ADD COLUMN target_ship_date TEXT NOT NULL DEFAULT ''"
        )
    if "ship_notes" not in cols:
        conn.execute(
            "ALTER TABLE platform_feature_offers ADD COLUMN ship_notes TEXT NOT NULL DEFAULT ''"
        )


DRAFT_OFFER_SHIP_NOTE = (
    "Draft — not listed for organisations yet. Review in Ship queue before listing."
)


def _backfill_draft_ship_notes(conn) -> None:
    """Seed honest Ship queue copy on existing drafts that have no owner note yet."""
    ph = "%s" if uses_postgres() else "?"
    conn.execute(
        f"""
        UPDATE platform_feature_offers
        SET ship_notes = {ph}
        WHERE catalog_status = 'draft'
          AND (ship_notes IS NULL OR TRIM(ship_notes) = '')
        """,
        (DRAFT_OFFER_SHIP_NOTE,),
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
            card_image_url TEXT NOT NULL DEFAULT '',
            card_featured INTEGER NOT NULL DEFAULT 0,
            card_bg_hex TEXT NOT NULL DEFAULT '',
            card_tag TEXT NOT NULL DEFAULT '',
            ready_to_ship INTEGER NOT NULL DEFAULT 0,
            target_ship_date TEXT NOT NULL DEFAULT '',
            ship_notes TEXT NOT NULL DEFAULT '',
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


def _seed_custom_branding_offer(conn) -> None:
    """List Custom branding — primary colour + side navigation theme."""
    now = _now()
    ph = "%s" if uses_postgres() else "?"
    existing = conn.execute(
        f"SELECT id, pricing_type FROM platform_feature_offers WHERE feature_key = {ph}",
        (CUSTOM_BRANDING_FEATURE_KEY,),
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
                CUSTOM_BRANDING_FEATURE_KEY,
                "Custom branding",
                "Choose your primary colour and side navigation theme — Theme colour or Default surface.",
                "paid",
                0,
                "INR",
                "listed",
                20,
                now,
                now,
                now,
            ),
        )
        return

    conn.execute(
        f"""
        UPDATE platform_feature_offers
        SET pricing_type = {ph}, updated_at = {ph}
        WHERE feature_key = {ph} AND pricing_type = {ph}
        """,
        ("paid", now, CUSTOM_BRANDING_FEATURE_KEY, "free"),
    )
