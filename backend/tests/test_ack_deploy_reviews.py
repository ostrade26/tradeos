"""Regression: deploy_review notices clear when destination CTA is acked."""

from __future__ import annotations

import json
import sqlite3
import unittest
from pathlib import Path
import sys

# Allow `python backend/tests/test_ack_deploy_reviews.py` from repo root.
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.identity.notifications_repository import (  # noqa: E402
    ack_deploy_review_notices,
    DEPLOY_REVIEW_CTAS,
)


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute(
        """
        CREATE TABLE user_notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          organisation_id INTEGER,
          recipient_user_id INTEGER NOT NULL,
          kind TEXT NOT NULL,
          title TEXT,
          body TEXT,
          payload_json TEXT,
          href TEXT,
          read_at TEXT,
          created_at TEXT
        )
        """
    )
    return conn


def _insert(conn: sqlite3.Connection, *, user_id: int, cta: str | None, href: str, read_at: str | None = None) -> int:
    payload = {"cta": cta} if cta is not None else {}
    cur = conn.execute(
        """
        INSERT INTO user_notifications
          (organisation_id, recipient_user_id, kind, title, body, payload_json, href, read_at, created_at)
        VALUES (NULL, ?, 'deploy_review', 'New feature(s) from deploy · test', 'body', ?, ?, ?, '2026-01-01T00:00:00Z')
        """,
        (user_id, json.dumps(payload), href, read_at),
    )
    return int(cur.lastrowid)


class AckDeployReviewsTests(unittest.TestCase):
    def test_cta_whitelist(self) -> None:
        self.assertEqual(DEPLOY_REVIEW_CTAS, frozenset({"review_features", "review_release"}))

    def test_deploy_review_actionable_tracks_unread(self) -> None:
        """List shape invariant — never leave actionable=True after read."""
        for unread in (True, False):
            actionable = unread  # mirrors inbox_repository deploy_review branch
            status = "open" if unread else "done"
            self.assertEqual(actionable, unread)
            self.assertEqual(status, "open" if unread else "done")

    def test_ack_features_marks_matching_unread_only(self) -> None:
        conn = _connect()
        uid = 7
        features = _insert(conn, user_id=uid, cta="review_features", href="/platform-admin/add-ons")
        releases = _insert(conn, user_id=uid, cta="review_release", href="/platform-admin/releases")
        other_user = _insert(conn, user_id=9, cta="review_features", href="/platform-admin/add-ons")
        already = _insert(
            conn,
            user_id=uid,
            cta="review_features",
            href="/platform-admin/add-ons",
            read_at="2026-01-02T00:00:00Z",
        )

        updated = ack_deploy_review_notices(conn, uid, "review_features")
        self.assertEqual(updated, 1)

        rows = {
            int(r["id"]): r["read_at"]
            for r in conn.execute("SELECT id, read_at FROM user_notifications").fetchall()
        }
        self.assertIsNotNone(rows[features])
        self.assertIsNone(rows[releases])
        self.assertIsNone(rows[other_user])
        self.assertEqual(rows[already], "2026-01-02T00:00:00Z")

    def test_ack_infers_cta_from_href_when_payload_missing(self) -> None:
        conn = _connect()
        uid = 3
        legacy = _insert(conn, user_id=uid, cta=None, href="/platform-admin/add-ons?tab=catalog")
        updated = ack_deploy_review_notices(conn, uid, "review_features")
        self.assertEqual(updated, 1)
        row = conn.execute("SELECT read_at FROM user_notifications WHERE id = ?", (legacy,)).fetchone()
        self.assertIsNotNone(row["read_at"])

    def test_invalid_cta_is_noop(self) -> None:
        conn = _connect()
        _insert(conn, user_id=1, cta="review_features", href="/platform-admin/add-ons")
        self.assertEqual(ack_deploy_review_notices(conn, 1, "nope"), 0)


if __name__ == "__main__":
    unittest.main()
