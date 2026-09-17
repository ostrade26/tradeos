"""Org-to-Tradeal product requests (issue, improvement, new need)."""

from __future__ import annotations

from ..db import _pg_connect, _sqlite_connect, uses_postgres


def init_product_requests_schema() -> None:
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
        CREATE TABLE IF NOT EXISTS product_requests (
            id {pk},
            organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
            requested_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            kind TEXT NOT NULL,
            message TEXT NOT NULL,
            page_path TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'received',
            reply TEXT NOT NULL DEFAULT '',
            reviewed_by_user_id INTEGER REFERENCES users(id),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_product_requests_org ON product_requests(organisation_id)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_product_requests_status ON product_requests(status)"
    )
    if uses_postgres():
        conn.execute(
            "ALTER TABLE product_requests ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'p3'"
        )
        conn.execute(
            "ALTER TABLE product_requests ADD COLUMN IF NOT EXISTS attachments TEXT NOT NULL DEFAULT '[]'"
        )
    else:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(product_requests)").fetchall()}
        if "priority" not in cols:
            conn.execute("ALTER TABLE product_requests ADD COLUMN priority TEXT NOT NULL DEFAULT 'p3'")
        if "attachments" not in cols:
            conn.execute("ALTER TABLE product_requests ADD COLUMN attachments TEXT NOT NULL DEFAULT '[]'")
