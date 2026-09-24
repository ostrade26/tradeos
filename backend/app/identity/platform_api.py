"""Tradeal platform admin — organisations, subscriptions, seats, and users."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field, model_validator

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
    delete_platform_user,
    organisation_detail,
    seat_summary,
    upsert_organisation_member,
)
from .org_members_repository import reset_organisation_member_sign_in
from .billing_schema import DEFAULT_ORG_NAME, LEGACY_DEFAULT_ORG_NAME, PRE_REBRAND_LEGACY_ORG_NAME
from .email_validation import optional_contact_email
from .login_username import require_login_username
from .repository import append_audit_log
from .seat_request_repository import (
    approve_seat_request,
    count_open_seat_requests,
    list_seat_requests_platform,
    mark_seat_request_paid,
    reject_seat_request,
)

router = APIRouter(prefix="/api/v1/platform", tags=["platform"])


def _attach_org_admin_welcome_email(result: dict[str, Any]) -> dict[str, Any]:
    """Send welcome + temp password email after org create; set welcome_email_sent."""
    from .email_welcome import send_org_admin_welcome_email

    pa = result.get("primary_admin") or {}
    email = (pa.get("email") or "").strip()
    password = (pa.get("temporary_password") or "").strip()
    org_name = ((result.get("organisation") or {}).get("name") or "").strip()
    if not email or not password:
        result["welcome_email_sent"] = False
        return result
    result["welcome_email_sent"] = send_org_admin_welcome_email(
        to=email,
        name=str(pa.get("name") or ""),
        organisation_name=org_name,
        login_id=str(pa.get("login_id") or pa.get("username") or ""),
        temporary_password=password,
    )
    return result


class PrimaryAdminBody(BaseModel):
    name: str
    username: str
    email: str = ""
    mobile: str = ""
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
    # Temporary QA/demo customer — listed under Test and deletable.
    is_test: bool = False


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
    is_test: bool | None = None


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

    @model_validator(mode="after")
    def included_seats_from_roles(self) -> PlanBody:
        total = int(self.included_admin_seats) + int(self.included_operator_seats)
        self.included_seats = max(1, total)
        return self


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


def _session_or_deploy_token(request: Request) -> auth.Session | None:
    session = getattr(request.state, "session", None)
    if session:
        return session
    if auth.is_api_token_request(request):
        return None
    raise HTTPException(status_code=401, detail="Not authenticated")


def _deploy_actor_user_id(conn, session: auth.Session | None) -> int:
    if session:
        return session.user.id
    from .platform_admins_repository import list_platform_admins

    admins = list_platform_admins(conn)
    if not admins:
        raise HTTPException(status_code=503, detail="No Tradeal platform admin account to attribute deploy")
    return int(admins[0]["id"])


def _org_list_fields() -> str:
    return """
        id, org_code, name, account_type, status, legal_name, gstin, pan,
        business_address, city, state, country, pincode,
        primary_contact_name, primary_contact_email, primary_contact_mobile,
        sandbox_tools, is_test, created_at, updated_at
    """  # sandbox_tools = system sandbox; is_test = temporary QA account (deletable)


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


@router.delete("/plans/{plan_id}", summary="Delete an inactive subscription plan")
def delete_plan(plan_id: int, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "subscription_plans.manage")

    def _delete(conn) -> dict[str, Any]:
        ph = "%s" if uses_postgres() else "?"
        row = conn.execute(
            f"SELECT * FROM subscription_plans WHERE id = {ph}",
            (plan_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Plan not found")
        plan = dict(row)
        if str(plan.get("status") or "") != "inactive":
            raise HTTPException(
                status_code=403,
                detail="Only inactive plans can be deleted. Set status to Inactive first.",
            )
        sub_count_row = conn.execute(
            f"SELECT COUNT(*) AS c FROM subscriptions WHERE plan_id = {ph}",
            (plan_id,),
        ).fetchone()
        assigned = int(dict(sub_count_row)["c"] if sub_count_row else 0)
        moved_to: dict[str, Any] | None = None
        if assigned > 0:
            fallback = conn.execute(
                f"""
                SELECT id, name, slug FROM subscription_plans
                WHERE status = 'active' AND id <> {ph}
                ORDER BY id
                LIMIT 1
                """,
                (plan_id,),
            ).fetchone()
            if not fallback:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "This plan is still assigned to organisations and there is no other "
                        "active plan to move them to. Activate or create another plan first."
                    ),
                )
            moved_to = dict(fallback)
            now = _now()
            conn.execute(
                f"""
                UPDATE subscriptions
                SET plan_id = {ph}, updated_at = {ph}
                WHERE plan_id = {ph}
                """,
                (int(moved_to["id"]), now, plan_id),
            )
        # Historical licences keep plan_name; clear FK so the row can be removed.
        conn.execute(
            f"UPDATE organisation_licenses SET plan_id = NULL WHERE plan_id = {ph}",
            (plan_id,),
        )
        conn.execute(f"DELETE FROM subscription_plans WHERE id = {ph}", (plan_id,))
        append_audit_log(
            organisation_id=None,
            actor_user_id=session.user.id,
            action="subscription_plan.deleted",
            entity_type="subscription_plan",
            entity_id=str(plan_id),
            old_value=plan,
            new_value={"moved_subscriptions_to": moved_to, "moved_count": assigned} if moved_to else None,
        )
        return {**plan, "_moved_to": moved_to, "_moved_count": assigned}

    if uses_postgres():
        with _pg_connect() as conn:
            plan = _delete(conn)
            conn.commit()
            moved_to = plan.pop("_moved_to", None)
            moved_count = plan.pop("_moved_count", 0)
            return {"deleted": plan, "moved_to": moved_to, "moved_count": moved_count}
    with _sqlite_connect() as conn:
        plan = _delete(conn)
        conn.commit()
        moved_to = plan.pop("_moved_to", None)
        moved_count = plan.pop("_moved_count", 0)
        return {"deleted": plan, "moved_to": moved_to, "moved_count": moved_count}


@router.get("/organisations", summary="List organisations")
def list_organisations(request: Request) -> dict[str, Any]:
    auth.require_platform(_session(request))
    auth.require_permission(_session(request), "organisations.view")
    fields = _org_list_fields()
    q = f"""
        SELECT {fields},
          COALESCE(
            (
              SELECT p.name
              FROM subscriptions s
              JOIN subscription_plans p ON p.id = s.plan_id
              WHERE s.organisation_id = organisations.id
                AND s.status IN ('trial', 'active', 'past_due')
              ORDER BY s.id DESC
              LIMIT 1
            ),
            (
              SELECT l.plan_name
              FROM organisation_licenses l
              WHERE l.organisation_id = organisations.id
              ORDER BY l.id DESC
              LIMIT 1
            ),
            ''
          ) AS plan_name
        FROM organisations
        ORDER BY name
    """
    if uses_postgres():
        with _pg_connect() as conn:
            rows = conn.execute(q).fetchall()
            orgs = [dict(r) for r in rows]
            for org in orgs:
                org["seats"] = seat_summary(conn, int(org["id"]))
            return {"organisations": orgs}
    with _sqlite_connect() as conn:
        rows = conn.execute(q).fetchall()
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

    if body.primary_admin:
        body.primary_admin.username = require_login_username(body.primary_admin.username)
        admin_email = (body.primary_admin.email or "").strip()
        if not admin_email:
            raise HTTPException(
                status_code=400,
                detail="Primary admin email is required so we can send their sign-in details.",
            )
        body.primary_admin.email = optional_contact_email(admin_email)

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
                return _attach_org_admin_welcome_email(result)

            begin_transaction(conn)
            try:
                now = _now()
                row = conn.execute(
                    """
                    INSERT INTO organisations (
                        name, account_type, status, sandbox_tools, is_test,
                        legal_name, gstin, pan, business_address, city, state, country, pincode,
                        created_at, updated_at
                    )
                    VALUES (%s, %s, 'active', 0, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        name,
                        body.account_type,
                        1 if body.is_test else 0,
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
                    (org_code_for_id(org_id, is_test=bool(body.is_test)), org_id),
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
            return _attach_org_admin_welcome_email(result)

        begin_transaction(conn)
        try:
            now = _now()
            cur = conn.execute(
                """
                INSERT INTO organisations (
                    name, account_type, status, sandbox_tools, is_test,
                    legal_name, gstin, pan, business_address, city, state, country, pincode,
                    created_at, updated_at
                )
                VALUES (?, ?, 'active', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    name,
                    body.account_type,
                    1 if body.is_test else 0,
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
                (org_code_for_id(org_id, is_test=bool(body.is_test)), org_id),
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
    if data.get("status") == "disabled":
        data["status"] = "inactive"
    # Test flag is set only at create time — ignore on edit.
    data.pop("is_test", None)
    if not data:
        raise HTTPException(status_code=400, detail="Nothing to update")
    if "primary_contact_email" in data:
        data["primary_contact_email"] = optional_contact_email(
            str(data.get("primary_contact_email") or "")
        )
    old_status = None
    for key, val in data.items():
        updates.append(f"{key} = ?" if not uses_postgres() else f"{key} = %s")
        values.append(val.strip() if isinstance(val, str) else val)
    now = _now()
    updates.append("updated_at = ?" if not uses_postgres() else "updated_at = %s")
    values.append(now)
    values.append(org_id)
    sql = f"UPDATE organisations SET {', '.join(updates)} WHERE id = {'?' if not uses_postgres() else '%s'}"

    def _sync_primary_admin_contact(conn) -> None:
        """Keep primary admin user in sync with org contact fields (email for reset/welcome)."""
        from .billing_repository import login_identity_in_use
        from .org_members_repository import find_primary_admin_user

        contact_keys = {"primary_contact_name", "primary_contact_email", "primary_contact_mobile"}
        if not (contact_keys & set(data.keys())):
            return
        admin = find_primary_admin_user(conn, org_id)
        if not admin:
            return
        user_id = int(admin["user_id"])
        name = data.get("primary_contact_name")
        email = data.get("primary_contact_email")
        mobile = data.get("primary_contact_mobile")
        sets: list[str] = []
        params: list[Any] = []
        if name is not None:
            sets.append("name = %s" if uses_postgres() else "name = ?")
            params.append(str(name).strip())
        if email is not None:
            email_norm = optional_contact_email(str(email))
            if email_norm and login_identity_in_use(
                conn, "", email_norm, exclude_user_id=user_id
            ):
                raise HTTPException(status_code=400, detail="This email is already in use")
            sets.append("email = %s" if uses_postgres() else "email = ?")
            params.append(email_norm)
        if mobile is not None:
            sets.append("phone = %s" if uses_postgres() else "phone = ?")
            params.append(str(mobile).strip())
        if not sets:
            return
        sets.append("updated_at = %s" if uses_postgres() else "updated_at = ?")
        params.append(now)
        params.append(user_id)
        conn.execute(
            f"UPDATE users SET {', '.join(sets)} WHERE id = {'%s' if uses_postgres() else '?'}",
            tuple(params),
        )

    def _sync_org_code_prefix(conn) -> None:
        """Keep ORG- vs T-ORG- in sync when test flag changes."""
        if "is_test" not in data:
            return
        from .billing_schema import org_code_for_id

        is_test = bool(data.get("is_test"))
        row = (
            conn.execute("SELECT org_code FROM organisations WHERE id = %s", (org_id,)).fetchone()
            if uses_postgres()
            else conn.execute("SELECT org_code FROM organisations WHERE id = ?", (org_id,)).fetchone()
        )
        old_code = str((dict(row).get("org_code") if row else None) or "").strip()
        new_code = org_code_for_id(org_id, is_test=is_test)
        if not old_code or old_code == new_code:
            if not old_code:
                if uses_postgres():
                    conn.execute(
                        "UPDATE organisations SET org_code = %s WHERE id = %s",
                        (new_code, org_id),
                    )
                else:
                    conn.execute(
                        "UPDATE organisations SET org_code = ? WHERE id = ?",
                        (new_code, org_id),
                    )
            return
        expected_live = org_code_for_id(org_id, is_test=False)
        expected_test = org_code_for_id(org_id, is_test=True)
        if old_code not in (expected_live, expected_test):
            return
        if uses_postgres():
            conn.execute("UPDATE organisations SET org_code = %s WHERE id = %s", (new_code, org_id))
            conn.execute(
                """
                UPDATE organisation_seats
                SET seat_label = %s || substr(seat_label, %s)
                WHERE organisation_id = %s AND seat_label LIKE %s
                """,
                (new_code, len(old_code) + 1, org_id, old_code + "%"),
            )
        else:
            conn.execute("UPDATE organisations SET org_code = ? WHERE id = ?", (new_code, org_id))
            conn.execute(
                """
                UPDATE organisation_seats
                SET seat_label = ? || substr(seat_label, ?)
                WHERE organisation_id = ? AND seat_label LIKE ?
                """,
                (new_code, len(old_code) + 1, org_id, old_code + "%"),
            )

    if uses_postgres():
        with _pg_connect() as conn:
            old = conn.execute("SELECT * FROM organisations WHERE id = %s", (org_id,)).fetchone()
            if not old:
                raise HTTPException(status_code=404, detail="Organisation not found")
            old_status = str(dict(old).get("status") or "")
            conn.execute(sql, tuple(values))
            _sync_primary_admin_contact(conn)
            _sync_org_code_prefix(conn)
            conn.commit()
            detail = organisation_detail(conn, org_id)
            action = "organisation.updated"
            if "status" in data and data["status"] != old_status:
                action = (
                    "organisation.deactivated"
                    if data["status"] == "inactive"
                    else "organisation.activated"
                    if data["status"] == "active"
                    else action
                )
            append_audit_log(
                organisation_id=org_id,
                actor_user_id=session.user.id,
                action=action,
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
        old_status = str(dict(old).get("status") or "")
        conn.execute(sql, tuple(values))
        _sync_primary_admin_contact(conn)
        _sync_org_code_prefix(conn)
        conn.commit()
        detail = organisation_detail(conn, org_id)
        action = "organisation.updated"
        if "status" in data and data["status"] != old_status:
            action = (
                "organisation.deactivated"
                if data["status"] == "inactive"
                else "organisation.activated"
                if data["status"] == "active"
                else action
            )
        append_audit_log(
            organisation_id=org_id,
            actor_user_id=session.user.id,
            action=action,
            entity_type="organisation",
            entity_id=str(org_id),
            old_value=dict(old),
            new_value=data,
        )
        return detail


@router.delete("/organisations/{org_id}", summary="Delete a test organisation")
def remove_organisation(org_id: int, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .billing_repository import delete_organisation

    if uses_postgres():
        with _pg_connect() as conn:
            row = conn.execute(
                "SELECT id, name, sandbox_tools, is_test FROM organisations WHERE id = %s",
                (org_id,),
            ).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Organisation not found")
            data = dict(row)
            if data.get("sandbox_tools"):
                raise HTTPException(
                    status_code=403,
                    detail="The system sandbox organisation cannot be deleted.",
                )
            if not data.get("is_test"):
                raise HTTPException(
                    status_code=403,
                    detail="Only test accounts can be deleted. Mark the organisation as Test, or deactivate a real customer instead.",
                )
            snapshot = delete_organisation(conn, org_id, actor_user_id=session.user.id)
            conn.commit()
            return {"deleted": snapshot}
    with _sqlite_connect() as conn:
        row = conn.execute(
            "SELECT id, name, sandbox_tools, is_test FROM organisations WHERE id = ?",
            (org_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Organisation not found")
        data = dict(row)
        if data.get("sandbox_tools"):
            raise HTTPException(
                status_code=403,
                detail="The system sandbox organisation cannot be deleted.",
            )
        if not data.get("is_test"):
            raise HTTPException(
                status_code=403,
                detail="Only test accounts can be deleted. Mark the organisation as Test, or deactivate a real customer instead.",
            )
        snapshot = delete_organisation(conn, org_id, actor_user_id=session.user.id)
        conn.commit()
        return {"deleted": snapshot}


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


class CreatePlatformAdminBody(BaseModel):
    username: str
    name: str


class ResetSignInBody(BaseModel):
    username: str = ""


@router.get("/admins", summary="List Tradeal platform admins")
def list_platform_admin_accounts(request: Request) -> dict[str, Any]:
    auth.require_platform(_session(request))
    from .platform_admins_repository import list_platform_admins

    if uses_postgres():
        with _pg_connect() as conn:
            return {"admins": list_platform_admins(conn)}
    with _sqlite_connect() as conn:
        return {"admins": list_platform_admins(conn)}


@router.post("/admins", summary="Create a Tradeal platform admin")
def create_platform_admin_account(body: CreatePlatformAdminBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "users.create")
    from .platform_admins_repository import create_platform_admin

    if uses_postgres():
        with _pg_connect() as conn:
            admin = create_platform_admin(
                conn,
                username=body.username,
                name=body.name,
                actor_user_id=session.user.id,
            )
            conn.commit()
            return {"admin": admin}
    with _sqlite_connect() as conn:
        admin = create_platform_admin(
            conn,
            username=body.username,
            name=body.name,
            actor_user_id=session.user.id,
        )
        conn.commit()
        return {"admin": admin}


@router.post("/admins/{user_id}/reset-sign-in", summary="Reset another Tradeal Admin sign-in")
def reset_platform_admin_account(
    user_id: int,
    request: Request,
    body: ResetSignInBody | None = None,
) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "users.create")
    from .platform_admins_repository import reset_platform_admin_sign_in

    username = (body.username if body else "") or None
    if uses_postgres():
        with _pg_connect() as conn:
            result = reset_platform_admin_sign_in(
                conn, user_id=user_id, actor_user_id=session.user.id, username=username
            )
            conn.commit()
            return result
    with _sqlite_connect() as conn:
        result = reset_platform_admin_sign_in(
            conn, user_id=user_id, actor_user_id=session.user.id, username=username
        )
        conn.commit()
        return result


@router.post("/users/{user_id}/reset-sign-in", summary="Reset organisation user sign-in")
def reset_user_sign_in(
    user_id: int,
    request: Request,
    body: ResetSignInBody | None = None,
) -> dict[str, Any]:
    """Issue a new temporary password for an organisation user (share securely with the customer)."""
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "users.create")
    username = (body.username if body else "") or None
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
                username=username,
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
            username=username,
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
    from .email_lifecycle import send_seat_request_lifecycle_email

    if uses_postgres():
        with _pg_connect() as conn:
            req = mark_seat_request_paid(
                conn,
                request_id,
                actor_user_id=session.user.id,
                payment_reference=body.payment_reference,
            )
            conn.commit()
            send_seat_request_lifecycle_email(conn, req, decision="paid")
            return {"request": req}
    with _sqlite_connect() as conn:
        req = mark_seat_request_paid(
            conn,
            request_id,
            actor_user_id=session.user.id,
            payment_reference=body.payment_reference,
        )
        conn.commit()
        send_seat_request_lifecycle_email(conn, req, decision="paid")
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
    from .email_lifecycle import send_seat_request_lifecycle_email

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
            send_seat_request_lifecycle_email(conn, result["request"], decision="approved")
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
        send_seat_request_lifecycle_email(conn, result["request"], decision="approved")
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
    from .email_lifecycle import send_seat_request_lifecycle_email

    if uses_postgres():
        with _pg_connect() as conn:
            req = reject_seat_request(
                conn,
                request_id,
                actor_user_id=session.user.id,
                admin_note=body.admin_note,
            )
            conn.commit()
            send_seat_request_lifecycle_email(conn, req, decision="rejected")
            return {"request": req}
    with _sqlite_connect() as conn:
        req = reject_seat_request(
            conn,
            request_id,
            actor_user_id=session.user.id,
            admin_note=body.admin_note,
        )
        conn.commit()
        send_seat_request_lifecycle_email(conn, req, decision="rejected")
        return {"request": req}


class ProductRequestReviewBody(BaseModel):
    status: str = Field(pattern="^(received|in_progress|done)$")
    reply: str = ""


@router.get("/product-requests/summary", summary="Open org requests for platform notifications")
def product_requests_summary(request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.view")
    from .product_request_repository import count_open_product_requests, list_open_product_requests_platform

    if uses_postgres():
        with _pg_connect() as conn:
            pending_count = count_open_product_requests(conn)
            open_requests = list_open_product_requests_platform(conn, limit=20)
    else:
        with _sqlite_connect() as conn:
            pending_count = count_open_product_requests(conn)
            open_requests = list_open_product_requests_platform(conn, limit=20)
    return {"pending_count": pending_count, "open_requests": open_requests}


@router.get("/product-requests", summary="Issues, improvements, and new needs from organisations")
def list_platform_product_requests(
    request: Request,
    status: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.view")
    from .product_request_repository import list_product_requests_platform

    if uses_postgres():
        with _pg_connect() as conn:
            return {"requests": list_product_requests_platform(conn, status=status, limit=limit)}
    with _sqlite_connect() as conn:
        return {"requests": list_product_requests_platform(conn, status=status, limit=limit)}


@router.patch("/product-requests/{request_id}", summary="Update status and reply to the requester")
def review_platform_product_request(
    request_id: int,
    body: ProductRequestReviewBody,
    request: Request,
) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .product_request_repository import review_product_request

    if uses_postgres():
        with _pg_connect() as conn:
            req = review_product_request(
                conn,
                request_id,
                status=body.status,
                reply=body.reply,
                actor_user_id=session.user.id,
            )
            conn.commit()
            return {"request": req}
    with _sqlite_connect() as conn:
        req = review_product_request(
            conn,
            request_id,
            status=body.status,
            reply=body.reply,
            actor_user_id=session.user.id,
        )
        conn.commit()
        return {"request": req}


class FeatureInterestReviewBody(BaseModel):
    note: str = ""


@router.get("/feature-interests/summary", summary="Open feature access requests")
def feature_interests_summary(request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .feature_interests_repository import count_open_interests_platform, list_open_interests_platform

    if uses_postgres():
        with _pg_connect() as conn:
            return {
                "open_count": count_open_interests_platform(conn),
                "open": list_open_interests_platform(conn, limit=20),
            }
    with _sqlite_connect() as conn:
        return {
            "open_count": count_open_interests_platform(conn),
            "open": list_open_interests_platform(conn, limit=20),
        }


@router.get("/feature-interests", summary="List organisation feature access requests")
def list_feature_interests(
    request: Request,
    status: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .feature_interests_repository import list_interests_platform

    if uses_postgres():
        with _pg_connect() as conn:
            return {"interests": list_interests_platform(conn, status=status, limit=limit)}
    with _sqlite_connect() as conn:
        return {"interests": list_interests_platform(conn, status=status, limit=limit)}


@router.post("/feature-interests/{interest_id}/approve", summary="Approve feature access for an organisation")
def approve_feature_interest(
    interest_id: int,
    body: FeatureInterestReviewBody,
    request: Request,
) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .email_lifecycle import send_feature_interest_lifecycle_email
    from .feature_interests_repository import approve_interest

    if uses_postgres():
        with _pg_connect() as conn:
            item = approve_interest(conn, interest_id=interest_id, actor_user_id=session.user.id, note=body.note)
            conn.commit()
            send_feature_interest_lifecycle_email(conn, item, decision="approved")
            return {"interest": item}
    with _sqlite_connect() as conn:
        item = approve_interest(conn, interest_id=interest_id, actor_user_id=session.user.id, note=body.note)
        conn.commit()
        send_feature_interest_lifecycle_email(conn, item, decision="approved")
        return {"interest": item}


@router.post("/feature-interests/{interest_id}/reject", summary="Decline feature access for an organisation")
def reject_feature_interest(
    interest_id: int,
    body: FeatureInterestReviewBody,
    request: Request,
) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .email_lifecycle import send_feature_interest_lifecycle_email
    from .feature_interests_repository import reject_interest

    if uses_postgres():
        with _pg_connect() as conn:
            item = reject_interest(conn, interest_id=interest_id, actor_user_id=session.user.id, note=body.note)
            conn.commit()
            send_feature_interest_lifecycle_email(conn, item, decision="rejected")
            return {"interest": item}
    with _sqlite_connect() as conn:
        item = reject_interest(conn, interest_id=interest_id, actor_user_id=session.user.id, note=body.note)
        conn.commit()
        send_feature_interest_lifecycle_email(conn, item, decision="rejected")
        return {"interest": item}


class FeatureOfferBody(BaseModel):
    feature_key: str
    title: str
    description: str = ""
    pricing_type: str = "free"
    price_cents: int = 0
    currency: str = "INR"
    sort_order: int = 0
    card_tone: str = ""
    card_image_url: str = ""
    card_featured: bool = False
    card_bg_hex: str = ""
    card_tag: str = ""


class FeatureOfferStatusBody(BaseModel):
    catalog_status: str
    # When listing: False = list quietly; True = also inbox-notify licensed orgs.
    notify_orgs: bool = False


@router.get("/feature-offers", summary="Add-ons catalog")
def list_platform_feature_offers(request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .feature_offers_repository import list_offers_platform_enriched

    if uses_postgres():
        with _pg_connect() as conn:
            return {"offers": list_offers_platform_enriched(conn)}
    with _sqlite_connect() as conn:
        return {"offers": list_offers_platform_enriched(conn)}


@router.post("/feature-offers", summary="Create add-on offer")
def create_platform_feature_offer(body: FeatureOfferBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .feature_offers_repository import upsert_offer

    if uses_postgres():
        with _pg_connect() as conn:
            offer = upsert_offer(
                conn,
                offer_id=None,
                feature_key=body.feature_key,
                title=body.title,
                description=body.description,
                pricing_type=body.pricing_type,
                price_cents=body.price_cents,
                currency=body.currency,
                sort_order=body.sort_order,
                card_tone=body.card_tone,
                card_image_url=body.card_image_url,
                card_featured=body.card_featured,
                card_bg_hex=body.card_bg_hex,
                card_tag=body.card_tag,
                actor_user_id=session.user.id,
            )
            conn.commit()
            return {"offer": offer}
    with _sqlite_connect() as conn:
        offer = upsert_offer(
            conn,
            offer_id=None,
            feature_key=body.feature_key,
            title=body.title,
            description=body.description,
            pricing_type=body.pricing_type,
            price_cents=body.price_cents,
            currency=body.currency,
            sort_order=body.sort_order,
            card_tone=body.card_tone,
            card_image_url=body.card_image_url,
            card_featured=body.card_featured,
            card_bg_hex=body.card_bg_hex,
            card_tag=body.card_tag,
            actor_user_id=session.user.id,
        )
        conn.commit()
        return {"offer": offer}


@router.patch("/feature-offers/{offer_id}", summary="Update add-on offer")
def update_platform_feature_offer(offer_id: int, body: FeatureOfferBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .feature_offers_repository import upsert_offer

    if uses_postgres():
        with _pg_connect() as conn:
            offer = upsert_offer(
                conn,
                offer_id=offer_id,
                feature_key=body.feature_key,
                title=body.title,
                description=body.description,
                pricing_type=body.pricing_type,
                price_cents=body.price_cents,
                currency=body.currency,
                sort_order=body.sort_order,
                card_tone=body.card_tone,
                card_image_url=body.card_image_url,
                card_featured=body.card_featured,
                card_bg_hex=body.card_bg_hex,
                card_tag=body.card_tag,
                actor_user_id=session.user.id,
            )
            conn.commit()
            return {"offer": offer}
    with _sqlite_connect() as conn:
        offer = upsert_offer(
            conn,
            offer_id=offer_id,
            feature_key=body.feature_key,
            title=body.title,
            description=body.description,
            pricing_type=body.pricing_type,
            price_cents=body.price_cents,
            currency=body.currency,
            sort_order=body.sort_order,
            card_tone=body.card_tone,
            card_image_url=body.card_image_url,
            card_featured=body.card_featured,
            card_bg_hex=body.card_bg_hex,
            card_tag=body.card_tag,
            actor_user_id=session.user.id,
        )
        conn.commit()
        return {"offer": offer}


@router.delete("/feature-offers/{offer_id}", summary="Delete add-on offer from catalog")
def delete_platform_feature_offer(offer_id: int, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .feature_offers_repository import delete_offer

    if uses_postgres():
        with _pg_connect() as conn:
            offer = delete_offer(conn, offer_id, actor_user_id=session.user.id)
            conn.commit()
            return {"ok": True, "offer": offer}
    with _sqlite_connect() as conn:
        offer = delete_offer(conn, offer_id, actor_user_id=session.user.id)
        conn.commit()
        return {"ok": True, "offer": offer}


@router.get("/feature-offers/{offer_id}/usage", summary="Organisations using a feature offer")
def get_platform_feature_offer_usage(offer_id: int, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .feature_offers_repository import get_offer_usage

    if uses_postgres():
        with _pg_connect() as conn:
            return get_offer_usage(conn, offer_id)
    with _sqlite_connect() as conn:
        return get_offer_usage(conn, offer_id)


@router.post("/feature-offers/{offer_id}/catalog-status", summary="List, retire, or draft an offer")
def set_platform_feature_offer_status(
    offer_id: int,
    body: FeatureOfferStatusBody,
    request: Request,
) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .feature_offers_repository import set_catalog_status

    if uses_postgres():
        with _pg_connect() as conn:
            offer = set_catalog_status(
                conn,
                offer_id,
                catalog_status=body.catalog_status,
                actor_user_id=session.user.id,
                notify_orgs=body.notify_orgs,
            )
            conn.commit()
            return {"offer": offer}
    with _sqlite_connect() as conn:
        offer = set_catalog_status(
            conn,
            offer_id,
            catalog_status=body.catalog_status,
            actor_user_id=session.user.id,
            notify_orgs=body.notify_orgs,
        )
        conn.commit()
        return {"offer": offer}


class ShipPlanningBody(BaseModel):
    ready_to_ship: bool = False
    target_ship_date: str = ""
    ship_notes: str = ""


class AnnounceProductUpdateBody(BaseModel):
    audience: str = "active_licences"
    organisation_id: int | None = None
    recipient_user_id: int | None = None
    recipient_scope: str = "org_admin"
    exclude_expired_amc: bool = True
    notify_organisations: bool = True


@router.get("/ship-queue", summary="Draft offers, releases, and deferred product updates waiting to ship")
def get_ship_queue(request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .ship_queue_repository import list_ship_queue

    if uses_postgres():
        with _pg_connect() as conn:
            return list_ship_queue(conn)
    with _sqlite_connect() as conn:
        return list_ship_queue(conn)


@router.patch("/feature-offers/{offer_id}/ship-planning", summary="Update draft offer ship planning")
def patch_feature_offer_ship_planning(
    offer_id: int,
    body: ShipPlanningBody,
    request: Request,
) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .feature_offers_repository import update_offer_ship_planning

    if uses_postgres():
        with _pg_connect() as conn:
            offer = update_offer_ship_planning(
                conn,
                offer_id,
                ready_to_ship=body.ready_to_ship,
                target_ship_date=body.target_ship_date,
                ship_notes=body.ship_notes,
                actor_user_id=session.user.id,
            )
            conn.commit()
            return {"offer": offer}
    with _sqlite_connect() as conn:
        offer = update_offer_ship_planning(
            conn,
            offer_id,
            ready_to_ship=body.ready_to_ship,
            target_ship_date=body.target_ship_date,
            ship_notes=body.ship_notes,
            actor_user_id=session.user.id,
        )
        conn.commit()
        return {"offer": offer}


@router.patch("/releases/{release_id}/ship-planning", summary="Update draft release ship planning")
def patch_release_ship_planning(
    release_id: int,
    body: ShipPlanningBody,
    request: Request,
) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .releases_repository import update_release_ship_planning

    if uses_postgres():
        with _pg_connect() as conn:
            release = update_release_ship_planning(
                conn,
                release_id,
                ready_to_ship=body.ready_to_ship,
                target_ship_date=body.target_ship_date,
                ship_notes=body.ship_notes,
                actor_user_id=session.user.id,
            )
            conn.commit()
            return {"release": release}
    with _sqlite_connect() as conn:
        release = update_release_ship_planning(
            conn,
            release_id,
            ready_to_ship=body.ready_to_ship,
            target_ship_date=body.target_ship_date,
            ship_notes=body.ship_notes,
            actor_user_id=session.user.id,
        )
        conn.commit()
        return {"release": release}


@router.patch(
    "/release-items/{item_id}/ship-planning",
    summary="Update deferred product-update ship planning",
)
def patch_release_item_ship_planning(
    item_id: int,
    body: ShipPlanningBody,
    request: Request,
) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .releases_repository import update_release_item_ship_planning

    if uses_postgres():
        with _pg_connect() as conn:
            item = update_release_item_ship_planning(
                conn,
                item_id,
                ready_to_ship=body.ready_to_ship,
                target_ship_date=body.target_ship_date,
                ship_notes=body.ship_notes,
                actor_user_id=session.user.id,
            )
            conn.commit()
            return {"item": item}
    with _sqlite_connect() as conn:
        item = update_release_item_ship_planning(
            conn,
            item_id,
            ready_to_ship=body.ready_to_ship,
            target_ship_date=body.target_ship_date,
            ship_notes=body.ship_notes,
            actor_user_id=session.user.id,
        )
        conn.commit()
        return {"item": item}


@router.post(
    "/release-items/{item_id}/announce",
    summary="Publish a deferred product update from Ship queue",
)
def announce_release_item(item_id: int, body: AnnounceProductUpdateBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .releases_repository import announce_product_update

    kwargs = dict(
        audience=body.audience,
        organisation_id=body.organisation_id,
        recipient_user_id=body.recipient_user_id,
        recipient_scope=body.recipient_scope,
        exclude_expired_amc=body.exclude_expired_amc,
        notify_organisations=body.notify_organisations,
        actor_user_id=session.user.id,
    )
    if uses_postgres():
        with _pg_connect() as conn:
            item = announce_product_update(conn, item_id, **kwargs)
            conn.commit()
            return {"item": item}
    with _sqlite_connect() as conn:
        item = announce_product_update(conn, item_id, **kwargs)
        conn.commit()
        return {"item": item}


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
    payment_type: str | None = None
    amount_cents: int | None = None
    payment_date: str | None = None
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


@router.delete("/payments/{payment_id}", summary="Remove a recorded payment")
def delete_org_payment(payment_id: int, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "subscriptions.manage")
    from .licence_repository import delete_payment

    if uses_postgres():
        with _pg_connect() as conn:
            payment = delete_payment(conn, payment_id, session.user.id)
            conn.commit()
            return {"deleted": payment}
    with _sqlite_connect() as conn:
        payment = delete_payment(conn, payment_id, session.user.id)
        conn.commit()
        return {"deleted": payment}


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
def send_org_notification(body: SendNotificationBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .notifications_repository import create_notifications_for_audience

    import json as _json

    from .notifications_repository import normalize_feature_key

    payload = dict(body.payload or {})
    if body.feature_key.strip():
        payload["feature_key"] = body.feature_key.strip()
    raw_items = str(payload.get("items") or "").strip()
    if body.kind in ("release_notes", "maintenance", "announcement", "backup_reminder"):
        payload.setdefault("cta", "acknowledge")
        if body.kind == "release_notes" and raw_items:
            lines = [ln.strip() for ln in raw_items.splitlines() if ln.strip()]
            payload["items"] = "\n".join(lines)
            payload["changelog"] = _json.dumps(
                [{"category": "ui_and_fixes", "title": line, "detail": line} for line in lines]
            )
    if body.kind == "feature_launch":
        payload.setdefault("cta", "interest")
        lines = [ln.strip() for ln in raw_items.splitlines() if ln.strip()] if raw_items else []
        if not lines and body.title.strip():
            lines = [body.title.strip()]
        entries = []
        keys = []
        for line in lines:
            key = normalize_feature_key(body.feature_key.strip() if len(lines) == 1 else "", line)
            entries.append(
                {"category": "feature_enhancement", "title": line, "detail": line, "feature_key": key}
            )
            keys.append(key)
        if entries:
            payload["changelog"] = _json.dumps(entries)
            payload["feature_keys"] = "\n".join(keys)
            payload["feature_key"] = keys[0]
            payload["items"] = "\n".join(lines)
    href = body.href.strip()
    if body.kind == "backup_reminder" and not href:
        href = "/app/settings/data"
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
        href=href,
        actor_user_id=session.user.id,
    )
    if uses_postgres():
        with _pg_connect() as conn:
            result = create_notifications_for_audience(conn, **kwargs)
            conn.commit()
            result.pop("notifications", None)
            return result
    with _sqlite_connect() as conn:
        result = create_notifications_for_audience(conn, **kwargs)
        conn.commit()
        result.pop("notifications", None)
        return result


class BackupReminderSettingsBody(BaseModel):
    enabled: bool | None = None
    frequency: str | None = None
    send_hour: int | None = None
    send_minute: int | None = None
    timezone: str | None = None
    weekdays: list[int] | None = None
    title: str | None = None
    body: str | None = None
    recipient_scope: str | None = None
    exclude_expired_amc: bool | None = None


@router.get("/backup-reminders", summary="Get backup reminder schedule")
def get_backup_reminders(request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.view")
    from .backup_reminder_repository import get_backup_reminder_settings

    if uses_postgres():
        with _pg_connect() as conn:
            return {"settings": get_backup_reminder_settings(conn)}
    with _sqlite_connect() as conn:
        return {"settings": get_backup_reminder_settings(conn)}


@router.patch("/backup-reminders", summary="Update backup reminder schedule")
def patch_backup_reminders(body: BackupReminderSettingsBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .backup_reminder_repository import update_backup_reminder_settings

    patch = body.model_dump(exclude_none=True)
    if uses_postgres():
        with _pg_connect() as conn:
            settings = update_backup_reminder_settings(conn, patch)
            append_audit_log(
                organisation_id=None,
                actor_user_id=session.user.id,
                action="backup_reminder.settings_updated",
                entity_type="backup_reminder_settings",
                entity_id="1",
                new_value=settings,
                conn=conn,
            )
            conn.commit()
            return {"settings": settings}
    with _sqlite_connect() as conn:
        settings = update_backup_reminder_settings(conn, patch)
        append_audit_log(
            organisation_id=None,
            actor_user_id=session.user.id,
            action="backup_reminder.settings_updated",
            entity_type="backup_reminder_settings",
            entity_id="1",
            new_value=settings,
            conn=conn,
        )
        conn.commit()
        return {"settings": settings}


@router.post("/backup-reminders/run", summary="Send backup reminders now")
def run_backup_reminders_now(request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .backup_reminder_repository import (
        BACKUP_HREF,
        get_backup_reminder_settings,
        mark_backup_reminder_sent,
    )
    from .notifications_repository import create_notifications_for_audience
    from zoneinfo import ZoneInfo

    if uses_postgres():
        with _pg_connect() as conn:
            settings = get_backup_reminder_settings(conn)
            result = create_notifications_for_audience(
                conn,
                audience="active_licences",
                organisation_id=None,
                recipient_user_id=None,
                recipient_scope="all_users",
                exclude_expired_amc=bool(settings.get("exclude_expired_amc", True)),
                kind="backup_reminder",
                title=str(settings.get("title") or "Backup reminder"),
                body=str(settings.get("body") or ""),
                payload={"cta": "acknowledge", "source": "manual"},
                href=BACKUP_HREF,
                actor_user_id=session.user.id,
            )
            tz = ZoneInfo(str(settings.get("timezone") or "Asia/Kolkata"))
            local_date = datetime.now(tz).date().isoformat()
            mark_backup_reminder_sent(conn, local_date=local_date)
            conn.commit()
            result.pop("notifications", None)
            return result
    with _sqlite_connect() as conn:
        settings = get_backup_reminder_settings(conn)
        result = create_notifications_for_audience(
            conn,
            audience="active_licences",
            organisation_id=None,
            recipient_user_id=None,
            recipient_scope="all_users",
            exclude_expired_amc=bool(settings.get("exclude_expired_amc", True)),
            kind="backup_reminder",
            title=str(settings.get("title") or "Backup reminder"),
            body=str(settings.get("body") or ""),
            payload={"cta": "acknowledge", "source": "manual"},
            href=BACKUP_HREF,
            actor_user_id=session.user.id,
        )
        tz = ZoneInfo(str(settings.get("timezone") or "Asia/Kolkata"))
        local_date = datetime.now(tz).date().isoformat()
        mark_backup_reminder_sent(conn, local_date=local_date)
        conn.commit()
        result.pop("notifications", None)
        return result


class ReleaseItemBody(BaseModel):
    category: str
    title: str
    detail: str = ""
    feature_key: str = ""
    announce_timing: str = "now"
    ready_to_ship: bool = False
    target_ship_date: str = ""
    ship_notes: str = ""


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
    notify_organisations: bool = True


class DeployReleaseItemBody(BaseModel):
    category: str
    title: str
    detail: str = ""
    feature_key: str = ""
    announce_timing: str = "now"
    ready_to_ship: bool = False
    target_ship_date: str = ""
    ship_notes: str = ""


class DeployReleaseBody(BaseModel):
    commit_sha: str
    environment: str = "production"
    title: str = ""
    summary: str = ""
    items: list[DeployReleaseItemBody] = Field(default_factory=list)
    notify_platform_admins: bool = True


@router.get(
    "/releases/deploy-anchor",
    summary="Last registered production deploy commit (for automatic changelogs in CI)",
)
def deploy_release_anchor(request: Request) -> dict[str, Any]:
    session = _session_or_deploy_token(request)
    if session:
        auth.require_platform(session)
        auth.require_permission(session, "organisations.edit")
    elif not auth.API_TOKEN:
        raise HTTPException(status_code=503, detail="Deploy hook is not configured (set TRADEAL_API_TOKEN)")
    from .releases_repository import latest_deploy_commit_sha

    if uses_postgres():
        with _pg_connect() as conn:
            since = latest_deploy_commit_sha(conn)
    else:
        with _sqlite_connect() as conn:
            since = latest_deploy_commit_sha(conn)
    return {"since_commit_sha": since or None}


@router.get("/releases", summary="List versioned product releases")
def list_platform_releases(request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .releases_repository import list_releases

    if uses_postgres():
        with _pg_connect() as conn:
            return list_releases(conn, for_display=True)
    with _sqlite_connect() as conn:
        return list_releases(conn, for_display=True)


@router.post(
    "/releases/from-deploy",
    summary="Register a production deploy as a draft release (CI / deploy hook)",
)
def register_deploy_release(body: DeployReleaseBody, request: Request) -> dict[str, Any]:
    session = _session_or_deploy_token(request)
    if session:
        auth.require_platform(session)
        auth.require_permission(session, "organisations.edit")
    elif not auth.API_TOKEN:
        raise HTTPException(status_code=503, detail="Deploy hook is not configured (set TRADEAL_API_TOKEN)")
    from .releases_repository import create_deploy_draft_release

    items = [item.model_dump() for item in body.items]
    if uses_postgres():
        with _pg_connect() as conn:
            actor_user_id = _deploy_actor_user_id(conn, session)
            result = create_deploy_draft_release(
                conn,
                commit_sha=body.commit_sha,
                environment=body.environment,
                title=body.title,
                summary=body.summary,
                items=items,
                actor_user_id=actor_user_id,
                notify_platform_admins=body.notify_platform_admins,
            )
            conn.commit()
            return result
    with _sqlite_connect() as conn:
        actor_user_id = _deploy_actor_user_id(conn, session)
        result = create_deploy_draft_release(
            conn,
            commit_sha=body.commit_sha,
            environment=body.environment,
            title=body.title,
            summary=body.summary,
            items=items,
            actor_user_id=actor_user_id,
            notify_platform_admins=body.notify_platform_admins,
        )
        conn.commit()
        return result


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
def publish_platform_release(release_id: int, body: PublishReleaseBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_platform(session)
    auth.require_permission(session, "organisations.edit")
    from .releases_repository import publish_release

    kwargs = dict(
        audience=body.audience,
        organisation_id=body.organisation_id,
        recipient_user_id=body.recipient_user_id,
        recipient_scope=body.recipient_scope,
        exclude_expired_amc=body.exclude_expired_amc,
        notify_organisations=body.notify_organisations,
        actor_user_id=session.user.id,
    )
    if uses_postgres():
        with _pg_connect() as conn:
            release = publish_release(conn, release_id, **kwargs)
            conn.commit()
            return {"release": release}
    with _sqlite_connect() as conn:
        release = publish_release(conn, release_id, **kwargs)
        conn.commit()
        return {"release": release}
