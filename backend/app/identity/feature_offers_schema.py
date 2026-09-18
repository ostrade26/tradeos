"""Catalog of optional product features (Add-ons marketplace)."""

from __future__ import annotations

from ..db import _pg_connect, _sqlite_connect, uses_postgres


def init_feature_offers_schema() -> None:
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
