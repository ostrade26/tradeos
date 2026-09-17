"""Subscriptions, seats, and organisation membership operations."""

from __future__ import annotations

import json
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException

from ..db import _pg_connect, _sqlite_connect, row_dict, row_get, uses_postgres
from .billing_schema import format_seat_label, org_code_for_id
from .email_validation import optional_contact_email
from .login_username import require_login_username
from .security import hash_password


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _mapping(row: Any) -> dict[str, Any]:
    return row_dict(row)


def normalize_login_email(email: str) -> str:
    return email.strip().lower()


def login_identity_in_use(
    conn,
    username: str,
    email: str,
    *,
    exclude_user_id: int | None = None,
) -> bool:
    """True if username or a non-empty email is already taken as a login identity."""
    keys: list[str] = []
    user_key = normalize_login_email(username)
    if user_key:
        keys.append(user_key)
    email_key = normalize_login_email(email)
    if email_key and email_key not in keys:
        keys.append(email_key)
    if not keys:
        return False
    extra = ""
    params: list[Any] = list(keys + keys)
    if exclude_user_id is not None:
        extra = " AND id <> %s" if uses_postgres() else " AND id <> ?"
        params.append(exclude_user_id)
    if uses_postgres():
        placeholders = ", ".join(["%s"] * len(keys))
        row = conn.execute(
            f"""
            SELECT 1 FROM users
            WHERE (
                lower(username) IN ({placeholders})
                OR (coalesce(email, '') <> '' AND lower(email) IN ({placeholders}))
            ){extra}
            LIMIT 1
            """,
            tuple(params),
        ).fetchone()
    else:
        placeholders = ", ".join(["?"] * len(keys))
        row = conn.execute(
            f"""
            SELECT 1 FROM users
            WHERE (
                lower(username) IN ({placeholders})
                OR (coalesce(email, '') <> '' AND lower(email) IN ({placeholders}))
            ){extra}
            LIMIT 1
            """,
            tuple(params),
        ).fetchone()
    return row is not None


def set_user_login_username(conn, user_id: int, username: str) -> str:
    """Set a user's sign-in username. Unchanged values (including legacy emails) are kept."""
    q = "SELECT username FROM users WHERE id = %s" if uses_postgres() else "SELECT username FROM users WHERE id = ?"
    row = conn.execute(q, (user_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    current = str(_mapping(row).get("username") or "")
    login = require_login_username(username, allow_existing=current)
    if login == current.strip().lower():
        return login
    if login_identity_in_use(conn, login, "", exclude_user_id=user_id):
        raise HTTPException(status_code=400, detail="That username is already in use")
    now = _now()
    if uses_postgres():
        conn.execute(
            "UPDATE users SET username = %s, updated_at = %s WHERE id = %s",
            (login, now, user_id),
        )
    else:
        conn.execute(
            "UPDATE users SET username = ?, updated_at = ? WHERE id = ?",
            (login, now, user_id),
        )
    return login


def default_org_user_password() -> str:
    import os

    configured = (
        os.environ.get("TRADEAL_DEFAULT_USER_PASSWORD")
        or os.environ.get("TRADEOS_DEFAULT_USER_PASSWORD")
        or ""
    ).strip()
    if configured:
        return configured
    return "Welcome2Tradeal!"


def username_from_email(email: str, fallback: str) -> str:
    """Login username is the full email; kept for legacy callers."""
    normalized = normalize_login_email(email)
    if normalized and "@" in normalized:
        return normalized
    return fallback


def ensure_minimum_seats(conn, organisation_id: int, minimum_active_members: int) -> None:
    """Legacy migration helper — grow entitlements to fit existing users."""
    sub = get_active_subscription(conn, organisation_id)
    if not sub:
        return
    sub_id = int(sub["id"])
    while True:
        summary = seat_summary(conn, organisation_id)
        if summary["total_entitled_seats"] >= minimum_active_members:
            break
        now = _now()
        new_purchased = int(sub["purchased_additional_seats"]) + 1
        if uses_postgres():
            conn.execute(
                "UPDATE subscriptions SET purchased_additional_seats = %s, updated_at = %s WHERE id = %s",
                (new_purchased, now, sub_id),
            )
        else:
            conn.execute(
                "UPDATE subscriptions SET purchased_additional_seats = ?, updated_at = ? WHERE id = ?",
                (new_purchased, now, sub_id),
            )
        sub["purchased_additional_seats"] = new_purchased
        sync_seat_entitlements(conn, organisation_id, sub_id)


PURCHASED_SEAT_TYPES = frozenset({"operator", "view_only"})


def _next_seat_sequence(conn, organisation_id: int, seat_type: str) -> int:
    """Next serial for this org and seat type (includes deactivated rows; labels are not reused)."""
    if uses_postgres():
        row = conn.execute(
            """
            SELECT COUNT(*) AS n FROM organisation_seats
            WHERE organisation_id = %s AND seat_type = %s
            """,
            (organisation_id, seat_type),
        ).fetchone()
    else:
        row = conn.execute(
            """
            SELECT COUNT(*) AS n FROM organisation_seats
            WHERE organisation_id = ? AND seat_type = ?
            """,
            (organisation_id, seat_type),
        ).fetchone()
    n = int(row_get(row, "n") or 0)
    return n + 1


def sync_seat_entitlements(
    conn,
    organisation_id: int,
    subscription_id: int,
    *,
    purchased_seat_type: str = "operator",
) -> None:
    """Ensure organisation_seats rows match subscription included + purchased totals."""
    if purchased_seat_type not in PURCHASED_SEAT_TYPES:
        purchased_seat_type = "operator"
    if uses_postgres():
        sub = conn.execute(
            """
            SELECT included_seats, purchased_additional_seats
            FROM subscriptions WHERE id = %s AND organisation_id = %s
            """,
            (subscription_id, organisation_id),
        ).fetchone()
    else:
        sub = conn.execute(
            """
            SELECT included_seats, purchased_additional_seats
            FROM subscriptions WHERE id = ? AND organisation_id = ?
            """,
            (subscription_id, organisation_id),
        ).fetchone()
    if not sub:
        return
    sub = _mapping(sub)
    included = int(sub["included_seats"])
    purchased = int(sub["purchased_additional_seats"])
    target = max(0, included + purchased)
    now = _now()

    if uses_postgres():
        rows = conn.execute(
            """
            SELECT id, source, status FROM organisation_seats
            WHERE organisation_id = %s AND subscription_id = %s AND status = 'active'
            ORDER BY id
            """,
            (organisation_id, subscription_id),
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT id, source, status FROM organisation_seats
            WHERE organisation_id = ? AND subscription_id = ? AND status = 'active'
            ORDER BY id
            """,
            (organisation_id, subscription_id),
        ).fetchall()

    active_count = len(rows)

    while active_count < target:
        source = "included" if active_count < included else "purchased"
        if source == "included" and active_count == 0:
            seat_type = "organisation_admin"
        elif source == "included":
            seat_type = "operator"
        else:
            seat_type = purchased_seat_type
        seq = _next_seat_sequence(conn, organisation_id, seat_type)
        label = format_seat_label(organisation_id, seat_type, seq)
        if uses_postgres():
            conn.execute(
                """
                INSERT INTO organisation_seats
                (organisation_id, subscription_id, source, status, seat_label, seat_type, created_at, updated_at)
                VALUES (%s, %s, %s, 'active', %s, %s, %s, %s)
                """,
                (organisation_id, subscription_id, source, label, seat_type, now, now),
            )
        else:
            conn.execute(
                """
                INSERT INTO organisation_seats
                (organisation_id, subscription_id, source, status, seat_label, seat_type, created_at, updated_at)
                VALUES (?, ?, ?, 'active', ?, ?, ?, ?)
                """,
                (organisation_id, subscription_id, source, label, seat_type, now, now),
            )
        active_count += 1

    # Do not delete extra seats when purchased count is reduced — mark deactivated instead (spec: retain purchased).
    # Entitlements are never auto-removed here — purchased seats stay until platform changes subscription.


def _find_unassigned_seat_id(conn, organisation_id: int) -> int | None:
    q = """
        SELECT s.id FROM organisation_seats s
        WHERE s.organisation_id = ? AND s.status = 'active'
          AND NOT EXISTS (
            SELECT 1 FROM organisation_members m
            WHERE m.seat_id = s.id AND m.status = 'active'
          )
        ORDER BY s.id
        LIMIT 1
    """
    if uses_postgres():
        q = q.replace("?", "%s")
        row = conn.execute(q, (organisation_id,)).fetchone()
    else:
        row = conn.execute(q, (organisation_id,)).fetchone()
    if not row:
        return None
    return int(_mapping(row)["id"])


def assign_available_seat(conn, organisation_id: int, member_id: int) -> int:
    seat_id = _find_unassigned_seat_id(conn, organisation_id)
    if seat_id is None:
        raise HTTPException(status_code=400, detail="No available seat. Add an additional seat before assigning this user.")
    now = _now()
    if uses_postgres():
        conn.execute(
            "UPDATE organisation_members SET seat_id = %s, updated_at = %s WHERE id = %s AND organisation_id = %s",
            (seat_id, now, member_id, organisation_id),
        )
    else:
        conn.execute(
            "UPDATE organisation_members SET seat_id = ?, updated_at = ? WHERE id = ? AND organisation_id = ?",
            (seat_id, now, member_id, organisation_id),
        )
    return seat_id


def release_member_seat(conn, member_id: int) -> None:
    now = _now()
    if uses_postgres():
        conn.execute(
            "UPDATE organisation_members SET seat_id = NULL, updated_at = %s WHERE id = %s",
            (now, member_id),
        )
    else:
        conn.execute(
            "UPDATE organisation_members SET seat_id = NULL, updated_at = ? WHERE id = ?",
            (now, member_id),
        )


def seat_summary(conn, organisation_id: int) -> dict[str, int]:
    if uses_postgres():
        sub = conn.execute(
            """
            SELECT included_seats, purchased_additional_seats
            FROM subscriptions
            WHERE organisation_id = %s AND status IN ('trial', 'active', 'past_due')
            ORDER BY id DESC LIMIT 1
            """,
            (organisation_id,),
        ).fetchone()
    else:
        sub = conn.execute(
            """
            SELECT included_seats, purchased_additional_seats
            FROM subscriptions
            WHERE organisation_id = ? AND status IN ('trial', 'active', 'past_due')
            ORDER BY id DESC LIMIT 1
            """,
            (organisation_id,),
        ).fetchone()
    if not sub:
        return {
            "included_seats": 0,
            "purchased_additional_seats": 0,
            "total_entitled_seats": 0,
            "active_assigned_seats": 0,
            "available_seats": 0,
        }
    sub = _mapping(sub)
    included = int(sub["included_seats"])
    purchased = int(sub["purchased_additional_seats"])
    total = included + purchased

    if uses_postgres():
        used = conn.execute(
            """
            SELECT COUNT(*) AS c FROM organisation_members
            WHERE organisation_id = %s AND status = 'active' AND seat_id IS NOT NULL
            """,
            (organisation_id,),
        ).fetchone()
    else:
        used = conn.execute(
            """
            SELECT COUNT(*) AS c FROM organisation_members
            WHERE organisation_id = ? AND status = 'active' AND seat_id IS NOT NULL
            """,
            (organisation_id,),
        ).fetchone()
    used_n = int(row_get(used, "c") or 0)
    return {
        "included_seats": included,
        "purchased_additional_seats": purchased,
        "total_entitled_seats": total,
        "active_assigned_seats": used_n,
        "available_seats": max(0, total - used_n),
    }


def user_has_org_seat_access(conn, user_id: int, role_slug: str) -> bool:
    if role_slug == "platform_admin":
        return True
    if uses_postgres():
        row = conn.execute(
            """
            SELECT m.status, m.seat_id, u.status AS user_status
            FROM organisation_members m
            JOIN users u ON u.id = m.user_id
            WHERE m.user_id = %s AND m.status = 'active'
            ORDER BY m.id LIMIT 1
            """,
            (user_id,),
        ).fetchone()
    else:
        row = conn.execute(
            """
            SELECT m.status, m.seat_id, u.status AS user_status
            FROM organisation_members m
            JOIN users u ON u.id = m.user_id
            WHERE m.user_id = ? AND m.status = 'active'
            ORDER BY m.id LIMIT 1
            """,
            (user_id,),
        ).fetchone()
    if not row:
        return False
    r = _mapping(row)
    if r.get("user_status") != "active":
        return False
    return bool(r.get("seat_id"))


def assert_user_org_access(conn, user_id: int, role_slug: str) -> None:
    if user_has_org_seat_access(conn, user_id, role_slug):
        return
    if role_slug == "platform_admin":
        return
    raise HTTPException(status_code=403, detail="No active organisation seat or membership")


def get_active_subscription(conn, organisation_id: int) -> dict[str, Any] | None:
    q = """
        SELECT s.*,
               p.slug AS plan_slug,
               p.name AS plan_name,
               p.description AS plan_description,
               p.licence_type AS plan_licence_type,
               p.licence_price_cents AS plan_licence_price_cents,
               p.included_admin_seats AS plan_included_admin_seats,
               p.included_operator_seats AS plan_included_operator_seats,
               p.additional_seat_licence_cents AS plan_additional_seat_licence_cents,
               p.amc_price_cents AS plan_amc_price_cents,
               p.additional_seat_amc_cents AS plan_additional_seat_amc_cents,
               p.amc_duration_months AS plan_amc_duration_months,
               p.amc_grace_days AS plan_amc_grace_days
        FROM subscriptions s
        JOIN subscription_plans p ON p.id = s.plan_id
        WHERE s.organisation_id = ?
          AND s.status IN ('trial', 'active', 'past_due')
        ORDER BY s.id DESC LIMIT 1
    """
    if uses_postgres():
        q = q.replace("?", "%s")
        row = conn.execute(q, (organisation_id,)).fetchone()
    else:
        row = conn.execute(q, (organisation_id,)).fetchone()
    return dict(_mapping(row)) if row else None


def organisation_detail(conn, org_id: int) -> dict[str, Any]:
    if uses_postgres():
        org = conn.execute("SELECT * FROM organisations WHERE id = %s", (org_id,)).fetchone()
    else:
        org = conn.execute("SELECT * FROM organisations WHERE id = ?", (org_id,)).fetchone()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")
    org_d = dict(_mapping(org))
    sub = get_active_subscription(conn, org_id)
    seats = seat_summary(conn, org_id)
    inventory = list_organisation_seats(conn, org_id)
    from .org_members_repository import find_primary_admin_user

    primary_admin_user = find_primary_admin_user(conn, org_id)
    from .licence_repository import commercial_summary

    commercial = commercial_summary(conn, org_id)
    return {
        "organisation": org_d,
        "subscription": sub,
        "seats": seats,
        "seat_inventory": inventory,
        "primary_admin_user": primary_admin_user,
        "licence": commercial.get("licence"),
        "amc": commercial.get("amc"),
        "billing": commercial.get("payments"),
    }


def create_subscription_for_org(
    conn,
    *,
    organisation_id: int,
    plan_id: int,
    billing_cycle: str = "annual",
    status: str = "active",
) -> int:
    if uses_postgres():
        plan = conn.execute(
            "SELECT included_seats FROM subscription_plans WHERE id = %s AND status = 'active'",
            (plan_id,),
        ).fetchone()
    else:
        plan = conn.execute(
            "SELECT included_seats FROM subscription_plans WHERE id = ? AND status = 'active'",
            (plan_id,),
        ).fetchone()
    if not plan:
        raise HTTPException(status_code=400, detail="Subscription plan not found")
    included = int(_mapping(plan)["included_seats"])
    now = _now()
    renewal = (datetime.now(timezone.utc) + timedelta(days=365 if billing_cycle == "annual" else 30)).isoformat()
    if uses_postgres():
        row = conn.execute(
            """
            INSERT INTO subscriptions
            (organisation_id, plan_id, billing_cycle, status, start_date, renewal_date,
             included_seats, purchased_additional_seats, payment_status, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 0, 'none', %s, %s)
            RETURNING id
            """,
            (organisation_id, plan_id, billing_cycle, status, now, renewal, included, now, now),
        ).fetchone()
        sub_id = int(row["id"])
    else:
        cur = conn.execute(
            """
            INSERT INTO subscriptions
            (organisation_id, plan_id, billing_cycle, status, start_date, renewal_date,
             included_seats, purchased_additional_seats, payment_status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'none', ?, ?)
            """,
            (organisation_id, plan_id, billing_cycle, status, now, renewal, included, now, now),
        )
        sub_id = int(cur.lastrowid)
    sync_seat_entitlements(conn, organisation_id, sub_id)
    return sub_id


def add_purchased_seat(
    conn,
    organisation_id: int,
    *,
    actor_user_id: int | None,
    count: int = 1,
    seat_type: str = "operator",
) -> dict[str, int]:
    if count < 1:
        raise HTTPException(status_code=400, detail="count must be at least 1")
    sub = get_active_subscription(conn, organisation_id)
    if not sub:
        raise HTTPException(status_code=400, detail="No active subscription")
    sub_id = int(sub["id"])
    now = _now()
    new_purchased = int(sub["purchased_additional_seats"]) + count
    if uses_postgres():
        conn.execute(
            """
            UPDATE subscriptions SET purchased_additional_seats = %s, updated_at = %s WHERE id = %s
            """,
            (new_purchased, now, sub_id),
        )
    else:
        conn.execute(
            "UPDATE subscriptions SET purchased_additional_seats = ?, updated_at = ? WHERE id = ?",
            (new_purchased, now, sub_id),
        )
    sync_seat_entitlements(conn, organisation_id, sub_id, purchased_seat_type=seat_type)
    summary = seat_summary(conn, organisation_id)
    from .repository import append_audit_log

    append_audit_log(
        organisation_id=organisation_id,
        actor_user_id=actor_user_id,
        action="seat.added",
        entity_type="subscription",
        entity_id=str(sub_id),
        old_value={"purchased_additional_seats": sub["purchased_additional_seats"]},
        new_value={
            "purchased_additional_seats": new_purchased,
            "added": count,
            "seat_type": seat_type,
        },
        conn=conn,
    )
    from .licence_repository import bump_additional_seats

    bump_additional_seats(conn, organisation_id, count, actor_user_id)
    return summary


def list_organisation_seats(conn, organisation_id: int) -> list[dict[str, Any]]:
    q = """
        SELECT s.id, s.organisation_id, s.subscription_id, s.source, s.status,
               s.seat_label, s.seat_type, s.created_at, s.updated_at,
               m.user_id AS assigned_user_id,
               u.name AS assigned_user_name,
               u.email AS assigned_user_email
        FROM organisation_seats s
        LEFT JOIN organisation_members m
          ON m.seat_id = s.id
         AND m.organisation_id = s.organisation_id
         AND m.status = 'active'
        LEFT JOIN users u ON u.id = m.user_id AND u.status = 'active'
        WHERE s.organisation_id = ? AND s.status = 'active'
        ORDER BY s.id
    """
    if uses_postgres():
        q = q.replace("?", "%s")
        rows = conn.execute(q, (organisation_id,)).fetchall()
    else:
        rows = conn.execute(q, (organisation_id,)).fetchall()
    return [dict(_mapping(r)) for r in rows]


def list_platform_seats(conn) -> list[dict[str, Any]]:
    """Licensed seats currently assigned to an active organisation member."""
    q = """
        SELECT s.id, s.organisation_id, s.subscription_id, s.source, s.status,
               s.seat_label, s.seat_type, s.created_at, s.updated_at,
               o.name AS organisation_name, o.org_code
        FROM organisation_seats s
        JOIN organisations o ON o.id = s.organisation_id
        WHERE s.status = 'active'
          AND EXISTS (
            SELECT 1 FROM organisation_members m
            WHERE m.seat_id = s.id AND m.status = 'active'
          )
        ORDER BY o.name, s.id
    """
    rows = conn.execute(q).fetchall()
    return [dict(_mapping(r)) for r in rows]


def upsert_organisation_member(
    conn,
    *,
    organisation_id: int,
    user_id: int,
    role_id: int,
    active: bool,
) -> int:
    now = _now()
    status = "active" if active else "deactivated"
    if uses_postgres():
        existing = conn.execute(
            "SELECT id, status, seat_id FROM organisation_members WHERE organisation_id = %s AND user_id = %s",
            (organisation_id, user_id),
        ).fetchone()
    else:
        existing = conn.execute(
            "SELECT id, status, seat_id FROM organisation_members WHERE organisation_id = ? AND user_id = ?",
            (organisation_id, user_id),
        ).fetchone()

    if existing:
        member_id = int(_mapping(existing)["id"])
        if uses_postgres():
            conn.execute(
                """
                UPDATE organisation_members
                SET role_id = %s, status = %s, updated_at = %s,
                    deactivated_at = CASE WHEN %s = 'deactivated' THEN %s ELSE NULL END
                WHERE id = %s
                """,
                (role_id, status, now, status, now, member_id),
            )
        else:
            conn.execute(
                """
                UPDATE organisation_members
                SET role_id = ?, status = ?, updated_at = ?,
                    deactivated_at = CASE WHEN ? = 'deactivated' THEN ? ELSE NULL END
                WHERE id = ?
                """,
                (role_id, status, now, status, now, member_id),
            )
        if active:
            if not _mapping(existing).get("seat_id"):
                assign_available_seat(conn, organisation_id, member_id)
        else:
            release_member_seat(conn, member_id)
        return member_id

    if uses_postgres():
        row = conn.execute(
            """
            INSERT INTO organisation_members
            (organisation_id, user_id, role_id, seat_id, status, joined_at, deactivated_at, created_at, updated_at)
            VALUES (%s, %s, %s, NULL, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                organisation_id,
                user_id,
                role_id,
                status,
                now,
                None if active else now,
                now,
                now,
            ),
        ).fetchone()
        member_id = int(row["id"])
    else:
        cur = conn.execute(
            """
            INSERT INTO organisation_members
            (organisation_id, user_id, role_id, seat_id, status, joined_at, deactivated_at, created_at, updated_at)
            VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)
            """,
            (
                organisation_id,
                user_id,
                role_id,
                status,
                now,
                None if active else now,
                now,
                now,
            ),
        )
        member_id = int(cur.lastrowid)

    if active:
        assign_available_seat(conn, organisation_id, member_id)
    return member_id


def create_org_user_with_seat(
    conn,
    *,
    username: str,
    password: str,
    name: str,
    email: str,
    phone: str,
    organisation_id: int,
    role_slug: str,
    account_type: str,
) -> int:
    summary = seat_summary(conn, organisation_id)
    if summary["available_seats"] <= 0:
        raise HTTPException(
            status_code=400,
            detail="No available seat. Purchase or add an additional seat before assigning this user.",
        )

    if uses_postgres():
        role = conn.execute("SELECT id FROM roles WHERE slug = %s", (role_slug,)).fetchone()
    else:
        role = conn.execute("SELECT id FROM roles WHERE slug = ?", (role_slug,)).fetchone()
    if not role:
        raise HTTPException(status_code=400, detail="Invalid role")
    role_id = int(_mapping(role)["id"])
    now = _now()
    pwd = hash_password(password)

    if uses_postgres():
        row = conn.execute(
            """
            INSERT INTO users (username, email, name, phone, password_hash, organisation_id, account_type, role_id, status, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'active', %s, %s)
            RETURNING id
            """,
            (username, email, name, phone, pwd, organisation_id, account_type, role_id, now, now),
        ).fetchone()
        user_id = int(row["id"])
    else:
        cur = conn.execute(
            """
            INSERT INTO users (username, email, name, phone, password_hash, organisation_id, account_type, role_id, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
            """,
            (username, email, name, phone, pwd, organisation_id, account_type, role_id, now, now),
        )
        user_id = int(cur.lastrowid)

    upsert_organisation_member(
        conn,
        organisation_id=organisation_id,
        user_id=user_id,
        role_id=role_id,
        active=True,
    )
    return user_id


def generate_temp_password() -> str:
    return secrets.token_urlsafe(9)


def delete_platform_user(conn, user_id: int, *, actor_user_id: int) -> dict[str, Any]:
    if user_id == actor_user_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    if uses_postgres():
        row = conn.execute(
            """
            SELECT u.id, u.username, u.organisation_id, r.slug AS role_slug
            FROM users u
            JOIN roles r ON r.id = u.role_id
            WHERE u.id = %s
            """,
            (user_id,),
        ).fetchone()
    else:
        row = conn.execute(
            """
            SELECT u.id, u.username, u.organisation_id, r.slug AS role_slug
            FROM users u
            JOIN roles r ON r.id = u.role_id
            WHERE u.id = ?
            """,
            (user_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    data = _mapping(row)
    if data["role_slug"] == "platform_admin":
        raise HTTPException(status_code=403, detail="Platform admin accounts cannot be deleted here")

    org_id = data.get("organisation_id")
    snapshot = dict(data)

    if uses_postgres():
        conn.execute("DELETE FROM auth_sessions WHERE user_id = %s", (user_id,))
        conn.execute("DELETE FROM organisation_members WHERE user_id = %s", (user_id,))
        conn.execute("DELETE FROM users WHERE id = %s", (user_id,))
    else:
        conn.execute("DELETE FROM auth_sessions WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM organisation_members WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))

    from .repository import append_audit_log

    append_audit_log(
        organisation_id=int(org_id) if org_id is not None else None,
        actor_user_id=actor_user_id,
        action="user.deleted",
        entity_type="user",
        entity_id=str(user_id),
        old_value=snapshot,
        conn=conn,
    )
    return snapshot


def _purge_organisation_rows(conn, org_id: int) -> None:
    if uses_postgres():
        user_rows = conn.execute(
            "SELECT id FROM users WHERE organisation_id = %s",
            (org_id,),
        ).fetchall()
        for u in user_rows:
            uid = int(row_get(u, "id"))
            conn.execute("DELETE FROM auth_sessions WHERE user_id = %s", (uid,))
        conn.execute("DELETE FROM organisation_members WHERE organisation_id = %s", (org_id,))
        conn.execute("DELETE FROM users WHERE organisation_id = %s", (org_id,))
        conn.execute("DELETE FROM subscriptions WHERE organisation_id = %s", (org_id,))
        conn.execute("DELETE FROM trade_state WHERE organisation_id = %s", (org_id,))
        conn.execute("DELETE FROM organisations WHERE id = %s", (org_id,))
        return

    user_rows = conn.execute(
        "SELECT id FROM users WHERE organisation_id = ?",
        (org_id,),
    ).fetchall()
    for u in user_rows:
        uid = int(row_get(u, "id"))
        conn.execute("DELETE FROM auth_sessions WHERE user_id = ?", (uid,))
    conn.execute("DELETE FROM organisation_members WHERE organisation_id = ?", (org_id,))
    conn.execute("DELETE FROM organisation_seats WHERE organisation_id = ?", (org_id,))
    conn.execute("DELETE FROM subscriptions WHERE organisation_id = ?", (org_id,))
    conn.execute("DELETE FROM users WHERE organisation_id = ?", (org_id,))
    conn.execute("DELETE FROM trade_state WHERE organisation_id = ?", (org_id,))
    conn.execute("DELETE FROM organisations WHERE id = ?", (org_id,))


def _organisation_retention_score(conn, org_id: int) -> tuple[int, int, int]:
    """Higher is better: trade activity, user count, then prefer lower id."""
    trade_volume = 0
    if uses_postgres():
        ts = conn.execute(
            "SELECT data FROM trade_state WHERE organisation_id = %s",
            (org_id,),
        ).fetchone()
        users = conn.execute(
            "SELECT COUNT(*) AS c FROM users WHERE organisation_id = %s",
            (org_id,),
        ).fetchone()
        user_count = int(row_get(users, "c") or 0)
    else:
        ts = conn.execute(
            "SELECT data FROM trade_state WHERE organisation_id = ?",
            (org_id,),
        ).fetchone()
        users = conn.execute(
            "SELECT COUNT(*) AS c FROM users WHERE organisation_id = ?",
            (org_id,),
        ).fetchone()
        user_count = int(row_get(users, "c") or 0)

    if ts:
        raw = row_get(ts, "data")
        try:
            payload = json.loads(raw) if isinstance(raw, str) else raw
            trade_volume = len(payload.get("tradeOrders") or []) + len(payload.get("lifts") or [])
        except (json.JSONDecodeError, TypeError, AttributeError):
            trade_volume = 0

    return (trade_volume, user_count, -org_id)


def dedupe_test_organisations(conn) -> None:
    """Keep a single system Test Organisation row (the one with real data)."""
    from .billing_schema import DEFAULT_ORG_NAME, LEGACY_DEFAULT_ORG_NAME, PRE_REBRAND_LEGACY_ORG_NAME

    legacy_names = (DEFAULT_ORG_NAME, LEGACY_DEFAULT_ORG_NAME, PRE_REBRAND_LEGACY_ORG_NAME)
    if uses_postgres():
        rows = conn.execute(
            """
            SELECT id FROM organisations
            WHERE name IN (%s, %s, %s)
            ORDER BY id
            """,
            legacy_names,
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT id FROM organisations
            WHERE name IN (?, ?, ?)
            ORDER BY id
            """,
            legacy_names,
        ).fetchall()

    ids = [int(_mapping(r)["id"]) for r in rows]
    if len(ids) <= 1:
        return

    keeper = max(ids, key=lambda oid: _organisation_retention_score(conn, oid))
    for org_id in ids:
        if org_id == keeper:
            continue
        _purge_organisation_rows(conn, org_id)


def delete_organisation(conn, org_id: int, *, actor_user_id: int) -> dict[str, Any]:
    if uses_postgres():
        org = conn.execute(
            "SELECT id, name, sandbox_tools FROM organisations WHERE id = %s",
            (org_id,),
        ).fetchone()
    else:
        org = conn.execute(
            "SELECT id, name, sandbox_tools FROM organisations WHERE id = ?",
            (org_id,),
        ).fetchone()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")
    org_d = _mapping(org)
    if org_d.get("sandbox_tools"):
        raise HTTPException(
            status_code=403,
            detail="The test/sandbox organisation cannot be deleted. Deactivate it or remove sandbox data instead.",
        )

    snapshot = dict(org_d)
    _purge_organisation_rows(conn, org_id)

    from .repository import append_audit_log

    append_audit_log(
        organisation_id=None,
        actor_user_id=actor_user_id,
        action="organisation.deleted",
        entity_type="organisation",
        entity_id=str(org_id),
        old_value=snapshot,
        conn=conn,
    )
    return snapshot


def create_organisation_with_primary_admin(
    conn,
    *,
    org: dict[str, Any],
    primary_admin: dict[str, str],
    plan_id: int,
    billing_cycle: str,
    actor_user_id: int | None,
) -> dict[str, Any]:
    from ..db import DEFAULT_STATE, set_pg_organisation_context

    org_name = (org.get("name") or "").strip()
    if not org_name:
        raise HTTPException(status_code=400, detail="Name is required")

    admin_name = primary_admin.get("name", "").strip() or "Organisation Admin"
    username = require_login_username(primary_admin.get("username", ""))
    email = optional_contact_email(primary_admin.get("email", ""))
    mobile = primary_admin.get("mobile", "").strip()
    if login_identity_in_use(conn, username, email):
        raise HTTPException(
            status_code=409,
            detail="This username or email is already in use.",
        )

    now = _now()
    if uses_postgres():
        row = conn.execute(
            """
            INSERT INTO organisations (
                name, account_type, status, sandbox_tools,
                legal_name, gstin, pan, business_address, city, state, country, pincode,
                primary_contact_name, primary_contact_email, primary_contact_mobile,
                created_at, updated_at
            )
            VALUES (%s, %s, 'active', 0, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                org_name,
                org.get("account_type", "wholesaler_retailer"),
                org.get("legal_name", ""),
                org.get("gstin", ""),
                org.get("pan", ""),
                org.get("business_address", ""),
                org.get("city", ""),
                org.get("state", ""),
                org.get("country", ""),
                org.get("pincode", ""),
                admin_name,
                email,
                mobile,
                now,
                now,
            ),
        ).fetchone()
        org_id = int(row["id"])
        code = org_code_for_id(org_id)
        conn.execute("UPDATE organisations SET org_code = %s WHERE id = %s", (code, org_id))
        set_pg_organisation_context(conn, org_id)
        conn.execute(
            """
            INSERT INTO trade_state (organisation_id, data) VALUES (%s, %s::jsonb)
            ON CONFLICT (organisation_id) DO NOTHING
            """,
            (org_id, json.dumps(DEFAULT_STATE)),
        )
    else:
        cur = conn.execute(
            """
            INSERT INTO organisations (
                name, account_type, status, sandbox_tools,
                legal_name, gstin, pan, business_address, city, state, country, pincode,
                primary_contact_name, primary_contact_email, primary_contact_mobile,
                created_at, updated_at
            )
            VALUES (?, ?, 'active', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                org_name,
                org.get("account_type", "wholesaler_retailer"),
                org.get("legal_name", ""),
                org.get("gstin", ""),
                org.get("pan", ""),
                org.get("business_address", ""),
                org.get("city", ""),
                org.get("state", ""),
                org.get("country", ""),
                org.get("pincode", ""),
                admin_name,
                email,
                mobile,
                now,
                now,
            ),
        )
        org_id = int(cur.lastrowid)
        code = org_code_for_id(org_id)
        conn.execute("UPDATE organisations SET org_code = ? WHERE id = ?", (code, org_id))
        conn.execute(
            "INSERT OR IGNORE INTO trade_state (organisation_id, data) VALUES (?, ?)",
            (org_id, json.dumps(DEFAULT_STATE)),
        )

    create_subscription_for_org(
        conn,
        organisation_id=org_id,
        plan_id=plan_id,
        billing_cycle=billing_cycle,
        status="active",
    )
    from .licence_repository import issue_licence_for_organisation

    issue_licence_for_organisation(
        conn,
        organisation_id=org_id,
        plan_id=plan_id,
        actor_user_id=actor_user_id,
        activate=True,
    )

    custom_password = primary_admin.get("password", "").strip()
    if custom_password:
        password = custom_password
        show_temporary_password = False
    else:
        password = generate_temp_password()
        show_temporary_password = True

    user_id = create_org_user_with_seat(
        conn,
        username=username,
        password=password,
        name=admin_name,
        email=email,
        phone=mobile,
        organisation_id=org_id,
        role_slug="organisation_admin",
        account_type=org.get("account_type", "wholesaler_retailer"),
    )

    detail = organisation_detail(conn, org_id)
    admin_summary = detail.get("primary_admin_user") or {}
    login_id = str(admin_summary.get("login_id") or username)
    return {
        **detail,
        "primary_admin": {
            "user_id": user_id,
            "username": username,
            "email": email,
            "name": admin_name,
            "login_id": login_id,
            "temporary_password": password if show_temporary_password else None,
        },
        "_audit_actor_user_id": actor_user_id,
    }
