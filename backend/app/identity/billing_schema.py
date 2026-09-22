"""Subscription, seat, and organisation membership tables + legacy backfill."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from ..db import _pg_connect, _sqlite_connect, row_dict, row_get, uses_postgres

DEFAULT_ORG_NAME = "Test Organisation"
LEGACY_DEFAULT_ORG_NAME = "Existing Tradeal Organisation"
# Migrated single-tenant org before Tradeal rebrand (2026).
PRE_REBRAND_LEGACY_ORG_NAME = "Existing TradeOS Organisation"

# Legacy SaaS tiers — retired; only Tradeal Standard is offered.
DEFAULT_PLANS: list[dict[str, Any]] = []
LEGACY_PLAN_SLUGS = ("starter", "professional")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def org_code_for_id(org_id: int, *, is_test: bool = False) -> str:
    """Live orgs: ORG-00042. Test orgs: T-ORG-00042 (same id padding, distinct prefix)."""
    prefix = "T-ORG" if is_test else "ORG"
    return f"{prefix}-{int(org_id):05d}"


SEAT_TYPE_CODES: dict[str, str] = {
    "organisation_admin": "AD",
    "operator": "OP",
    "view_only": "VR",
}


def seat_type_code(seat_type: str) -> str:
    return SEAT_TYPE_CODES.get(seat_type, "OP")


def format_seat_label(
    org_id: int,
    seat_type: str,
    sequence: int,
    *,
    is_test: bool = False,
) -> str:
    """Human-readable seat key: ORG-00001-ST-OP-0001 (or T-ORG-… for test)."""
    return f"{org_code_for_id(org_id, is_test=is_test)}-ST-{seat_type_code(seat_type)}-{sequence:04d}"


def _table_columns_sqlite(conn, table: str) -> set[str]:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return {r[1] for r in rows}


def init_billing_schema() -> None:
    if uses_postgres():
        _init_billing_pg()
    else:
        _init_billing_sqlite()


def _create_core_tables_pg(conn) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS subscription_plans (
            id SERIAL PRIMARY KEY,
            slug TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            monthly_price_cents INTEGER NOT NULL DEFAULT 0,
            annual_price_cents INTEGER NOT NULL DEFAULT 0,
            included_seats INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'inactive')),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS subscriptions (
            id SERIAL PRIMARY KEY,
            organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
            plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
            billing_cycle TEXT NOT NULL DEFAULT 'annual'
                CHECK (billing_cycle IN ('monthly', 'annual')),
            status TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('trial', 'active', 'past_due', 'cancelled', 'expired')),
            start_date TEXT NOT NULL,
            renewal_date TEXT NOT NULL,
            included_seats INTEGER NOT NULL DEFAULT 1,
            purchased_additional_seats INTEGER NOT NULL DEFAULT 0,
            payment_status TEXT NOT NULL DEFAULT 'none',
            external_customer_id TEXT NOT NULL DEFAULT '',
            external_subscription_id TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(organisation_id)
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS organisation_seats (
            id SERIAL PRIMARY KEY,
            organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
            subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
            source TEXT NOT NULL DEFAULT 'included'
                CHECK (source IN ('included', 'purchased')),
            status TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'deactivated')),
            seat_label TEXT NOT NULL DEFAULT '',
            seat_type TEXT NOT NULL DEFAULT 'operator'
                CHECK (seat_type IN ('organisation_admin', 'operator', 'view_only')),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        "ALTER TABLE organisation_seats ADD COLUMN IF NOT EXISTS seat_type TEXT NOT NULL DEFAULT 'operator'"
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS organisation_members (
            id SERIAL PRIMARY KEY,
            organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role_id INTEGER NOT NULL REFERENCES roles(id),
            seat_id INTEGER REFERENCES organisation_seats(id),
            status TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'deactivated')),
            joined_at TEXT NOT NULL,
            deactivated_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE (organisation_id, user_id)
        )
        """
    )
    conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT ''")
    conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT ''")
    conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences TEXT NOT NULL DEFAULT '{}'")
    conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TEXT")
    conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_at TEXT")
    for name, ddl in [
        ("org_code", "TEXT"),
        ("legal_name", "TEXT NOT NULL DEFAULT ''"),
        ("gstin", "TEXT NOT NULL DEFAULT ''"),
        ("pan", "TEXT NOT NULL DEFAULT ''"),
        ("business_address", "TEXT NOT NULL DEFAULT ''"),
        ("city", "TEXT NOT NULL DEFAULT ''"),
        ("state", "TEXT NOT NULL DEFAULT ''"),
        ("country", "TEXT NOT NULL DEFAULT ''"),
        ("pincode", "TEXT NOT NULL DEFAULT ''"),
        ("primary_contact_name", "TEXT NOT NULL DEFAULT ''"),
        ("primary_contact_email", "TEXT NOT NULL DEFAULT ''"),
        ("primary_contact_mobile", "TEXT NOT NULL DEFAULT ''"),
    ]:
        conn.execute(f"ALTER TABLE organisations ADD COLUMN IF NOT EXISTS {name} {ddl}")
    conn.execute("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS additional_seat_monthly_price_cents INTEGER NOT NULL DEFAULT 0")
    conn.execute("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS additional_seat_annual_price_cents INTEGER NOT NULL DEFAULT 0")
    _create_seat_requests_table_pg(conn)


def _create_seat_requests_table_pg(conn) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS seat_requests (
            id SERIAL PRIMARY KEY,
            organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
            subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
            requested_seats INTEGER NOT NULL DEFAULT 1,
            amount_cents INTEGER NOT NULL DEFAULT 0,
            billing_cycle TEXT NOT NULL DEFAULT 'annual',
            plan_name TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'pending_payment'
                CHECK (status IN ('pending_payment', 'paid', 'approved', 'rejected', 'cancelled')),
            payment_reference TEXT NOT NULL DEFAULT '',
            request_note TEXT NOT NULL DEFAULT '',
            admin_note TEXT NOT NULL DEFAULT '',
            requested_by_user_id INTEGER REFERENCES users(id),
            reviewed_by_user_id INTEGER REFERENCES users(id),
            paid_at TEXT,
            approved_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_seat_requests_org ON seat_requests(organisation_id)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_seat_requests_status ON seat_requests(status)"
    )
    conn.execute(
        "ALTER TABLE seat_requests ADD COLUMN IF NOT EXISTS seat_type TEXT NOT NULL DEFAULT 'operator'"
    )


def _create_core_tables_sqlite(conn) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS subscription_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            monthly_price_cents INTEGER NOT NULL DEFAULT 0,
            annual_price_cents INTEGER NOT NULL DEFAULT 0,
            included_seats INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'inactive')),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
            plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
            billing_cycle TEXT NOT NULL DEFAULT 'annual'
                CHECK (billing_cycle IN ('monthly', 'annual')),
            status TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('trial', 'active', 'past_due', 'cancelled', 'expired')),
            start_date TEXT NOT NULL,
            renewal_date TEXT NOT NULL,
            included_seats INTEGER NOT NULL DEFAULT 1,
            purchased_additional_seats INTEGER NOT NULL DEFAULT 0,
            payment_status TEXT NOT NULL DEFAULT 'none',
            external_customer_id TEXT NOT NULL DEFAULT '',
            external_subscription_id TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS organisation_seats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
            subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
            source TEXT NOT NULL DEFAULT 'included'
                CHECK (source IN ('included', 'purchased')),
            status TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'deactivated')),
            seat_label TEXT NOT NULL DEFAULT '',
            seat_type TEXT NOT NULL DEFAULT 'operator'
                CHECK (seat_type IN ('organisation_admin', 'operator', 'view_only')),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    try:
        conn.execute(
            "ALTER TABLE organisation_seats ADD COLUMN seat_type TEXT NOT NULL DEFAULT 'operator'"
        )
    except Exception:
        pass
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS organisation_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role_id INTEGER NOT NULL REFERENCES roles(id),
            seat_id INTEGER REFERENCES organisation_seats(id),
            status TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'deactivated')),
            joined_at TEXT NOT NULL,
            deactivated_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE (organisation_id, user_id)
        )
        """
    )
    cols = _table_columns_sqlite(conn, "users")
    if "phone" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT ''")
    if "location" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN location TEXT NOT NULL DEFAULT ''")
    if "preferences" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN preferences TEXT NOT NULL DEFAULT '{}'")
    if "last_login_at" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN last_login_at TEXT")
    if "last_activity_at" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN last_activity_at TEXT")
    org_cols = _table_columns_sqlite(conn, "organisations")
    for name, ddl in [
        ("org_code", "TEXT"),
        ("legal_name", "TEXT NOT NULL DEFAULT ''"),
        ("gstin", "TEXT NOT NULL DEFAULT ''"),
        ("pan", "TEXT NOT NULL DEFAULT ''"),
        ("business_address", "TEXT NOT NULL DEFAULT ''"),
        ("city", "TEXT NOT NULL DEFAULT ''"),
        ("state", "TEXT NOT NULL DEFAULT ''"),
        ("country", "TEXT NOT NULL DEFAULT ''"),
        ("pincode", "TEXT NOT NULL DEFAULT ''"),
        ("primary_contact_name", "TEXT NOT NULL DEFAULT ''"),
        ("primary_contact_email", "TEXT NOT NULL DEFAULT ''"),
        ("primary_contact_mobile", "TEXT NOT NULL DEFAULT ''"),
    ]:
        if name not in org_cols:
            conn.execute(f"ALTER TABLE organisations ADD COLUMN {name} {ddl}")
    plan_cols = _table_columns_sqlite(conn, "subscription_plans")
    for name, ddl in [
        ("additional_seat_monthly_price_cents", "INTEGER NOT NULL DEFAULT 0"),
        ("additional_seat_annual_price_cents", "INTEGER NOT NULL DEFAULT 0"),
    ]:
        if name not in plan_cols:
            conn.execute(f"ALTER TABLE subscription_plans ADD COLUMN {name} {ddl}")
    _create_seat_requests_table_sqlite(conn)


def _create_seat_requests_table_sqlite(conn) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS seat_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
            subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
            requested_seats INTEGER NOT NULL DEFAULT 1,
            amount_cents INTEGER NOT NULL DEFAULT 0,
            billing_cycle TEXT NOT NULL DEFAULT 'annual',
            plan_name TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'pending_payment'
                CHECK (status IN ('pending_payment', 'paid', 'approved', 'rejected', 'cancelled')),
            payment_reference TEXT NOT NULL DEFAULT '',
            request_note TEXT NOT NULL DEFAULT '',
            admin_note TEXT NOT NULL DEFAULT '',
            requested_by_user_id INTEGER REFERENCES users(id),
            reviewed_by_user_id INTEGER REFERENCES users(id),
            paid_at TEXT,
            approved_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_seat_requests_org ON seat_requests(organisation_id)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_seat_requests_status ON seat_requests(status)"
    )
    try:
        conn.execute(
            "ALTER TABLE seat_requests ADD COLUMN seat_type TEXT NOT NULL DEFAULT 'operator'"
        )
    except Exception:
        pass


def _backfill_seat_labels(conn) -> None:
    """Canonical labels for all seats (legacy ORG-*-SEAT-* → ORG-*-ST-{AD|OP|VR}-*)."""
    if uses_postgres():
        org_rows = conn.execute("SELECT id, is_test FROM organisations").fetchall()
        rows = conn.execute(
            """
            SELECT id, organisation_id, seat_type, seat_label
            FROM organisation_seats
            ORDER BY organisation_id, seat_type, id
            """
        ).fetchall()
    else:
        org_rows = conn.execute("SELECT id, is_test FROM organisations").fetchall()
        rows = conn.execute(
            """
            SELECT id, organisation_id, seat_type, seat_label
            FROM organisation_seats
            ORDER BY organisation_id, seat_type, id
            """
        ).fetchall()
    org_is_test = {int(row_dict(r)["id"]): bool(row_dict(r).get("is_test")) for r in org_rows}
    counters: dict[tuple[int, str], int] = {}
    for row in rows:
        r = row_dict(row)
        org_id = int(r["organisation_id"])
        seat_id = int(r["id"])
        st = (r.get("seat_type") or "operator").strip()
        if st not in SEAT_TYPE_CODES:
            st = "operator"
        key = (org_id, st)
        counters[key] = counters.get(key, 0) + 1
        label = format_seat_label(org_id, st, counters[key], is_test=org_is_test.get(org_id, False))
        current = (r.get("seat_label") or "").strip()
        if current == label:
            continue
        if uses_postgres():
            conn.execute(
                "UPDATE organisation_seats SET seat_label = %s WHERE id = %s",
                (label, seat_id),
            )
        else:
            conn.execute(
                "UPDATE organisation_seats SET seat_label = ? WHERE id = ?",
                (label, seat_id),
            )


def _backfill_seat_types(conn) -> None:
    """First included seat per org → organisation_admin; others keep/default operator."""
    if uses_postgres():
        rows = conn.execute(
            """
            SELECT id, organisation_id, source
            FROM organisation_seats
            WHERE status = 'active'
            ORDER BY organisation_id, id
            """
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT id, organisation_id, source
            FROM organisation_seats
            WHERE status = 'active'
            ORDER BY organisation_id, id
            """
        ).fetchall()
    seen_admin: set[int] = set()
    for row in rows:
        r = row_dict(row)
        org_id = int(r["organisation_id"])
        seat_id = int(r["id"])
        if org_id not in seen_admin and r.get("source") == "included":
            st = "organisation_admin"
            seen_admin.add(org_id)
        else:
            continue
        if uses_postgres():
            conn.execute(
                "UPDATE organisation_seats SET seat_type = %s WHERE id = %s",
                (st, seat_id),
            )
        else:
            conn.execute(
                "UPDATE organisation_seats SET seat_type = ? WHERE id = ?",
                (st, seat_id),
            )


def _seed_plans(conn, execute: Callable, fetchone: Callable, commit: Callable) -> None:
    now = _now()
    # Retire Starter / Professional — Tradeal Standard is seeded in licence_schema.
    placeholders = ",".join(["%s"] * len(LEGACY_PLAN_SLUGS)) if uses_postgres() else ",".join("?" for _ in LEGACY_PLAN_SLUGS)
    ts_ph = "%s" if uses_postgres() else "?"
    execute(
        f"""
        UPDATE subscription_plans
        SET status = 'inactive', updated_at = {ts_ph}
        WHERE slug IN ({placeholders}) AND status <> 'inactive'
        """,
        (now, *LEGACY_PLAN_SLUGS),
    )
    for plan in DEFAULT_PLANS:
        if uses_postgres():
            execute(
                """
                INSERT INTO subscription_plans
                (slug, name, description, monthly_price_cents, annual_price_cents, included_seats,
                 additional_seat_monthly_price_cents, additional_seat_annual_price_cents,
                 status, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'active', %s, %s)
                ON CONFLICT (slug) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    monthly_price_cents = EXCLUDED.monthly_price_cents,
                    annual_price_cents = EXCLUDED.annual_price_cents,
                    included_seats = EXCLUDED.included_seats,
                    additional_seat_monthly_price_cents = EXCLUDED.additional_seat_monthly_price_cents,
                    additional_seat_annual_price_cents = EXCLUDED.additional_seat_annual_price_cents,
                    updated_at = EXCLUDED.updated_at
                """,
                (
                    plan["slug"],
                    plan["name"],
                    plan["description"],
                    plan["monthly_price_cents"],
                    plan["annual_price_cents"],
                    plan["included_seats"],
                    plan.get("additional_seat_monthly_price_cents", 0),
                    plan.get("additional_seat_annual_price_cents", 0),
                    now,
                    now,
                ),
            )
        else:
            execute(
                """
                INSERT INTO subscription_plans
                (slug, name, description, monthly_price_cents, annual_price_cents, included_seats,
                 additional_seat_monthly_price_cents, additional_seat_annual_price_cents,
                 status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
                ON CONFLICT(slug) DO UPDATE SET
                    name = excluded.name,
                    description = excluded.description,
                    monthly_price_cents = excluded.monthly_price_cents,
                    annual_price_cents = excluded.annual_price_cents,
                    included_seats = excluded.included_seats,
                    additional_seat_monthly_price_cents = excluded.additional_seat_monthly_price_cents,
                    additional_seat_annual_price_cents = excluded.additional_seat_annual_price_cents,
                    updated_at = excluded.updated_at
                """,
                (
                    plan["slug"],
                    plan["name"],
                    plan["description"],
                    plan["monthly_price_cents"],
                    plan["annual_price_cents"],
                    plan["included_seats"],
                    plan.get("additional_seat_monthly_price_cents", 0),
                    plan.get("additional_seat_annual_price_cents", 0),
                    now,
                    now,
                ),
            )
    commit()


def _backfill_org_codes(conn, execute: Callable, fetchall: Callable, commit: Callable) -> None:
    rows = fetchall("SELECT id, org_code, is_test FROM organisations ORDER BY id")
    for row in rows:
        r = row_dict(row)
        org_id = int(r["id"])
        code = (r.get("org_code") or "").strip()
        if code:
            continue
        new_code = org_code_for_id(org_id, is_test=bool(r.get("is_test")))
        if uses_postgres():
            execute("UPDATE organisations SET org_code = %s WHERE id = %s", (new_code, org_id))
        else:
            execute("UPDATE organisations SET org_code = ? WHERE id = ?", (new_code, org_id))
    commit()


def _migrate_test_org_code_prefix(conn, execute: Callable, fetchall: Callable, commit: Callable) -> None:
    """Retarget test orgs from ORG-##### to T-ORG-##### (and matching seat labels)."""
    rows = fetchall("SELECT id, org_code, is_test FROM organisations ORDER BY id")
    for row in rows:
        r = row_dict(row)
        org_id = int(r["id"])
        is_test = bool(r.get("is_test"))
        old_code = (r.get("org_code") or "").strip()
        new_code = org_code_for_id(org_id, is_test=is_test)
        if not old_code or old_code == new_code:
            continue
        # Only rewrite canonical ORG-/T-ORG- codes for this id
        expected_live = org_code_for_id(org_id, is_test=False)
        expected_test = org_code_for_id(org_id, is_test=True)
        if old_code not in (expected_live, expected_test):
            continue
        if uses_postgres():
            execute("UPDATE organisations SET org_code = %s WHERE id = %s", (new_code, org_id))
            execute(
                """
                UPDATE organisation_seats
                SET seat_label = %s || substr(seat_label, %s)
                WHERE organisation_id = %s AND seat_label LIKE %s
                """,
                (new_code, len(old_code) + 1, org_id, old_code + "%"),
            )
        else:
            execute("UPDATE organisations SET org_code = ? WHERE id = ?", (new_code, org_id))
            execute(
                """
                UPDATE organisation_seats
                SET seat_label = ? || substr(seat_label, ?)
                WHERE organisation_id = ? AND seat_label LIKE ?
                """,
                (new_code, len(old_code) + 1, org_id, old_code + "%"),
            )
    commit()


def _default_plan_id(fetchone: Callable) -> int:
    if uses_postgres():
        row = fetchone(
            "SELECT id FROM subscription_plans WHERE slug = %s ORDER BY id LIMIT 1",
            ("professional",),
        )
    else:
        row = fetchone(
            "SELECT id FROM subscription_plans WHERE slug = ? ORDER BY id LIMIT 1",
            ("professional",),
        )
    if not row:
        if uses_postgres():
            row = fetchone("SELECT id FROM subscription_plans ORDER BY id LIMIT 1", ())
        else:
            row = fetchone("SELECT id FROM subscription_plans ORDER BY id LIMIT 1", ())
    return int(row_get(row, "id"))


def _ensure_subscription_for_org(
    conn,
    execute: Callable,
    fetchone: Callable,
    org_id: int,
    plan_id: int | None = None,
) -> int:
    if uses_postgres():
        existing = fetchone(
            """
            SELECT id FROM subscriptions
            WHERE organisation_id = %s AND status IN ('trial', 'active', 'past_due')
            ORDER BY id DESC LIMIT 1
            """,
            (org_id,),
        )
    else:
        existing = fetchone(
            """
            SELECT id FROM subscriptions
            WHERE organisation_id = ? AND status IN ('trial', 'active', 'past_due')
            ORDER BY id DESC LIMIT 1
            """,
            (org_id,),
        )
    if existing:
        return int(row_get(existing, "id"))

    pid = plan_id or _default_plan_id(fetchone)
    if uses_postgres():
        plan = fetchone("SELECT included_seats FROM subscription_plans WHERE id = %s", (pid,))
    else:
        plan = fetchone("SELECT included_seats FROM subscription_plans WHERE id = ?", (pid,))
    included = int(row_get(plan, "included_seats") or 0)
    now = _now()
    start = now
    renewal = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
    if uses_postgres():
        row = fetchone(
            """
            INSERT INTO subscriptions
            (organisation_id, plan_id, billing_cycle, status, start_date, renewal_date,
             included_seats, purchased_additional_seats, payment_status, created_at, updated_at)
            VALUES (%s, %s, 'annual', 'active', %s, %s, %s, 0, 'none', %s, %s)
            RETURNING id
            """,
            (org_id, pid, start, renewal, included, now, now),
        )
        sub_id = int(row["id"])
    else:
        cur = execute(
            """
            INSERT INTO subscriptions
            (organisation_id, plan_id, billing_cycle, status, start_date, renewal_date,
             included_seats, purchased_additional_seats, payment_status, created_at, updated_at)
            VALUES (?, ?, 'annual', 'active', ?, ?, ?, 0, 'none', ?, ?)
            """,
            (org_id, pid, start, renewal, included, now, now),
        )
        sub_id = int(cur.lastrowid)

    from .billing_repository import sync_seat_entitlements

    sync_seat_entitlements(conn, org_id, sub_id)
    return sub_id


def _backfill_memberships(conn, execute: Callable, fetchone: Callable, fetchall: Callable, commit: Callable) -> None:
    from .billing_repository import assign_available_seat, ensure_minimum_seats, sync_seat_entitlements

    q = """
        SELECT u.id AS user_id, u.organisation_id, u.role_id, u.status, u.name, u.email, u.phone,
               r.slug AS role_slug, o.name AS org_name
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN organisations o ON o.id = u.organisation_id
        WHERE u.organisation_id IS NOT NULL AND r.scope = 'organisation'
    """
    rows = fetchall(q)
    now = _now()

    # Legacy orgs may have more users than default plan seats — expand entitlements once.
    org_active_counts: dict[int, int] = {}
    for row in rows:
        r = row_dict(row)
        if r["status"] != "active":
            continue
        oid = int(r["organisation_id"])
        org_active_counts[oid] = org_active_counts.get(oid, 0) + 1
    for oid, count in org_active_counts.items():
        sub_id = _ensure_subscription_for_org(conn, execute, fetchone, oid)
        sync_seat_entitlements(conn, oid, sub_id)
        ensure_minimum_seats(conn, oid, count)

    for row in rows:
        r = row_dict(row)
        org_id = int(r["organisation_id"])
        user_id = int(r["user_id"])
        role_id = int(r["role_id"])
        sub_id = _ensure_subscription_for_org(conn, execute, fetchone, org_id)

        if uses_postgres():
            member = fetchone(
                "SELECT id, status, seat_id FROM organisation_members WHERE organisation_id = %s AND user_id = %s",
                (org_id, user_id),
            )
        else:
            member = fetchone(
                "SELECT id, status, seat_id FROM organisation_members WHERE organisation_id = ? AND user_id = ?",
                (org_id, user_id),
            )

        member_status = "active" if r["status"] == "active" else "deactivated"
        if not member:
            if uses_postgres():
                mrow = fetchone(
                    """
                    INSERT INTO organisation_members
                    (organisation_id, user_id, role_id, seat_id, status, joined_at, deactivated_at, created_at, updated_at)
                    VALUES (%s, %s, %s, NULL, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        org_id,
                        user_id,
                        role_id,
                        member_status,
                        now,
                        None if member_status == "active" else now,
                        now,
                        now,
                    ),
                )
                member_id = int(mrow["id"])
            else:
                cur = execute(
                    """
                    INSERT INTO organisation_members
                    (organisation_id, user_id, role_id, seat_id, status, joined_at, deactivated_at, created_at, updated_at)
                    VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)
                    """,
                    (
                        org_id,
                        user_id,
                        role_id,
                        member_status,
                        now,
                        None if member_status == "active" else now,
                        now,
                        now,
                    ),
                )
                member_id = int(cur.lastrowid)
        else:
            member_id = int(row_get(member, "id"))

        sync_seat_entitlements(conn, org_id, sub_id)

        if member_status == "active":
            if uses_postgres():
                seat_row = fetchone(
                    "SELECT seat_id FROM organisation_members WHERE id = %s",
                    (member_id,),
                )
            else:
                seat_row = fetchone(
                    "SELECT seat_id FROM organisation_members WHERE id = ?",
                    (member_id,),
                )
            if not seat_row or not row_get(seat_row, "seat_id"):
                assign_available_seat(conn, org_id, member_id)

    commit()


def _dedupe_test_organisations(conn) -> None:
    from .billing_repository import dedupe_test_organisations

    dedupe_test_organisations(conn)
    conn.commit()


def _init_billing_pg() -> None:
    with _pg_connect() as conn:
        _create_core_tables_pg(conn)
        conn.commit()

        def execute(q, p=()):
            return conn.execute(q, p)

        def fetchone(q, p=()):
            return conn.execute(q, p).fetchone()

        def fetchall(q, p=()):
            return conn.execute(q, p).fetchall()

        _seed_plans(conn, execute, fetchone, conn.commit)
        _backfill_org_codes(conn, execute, fetchall, conn.commit)
        _migrate_test_org_code_prefix(conn, execute, fetchall, conn.commit)
        _backfill_memberships(conn, execute, fetchone, fetchall, conn.commit)
        _dedupe_test_organisations(conn)
        _backfill_seat_types(conn)
        _backfill_seat_labels(conn)
        from .licence_schema import init_licence_schema

        init_licence_schema(conn)
        conn.commit()


def _init_billing_sqlite() -> None:
    with _sqlite_connect() as conn:
        _create_core_tables_sqlite(conn)
        conn.commit()

        def execute(q, p=()):
            return conn.execute(q, p)

        def fetchone(q, p=()):
            return conn.execute(q, p).fetchone()

        def fetchall(q, p=()):
            return conn.execute(q, p).fetchall()

        _seed_plans(conn, execute, fetchone, conn.commit)
        _backfill_org_codes(conn, execute, fetchall, conn.commit)
        _migrate_test_org_code_prefix(conn, execute, fetchall, conn.commit)
        _backfill_memberships(conn, execute, fetchone, fetchall, conn.commit)
        _dedupe_test_organisations(conn)
        _backfill_seat_types(conn)
        _backfill_seat_labels(conn)
        from .licence_schema import init_licence_schema

        init_licence_schema(conn)
        conn.commit()
