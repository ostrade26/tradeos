"""Organisation perpetual licences, AMC periods, and manual payments."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException

from ..db import uses_postgres
from .billing_repository import _mapping, seat_summary
from .repository import append_audit_log


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def compute_amc_status(end_iso: str, grace_until_iso: str | None, stored: str) -> str:
    if stored == "cancelled":
        return "cancelled"
    end = _parse_dt(end_iso)
    grace = _parse_dt(grace_until_iso) or (
        end + timedelta(days=30) if end else None
    )
    now = _now()
    if end and now <= end:
        if (end - now) <= timedelta(days=30):
            return "due_soon"
        return "active"
    if grace and now <= grace:
        return "grace_period"
    return "expired"


def refresh_amc_statuses(conn) -> None:
    rows = conn.execute("SELECT id, end_date, grace_until, status FROM organisation_amcs").fetchall()
    now = _now_iso()
    for row in rows:
        r = _mapping(row)
        if r.get("status") == "cancelled":
            continue
        next_status = compute_amc_status(r["end_date"], r.get("grace_until"), r.get("status") or "")
        if next_status != r.get("status"):
            if uses_postgres():
                conn.execute(
                    "UPDATE organisation_amcs SET status = %s, updated_at = %s WHERE id = %s",
                    (next_status, now, int(r["id"])),
                )
            else:
                conn.execute(
                    "UPDATE organisation_amcs SET status = ?, updated_at = ? WHERE id = ?",
                    (next_status, now, int(r["id"])),
                )


def _next_licence_number(conn, organisation_id: int) -> str:
    if uses_postgres():
        row = conn.execute(
            "SELECT COUNT(*) AS n FROM organisation_licenses WHERE organisation_id = %s",
            (organisation_id,),
        ).fetchone()
    else:
        row = conn.execute(
            "SELECT COUNT(*) AS n FROM organisation_licenses WHERE organisation_id = ?",
            (organisation_id,),
        ).fetchone()
    n = int(_mapping(row).get("n") or 0) + 1
    return f"LIC-{organisation_id:05d}-{n:04d}"


def _plan_row(conn, plan_id: int) -> dict[str, Any] | None:
    if uses_postgres():
        row = conn.execute("SELECT * FROM subscription_plans WHERE id = %s", (plan_id,)).fetchone()
    else:
        row = conn.execute("SELECT * FROM subscription_plans WHERE id = ?", (plan_id,)).fetchone()
    return dict(_mapping(row)) if row else None


def issue_licence_for_organisation(
    conn,
    *,
    organisation_id: int,
    plan_id: int | None,
    purchase_date: str | None = None,
    purchased_additional_seats: int = 0,
    actor_user_id: int | None = None,
    activate: bool = True,
) -> dict[str, Any]:
    plan = _plan_row(conn, plan_id) if plan_id else None
    now = _now()
    purchase = purchase_date or now.isoformat()
    activation = now.isoformat() if activate else None
    status = "active" if activate else "pending"
    grace_days = int((plan or {}).get("amc_grace_days") or 30)
    duration_months = int((plan or {}).get("amc_duration_months") or 12)
    included_seats = int((plan or {}).get("included_seats") or 2)
    number = _next_licence_number(conn, organisation_id)
    values = (
        organisation_id,
        plan_id,
        number,
        (plan or {}).get("name") or "Tradeal Standard",
        (plan or {}).get("licence_type") or "perpetual",
        int((plan or {}).get("licence_price_cents") or 0),
        purchase,
        activation,
        status,
        included_seats,
        int((plan or {}).get("included_admin_seats") or 1),
        int((plan or {}).get("included_operator_seats") or 1),
        purchased_additional_seats,
        int((plan or {}).get("additional_seat_licence_cents") or 0),
        int((plan or {}).get("additional_seat_amc_cents") or 0),
        int((plan or {}).get("amc_price_cents") or 0),
        duration_months,
        grace_days,
        now.isoformat(),
        now.isoformat(),
    )
    if uses_postgres():
        row = conn.execute(
            """
            INSERT INTO organisation_licenses (
                organisation_id, plan_id, licence_number, plan_name, licence_type, licence_price_cents,
                purchase_date, activation_date, status, included_seats, included_admin_seats,
                included_operator_seats, purchased_additional_seats, additional_seat_licence_cents,
                additional_seat_amc_cents, amc_price_cents, amc_duration_months, amc_grace_days,
                created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            values,
        ).fetchone()
        licence = dict(_mapping(row))
    else:
        cur = conn.execute(
            """
            INSERT INTO organisation_licenses (
                organisation_id, plan_id, licence_number, plan_name, licence_type, licence_price_cents,
                purchase_date, activation_date, status, included_seats, included_admin_seats,
                included_operator_seats, purchased_additional_seats, additional_seat_licence_cents,
                additional_seat_amc_cents, amc_price_cents, amc_duration_months, amc_grace_days,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            values,
        )
        licence_id = int(cur.lastrowid)
        licence = dict(
            _mapping(conn.execute("SELECT * FROM organisation_licenses WHERE id = ?", (licence_id,)).fetchone())
        )

    amc_end = now + timedelta(days=int(duration_months) * 30)
    grace_until = amc_end + timedelta(days=grace_days)
    _insert_amc(
        conn,
        organisation_id=organisation_id,
        licence_id=int(licence["id"]),
        amc_price_cents=0,
        included=1,
        start_date=now.isoformat(),
        end_date=amc_end.isoformat(),
        grace_until=grace_until.isoformat(),
        status="active",
        payment_status="included",
    )
    if actor_user_id:
        append_audit_log(
            organisation_id=organisation_id,
            actor_user_id=actor_user_id,
            action="licence.created",
            entity_type="organisation_license",
            entity_id=str(licence["id"]),
            new_value=licence,
        )
        if activate:
            append_audit_log(
                organisation_id=organisation_id,
                actor_user_id=actor_user_id,
                action="licence.activated",
                entity_type="organisation_license",
                entity_id=str(licence["id"]),
                new_value={"status": "active"},
            )
            append_audit_log(
                organisation_id=organisation_id,
                actor_user_id=actor_user_id,
                action="amc.created",
                entity_type="organisation_amc",
                entity_id=str(licence["id"]),
                new_value={"included": True, "year": 1},
            )
    return licence


def _insert_amc(
    conn,
    *,
    organisation_id: int,
    licence_id: int,
    amc_price_cents: int,
    included: int,
    start_date: str,
    end_date: str,
    grace_until: str,
    status: str,
    payment_status: str,
) -> dict[str, Any]:
    now = _now_iso()
    vals = (
        organisation_id,
        licence_id,
        amc_price_cents,
        included,
        start_date,
        end_date,
        grace_until,
        end_date,
        status,
        payment_status,
        now,
        now,
    )
    if uses_postgres():
        row = conn.execute(
            """
            INSERT INTO organisation_amcs (
                organisation_id, licence_id, amc_price_cents, included, start_date, end_date,
                grace_until, renewal_date, status, payment_status, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            vals,
        ).fetchone()
        return dict(_mapping(row))
    cur = conn.execute(
        """
        INSERT INTO organisation_amcs (
            organisation_id, licence_id, amc_price_cents, included, start_date, end_date,
            grace_until, renewal_date, status, payment_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        vals,
    )
    return dict(
        _mapping(conn.execute("SELECT * FROM organisation_amcs WHERE id = ?", (cur.lastrowid,)).fetchone())
    )


def get_current_licence(conn, organisation_id: int) -> dict[str, Any] | None:
    if uses_postgres():
        row = conn.execute(
            """
            SELECT * FROM organisation_licenses
            WHERE organisation_id = %s
            ORDER BY id DESC LIMIT 1
            """,
            (organisation_id,),
        ).fetchone()
    else:
        row = conn.execute(
            """
            SELECT * FROM organisation_licenses
            WHERE organisation_id = ?
            ORDER BY id DESC LIMIT 1
            """,
            (organisation_id,),
        ).fetchone()
    return dict(_mapping(row)) if row else None


def get_current_amc(conn, licence_id: int) -> dict[str, Any] | None:
    if uses_postgres():
        row = conn.execute(
            """
            SELECT * FROM organisation_amcs
            WHERE licence_id = %s
            ORDER BY id DESC LIMIT 1
            """,
            (licence_id,),
        ).fetchone()
    else:
        row = conn.execute(
            """
            SELECT * FROM organisation_amcs
            WHERE licence_id = ?
            ORDER BY id DESC LIMIT 1
            """,
            (licence_id,),
        ).fetchone()
    if not row:
        return None
    amc = dict(_mapping(row))
    amc["status"] = compute_amc_status(amc["end_date"], amc.get("grace_until"), amc.get("status") or "")
    return amc


def list_licenses(conn) -> list[dict[str, Any]]:
    refresh_amc_statuses(conn)
    q = """
        SELECT l.*, o.name AS organisation_name, o.org_code
        FROM organisation_licenses l
        JOIN organisations o ON o.id = l.organisation_id
        ORDER BY l.id DESC
    """
    rows = conn.execute(q).fetchall()
    out = []
    for row in rows:
        item = dict(_mapping(row))
        amc = get_current_amc(conn, int(item["id"]))
        item["amc"] = amc
        out.append(item)
    return out


def list_amcs(conn) -> list[dict[str, Any]]:
    refresh_amc_statuses(conn)
    q = """
        SELECT a.*, o.name AS organisation_name, o.org_code, l.licence_number, l.plan_name
        FROM organisation_amcs a
        JOIN organisations o ON o.id = a.organisation_id
        JOIN organisation_licenses l ON l.id = a.licence_id
        ORDER BY a.end_date ASC
    """
    rows = conn.execute(q).fetchall()
    items = []
    for row in rows:
        item = dict(_mapping(row))
        item["status"] = compute_amc_status(item["end_date"], item.get("grace_until"), item.get("status") or "")
        items.append(item)
    return items


def list_payments(conn) -> list[dict[str, Any]]:
    q = """
        SELECT p.*, o.name AS organisation_name, o.org_code, l.licence_number
        FROM organisation_payments p
        JOIN organisations o ON o.id = p.organisation_id
        LEFT JOIN organisation_licenses l ON l.id = p.licence_id
        ORDER BY p.payment_date DESC, p.id DESC
    """
    return [dict(_mapping(r)) for r in conn.execute(q).fetchall()]


def payment_totals(conn, organisation_id: int) -> dict[str, Any]:
    if uses_postgres():
        rows = conn.execute(
            "SELECT amount_cents, status, payment_date, payment_type FROM organisation_payments WHERE organisation_id = %s",
            (organisation_id,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT amount_cents, status, payment_date, payment_type FROM organisation_payments WHERE organisation_id = ?",
            (organisation_id,),
        ).fetchall()
    paid = 0
    pending = 0
    last = None
    last_status = None
    for row in rows:
        r = _mapping(row)
        amt = int(r["amount_cents"] or 0)
        if r["status"] == "paid":
            paid += amt
            if last is None or str(r["payment_date"]) > str(last):
                last = r["payment_date"]
                last_status = r["status"]
        elif r["status"] == "pending":
            pending += amt
            if last_status is None:
                last_status = "pending"
    return {
        "total_paid_cents": paid,
        "pending_cents": pending,
        "last_payment_date": last,
        "payment_status": last_status or "none",
    }


def commercial_summary(conn, organisation_id: int) -> dict[str, Any]:
    refresh_amc_statuses(conn)
    licence = get_current_licence(conn, organisation_id)
    amc = get_current_amc(conn, int(licence["id"])) if licence else None
    seats = seat_summary(conn, organisation_id)
    payments = payment_totals(conn, organisation_id)
    return {
        "licence": licence,
        "amc": amc,
        "seats": seats,
        "payments": payments,
    }


def set_licence_status(conn, licence_id: int, status: str, actor_user_id: int) -> dict[str, Any]:
    allowed = {"pending", "active", "suspended", "cancelled"}
    if status not in allowed:
        raise HTTPException(status_code=400, detail="Invalid licence status")
    if uses_postgres():
        old = conn.execute("SELECT * FROM organisation_licenses WHERE id = %s", (licence_id,)).fetchone()
    else:
        old = conn.execute("SELECT * FROM organisation_licenses WHERE id = ?", (licence_id,)).fetchone()
    if not old:
        raise HTTPException(status_code=404, detail="Licence not found")
    old_d = dict(_mapping(old))
    now = _now_iso()
    activation = old_d.get("activation_date")
    if status == "active" and not activation:
        activation = now
    if uses_postgres():
        conn.execute(
            """
            UPDATE organisation_licenses
            SET status = %s, activation_date = %s, updated_at = %s WHERE id = %s
            """,
            (status, activation, now, licence_id),
        )
        row = conn.execute("SELECT * FROM organisation_licenses WHERE id = %s", (licence_id,)).fetchone()
    else:
        conn.execute(
            """
            UPDATE organisation_licenses
            SET status = ?, activation_date = ?, updated_at = ? WHERE id = ?
            """,
            (status, activation, now, licence_id),
        )
        row = conn.execute("SELECT * FROM organisation_licenses WHERE id = ?", (licence_id,)).fetchone()
    action = {
        "active": "licence.activated",
        "suspended": "licence.suspended",
        "cancelled": "licence.cancelled",
        "pending": "licence.updated",
    }.get(status, "licence.updated")
    append_audit_log(
        organisation_id=int(old_d["organisation_id"]),
        actor_user_id=actor_user_id,
        action=action,
        entity_type="organisation_license",
        entity_id=str(licence_id),
        old_value={"status": old_d.get("status")},
        new_value={"status": status},
    )
    return dict(_mapping(row))


def renew_amc(conn, licence_id: int, actor_user_id: int, payment_status: str = "pending") -> dict[str, Any]:
    licence = None
    if uses_postgres():
        row = conn.execute("SELECT * FROM organisation_licenses WHERE id = %s", (licence_id,)).fetchone()
    else:
        row = conn.execute("SELECT * FROM organisation_licenses WHERE id = ?", (licence_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Licence not found")
    licence = dict(_mapping(row))
    current = get_current_amc(conn, licence_id)
    start = _now()
    if current and _parse_dt(current.get("end_date")) and _parse_dt(current["end_date"]) > start:
        start = _parse_dt(current["end_date"]) or start
    months = int(licence.get("amc_duration_months") or 12)
    grace_days = int(licence.get("amc_grace_days") or 30)
    end = start + timedelta(days=months * 30)
    grace_until = end + timedelta(days=grace_days)
    price = int(licence.get("amc_price_cents") or 0)
    amc = _insert_amc(
        conn,
        organisation_id=int(licence["organisation_id"]),
        licence_id=licence_id,
        amc_price_cents=price,
        included=0,
        start_date=start.isoformat(),
        end_date=end.isoformat(),
        grace_until=grace_until.isoformat(),
        status="active",
        payment_status=payment_status,
    )
    append_audit_log(
        organisation_id=int(licence["organisation_id"]),
        actor_user_id=actor_user_id,
        action="amc.renewed",
        entity_type="organisation_amc",
        entity_id=str(amc["id"]),
        new_value=amc,
    )
    return amc


def bump_additional_seats(conn, organisation_id: int, count: int, actor_user_id: int | None) -> None:
    licence = get_current_licence(conn, organisation_id)
    if not licence:
        return
    next_n = int(licence.get("purchased_additional_seats") or 0) + count
    now = _now_iso()
    if uses_postgres():
        conn.execute(
            "UPDATE organisation_licenses SET purchased_additional_seats = %s, updated_at = %s WHERE id = %s",
            (next_n, now, int(licence["id"])),
        )
    else:
        conn.execute(
            "UPDATE organisation_licenses SET purchased_additional_seats = ?, updated_at = ? WHERE id = ?",
            (next_n, now, int(licence["id"])),
        )
    if actor_user_id:
        append_audit_log(
            organisation_id=organisation_id,
            actor_user_id=actor_user_id,
            action="seat.purchased",
            entity_type="organisation_license",
            entity_id=str(licence["id"]),
            old_value={"purchased_additional_seats": licence.get("purchased_additional_seats")},
            new_value={"purchased_additional_seats": next_n, "added": count},
        )


def record_payment(
    conn,
    *,
    organisation_id: int,
    payment_type: str,
    amount_cents: int,
    payment_date: str,
    payment_reference: str,
    status: str,
    notes: str,
    licence_id: int | None,
    amc_id: int | None,
    actor_user_id: int,
) -> dict[str, Any]:
    types = {"licence", "amc", "additional_seat", "other"}
    statuses = {"pending", "paid", "failed", "refunded"}
    if payment_type not in types:
        raise HTTPException(status_code=400, detail="Invalid payment type")
    if status not in statuses:
        raise HTTPException(status_code=400, detail="Invalid payment status")
    if amount_cents < 0:
        raise HTTPException(status_code=400, detail="Amount must be zero or more")
    now = _now_iso()
    if not licence_id:
        licence = get_current_licence(conn, organisation_id)
        licence_id = int(licence["id"]) if licence else None
    vals = (
        organisation_id,
        licence_id,
        amc_id,
        payment_type,
        amount_cents,
        payment_date or now,
        payment_reference or "",
        status,
        notes or "",
        now,
        now,
    )
    if uses_postgres():
        row = conn.execute(
            """
            INSERT INTO organisation_payments (
                organisation_id, licence_id, amc_id, payment_type, amount_cents, payment_date,
                payment_reference, status, notes, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            vals,
        ).fetchone()
        payment = dict(_mapping(row))
    else:
        cur = conn.execute(
            """
            INSERT INTO organisation_payments (
                organisation_id, licence_id, amc_id, payment_type, amount_cents, payment_date,
                payment_reference, status, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            vals,
        )
        payment = dict(
            _mapping(conn.execute("SELECT * FROM organisation_payments WHERE id = ?", (cur.lastrowid,)).fetchone())
        )
    append_audit_log(
        organisation_id=organisation_id,
        actor_user_id=actor_user_id,
        action="payment.recorded",
        entity_type="organisation_payment",
        entity_id=str(payment["id"]),
        new_value=payment,
    )
    if status == "paid" and payment_type == "amc" and amc_id:
        if uses_postgres():
            conn.execute(
                "UPDATE organisation_amcs SET payment_status = %s, updated_at = %s WHERE id = %s",
                ("paid", now, amc_id),
            )
        else:
            conn.execute(
                "UPDATE organisation_amcs SET payment_status = ?, updated_at = ? WHERE id = ?",
                ("paid", now, amc_id),
            )
    return payment


def update_payment(conn, payment_id: int, patch: dict[str, Any], actor_user_id: int) -> dict[str, Any]:
    if uses_postgres():
        old = conn.execute("SELECT * FROM organisation_payments WHERE id = %s", (payment_id,)).fetchone()
    else:
        old = conn.execute("SELECT * FROM organisation_payments WHERE id = ?", (payment_id,)).fetchone()
    if not old:
        raise HTTPException(status_code=404, detail="Payment not found")
    old_d = dict(_mapping(old))
    status = patch.get("status", old_d["status"])
    notes = patch.get("notes", old_d.get("notes") or "")
    ref = patch.get("payment_reference", old_d.get("payment_reference") or "")
    now = _now_iso()
    if uses_postgres():
        conn.execute(
            """
            UPDATE organisation_payments
            SET status = %s, notes = %s, payment_reference = %s, updated_at = %s WHERE id = %s
            """,
            (status, notes, ref, now, payment_id),
        )
        row = conn.execute("SELECT * FROM organisation_payments WHERE id = %s", (payment_id,)).fetchone()
    else:
        conn.execute(
            """
            UPDATE organisation_payments
            SET status = ?, notes = ?, payment_reference = ?, updated_at = ? WHERE id = ?
            """,
            (status, notes, ref, now, payment_id),
        )
        row = conn.execute("SELECT * FROM organisation_payments WHERE id = ?", (payment_id,)).fetchone()
    append_audit_log(
        organisation_id=int(old_d["organisation_id"]),
        actor_user_id=actor_user_id,
        action="payment.updated",
        entity_type="organisation_payment",
        entity_id=str(payment_id),
        old_value={"status": old_d.get("status")},
        new_value={"status": status},
    )
    return dict(_mapping(row))


def dashboard_metrics(conn) -> dict[str, Any]:
    refresh_amc_statuses(conn)
    orgs = conn.execute("SELECT COUNT(*) AS n FROM organisations").fetchone()
    active_lic = conn.execute(
        "SELECT COUNT(*) AS n FROM organisation_licenses WHERE status = 'active'"
    ).fetchone()
    amcs_full = conn.execute(
        "SELECT end_date, grace_until, status FROM organisation_amcs"
    ).fetchall()
    amc_counts = {"active": 0, "due_soon": 0, "grace_period": 0, "expired": 0, "cancelled": 0}
    for row in amcs_full:
        r = _mapping(row)
        st = compute_amc_status(r["end_date"], r.get("grace_until"), r.get("status") or "")
        amc_counts[st] = amc_counts.get(st, 0) + 1

    orgs_rows = conn.execute("SELECT id FROM organisations").fetchall()
    purchased = 0
    assigned = 0
    available = 0
    for row in orgs_rows:
        oid = int(_mapping(row)["id"])
        s = seat_summary(conn, oid)
        purchased += int(s.get("total_entitled_seats") or 0)
        assigned += int(s.get("active_assigned_seats") or 0)
        available += int(s.get("available_seats") or 0)

    pays = conn.execute(
        "SELECT payment_type, amount_cents, status FROM organisation_payments"
    ).fetchall()
    licence_rev = 0
    amc_rev = 0
    pending = 0
    for row in pays:
        r = _mapping(row)
        amt = int(r["amount_cents"] or 0)
        if r["status"] == "pending":
            pending += amt
        elif r["status"] == "paid":
            if r["payment_type"] == "licence":
                licence_rev += amt
            elif r["payment_type"] == "amc":
                amc_rev += amt
            elif r["payment_type"] == "additional_seat":
                licence_rev += amt

    return {
        "organisations": {
            "total": int(_mapping(orgs).get("n") or 0),
            "active_licences": int(_mapping(active_lic).get("n") or 0),
        },
        "amc": amc_counts,
        "seats": {
            "purchased": purchased,
            "assigned": assigned,
            "available": available,
        },
        "revenue": {
            "licence_cents": licence_rev,
            "amc_cents": amc_rev,
            "pending_cents": pending,
        },
    }
