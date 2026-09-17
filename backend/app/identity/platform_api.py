"""Tradeal platform admin — organisations, subscriptions, seats, and users."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request
from pydantic import BaseModel, Field

from .. import auth
from ..db import (
    DEFAULT_STATE,
    _pg_connect,
    _sqlite_connect,
    begin_transaction,
    rollback_transaction,
    set_pg_organisation_context,
    uses_postgres,
)
from .billing_repository import (
    add_purchased_seat,
    list_platform_seats,
    create_org_user_with_seat,
    create_organisation_with_primary_admin,
    delete_organisation,
    delete_platform_user,
    organisation_detail,
    seat_summary,
    upsert_organisation_member,
)
from .org_members_repository import reset_organisation_member_sign_in
from .billing_schema import DEFAULT_ORG_NAME, LEGACY_DEFAULT_ORG_NAME, PRE_REBRAND_LEGACY_ORG_NAME
from .repository import append_audit_log
from .seat_request_repository import (
    approve_seat_request,
    count_open_seat_requests,
    list_seat_requests_platform,
    mark_seat_request_paid,
    reject_seat_request,
)

router = APIRouter(prefix="/api/v1/platform", tags=["platform"])


class PrimaryAdminBody(BaseModel):
    name: str
    email: str
    mobile: str = ""
    username: str = ""
    password: str = ""


class OrganisationBody(BaseModel):
    name: str
    account_type: str = Field(default="wholesaler_retailer", pattern="^(wholesaler_retailer|broker)$")
    legal_name: str = ""
    gstin: str = ""
    pan: str = ""
    business_address: str
    city: str
    state: str
    country: str
    pincode: str
    plan_id: int | None = None
    billing_cycle: str = Field(default="annual", pattern="^(monthly|annual)$")
    primary_admin: PrimaryAdminBody | None = None


class OrganisationUpdateBody(BaseModel):
    name: str | None = None
    status: str | None = Field(default=None, pattern="^(active|inactive)$")
    legal_name: str | None = None
    gstin: str | None = None
    pan: str | None = None
    business_address: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    pincode: str | None = None
    primary_contact_name: str | None = None
    primary_contact_email: str | None = None
    primary_contact_mobile: str | None = None


class CreateUserBody(BaseModel):
    username: str
    password: str
    name: str
    email: str = ""
    phone: str = ""
    organisation_id: int
    role_slug: str = Field(pattern="^(organisation_admin|operator|view_only)$")
    account_type: str = Field(default="wholesaler_retailer", pattern="^(wholesaler_retailer|broker)$")


class UpdateUserBody(BaseModel):
    role_slug: str | None = Field(default=None, pattern="^(organisation_admin|operator|view_only)$")
    status: str | None = Field(default=None, pattern="^(active|disabled)$")


class PlanBody(BaseModel):
    slug: str
    name: str
    description: str = ""
    monthly_price_cents: int = 0
    annual_price_cents: int = 0
    additional_seat_monthly_price_cents: int = 0
    additional_seat_annual_price_cents: int = 0
    included_seats: int = Field(default=2, ge=1)
    licence_type: str = "perpetual"
    licence_price_cents: int = 0
    included_admin_seats: int = Field(default=1, ge=0)
    included_operator_seats: int = Field(default=1, ge=0)
    additional_seat_licence_cents: int = 0
    amc_price_cents: int = 0
    additional_seat_amc_cents: int = 0
    amc_duration_months: int = Field(default=12, ge=1)
    amc_grace_days: int = Field(default=30, ge=0)
    status: str = Field(default="active", pattern="^(active|inactive)$")


class MarkSeatRequestPaidBody(BaseModel):
    payment_reference: str = ""


class ApproveSeatRequestBody(BaseModel):
    payment_reference: str = ""
    admin_note: str = ""


class RejectSeatRequestBody(BaseModel):
    admin_note: str = ""


class AddSeatsBody(BaseModel):
    count: int = Field(default=1, ge=1, le=50)
    seat_type: str = Field(default="operator", pattern="^(operator|view_only)$")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _session(request: Request) -> auth.Session:
    session = getattr(request.state, "session", None)
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return session


def _org_list_fields() -> str:
    return """
        id, org_code, name, account_type, status, legal_name, gstin, pan,
        business_address, city, state, country, pincode,
        primary_contact_name, primary_contact_email, primary_contact_mobile,
        sandbox_tools, created_at, updated_at
    """  # sandbox_tools: 1 = test org (non-deletable)


@router.get("/plans", summary="List subscription plans")
def list_plans(request: Request) -> dict[str, Any]:
    auth.require_platform(_session(request))
    auth.require_permission(_session(request), "subscriptions.view")
    q = "SELECT * FROM subscription_plans ORDER BY name"
    if uses_postgres():
        with _pg_connect() as conn:
            rows = conn.execute(q).fetchall()
            return {"plans": [dict(r) for r in rows]}
    with _sqlite_connect() as conn:
        rows = conn.execute(q).fetchall()
        return {"plans": [dict(r) for r in rows]}


@router.post("/plans", summary="Create or update subscription plan")
def upsert_plan(body: PlanBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "subscription_plans.manage")
    slug = body.slug.strip().lower()
    now = _now()
    if uses_postgres():
        with _pg_connect() as conn:
            old = conn.execute("SELECT * FROM subscription_plans WHERE slug = %s", (slug,)).fetchone()
            row = conn.execute(
                """
                INSERT INTO subscription_plans
                (slug, name, description, monthly_price_cents, annual_price_cents, included_seats,
                 additional_seat_monthly_price_cents, additional_seat_annual_price_cents,
                 licence_type, licence_price_cents, included_admin_seats, included_operator_seats,
                 additional_seat_licence_cents, amc_price_cents, additional_seat_amc_cents,
                 amc_duration_months, amc_grace_days, status, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (slug) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    monthly_price_cents = EXCLUDED.monthly_price_cents,
                    annual_price_cents = EXCLUDED.annual_price_cents,
                    included_seats = EXCLUDED.included_seats,
                    additional_seat_monthly_price_cents = EXCLUDED.additional_seat_monthly_price_cents,
                    additional_seat_annual_price_cents = EXCLUDED.additional_seat_annual_price_cents,
                    licence_type = EXCLUDED.licence_type,
                    licence_price_cents = EXCLUDED.licence_price_cents,
                    included_admin_seats = EXCLUDED.included_admin_seats,
                    included_operator_seats = EXCLUDED.included_operator_seats,
                    additional_seat_licence_cents = EXCLUDED.additional_seat_licence_cents,
                    amc_price_cents = EXCLUDED.amc_price_cents,
                    additional_seat_amc_cents = EXCLUDED.additional_seat_amc_cents,
                    amc_duration_months = EXCLUDED.amc_duration_months,
                    amc_grace_days = EXCLUDED.amc_grace_days,
                    status = EXCLUDED.status,
                    updated_at = EXCLUDED.updated_at
                RETURNING *
                """,
                (
                    slug,
                    body.name.strip(),
                    body.description,
                    body.monthly_price_cents,
                    body.annual_price_cents,
                    body.included_seats,
                    body.additional_seat_monthly_price_cents,
                    body.additional_seat_annual_price_cents,
                    body.licence_type,
                    body.licence_price_cents,
                    body.included_admin_seats,
                    body.included_operator_seats,
                    body.additional_seat_licence_cents,
                    body.amc_price_cents,
                    body.additional_seat_amc_cents,
                    body.amc_duration_months,
                    body.amc_grace_days,
                    body.status,
                    now,
                    now,
                ),
            ).fetchone()
            conn.commit()
            action = "subscription_plan.created" if old is None else "subscription_plan.upserted"
            if old and int(old["licence_price_cents"] or 0) != body.licence_price_cents:
                append_audit_log(
                    organisation_id=None,
                    actor_user_id=session.user.id,
                    action="plan.price.changed",
                    entity_type="subscription_plan",
                    entity_id=str(row["id"]),
                    old_value={"licence_price_cents": old["licence_price_cents"], "amc_price_cents": old.get("amc_price_cents")},
                    new_value={"licence_price_cents": body.licence_price_cents, "amc_price_cents": body.amc_price_cents},
                )
            append_audit_log(
                organisation_id=None,
                actor_user_id=session.user.id,
                action=action,
                entity_type="subscription_plan",
                entity_id=str(row["id"]),
                old_value=dict(old) if old else None,
                new_value=dict(row),
            )
            return {"plan": dict(row)}

    with _sqlite_connect() as conn:
        old = conn.execute("SELECT * FROM subscription_plans WHERE slug = ?", (slug,)).fetchone()
        conn.execute(
            """
            INSERT INTO subscription_plans
            (slug, name, description, monthly_price_cents, annual_price_cents, included_seats,
             additional_seat_monthly_price_cents, additional_seat_annual_price_cents,
             licence_type, licence_price_cents, included_admin_seats, included_operator_seats,
             additional_seat_licence_cents, amc_price_cents, additional_seat_amc_cents,
             amc_duration_months, amc_grace_days, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET
                name = excluded.name,
                description = excluded.description,
                monthly_price_cents = excluded.monthly_price_cents,
                annual_price_cents = excluded.annual_price_cents,
                included_seats = excluded.included_seats,
                additional_seat_monthly_price_cents = excluded.additional_seat_monthly_price_cents,
                additional_seat_annual_price_cents = excluded.additional_seat_annual_price_cents,
                licence_type = excluded.licence_type,
                licence_price_cents = excluded.licence_price_cents,
                included_admin_seats = excluded.included_admin_seats,
                included_operator_seats = excluded.included_operator_seats,
                additional_seat_licence_cents = excluded.additional_seat_licence_cents,
                amc_price_cents = excluded.amc_price_cents,
                additional_seat_amc_cents = excluded.additional_seat_amc_cents,
                amc_duration_months = excluded.amc_duration_months,
                amc_grace_days = excluded.amc_grace_days,
                status = excluded.status,
                updated_at = excluded.updated_at
            """,
            (
                slug,
                body.name.strip(),
                body.description,
                body.monthly_price_cents,
                body.annual_price_cents,
                body.included_seats,
                body.additional_seat_monthly_price_cents,
                body.additional_seat_annual_price_cents,
                body.licence_type,
                body.licence_price_cents,
                body.included_admin_seats,
                body.included_operator_seats,
                body.additional_seat_licence_cents,
                body.amc_price_cents,
                body.additional_seat_amc_cents,
                body.amc_duration_months,
                body.amc_grace_days,
                body.status,
                now,
                now,
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM subscription_plans WHERE slug = ?", (slug,)).fetchone()
        action = "subscription_plan.created" if old is None else "subscription_plan.upserted"
        if old and int(old["licence_price_cents"] or 0) != body.licence_price_cents:
            append_audit_log(
                organisation_id=None,
                actor_user_id=session.user.id,
                action="plan.price.changed",
                entity_type="subscription_plan",
                entity_id=str(row["id"]),
                old_value={"licence_price_cents": old["licence_price_cents"], "amc_price_cents": old["amc_price_cents"] if "amc_price_cents" in old.keys() else None},
                new_value={"licence_price_cents": body.licence_price_cents, "amc_price_cents": body.amc_price_cents},
            )
        append_audit_log(
            organisation_id=None,
            actor_user_id=session.user.id,
            action=action,
            entity_type="subscription_plan",
            entity_id=str(row["id"]),
            old_value=dict(old) if old else None,
            new_value=dict(row),
        )
        return {"plan": dict(row)}


@router.get("/organisations", summary="List organisations")
def list_organisations(request: Request) -> dict[str, Any]:
    auth.require_platform(_session(request))
    auth.require_permission(_session(request), "organisations.view")
    fields = _org_list_fields()
    if uses_postgres():
        with _pg_connect() as conn:
            rows = conn.execute(f"SELECT {fields} FROM organisations ORDER BY name").fetchall()
            orgs = [dict(r) for r in rows]
            for org in orgs:
                org["seats"] = seat_summary(conn, int(org["id"]))
            return {"organisations": orgs}
    with _sqlite_connect() as conn:
        rows = conn.execute(f"SELECT {fields} FROM organisations ORDER BY name").fetchall()
        orgs = [dict(r) for r in rows]
        for org in orgs:
            org["seats"] = seat_summary(conn, int(org["id"]))
        return {"organisations": orgs}


@router.get("/organisations/{org_id}", summary="Organisation detail")
def get_organisation(org_id: int, request: Request) -> dict[str, Any]:
    auth.require_platform(_session(request))
    auth.require_permission(_session(request), "organisations.view")
    if uses_postgres():
        with _pg_connect() as conn:
            return organisation_detail(conn, org_id)
    with _sqlite_connect() as conn:
        return organisation_detail(conn, org_id)


@router.post("/organisations", summary="Create organisation")
def create_organisation(body: OrganisationBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.create")
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    reserved = {
        DEFAULT_ORG_NAME.casefold(),
        LEGACY_DEFAULT_ORG_NAME.casefold(),
        PRE_REBRAND_LEGACY_ORG_NAME.casefold(),
    }
    if name.casefold() in reserved:
        raise HTTPException(
            status_code=400,
            detail="“Test Organisation” is reserved for the system sandbox. Use the existing test organisation.",
        )
    for field, label in [
        (body.business_address, "Business address"),
        (body.city, "City"),
        (body.state, "State"),
        (body.country, "Country"),
        (body.pincode, "Pincode"),
    ]:
        if not field.strip():
            raise HTTPException(status_code=400, detail=f"{label} is required")

    if uses_postgres():
        with _pg_connect() as conn:
            plan_id = body.plan_id
            if plan_id is None:
                row = conn.execute(
                    "SELECT id FROM subscription_plans WHERE status = 'active' ORDER BY id LIMIT 1"
                ).fetchone()
                if not row:
                    raise HTTPException(status_code=400, detail="No active subscription plan configured")
                plan_id = int(row["id"])

            if body.primary_admin:
                begin_transaction(conn)
                try:
                    result = create_organisation_with_primary_admin(
                        conn,
                        org=body.model_dump(),
                        primary_admin=body.primary_admin.model_dump(),
                        plan_id=plan_id,
                        billing_cycle=body.billing_cycle,
                        actor_user_id=session.user.id,
                    )
                    conn.commit()
                except Exception:
                    rollback_transaction(conn)
                    raise
                actor_user_id = result.pop("_audit_actor_user_id", session.user.id)
                org_id = int(result["organisation"]["id"])
                append_audit_log(
                    organisation_id=org_id,
                    actor_user_id=actor_user_id,
                    action="organisation.created",
                    entity_type="organisation",
                    entity_id=str(org_id),
                    new_value={
                        **result["organisation"],
                        "primary_admin_user_id": result["primary_admin"]["user_id"],
                    },
                )
                return result

            begin_transaction(conn)
            try:
                now = _now()
                row = conn.execute(
                    """
                    INSERT INTO organisations (
                        name, account_type, status, sandbox_tools,
                        legal_name, gstin, pan, business_address, city, state, country, pincode,
                        created_at, updated_at
                    )
                    VALUES (%s, %s, 'active', 0, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        name,
                        body.account_type,
                        body.legal_name,
                        body.gstin,
                        body.pan,
                        body.business_address,
                        body.city,
                        body.state,
                        body.country,
                        body.pincode,
                        now,
                        now,
                    ),
                ).fetchone()
                org_id = int(row["id"])
                from .billing_schema import org_code_for_id
                from .billing_repository import create_subscription_for_org

                conn.execute(
                    "UPDATE organisations SET org_code = %s WHERE id = %s",
                    (org_code_for_id(org_id), org_id),
                )
                set_pg_organisation_context(conn, org_id)
                conn.execute(
                    """
                    INSERT INTO trade_state (organisation_id, data)
                    VALUES (%s, %s::jsonb)
                    ON CONFLICT (organisation_id) DO NOTHING
                    """,
                    (org_id, json.dumps(DEFAULT_STATE)),
                )
                create_subscription_for_org(
                    conn,
                    organisation_id=org_id,
                    plan_id=plan_id,
                    billing_cycle=body.billing_cycle,
                )
                conn.commit()
            except Exception:
                rollback_transaction(conn)
                raise
            detail = organisation_detail(conn, org_id)
            append_audit_log(
                organisation_id=org_id,
                actor_user_id=session.user.id,
                action="organisation.created",
                entity_type="organisation",
                entity_id=str(org_id),
                new_value=detail["organisation"],
            )
            return detail

    with _sqlite_connect() as conn:
        plan_id = body.plan_id
        if plan_id is None:
            row = conn.execute(
                "SELECT id FROM subscription_plans WHERE status = 'active' ORDER BY id LIMIT 1"
            ).fetchone()
            if not row:
                raise HTTPException(status_code=400, detail="No active subscription plan configured")
            plan_id = int(row["id"])

        if body.primary_admin:
            begin_transaction(conn)
            try:
                result = create_organisation_with_primary_admin(
                    conn,
                    org=body.model_dump(),
                    primary_admin=body.primary_admin.model_dump(),
                    plan_id=plan_id,
                    billing_cycle=body.billing_cycle,
                    actor_user_id=session.user.id,
                )
                conn.commit()
            except Exception:
                rollback_transaction(conn)
                raise
            actor_user_id = result.pop("_audit_actor_user_id", session.user.id)
            org_id = int(result["organisation"]["id"])
            append_audit_log(
                organisation_id=org_id,
                actor_user_id=actor_user_id,
                action="organisation.created",
                entity_type="organisation",
                entity_id=str(org_id),
                new_value={
                    **result["organisation"],
                    "primary_admin_user_id": result["primary_admin"]["user_id"],
                },
            )
            return result

        begin_transaction(conn)
        try:
            now = _now()
            cur = conn.execute(
                """
                INSERT INTO organisations (
                    name, account_type, status, sandbox_tools,
                    legal_name, gstin, pan, business_address, city, state, country, pincode,
                    created_at, updated_at
                )
                VALUES (?, ?, 'active', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    name,
                    body.account_type,
                    body.legal_name,
                    body.gstin,
                    body.pan,
                    body.business_address,
                    body.city,
                    body.state,
                    body.country,
                    body.pincode,
                    now,
                    now,
                ),
            )
            org_id = int(cur.lastrowid)
            from .billing_schema import org_code_for_id
            from .billing_repository import create_subscription_for_org

            conn.execute(
                "UPDATE organisations SET org_code = ? WHERE id = ?",
                (org_code_for_id(org_id), org_id),
            )
            conn.execute(
                "INSERT OR IGNORE INTO trade_state (organisation_id, data) VALUES (?, ?)",
                (org_id, json.dumps(DEFAULT_STATE)),
            )
            create_subscription_for_org(
                conn,
                organisation_id=org_id,
                plan_id=plan_id,
                billing_cycle=body.billing_cycle,
            )
            conn.commit()
        except Exception:
            rollback_transaction(conn)
            raise
        detail = organisation_detail(conn, org_id)
        append_audit_log(
            organisation_id=org_id,
            actor_user_id=session.user.id,
            action="organisation.created",
            entity_type="organisation",
            entity_id=str(org_id),
            new_value=detail["organisation"],
        )
        return detail


@router.patch("/organisations/{org_id}", summary="Update organisation")
def update_organisation(org_id: int, body: OrganisationUpdateBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    updates: list[str] = []
    values: list[Any] = []
    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="Nothing to update")
    for key, val in data.items():
        updates.append(f"{key} = ?" if not uses_postgres() else f"{key} = %s")
        values.append(val.strip() if isinstance(val, str) else val)
    now = _now()
    updates.append("updated_at = ?" if not uses_postgres() else "updated_at = %s")
    values.append(now)
    values.append(org_id)
    sql = f"UPDATE organisations SET {', '.join(updates)} WHERE id = {'?' if not uses_postgres() else '%s'}"
    if uses_postgres():
        with _pg_connect() as conn:
            old = conn.execute("SELECT * FROM organisations WHERE id = %s", (org_id,)).fetchone()
            if not old:
                raise HTTPException(status_code=404, detail="Organisation not found")
            conn.execute(sql, tuple(values))
            conn.commit()
            detail = organisation_detail(conn, org_id)
            append_audit_log(
                organisation_id=org_id,
                actor_user_id=session.user.id,
                action="organisation.updated",
                entity_type="organisation",
                entity_id=str(org_id),
                old_value=dict(old),
                new_value=data,
            )
            return detail
    with _sqlite_connect() as conn:
        old = conn.execute("SELECT * FROM organisations WHERE id = ?", (org_id,)).fetchone()
        if not old:
            raise HTTPException(status_code=404, detail="Organisation not found")
        conn.execute(sql, tuple(values))
        conn.commit()
        detail = organisation_detail(conn, org_id)
        append_audit_log(
            organisation_id=org_id,
            actor_user_id=session.user.id,
            action="organisation.updated",
            entity_type="organisation",
            entity_id=str(org_id),
            old_value=dict(old),
            new_value=data,
        )
        return detail


@router.delete("/organisations/{org_id}", summary="Delete organisation")
def remove_organisation(org_id: int, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.delete")
    if uses_postgres():
        with _pg_connect() as conn:
            deleted = delete_organisation(conn, org_id, actor_user_id=session.user.id)
            conn.commit()
            return {"ok": True, "organisation": deleted}
    with _sqlite_connect() as conn:
        deleted = delete_organisation(conn, org_id, actor_user_id=session.user.id)
        conn.commit()
        return {"ok": True, "organisation": deleted}


@router.post("/organisations/{org_id}/seats", summary="Add purchased seats")
def purchase_seats(org_id: int, body: AddSeatsBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "subscriptions.manage")
    if uses_postgres():
        with _pg_connect() as conn:
            seats = add_purchased_seat(
                conn,
                org_id,
                actor_user_id=session.user.id,
                count=body.count,
                seat_type=body.seat_type,
            )
            conn.commit()
            return {"organisation_id": org_id, "seats": seats}
    with _sqlite_connect() as conn:
        seats = add_purchased_seat(
            conn,
            org_id,
            actor_user_id=session.user.id,
            count=body.count,
            seat_type=body.seat_type,
        )
        conn.commit()
        return {"organisation_id": org_id, "seats": seats}


@router.get("/users", summary="List users")
def list_users(request: Request) -> dict[str, Any]:
    auth.require_platform(_session(request))
    q = """
        SELECT u.id, u.username, u.email, u.phone, u.name, u.organisation_id, u.account_type, u.status,
               r.slug AS role_slug, r.name AS role_name, o.name AS organisation_name,
               m.seat_id, m.status AS membership_status
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN organisations o ON o.id = u.organisation_id
        LEFT JOIN organisation_members m ON m.user_id = u.id AND m.organisation_id = u.organisation_id
        WHERE r.scope = 'organisation' OR r.slug = 'platform_admin'
        ORDER BY u.username
    """
    if uses_postgres():
        with _pg_connect() as conn:
            rows = conn.execute(q).fetchall()
            return {"users": [dict(r) for r in rows]}
    with _sqlite_connect() as conn:
        rows = conn.execute(q).fetchall()
        return {"users": [dict(r) for r in rows]}


@router.post("/users", summary="Create user")
def create_user(body: CreateUserBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "users.create")
    username = body.username.strip()
    if not username or not body.password:
        raise HTTPException(status_code=400, detail="Username and password are required")
    if uses_postgres():
        with _pg_connect() as conn:
            org = conn.execute("SELECT id FROM organisations WHERE id = %s", (body.organisation_id,)).fetchone()
            if not org:
                raise HTTPException(status_code=400, detail="Organisation not found")
            user_id = create_org_user_with_seat(
                conn,
                username=username,
                password=body.password,
                name=body.name.strip() or username,
                email=body.email.strip(),
                phone=body.phone.strip(),
                organisation_id=body.organisation_id,
                role_slug=body.role_slug,
                account_type=body.account_type,
            )
            conn.commit()
            append_audit_log(
                organisation_id=body.organisation_id,
                actor_user_id=session.user.id,
                action="user.created",
                entity_type="user",
                entity_id=str(user_id),
                new_value={"username": username, "role": body.role_slug},
            )
            return {"id": user_id, "username": username}

    with _sqlite_connect() as conn:
        org = conn.execute("SELECT id FROM organisations WHERE id = ?", (body.organisation_id,)).fetchone()
        if not org:
            raise HTTPException(status_code=400, detail="Organisation not found")
        user_id = create_org_user_with_seat(
            conn,
            username=username,
            password=body.password,
            name=body.name.strip() or username,
            email=body.email.strip(),
            phone=body.phone.strip(),
            organisation_id=body.organisation_id,
            role_slug=body.role_slug,
            account_type=body.account_type,
        )
        conn.commit()
        append_audit_log(
            organisation_id=body.organisation_id,
            actor_user_id=session.user.id,
            action="user.created",
            entity_type="user",
            entity_id=str(user_id),
            new_value={"username": username, "role": body.role_slug},
        )
        return {"id": user_id, "username": username}


@router.post("/users/{user_id}/reset-sign-in", summary="Reset organisation user sign-in")
def reset_user_sign_in(user_id: int, request: Request) -> dict[str, Any]:
    """Issue a new temporary password for an organisation user (share securely with the customer)."""
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "users.create")
    if uses_postgres():
        with _pg_connect() as conn:
            row = conn.execute(
                """
                SELECT u.id, u.organisation_id, r.slug AS role_slug
                FROM users u
                JOIN roles r ON r.id = u.role_id
                WHERE u.id = %s
                """,
                (user_id,),
            ).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="User not found")
            r = dict(row)
            if r["role_slug"] == "platform_admin":
                raise HTTPException(status_code=400, detail="Cannot reset platform admin sign-in here")
            org_id = r.get("organisation_id")
            if org_id is None:
                raise HTTPException(status_code=400, detail="User is not linked to an organisation")
            result = reset_organisation_member_sign_in(
                conn,
                organisation_id=int(org_id),
                user_id=user_id,
                actor_user_id=session.user.id,
            )
            conn.commit()
            return result
    with _sqlite_connect() as conn:
        row = conn.execute(
            """
            SELECT u.id, u.organisation_id, r.slug AS role_slug
            FROM users u
            JOIN roles r ON r.id = u.role_id
            WHERE u.id = ?
            """,
            (user_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        r = dict(row)
        if r["role_slug"] == "platform_admin":
            raise HTTPException(status_code=400, detail="Cannot reset platform admin sign-in here")
        org_id = r.get("organisation_id")
        if org_id is None:
            raise HTTPException(status_code=400, detail="User is not linked to an organisation")
        result = reset_organisation_member_sign_in(
            conn,
            organisation_id=int(org_id),
            user_id=user_id,
            actor_user_id=session.user.id,
        )
        conn.commit()
        return result


@router.delete("/users/{user_id}", summary="Delete user")
def remove_user(user_id: int, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "users.delete")
    if uses_postgres():
        with _pg_connect() as conn:
            deleted = delete_platform_user(conn, user_id, actor_user_id=session.user.id)
            conn.commit()
            return {"ok": True, "user": deleted}
    with _sqlite_connect() as conn:
        deleted = delete_platform_user(conn, user_id, actor_user_id=session.user.id)
        conn.commit()
        return {"ok": True, "user": deleted}


@router.patch("/users/{user_id}", summary="Update user role or status")
def update_user(user_id: int, body: UpdateUserBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    if body.role_slug:
        auth.require_permission(session, "users.role_change")
    if body.status:
        auth.require_permission(session, "users.disable")
    if not body.role_slug and not body.status:
        raise HTTPException(status_code=400, detail="Nothing to update")
    now = _now()
    if uses_postgres():
        with _pg_connect() as conn:
            existing = conn.execute(
                "SELECT id, role_id, status, organisation_id FROM users WHERE id = %s",
                (user_id,),
            ).fetchone()
            if not existing:
                raise HTTPException(status_code=404, detail="User not found")
            org_id = existing["organisation_id"]
            if body.role_slug:
                conn.execute(
                    """
                    UPDATE users SET role_id = r.id, updated_at = %s
                    FROM roles r WHERE users.id = %s AND r.slug = %s
                    """,
                    (now, user_id, body.role_slug),
                )
                role = conn.execute("SELECT id FROM roles WHERE slug = %s", (body.role_slug,)).fetchone()
                if org_id and role:
                    upsert_organisation_member(
                        conn,
                        organisation_id=int(org_id),
                        user_id=user_id,
                        role_id=int(role["id"]),
                        active=existing["status"] == "active" and (body.status or existing["status"]) == "active",
                    )
            if body.status:
                conn.execute(
                    "UPDATE users SET status = %s, updated_at = %s WHERE id = %s",
                    (body.status, now, user_id),
                )
                if org_id:
                    role = conn.execute("SELECT role_id FROM users WHERE id = %s", (user_id,)).fetchone()
                    upsert_organisation_member(
                        conn,
                        organisation_id=int(org_id),
                        user_id=user_id,
                        role_id=int(role["role_id"]),
                        active=body.status == "active",
                    )
            conn.commit()
            append_audit_log(
                organisation_id=existing["organisation_id"],
                actor_user_id=session.user.id,
                action="user.updated",
                entity_type="user",
                entity_id=str(user_id),
                old_value={"role_id": existing["role_id"], "status": existing["status"]},
                new_value={"role_slug": body.role_slug, "status": body.status},
            )
            return {"ok": True}

    with _sqlite_connect() as conn:
        existing = conn.execute(
            "SELECT id, role_id, status, organisation_id FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="User not found")
        org_id = existing["organisation_id"]
        if body.role_slug:
            role = conn.execute("SELECT id FROM roles WHERE slug = ?", (body.role_slug,)).fetchone()
            if not role:
                raise HTTPException(status_code=400, detail="Invalid role")
            conn.execute(
                "UPDATE users SET role_id = ?, updated_at = ? WHERE id = ?",
                (role["id"], now, user_id),
            )
            if org_id:
                upsert_organisation_member(
                    conn,
                    organisation_id=int(org_id),
                    user_id=user_id,
                    role_id=int(role["id"]),
                    active=existing["status"] == "active" and (body.status or existing["status"]) == "active",
                )
        if body.status:
            conn.execute(
                "UPDATE users SET status = ?, updated_at = ? WHERE id = ?",
                (body.status, now, user_id),
            )
            if org_id:
                role = conn.execute("SELECT role_id FROM users WHERE id = ?", (user_id,)).fetchone()
                upsert_organisation_member(
                    conn,
                    organisation_id=int(org_id),
                    user_id=user_id,
                    role_id=int(role["role_id"]),
                    active=body.status == "active",
                )
        conn.commit()
        append_audit_log(
            organisation_id=existing["organisation_id"],
            actor_user_id=session.user.id,
            action="user.updated",
            entity_type="user",
            entity_id=str(user_id),
            old_value={"role_id": existing["role_id"], "status": existing["status"]},
            new_value={"role_slug": body.role_slug, "status": body.status},
        )
        return {"ok": True}


@router.get("/seats", summary="Licensed seats across organisations")
def list_seats(request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.view")
    if uses_postgres():
        with _pg_connect() as conn:
            return {"seats": list_platform_seats(conn)}
    with _sqlite_connect() as conn:
        return {"seats": list_platform_seats(conn)}


@router.get("/inbox", summary="Needs attention — open platform actions (server unread)")
def platform_action_inbox(request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.view")
    from .platform_inbox import platform_action_inbox as load_inbox

    if uses_postgres():
        with _pg_connect() as conn:
            return load_inbox(conn)
    with _sqlite_connect() as conn:
        return load_inbox(conn)


@router.get("/seat-requests/summary", summary="Open seat requests count (platform notifications)")
def seat_requests_summary(request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.view")
    if uses_postgres():
        with _pg_connect() as conn:
            pending_count = count_open_seat_requests(conn)
            pending = list_seat_requests_platform(conn, status="pending_payment", limit=20)
            paid = list_seat_requests_platform(conn, status="paid", limit=20)
    else:
        with _sqlite_connect() as conn:
            pending_count = count_open_seat_requests(conn)
            pending = list_seat_requests_platform(conn, status="pending_payment", limit=20)
            paid = list_seat_requests_platform(conn, status="paid", limit=20)
    open_requests = sorted(
        pending + paid,
        key=lambda r: r.get("created_at") or "",
        reverse=True,
    )
    return {"pending_count": pending_count, "open_requests": open_requests}


@router.get("/seat-requests", summary="Seat add-on requests (all organisations)")
def list_platform_seat_requests(
    request: Request,
    status: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.view")
    if uses_postgres():
        with _pg_connect() as conn:
            return {"requests": list_seat_requests_platform(conn, status=status, limit=limit)}
    with _sqlite_connect() as conn:
        return {"requests": list_seat_requests_platform(conn, status=status, limit=limit)}


@router.post("/seat-requests/{request_id}/mark-paid", summary="Record payment for a seat request")
def platform_mark_seat_request_paid(
    request_id: int,
    body: MarkSeatRequestPaidBody,
    request: Request,
) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "subscriptions.manage")
    if uses_postgres():
        with _pg_connect() as conn:
            req = mark_seat_request_paid(
                conn,
                request_id,
                actor_user_id=session.user.id,
                payment_reference=body.payment_reference,
            )
            conn.commit()
            return {"request": req}
    with _sqlite_connect() as conn:
        req = mark_seat_request_paid(
            conn,
            request_id,
            actor_user_id=session.user.id,
            payment_reference=body.payment_reference,
        )
        conn.commit()
        return {"request": req}


@router.post("/seat-requests/{request_id}/approve", summary="Approve seat request and add seats")
def platform_approve_seat_request(
    request_id: int,
    body: ApproveSeatRequestBody,
    request: Request,
) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "subscriptions.manage")
    if uses_postgres():
        with _pg_connect() as conn:
            result = approve_seat_request(
                conn,
                request_id,
                actor_user_id=session.user.id,
                payment_reference=body.payment_reference,
                admin_note=body.admin_note,
            )
            conn.commit()
            return result
    with _sqlite_connect() as conn:
        result = approve_seat_request(
            conn,
            request_id,
            actor_user_id=session.user.id,
            payment_reference=body.payment_reference,
            admin_note=body.admin_note,
        )
        conn.commit()
        return result


@router.post("/seat-requests/{request_id}/reject", summary="Reject a seat request")
def platform_reject_seat_request(
    request_id: int,
    body: RejectSeatRequestBody,
    request: Request,
) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "subscriptions.manage")
    if uses_postgres():
        with _pg_connect() as conn:
            req = reject_seat_request(
                conn,
                request_id,
                actor_user_id=session.user.id,
                admin_note=body.admin_note,
            )
            conn.commit()
            return {"request": req}
    with _sqlite_connect() as conn:
        req = reject_seat_request(
            conn,
            request_id,
            actor_user_id=session.user.id,
            admin_note=body.admin_note,
        )
        conn.commit()
        return {"request": req}


@router.get("/audit-logs", summary="Platform audit log")
def list_audit_logs(
    request: Request,
    organisation_id: int | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "platform.audit")
    if uses_postgres():
        with _pg_connect() as conn:
            if organisation_id:
                rows = conn.execute(
                    """
                    SELECT * FROM audit_logs WHERE organisation_id = %s
                    ORDER BY id DESC LIMIT %s
                    """,
                    (organisation_id, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM audit_logs ORDER BY id DESC LIMIT %s",
                    (limit,),
                ).fetchall()
            return {"logs": [dict(r) for r in rows]}
    with _sqlite_connect() as conn:
        if organisation_id:
            rows = conn.execute(
                """
                SELECT * FROM audit_logs WHERE organisation_id = ?
                ORDER BY id DESC LIMIT ?
                """,
                (organisation_id, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return {"logs": [dict(r) for r in rows]}


class LicenceStatusBody(BaseModel):
    status: str


class RenewAmcBody(BaseModel):
    payment_status: str = "pending"


class PaymentBody(BaseModel):
    organisation_id: int
    payment_type: str
    amount_cents: int
    payment_date: str = ""
    payment_reference: str = ""
    status: str = "paid"
    notes: str = ""
    licence_id: int | None = None
    amc_id: int | None = None


class PaymentPatchBody(BaseModel):
    status: str | None = None
    notes: str | None = None
    payment_reference: str | None = None


@router.get("/dashboard", summary="Platform commercial metrics")
def platform_dashboard(request: Request) -> dict[str, Any]:
    auth.require_platform(_session(request))
    auth.require_permission(_session(request), "organisations.view")
    from .licence_repository import dashboard_metrics

    if uses_postgres():
        with _pg_connect() as conn:
            return dashboard_metrics(conn)
    with _sqlite_connect() as conn:
        return dashboard_metrics(conn)


@router.get("/licenses", summary="Organisation licences")
def list_org_licenses(request: Request) -> dict[str, Any]:
    auth.require_platform(_session(request))
    auth.require_permission(_session(request), "subscriptions.view")
    from .licence_repository import list_licenses

    if uses_postgres():
        with _pg_connect() as conn:
            return {"licenses": list_licenses(conn)}
    with _sqlite_connect() as conn:
        return {"licenses": list_licenses(conn)}


@router.patch("/licenses/{licence_id}", summary="Update licence status")
def patch_licence(licence_id: int, body: LicenceStatusBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "subscriptions.manage")
    from .licence_repository import set_licence_status

    if uses_postgres():
        with _pg_connect() as conn:
            licence = set_licence_status(conn, licence_id, body.status, session.user.id)
            conn.commit()
            return {"licence": licence}
    with _sqlite_connect() as conn:
        licence = set_licence_status(conn, licence_id, body.status, session.user.id)
        conn.commit()
        return {"licence": licence}


@router.get("/amcs", summary="AMC / renewal register")
def list_org_amcs(request: Request) -> dict[str, Any]:
    auth.require_platform(_session(request))
    auth.require_permission(_session(request), "subscriptions.view")
    from .licence_repository import list_amcs

    if uses_postgres():
        with _pg_connect() as conn:
            return {"amcs": list_amcs(conn)}
    with _sqlite_connect() as conn:
        return {"amcs": list_amcs(conn)}


@router.post("/licenses/{licence_id}/renew-amc", summary="Start next AMC period using licence snapshot price")
def renew_licence_amc(licence_id: int, body: RenewAmcBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "subscriptions.manage")
    from .licence_repository import renew_amc

    if uses_postgres():
        with _pg_connect() as conn:
            amc = renew_amc(conn, licence_id, session.user.id, body.payment_status)
            conn.commit()
            return {"amc": amc}
    with _sqlite_connect() as conn:
        amc = renew_amc(conn, licence_id, session.user.id, body.payment_status)
        conn.commit()
        return {"amc": amc}


@router.get("/payments", summary="Licence / AMC / seat payments")
def list_org_payments(request: Request) -> dict[str, Any]:
    auth.require_platform(_session(request))
    auth.require_permission(_session(request), "subscriptions.view")
    from .licence_repository import list_payments

    if uses_postgres():
        with _pg_connect() as conn:
            return {"payments": list_payments(conn)}
    with _sqlite_connect() as conn:
        return {"payments": list_payments(conn)}


@router.post("/payments", summary="Record a manual payment")
def create_org_payment(body: PaymentBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "subscriptions.manage")
    from .licence_repository import record_payment

    payload = dict(
        organisation_id=body.organisation_id,
        payment_type=body.payment_type,
        amount_cents=body.amount_cents,
        payment_date=body.payment_date,
        payment_reference=body.payment_reference,
        status=body.status,
        notes=body.notes,
        licence_id=body.licence_id,
        amc_id=body.amc_id,
        actor_user_id=session.user.id,
    )
    if uses_postgres():
        with _pg_connect() as conn:
            payment = record_payment(conn, **payload)
            conn.commit()
            return {"payment": payment}
    with _sqlite_connect() as conn:
        payment = record_payment(conn, **payload)
        conn.commit()
        return {"payment": payment}


@router.patch("/payments/{payment_id}", summary="Update payment status")
def patch_org_payment(payment_id: int, body: PaymentPatchBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "subscriptions.manage")
    from .licence_repository import update_payment

    patch = body.model_dump(exclude_none=True)
    if uses_postgres():
        with _pg_connect() as conn:
            payment = update_payment(conn, payment_id, patch, session.user.id)
            conn.commit()
            return {"payment": payment}
    with _sqlite_connect() as conn:
        payment = update_payment(conn, payment_id, patch, session.user.id)
        conn.commit()
        return {"payment": payment}


class SendNotificationBody(BaseModel):
    audience: str = "user"
    organisation_id: int | None = None
    recipient_user_id: int | None = None
    recipient_scope: str = "org_admin"
    exclude_expired_amc: bool = False
    kind: str
    title: str
    body: str = ""
    href: str = ""
    payload: dict[str, Any] = Field(default_factory=dict)
    feature_key: str = ""


@router.post("/notifications", summary="Send an in-app notice to a chosen audience")
def send_org_notification(
    body: SendNotificationBody,
    request: Request,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .notifications_repository import create_notifications_for_audience
    from .notification_worker import schedule_campaign_processing

    payload = dict(body.payload or {})
    if body.feature_key.strip():
        payload["feature_key"] = body.feature_key.strip()
    # Single-user stays inline so credentials notices exist before the response returns.
    # org / active_licences enqueue a campaign and fan out after the response.
    process_inline = body.audience == "user"
    kwargs = dict(
        audience=body.audience,
        organisation_id=body.organisation_id,
        recipient_user_id=body.recipient_user_id,
        recipient_scope=body.recipient_scope,
        exclude_expired_amc=body.exclude_expired_amc,
        kind=body.kind,
        title=body.title,
        body=body.body,
        payload=payload,
        href=body.href,
        actor_user_id=session.user.id,
        process_inline=process_inline,
        source="manual",
    )
    if uses_postgres():
        with _pg_connect() as conn:
            result = create_notifications_for_audience(conn, **kwargs)
            conn.commit()
    else:
        with _sqlite_connect() as conn:
            result = create_notifications_for_audience(conn, **kwargs)
            conn.commit()
    result.pop("notifications", None)
    if result.get("queued"):
        schedule_campaign_processing(background_tasks)
    return result


@router.get("/notification-campaigns", summary="List recent notification campaigns")
def list_notification_campaigns(
    request: Request,
    limit: int = Query(default=50, ge=1, le=200),
) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .notification_campaigns_repository import list_campaigns

    if uses_postgres():
        with _pg_connect() as conn:
            return {"campaigns": list_campaigns(conn, limit=limit)}
    with _sqlite_connect() as conn:
        return {"campaigns": list_campaigns(conn, limit=limit)}


@router.get("/notification-campaigns/{campaign_id}", summary="Get a notification campaign")
def get_notification_campaign(campaign_id: int, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .notification_campaigns_repository import get_campaign

    if uses_postgres():
        with _pg_connect() as conn:
            return {"campaign": get_campaign(conn, campaign_id)}
    with _sqlite_connect() as conn:
        return {"campaign": get_campaign(conn, campaign_id)}


@router.post("/notification-campaigns/{campaign_id}/process", summary="Run or retry campaign fan-out")
def process_notification_campaign(campaign_id: int, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .notification_campaigns_repository import process_campaign

    if uses_postgres():
        with _pg_connect() as conn:
            result = process_campaign(conn, campaign_id)
            conn.commit()
            result.pop("notifications", None)
            return result
    with _sqlite_connect() as conn:
        result = process_campaign(conn, campaign_id)
        conn.commit()
        result.pop("notifications", None)
        return result


class ReleaseItemBody(BaseModel):
    category: str
    title: str
    detail: str = ""
    feature_key: str = ""


class ReleaseBody(BaseModel):
    version: str
    title: str
    summary: str = ""
    items: list[ReleaseItemBody]


class PublishReleaseBody(BaseModel):
    audience: str = "active_licences"
    organisation_id: int | None = None
    recipient_user_id: int | None = None
    recipient_scope: str = "org_admin"
    exclude_expired_amc: bool = True


@router.get("/releases", summary="List versioned product releases")
def list_platform_releases(request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .releases_repository import list_releases

    if uses_postgres():
        with _pg_connect() as conn:
            return list_releases(conn)
    with _sqlite_connect() as conn:
        return list_releases(conn)


@router.post("/releases", summary="Create a draft product release")
def create_platform_release(body: ReleaseBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .releases_repository import create_release

    items = [item.model_dump() for item in body.items]
    if uses_postgres():
        with _pg_connect() as conn:
            release = create_release(
                conn,
                version=body.version,
                title=body.title,
                summary=body.summary,
                items=items,
                actor_user_id=session.user.id,
            )
            conn.commit()
            return {"release": release}
    with _sqlite_connect() as conn:
        release = create_release(
            conn,
            version=body.version,
            title=body.title,
            summary=body.summary,
            items=items,
            actor_user_id=session.user.id,
        )
        conn.commit()
        return {"release": release}


@router.patch("/releases/{release_id}", summary="Update a draft product release")
def update_platform_release(release_id: int, body: ReleaseBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .releases_repository import update_release

    items = [item.model_dump() for item in body.items]
    if uses_postgres():
        with _pg_connect() as conn:
            release = update_release(
                conn,
                release_id,
                version=body.version,
                title=body.title,
                summary=body.summary,
                items=items,
                actor_user_id=session.user.id,
            )
            conn.commit()
            return {"release": release}
    with _sqlite_connect() as conn:
        release = update_release(
            conn,
            release_id,
            version=body.version,
            title=body.title,
            summary=body.summary,
            items=items,
            actor_user_id=session.user.id,
        )
        conn.commit()
        return {"release": release}


@router.post("/releases/{release_id}/publish", summary="Publish a release to a chosen audience")
def publish_platform_release(
    release_id: int,
    body: PublishReleaseBody,
    request: Request,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .releases_repository import publish_release
    from .notification_worker import schedule_campaign_processing

    kwargs = dict(
        audience=body.audience,
        organisation_id=body.organisation_id,
        recipient_user_id=body.recipient_user_id,
        recipient_scope=body.recipient_scope,
        exclude_expired_amc=body.exclude_expired_amc,
        actor_user_id=session.user.id,
    )
    if uses_postgres():
        with _pg_connect() as conn:
            release = publish_release(conn, release_id, **kwargs)
            conn.commit()
    else:
        with _sqlite_connect() as conn:
            release = publish_release(conn, release_id, **kwargs)
            conn.commit()
    if release.get("queued"):
        schedule_campaign_processing(background_tasks)
    return {"release": release}
