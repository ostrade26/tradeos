"""Campaign parent + deferred fan-out for user_notifications."""

from __future__ import annotations

import sqlite3
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.isolation_level = None
    conn.execute(
        """
        CREATE TABLE organisations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT NOT NULL,
            name TEXT NOT NULL,
            scope TEXT NOT NULL DEFAULT 'organisation'
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            organisation_id INTEGER,
            role_id INTEGER,
            status TEXT NOT NULL DEFAULT 'active',
            name TEXT NOT NULL DEFAULT ''
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE organisation_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            organisation_id INTEGER,
            user_id INTEGER,
            status TEXT NOT NULL DEFAULT 'active'
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE organisation_licenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            organisation_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'active'
        )
        """
    )
    from app.identity.notifications_schema import _create_tables

    _create_tables(conn)
    return conn


def _seed(conn: sqlite3.Connection) -> dict[str, int]:
    conn.execute("INSERT INTO roles (slug, name, scope) VALUES ('organisation_admin', 'Admin', 'organisation')")
    conn.execute("INSERT INTO roles (slug, name, scope) VALUES ('operator', 'Operator', 'organisation')")
    admin_role = int(conn.execute("SELECT id FROM roles WHERE slug = 'organisation_admin'").fetchone()[0])
    operator_role = int(conn.execute("SELECT id FROM roles WHERE slug = 'operator'").fetchone()[0])
    conn.execute("INSERT INTO organisations (name) VALUES ('Acme')")
    conn.execute("INSERT INTO organisations (name) VALUES ('Beta')")
    org1 = int(conn.execute("SELECT id FROM organisations WHERE name = 'Acme'").fetchone()[0])
    org2 = int(conn.execute("SELECT id FROM organisations WHERE name = 'Beta'").fetchone()[0])
    conn.execute(
        "INSERT INTO users (organisation_id, role_id, status, name) VALUES (?, ?, 'active', 'Ada')",
        (org1, admin_role),
    )
    conn.execute(
        "INSERT INTO users (organisation_id, role_id, status, name) VALUES (?, ?, 'active', 'Op')",
        (org1, operator_role),
    )
    conn.execute(
        "INSERT INTO users (organisation_id, role_id, status, name) VALUES (?, ?, 'active', 'Bea')",
        (org2, admin_role),
    )
    u1 = int(conn.execute("SELECT id FROM users WHERE name = 'Ada'").fetchone()[0])
    u2 = int(conn.execute("SELECT id FROM users WHERE name = 'Op'").fetchone()[0])
    u3 = int(conn.execute("SELECT id FROM users WHERE name = 'Bea'").fetchone()[0])
    conn.execute("INSERT INTO organisation_licenses (organisation_id, status) VALUES (?, 'active')", (org1,))
    conn.execute("INSERT INTO organisation_licenses (organisation_id, status) VALUES (?, 'active')", (org2,))
    return {"org1": org1, "org2": org2, "admin": u1, "operator": u2, "admin2": u3}


class NotificationCampaignTests(unittest.TestCase):
    def setUp(self) -> None:
        self.uses_pg = patch("app.identity.notifications_repository.uses_postgres", return_value=False)
        self.uses_pg_campaigns = patch(
            "app.identity.notification_campaigns_repository.uses_postgres", return_value=False
        )
        self.uses_pg_schema = patch("app.identity.notifications_schema.uses_postgres", return_value=False)
        self.audit = patch("app.identity.notification_campaigns_repository.append_audit_log")
        self.uses_pg.start()
        self.uses_pg_campaigns.start()
        self.uses_pg_schema.start()
        self.audit.start()
        self.addCleanup(self.uses_pg.stop)
        self.addCleanup(self.uses_pg_campaigns.stop)
        self.addCleanup(self.uses_pg_schema.stop)
        self.addCleanup(self.audit.stop)
        self.conn = _conn()
        self.ids = _seed(self.conn)

    def tearDown(self) -> None:
        self.conn.close()

    def test_single_user_send_is_inline_and_linked_to_campaign(self) -> None:
        from app.identity.notifications_repository import (
            create_notifications_for_audience,
            list_notifications_for_user,
            unread_count_for_user,
        )

        result = create_notifications_for_audience(
            self.conn,
            audience="user",
            organisation_id=self.ids["org1"],
            recipient_user_id=self.ids["admin"],
            recipient_scope="org_admin",
            exclude_expired_amc=False,
            kind="payment_reminder",
            title="Pay invoice",
            body="Please pay",
            payload={},
            href="",
            actor_user_id=self.ids["admin"],
        )
        self.assertFalse(result["queued"])
        self.assertEqual(result["sent"], 1)
        self.assertEqual(result["campaign_status"], "complete")
        self.assertIsNotNone(result["notification"])
        self.assertEqual(result["notification"]["campaign_id"], result["campaign_id"])
        items = list_notifications_for_user(self.conn, self.ids["admin"])
        self.assertEqual(len(items), 1)
        self.assertTrue(items[0]["unread"])
        self.assertEqual(unread_count_for_user(self.conn, self.ids["admin"]), 1)

    def test_active_licences_queues_then_fanout_is_idempotent(self) -> None:
        from app.identity.notification_campaigns_repository import process_campaign
        from app.identity.notifications_repository import (
            create_notifications_for_audience,
            list_notifications_for_user,
        )

        queued = create_notifications_for_audience(
            self.conn,
            audience="active_licences",
            organisation_id=None,
            recipient_user_id=None,
            recipient_scope="org_admin",
            exclude_expired_amc=False,
            kind="feature_launch",
            title="New on Tradeal",
            body="Lots v2",
            payload={"feature_key": "lots-v2"},
            href="",
            actor_user_id=self.ids["admin"],
            process_inline=False,
        )
        self.assertTrue(queued["queued"])
        self.assertEqual(queued["sent"], 0)
        self.assertIsNone(queued["notification"])
        self.assertEqual(list_notifications_for_user(self.conn, self.ids["admin"]), [])

        first = process_campaign(self.conn, queued["campaign_id"])
        self.assertFalse(first["queued"])
        self.assertEqual(first["sent"], 2)
        self.assertEqual(len(list_notifications_for_user(self.conn, self.ids["admin"])), 1)
        self.assertEqual(len(list_notifications_for_user(self.conn, self.ids["admin2"])), 1)
        self.assertEqual(list_notifications_for_user(self.conn, self.ids["operator"]), [])

        again = process_campaign(self.conn, queued["campaign_id"])
        self.assertEqual(again["sent"], 2)
        self.assertEqual(len(list_notifications_for_user(self.conn, self.ids["admin"])), 1)

    def test_org_list_shape_and_mark_read(self) -> None:
        from app.identity.notifications_repository import (
            create_notifications_for_audience,
            list_notifications_for_user,
            mark_notification_read,
            unread_count_for_user,
        )

        create_notifications_for_audience(
            self.conn,
            audience="user",
            organisation_id=self.ids["org1"],
            recipient_user_id=self.ids["admin"],
            recipient_scope="org_admin",
            exclude_expired_amc=False,
            kind="release_notes",
            title="Notes",
            body="Hello",
            payload={},
            href="/app",
            actor_user_id=self.ids["admin"],
        )
        items = list_notifications_for_user(self.conn, self.ids["admin"])
        row = items[0]
        for key in ("id", "organisation_id", "recipient_user_id", "kind", "title", "body", "payload", "href", "unread", "created_at"):
            self.assertIn(key, row)
        marked = mark_notification_read(self.conn, row["id"], self.ids["admin"])
        self.assertFalse(marked["unread"])
        self.assertEqual(unread_count_for_user(self.conn, self.ids["admin"]), 0)

    def test_credentials_payload_still_accepted_but_campaign_api_redacts(self) -> None:
        from app.identity.notification_campaigns_repository import get_campaign
        from app.identity.notifications_repository import create_notifications_for_audience

        result = create_notifications_for_audience(
            self.conn,
            audience="user",
            organisation_id=self.ids["org1"],
            recipient_user_id=self.ids["admin"],
            recipient_scope="org_admin",
            exclude_expired_amc=False,
            kind="credentials",
            title="Sign-in",
            body="Use these details",
            payload={"login_id": "ada@acme.test", "temporary_password": "secret-pass"},
            href="",
            actor_user_id=self.ids["admin"],
        )
        self.assertEqual(result["notification"]["payload"]["temporary_password"], "secret-pass")
        campaign = get_campaign(self.conn, result["campaign_id"])
        self.assertEqual(campaign["payload"]["temporary_password"], "[redacted]")


if __name__ == "__main__":
    unittest.main()
