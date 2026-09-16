"""Organisation-scoped endpoints (subscription read-only for org admins)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from .. import auth
from .billing_repository import organisation_detail
from .org_members_repository import (
    create_organisation_member,
    list_organisation_members,
    reset_organisation_member_sign_in,
    set_organisation_member_password,
    set_organisation_member_status,
)
from .seat_request_repository import (
    cancel_seat_request,
    create_seat_request,
    organisation_seat_request_context,
)
from ..db import _pg_connect, _sqlite_connect, uses_postgres

router = APIRouter(prefix="/api/v1/organisation", tags=["organisation"])


def _session(request: Request) -> auth.Session:
    session = getattr(request.state, "session", None)
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return session


@router.get("/billing", summary="Subscription and seat usage (read-only)")
def organisation_billing(request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_permission(session, "organisation.subscription.view")
    org_id = session.user.organisation_id
    if org_id is None:
        raise HTTPException(status_code=403, detail="Organisation context required")
    if uses_postgres():
        with _pg_connect() as conn:
            return organisation_detail(conn, org_id)
    with _sqlite_connect() as conn:
        return organisation_detail(conn, org_id)


class SeatRequestBody(BaseModel):
    requested_seats: int = Field(default=1, ge=1, le=20)
    seat_type: str = Field(default="operator", pattern="^(operator|view_only)$")
    note: str = ""


@router.get("/seat-requests", summary="Seat add-on requests for your organisation")
def list_seat_requests(request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_permission(session, "organisation.subscription.view")
    org_id = session.user.organisation_id
    if org_id is None:
        raise HTTPException(status_code=403, detail="Organisation context required")
    if uses_postgres():
        with _pg_connect() as conn:
            return organisation_seat_request_context(conn, org_id)
    with _sqlite_connect() as conn:
        return organisation_seat_request_context(conn, org_id)


@router.post("/seat-requests", summary="Request additional seat(s)")
def submit_seat_request(body: SeatRequestBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_permission(session, "organisation.seats.request")
    org_id = session.user.organisation_id
    if org_id is None:
        raise HTTPException(status_code=403, detail="Organisation context required")
    if uses_postgres():
        with _pg_connect() as conn:
            req = create_seat_request(
                conn,
                organisation_id=org_id,
                requested_by_user_id=session.user.id,
                requested_seats=body.requested_seats,
                seat_type=body.seat_type,
                note=body.note,
            )
            conn.commit()
            return {"request": req}
    with _sqlite_connect() as conn:
        req = create_seat_request(
            conn,
            organisation_id=org_id,
            requested_by_user_id=session.user.id,
            requested_seats=body.requested_seats,
            seat_type=body.seat_type,
            note=body.note,
        )
        conn.commit()
        return {"request": req}


@router.post("/seat-requests/{request_id}/cancel", summary="Cancel a pending seat request")
def cancel_seat_request_route(request_id: int, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_permission(session, "organisation.seats.request")
    org_id = session.user.organisation_id
    if org_id is None:
        raise HTTPException(status_code=403, detail="Organisation context required")
    if uses_postgres():
        with _pg_connect() as conn:
            req = cancel_seat_request(
                conn, request_id, organisation_id=org_id, actor_user_id=session.user.id
            )
            conn.commit()
            return {"request": req}
    with _sqlite_connect() as conn:
        req = cancel_seat_request(conn, request_id, organisation_id=org_id, actor_user_id=session.user.id)
        conn.commit()
        return {"request": req}


class CreateMemberBody(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    name: str = ""
    password: str = Field(min_length=4)
    role_slug: str = Field(pattern="^(organisation_admin|operator|view_only)$")
    phone: str = ""
    account_type: str = Field(default="wholesaler_retailer", pattern="^(wholesaler_retailer|broker)$")


class MemberStatusBody(BaseModel):
    status: str = Field(pattern="^(active|inactive)$")


class MemberPasswordBody(BaseModel):
    password: str = Field(min_length=4)


@router.get("/members", summary="Licensed organisation users")
def list_members(request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_permission(session, "organisation.view")
    org_id = session.user.organisation_id
    if org_id is None:
        raise HTTPException(status_code=403, detail="Organisation context required")
    if uses_postgres():
        with _pg_connect() as conn:
            return {"members": list_organisation_members(conn, org_id)}
    with _sqlite_connect() as conn:
        return {"members": list_organisation_members(conn, org_id)}


@router.post("/members", summary="Create user on a licensed seat")
def create_member(body: CreateMemberBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_permission(session, "organisation.edit")
    org_id = session.user.organisation_id
    if org_id is None:
        raise HTTPException(status_code=403, detail="Organisation context required")
    if uses_postgres():
        with _pg_connect() as conn:
            user_id = create_organisation_member(
                conn,
                organisation_id=org_id,
                email=body.email,
                name=body.name,
                password=body.password,
                role_slug=body.role_slug,
                phone=body.phone,
                account_type=body.account_type,
                actor_user_id=session.user.id,
            )
            conn.commit()
            return {"id": user_id}
    with _sqlite_connect() as conn:
        user_id = create_organisation_member(
            conn,
            organisation_id=org_id,
            email=body.email,
            name=body.name,
            password=body.password,
            role_slug=body.role_slug,
            phone=body.phone,
            account_type=body.account_type,
            actor_user_id=session.user.id,
        )
        conn.commit()
        return {"id": user_id}


@router.patch("/members/{user_id}", summary="Activate or deactivate member")
def update_member_status(user_id: int, body: MemberStatusBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_permission(session, "organisation.edit")
    org_id = session.user.organisation_id
    if org_id is None:
        raise HTTPException(status_code=403, detail="Organisation context required")
    if uses_postgres():
        with _pg_connect() as conn:
            set_organisation_member_status(
                conn,
                organisation_id=org_id,
                user_id=user_id,
                status=body.status,
                actor_user_id=session.user.id,
            )
            conn.commit()
    else:
        with _sqlite_connect() as conn:
            set_organisation_member_status(
                conn,
                organisation_id=org_id,
                user_id=user_id,
                status=body.status,
                actor_user_id=session.user.id,
            )
            conn.commit()
    return {"ok": True}


@router.post("/members/{user_id}/reset-sign-in", summary="Reset member sign-in (org admin)")
def reset_member_sign_in(user_id: int, request: Request) -> dict[str, Any]:
    """Generate a temporary password for a team member. Share it securely — shown once in the response."""
    session = _session(request)
    auth.require_permission(session, "organisation.edit")
    org_id = session.user.organisation_id
    if org_id is None:
        raise HTTPException(status_code=403, detail="Organisation context required")
    if user_id == session.user.id:
        raise HTTPException(
            status_code=400,
            detail="Ask another organisation admin or Tradeal support to reset your own sign-in",
        )
    if uses_postgres():
        with _pg_connect() as conn:
            result = reset_organisation_member_sign_in(
                conn,
                organisation_id=org_id,
                user_id=user_id,
                actor_user_id=session.user.id,
            )
            conn.commit()
            return result
    with _sqlite_connect() as conn:
        result = reset_organisation_member_sign_in(
            conn,
            organisation_id=org_id,
            user_id=user_id,
            actor_user_id=session.user.id,
        )
        conn.commit()
        return result


@router.post("/members/{user_id}/password", summary="Set member password (org admin)")
def reset_member_password(user_id: int, body: MemberPasswordBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_permission(session, "organisation.edit")
    org_id = session.user.organisation_id
    if org_id is None:
        raise HTTPException(status_code=403, detail="Organisation context required")
    if uses_postgres():
        with _pg_connect() as conn:
            set_organisation_member_password(
                conn,
                organisation_id=org_id,
                user_id=user_id,
                password=body.password,
                actor_user_id=session.user.id,
            )
            conn.commit()
    else:
        with _sqlite_connect() as conn:
            set_organisation_member_password(
                conn,
                organisation_id=org_id,
                user_id=user_id,
                password=body.password,
                actor_user_id=session.user.id,
            )
            conn.commit()
    return {"ok": True}


@router.get("/notifications", summary="In-app notifications for the signed-in user")
def list_my_notifications(request: Request) -> dict[str, Any]:
    session = _session(request)
    from .notifications_repository import list_notifications_for_user, unread_count_for_user

    if uses_postgres():
        with _pg_connect() as conn:
            items = list_notifications_for_user(conn, session.user.id)
            unread = unread_count_for_user(conn, session.user.id)
            return {"notifications": items, "unread": unread}
    with _sqlite_connect() as conn:
        items = list_notifications_for_user(conn, session.user.id)
        unread = unread_count_for_user(conn, session.user.id)
        return {"notifications": items, "unread": unread}


@router.post("/notifications/read-all", summary="Mark all notifications read")
def mark_all_my_notifications_read(request: Request) -> dict[str, Any]:
    session = _session(request)
    from .notifications_repository import mark_all_read_for_user

    if uses_postgres():
        with _pg_connect() as conn:
            count = mark_all_read_for_user(conn, session.user.id)
            conn.commit()
            return {"ok": True, "updated": count}
    with _sqlite_connect() as conn:
        count = mark_all_read_for_user(conn, session.user.id)
        conn.commit()
        return {"ok": True, "updated": count}


@router.post("/notifications/{notification_id}/read", summary="Mark a notification read")
def mark_my_notification_read(notification_id: int, request: Request) -> dict[str, Any]:
    session = _session(request)
    from .notifications_repository import mark_notification_read

    if uses_postgres():
        with _pg_connect() as conn:
            item = mark_notification_read(conn, notification_id, session.user.id)
            conn.commit()
            return {"notification": item}
    with _sqlite_connect() as conn:
        item = mark_notification_read(conn, notification_id, session.user.id)
        conn.commit()
        return {"notification": item}


@router.post("/notifications/{notification_id}/apply", summary="Apply a product update from a notice")
def apply_my_notification_update(notification_id: int, request: Request) -> dict[str, Any]:
    session = _session(request)
    from .notifications_repository import apply_notification_update

    if uses_postgres():
        with _pg_connect() as conn:
            item = apply_notification_update(conn, notification_id, session.user.id)
            conn.commit()
            return {"notification": item, "applied": True}
    with _sqlite_connect() as conn:
        item = apply_notification_update(conn, notification_id, session.user.id)
        conn.commit()
        return {"notification": item, "applied": True}
