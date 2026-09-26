"""Publish must not collide with an unpublished draft that already holds the next number."""

from __future__ import annotations

import sqlite3
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.identity.releases_repository import (  # noqa: E402
    allocate_publish_version,
    peek_next_publish_version,
)


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute(
        """
        CREATE TABLE platform_releases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          version TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL,
          published_at TEXT,
          updated_at TEXT
        )
        """
    )
    return conn


def _insert(conn: sqlite3.Connection, version: str, status: str, published_at: str | None = None) -> int:
    cur = conn.execute(
        """
        INSERT INTO platform_releases (version, status, published_at, updated_at)
        VALUES (?, ?, ?, '2026-01-01T00:00:00Z')
        """,
        (version, status, published_at),
    )
    return int(cur.lastrowid)


class PublishVersionAllocationTests(unittest.TestCase):
    def test_latest_push_can_publish_past_a_missing_draft_version(self) -> None:
        conn = _connect()
        _insert(conn, "1.0.62", "published", "2026-09-01T00:00:00Z")
        blocked = _insert(conn, "1.0.63", "draft")
        latest_push = _insert(conn, "1.0.64", "draft")

        self.assertEqual(peek_next_publish_version(conn), "1.0.64")
        version = allocate_publish_version(conn, ["bug_fix"], latest_push)
        self.assertEqual(version, "1.0.64")

        still = conn.execute(
            "SELECT version FROM platform_releases WHERE id = ?",
            (blocked,),
        ).fetchone()
        self.assertEqual(still["version"], "1.0.63")


if __name__ == "__main__":
    unittest.main()
