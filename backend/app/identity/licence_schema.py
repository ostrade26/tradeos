"""Perpetual licence, AMC, and payment tables — extend existing billing schema."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from ..db import row_dict, row_get, uses_postgres

# Initial Tradeal Standard defaults (paise). Editable from Platform Admin after seed.
STANDARD_PLAN: dict[str, Any] = {
    "slug": "tradeal-standard",
    "name": "Tradeal Standard",
    "description": "Perpetual licence with first-year AMC included. Additional seats licensed separately.",
    "licence_type": "perpetual",
    "licence_price_cents": 1_100_000,
    "included_seats": 2,
    "included_admin_seats": 1,
    "included_operator_seats": 1,
    "additional_seat_licence_cents": 250_000,
    "amc_price_cents": 500_000,
    "additional_seat_amc_cents": 100_000,
    "amc_duration_months": 12,
    "amc_grace_days": 30,
    "monthly_price_cents": 0,
    "annual_price_cents": 0,
    "additional_seat_monthly_price_cents": 0,
    "additional_seat_annual_price_cents": 100_000,
}


PLAN_LICENCE_COLUMNS: list[tuple[str, str]] = [
    ("licence_type", "TEXT NOT NULL DEFAULT 'perpetual'"),
    ("licence_price_cents", "INTEGER NOT NULL DEFAULT 0"),
    ("included_admin_seats", "INTEGER NOT NULL DEFAULT 1"),
    ("included_operator_seats", "INTEGER NOT NULL DEFAULT 1"),
    ("additional_seat_licence_cents", "INTEGER NOT NULL DEFAULT 0"),
    ("amc_price_cents", "INTEGER NOT NULL DEFAULT 0"),
    ("additional_seat_amc_cents", "INTEGER NOT NULL DEFAULT 0"),
    ("amc_duration_months", "INTEGER NOT NULL DEFAULT 12"),
    ("amc_grace_days", "INTEGER NOT NULL DEFAULT 30"),
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_licence_schema(conn) -> None:
    _ensure_plan_columns(conn)
    _create_tables(conn)
    _seed_standard_plan(conn)
    _backfill_licenses_from_subscriptions(conn)
    conn.commit()


def _ensure_plan_columns(conn) -> None:
    if uses_postgres():
        for name, ddl in PLAN_LICENCE_COLUMNS:
            conn.execute(f"ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS {name} {ddl}")
        return
    existing = {r[1] for r in conn.execute("PRAGMA table_info(subscription_plans)").fetchall()}
    for name, ddl in PLAN_LICENCE_COLUMNS:
        if name not in existing:
            conn.execute(f"ALTER TABLE subscription_plans ADD COLUMN {name} {ddl}")


def _create_tables(conn) -> None:
    pk = "SERIAL PRIMARY KEY" if uses_postgres() else "INTEGER PRIMARY KEY AUTOINCREMENT"
    conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS organisation_licenses (
            id {pk},
            organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
            plan_id INTEGER REFERENCES subscription_plans(id),
            licence_number TEXT NOT NULL UNIQUE,
            plan_name TEXT NOT NULL DEFAULT '',
            licence_type TEXT NOT NULL DEFAULT 'perpetual',
            licence_price_cents INTEGER NOT NULL DEFAULT 0,
            purchase_date TEXT NOT NULL,
            activation_date TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            included_seats INTEGER NOT NULL DEFAULT 2,
            included_admin_seats INTEGER NOT NULL DEFAULT 1,
            included_operator_seats INTEGER NOT NULL DEFAULT 1,
            purchased_additional_seats INTEGER NOT NULL DEFAULT 0,
            additional_seat_licence_cents INTEGER NOT NULL DEFAULT 0,
            additional_seat_amc_cents INTEGER NOT NULL DEFAULT 0,
            amc_price_cents INTEGER NOT NULL DEFAULT 0,
            amc_duration_months INTEGER NOT NULL DEFAULT 12,
            amc_grace_days INTEGER NOT NULL DEFAULT 30,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_org_licenses_org ON organisation_licenses(organisation_id)"
    )
    conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS organisation_amcs (
            id {pk},
            organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
            licence_id INTEGER NOT NULL REFERENCES organisation_licenses(id) ON DELETE CASCADE,
            amc_price_cents INTEGER NOT NULL DEFAULT 0,
            included INTEGER NOT NULL DEFAULT 0,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            grace_until TEXT,
            renewal_date TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            payment_status TEXT NOT NULL DEFAULT 'none',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_org_amcs_licence ON organisation_amcs(licence_id)"
    )
    conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS organisation_payments (
            id {pk},
            organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
            licence_id INTEGER REFERENCES organisation_licenses(id),
            amc_id INTEGER REFERENCES organisation_amcs(id),
            payment_type TEXT NOT NULL DEFAULT 'other',
            amount_cents INTEGER NOT NULL DEFAULT 0,
            payment_date TEXT NOT NULL,
            payment_reference TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'pending',
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_org_payments_org ON organisation_payments(organisation_id)"
    )


def _seed_standard_plan(conn) -> None:
    now = _now()
    p = STANDARD_PLAN
    if uses_postgres():
        conn.execute(
            """
            INSERT INTO subscription_plans
            (slug, name, description, monthly_price_cents, annual_price_cents, included_seats,
             additional_seat_monthly_price_cents, additional_seat_annual_price_cents,
             licence_type, licence_price_cents, included_admin_seats, included_operator_seats,
             additional_seat_licence_cents, amc_price_cents, additional_seat_amc_cents,
             amc_duration_months, amc_grace_days, status, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'active', %s, %s)
            ON CONFLICT (slug) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                licence_type = EXCLUDED.licence_type,
                included_seats = CASE
                    WHEN subscription_plans.licence_price_cents = 0 THEN EXCLUDED.included_seats
                    ELSE subscription_plans.included_seats END,
                included_admin_seats = CASE
                    WHEN subscription_plans.licence_price_cents = 0 THEN EXCLUDED.included_admin_seats
                    ELSE subscription_plans.included_admin_seats END,
                included_operator_seats = CASE
                    WHEN subscription_plans.licence_price_cents = 0 THEN EXCLUDED.included_operator_seats
                    ELSE subscription_plans.included_operator_seats END,
                licence_price_cents = CASE
                    WHEN subscription_plans.licence_price_cents = 0 THEN EXCLUDED.licence_price_cents
                    ELSE subscription_plans.licence_price_cents END,
                additional_seat_licence_cents = CASE
                    WHEN subscription_plans.additional_seat_licence_cents = 0 THEN EXCLUDED.additional_seat_licence_cents
                    ELSE subscription_plans.additional_seat_licence_cents END,
                amc_price_cents = CASE
                    WHEN subscription_plans.amc_price_cents = 0 THEN EXCLUDED.amc_price_cents
                    ELSE subscription_plans.amc_price_cents END,
                additional_seat_amc_cents = CASE
                    WHEN subscription_plans.additional_seat_amc_cents = 0 THEN EXCLUDED.additional_seat_amc_cents
                    ELSE subscription_plans.additional_seat_amc_cents END,
                amc_duration_months = EXCLUDED.amc_duration_months,
                amc_grace_days = CASE
                    WHEN subscription_plans.amc_grace_days = 30 AND EXCLUDED.amc_grace_days = 30
                    THEN subscription_plans.amc_grace_days ELSE subscription_plans.amc_grace_days END,
                additional_seat_annual_price_cents = EXCLUDED.additional_seat_annual_price_cents,
                updated_at = EXCLUDED.updated_at
            """,
            (
                p["slug"], p["name"], p["description"],
                p["monthly_price_cents"], p["annual_price_cents"], p["included_seats"],
                p["additional_seat_monthly_price_cents"], p["additional_seat_annual_price_cents"],
                p["licence_type"], p["licence_price_cents"], p["included_admin_seats"],
                p["included_operator_seats"], p["additional_seat_licence_cents"],
                p["amc_price_cents"], p["additional_seat_amc_cents"],
                p["amc_duration_months"], p["amc_grace_days"], now, now,
            ),
        )
        return

    conn.execute(
        """
        INSERT INTO subscription_plans
        (slug, name, description, monthly_price_cents, annual_price_cents, included_seats,
         additional_seat_monthly_price_cents, additional_seat_annual_price_cents,
         licence_type, licence_price_cents, included_admin_seats, included_operator_seats,
         additional_seat_licence_cents, amc_price_cents, additional_seat_amc_cents,
         amc_duration_months, amc_grace_days, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
        ON CONFLICT(slug) DO UPDATE SET
            name = excluded.name,
            description = excluded.description,
            updated_at = excluded.updated_at
        """,
        (
            p["slug"], p["name"], p["description"],
            p["monthly_price_cents"], p["annual_price_cents"], p["included_seats"],
            p["additional_seat_monthly_price_cents"], p["additional_seat_annual_price_cents"],
            p["licence_type"], p["licence_price_cents"], p["included_admin_seats"],
            p["included_operator_seats"], p["additional_seat_licence_cents"],
            p["amc_price_cents"], p["additional_seat_amc_cents"],
            p["amc_duration_months"], p["amc_grace_days"], now, now,
        ),
    )
    row = conn.execute(
        "SELECT licence_price_cents FROM subscription_plans WHERE slug = ?",
        (p["slug"],),
    ).fetchone()
    if row and int(row_get(row, "licence_price_cents") or 0) == 0:
        conn.execute(
            """
            UPDATE subscription_plans SET
                licence_type = ?, licence_price_cents = ?, included_seats = ?,
                included_admin_seats = ?, included_operator_seats = ?,
                additional_seat_licence_cents = ?, amc_price_cents = ?,
                additional_seat_amc_cents = ?, amc_duration_months = ?, amc_grace_days = ?,
                additional_seat_annual_price_cents = ?, updated_at = ?
            WHERE slug = ?
            """,
            (
                p["licence_type"], p["licence_price_cents"], p["included_seats"],
                p["included_admin_seats"], p["included_operator_seats"],
                p["additional_seat_licence_cents"], p["amc_price_cents"],
                p["additional_seat_amc_cents"], p["amc_duration_months"], p["amc_grace_days"],
                p["additional_seat_annual_price_cents"], now, p["slug"],
            ),
        )


def _backfill_licenses_from_subscriptions(conn) -> None:
    """Create a licence snapshot for orgs that already have a subscription but no licence."""
    from .licence_repository import issue_licence_for_organisation

    if uses_postgres():
        orgs = conn.execute(
            """
            SELECT s.organisation_id, s.plan_id, s.included_seats, s.purchased_additional_seats, s.start_date
            FROM subscriptions s
            WHERE s.status IN ('trial', 'active', 'past_due')
              AND NOT EXISTS (
                SELECT 1 FROM organisation_licenses l WHERE l.organisation_id = s.organisation_id
              )
            """
        ).fetchall()
    else:
        orgs = conn.execute(
            """
            SELECT s.organisation_id, s.plan_id, s.included_seats, s.purchased_additional_seats, s.start_date
            FROM subscriptions s
            WHERE s.status IN ('trial', 'active', 'past_due')
              AND NOT EXISTS (
                SELECT 1 FROM organisation_licenses l WHERE l.organisation_id = s.organisation_id
              )
            """
        ).fetchall()
    for row in orgs:
        r = row_dict(row)
        issue_licence_for_organisation(
            conn,
            organisation_id=int(r["organisation_id"]),
            plan_id=int(r["plan_id"]) if r.get("plan_id") else None,
            purchase_date=r.get("start_date") or _now(),
            purchased_additional_seats=int(r.get("purchased_additional_seats") or 0),
            actor_user_id=None,
            activate=True,
        )
