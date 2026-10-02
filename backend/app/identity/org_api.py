"""Organisation-scoped endpoints (subscription read-only for org admins)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from .. import auth
from .billing_repository import generate_temp_password, organisation_detail
from .org_members_repository import (
    create_organisation_member,
    list_organisation_members,
    reset_organisation_member_sign_in,
    set_organisation_member_sign_in,
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
    from .email_lifecycle import send_seat_request_submitted_to_platform

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
            send_seat_request_submitted_to_platform(conn, req)
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
        send_seat_request_submitted_to_platform(conn, req)
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


class ProductRequestAttachmentBody(BaseModel):
    name: str = ""
    mime: str
    data: str


class ProductRequestBody(BaseModel):
    kind: str = Field(pattern="^(issue|improvement|requirement)$")
    message: str = Field(min_length=8, max_length=2000)
    page_path: str = Field(default="", max_length=500)
    priority: str = Field(default="p3", pattern="^(p1|p2|p3)$")
    attachments: list[ProductRequestAttachmentBody] = Field(default_factory=list)


@router.get("/product-requests", summary="Your requests to Tradeal")
def list_my_product_requests(request: Request) -> dict[str, Any]:
    session = _session(request)
    org_id = session.user.organisation_id
    if org_id is None:
        raise HTTPException(status_code=403, detail="Organisation context required")
    from .product_request_repository import list_product_requests_for_user

    if uses_postgres():
        with _pg_connect() as conn:
            return {"requests": list_product_requests_for_user(conn, org_id, session.user.id)}
    with _sqlite_connect() as conn:
        return {"requests": list_product_requests_for_user(conn, org_id, session.user.id)}


@router.post("/product-requests", summary="Send an issue, improvement, or new need to Tradeal")
def submit_product_request(body: ProductRequestBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    org_id = session.user.organisation_id
    if org_id is None:
        raise HTTPException(status_code=403, detail="Organisation context required")
    from .email_lifecycle import send_product_request_submitted_to_platform
    from .product_request_repository import create_product_request

    if uses_postgres():
        with _pg_connect() as conn:
            req = create_product_request(
                conn,
                organisation_id=org_id,
                user_id=session.user.id,
                kind=body.kind,
                message=body.message,
                page_path=body.page_path,
                priority=body.priority,
                attachments=[item.model_dump() for item in body.attachments],
            )
            conn.commit()
            send_product_request_submitted_to_platform(conn, req)
            return {"request": req}
    with _sqlite_connect() as conn:
        req = create_product_request(
            conn,
            organisation_id=org_id,
            user_id=session.user.id,
            kind=body.kind,
            message=body.message,
            page_path=body.page_path,
            priority=body.priority,
            attachments=[item.model_dump() for item in body.attachments],
        )
        conn.commit()
        send_product_request_submitted_to_platform(conn, req)
        return {"request": req}


class CreateMemberBody(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    name: str = ""
    password: str = ""
    role_slug: str = Field(pattern="^(organisation_admin|operator|view_only)$")
    phone: str = ""
    account_type: str = Field(default="wholesaler_retailer", pattern="^(wholesaler_retailer|broker)$")


class MemberStatusBody(BaseModel):
    status: str = Field(pattern="^(active|inactive)$")


class MemberPasswordBody(BaseModel):
    password: str = ""
    username: str = ""


class ResetSignInBody(BaseModel):
    username: str = ""


def _create_member_with_welcome(
    conn,
    *,
    organisation_id: int,
    body: CreateMemberBody,
    actor_user_id: int,
) -> dict[str, Any]:
    from .email_welcome import send_teammate_welcome_email

    password = (body.password or "").strip()
    if password and len(password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    if not password:
        password = generate_temp_password()

    email = body.email.strip()
    name = body.name.strip() or email
    ph = "%s" if uses_postgres() else "?"
    org_row = conn.execute(
        f"SELECT account_type FROM organisations WHERE id = {ph}",
        (organisation_id,),
    ).fetchone()
    account_type = body.account_type
    if org_row:
        from ..db import row_dict

        stored = str(dict(row_dict(org_row)).get("account_type") or "").strip()
        if stored in ("wholesaler_retailer", "broker"):
            account_type = stored
    user_id = create_organisation_member(
        conn,
        organisation_id=organisation_id,
        email=email,
        name=name,
        password=password,
        role_slug=body.role_slug,
        phone=body.phone,
        account_type=account_type,
        actor_user_id=actor_user_id,
    )
    conn.commit()

    org_name = ""
    if uses_postgres():
        row = conn.execute("SELECT name FROM organisations WHERE id = %s", (organisation_id,)).fetchone()
    else:
        row = conn.execute("SELECT name FROM organisations WHERE id = ?", (organisation_id,)).fetchone()
    if row:
        from .billing_repository import _mapping

        org_name = str(_mapping(row).get("name") or "")

    welcome_email_sent = send_teammate_welcome_email(
        to=email,
        name=name,
        organisation_name=org_name,
        login_id=email.lower(),
        temporary_password=password,
    )
    return {"id": user_id, "welcome_email_sent": welcome_email_sent}


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
            return _create_member_with_welcome(
                conn,
                organisation_id=org_id,
                body=body,
                actor_user_id=session.user.id,
            )
    with _sqlite_connect() as conn:
        return _create_member_with_welcome(
            conn,
            organisation_id=org_id,
            body=body,
            actor_user_id=session.user.id,
        )


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
def reset_member_sign_in(
    user_id: int,
    request: Request,
    body: ResetSignInBody | None = None,
) -> dict[str, Any]:
    """Optionally set a new username, then generate a temporary password."""
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
    username = (body.username if body else "") or None
    if uses_postgres():
        with _pg_connect() as conn:
            result = reset_organisation_member_sign_in(
                conn,
                organisation_id=org_id,
                user_id=user_id,
                actor_user_id=session.user.id,
                username=username,
            )
            conn.commit()
            return result
    with _sqlite_connect() as conn:
        result = reset_organisation_member_sign_in(
            conn,
            organisation_id=org_id,
            user_id=user_id,
            actor_user_id=session.user.id,
            username=username,
        )
        conn.commit()
        return result


@router.post("/members/{user_id}/password", summary="Set member username and/or password (org admin)")
def reset_member_password(user_id: int, body: MemberPasswordBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_permission(session, "organisation.edit")
    org_id = session.user.organisation_id
    if org_id is None:
        raise HTTPException(status_code=403, detail="Organisation context required")
    if uses_postgres():
        with _pg_connect() as conn:
            result = set_organisation_member_sign_in(
                conn,
                organisation_id=org_id,
                user_id=user_id,
                actor_user_id=session.user.id,
                password=body.password,
                username=body.username,
            )
            conn.commit()
    else:
        with _sqlite_connect() as conn:
            result = set_organisation_member_sign_in(
                conn,
                organisation_id=org_id,
                user_id=user_id,
                actor_user_id=session.user.id,
                password=body.password,
                username=body.username,
            )
            conn.commit()
    return result


@router.get("/notifications", summary="In-app notifications for the signed-in user")
def list_my_notifications(
    request: Request,
    limit: int = Query(default=100, ge=1, le=200),
) -> dict[str, Any]:
    session = _session(request)
    from .notifications_repository import list_notifications_for_user, unread_count_for_user

    if uses_postgres():
        with _pg_connect() as conn:
            items = list_notifications_for_user(conn, session.user.id, limit=limit)
            unread = unread_count_for_user(conn, session.user.id)
            return {"notifications": items, "unread": unread}
    with _sqlite_connect() as conn:
        items = list_notifications_for_user(conn, session.user.id, limit=limit)
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


@router.get("/add-ons", summary="Listed add-ons for your organisation")
def list_org_add_ons(request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_permission(session, "organisation.subscription.view")
    org_id = session.user.organisation_id
    if org_id is None:
        raise HTTPException(status_code=403, detail="Organisation context required")
    from .feature_offers_repository import list_marketplace_for_org

    if uses_postgres():
        with _pg_connect() as conn:
            return {"offers": list_marketplace_for_org(conn, int(org_id))}
    with _sqlite_connect() as conn:
        return {"offers": list_marketplace_for_org(conn, int(org_id))}


@router.post("/add-ons/{feature_key}/enable", summary="Enable a free add-on")
def enable_org_add_on(feature_key: str, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_permission(session, "organisation.edit")
    org_id = session.user.organisation_id
    if org_id is None:
        raise HTTPException(status_code=403, detail="Organisation context required")
    from .feature_offers_repository import enable_free_for_org

    if uses_postgres():
        with _pg_connect() as conn:
            offer = enable_free_for_org(
                conn,
                organisation_id=int(org_id),
                user_id=session.user.id,
                feature_key=feature_key,
                actor_user_id=session.user.id,
            )
            conn.commit()
            return {"offer": offer}
    with _sqlite_connect() as conn:
        offer = enable_free_for_org(
            conn,
            organisation_id=int(org_id),
            user_id=session.user.id,
            feature_key=feature_key,
            actor_user_id=session.user.id,
        )
        conn.commit()
        return {"offer": offer}


@router.post("/add-ons/{feature_key}/request", summary="Request a paid add-on")
def request_org_add_on(feature_key: str, request: Request) -> dict[str, Any]:
    session = _session(request)
    auth.require_permission(session, "organisation.edit")
    org_id = session.user.organisation_id
    if org_id is None:
        raise HTTPException(status_code=403, detail="Organisation context required")
    from .email_lifecycle import send_feature_interest_submitted_to_platform
    from .feature_interests_repository import get_interest
    from .feature_offers_repository import request_paid_for_org

    if uses_postgres():
        with _pg_connect() as conn:
            result = request_paid_for_org(
                conn,
                organisation_id=int(org_id),
                user_id=session.user.id,
                feature_key=feature_key,
            )
            conn.commit()
            interest_id = result.get("interest_id")
            if interest_id:
                send_feature_interest_submitted_to_platform(conn, get_interest(conn, int(interest_id)))
            return result
    with _sqlite_connect() as conn:
        result = request_paid_for_org(
            conn,
            organisation_id=int(org_id),
            user_id=session.user.id,
            feature_key=feature_key,
        )
        conn.commit()
        interest_id = result.get("interest_id")
        if interest_id:
            send_feature_interest_submitted_to_platform(conn, get_interest(conn, int(interest_id)))
        return result


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


class BrokerContractShareBody(BaseModel):
    buyer_org_code: str = ""
    seller_org_code: str = ""
    buyer_external_name: str = ""
    buyer_external_email: str = ""
    buyer_external_phone: str = ""
    seller_external_name: str = ""
    seller_external_email: str = ""
    seller_external_phone: str = ""
    contract_ref: str = ""
    note: str = ""
    filename: str = ""
    pdf_data: str = ""
    item_name: str = ""
    quantity: str = ""
    rate: str = ""
    brokerage: str = ""
    delivery_period: str = ""
    payment_terms: str = ""


class BookBrokerContractBody(BaseModel):
    order_ref: str = ""


class ReportLiftTankerBody(BaseModel):
    tanker_no: str = ""
    transport_name: str = ""
    driver_mobile: str = ""
    lr_no: str = ""
    qty_mt: float = 0
    sales_invoice_no: str = ""
    po_invoice_no: str = ""


class ReportBrokerShareLiftBody(BaseModel):
    lift_id: str = ""
    lift_ref: int = 0
    order_ref: str = ""
    qty_mt: float = 0
    status: str = "pending"
    event_at: str = ""
    tankers: list[ReportLiftTankerBody] = []


class CreateBrokerRecordedLiftBody(BaseModel):
    party_role: str = ""
    qty_mt: float = 0
    status: str = "pending"
    event_at: str = ""
    tanker_no: str = ""
    transport_name: str = ""
    driver_mobile: str = ""
    lr_no: str = ""


def _require_broker(session: auth.Session) -> int:
    org_id = session.user.organisation_id
    if org_id is None:
        raise HTTPException(status_code=403, detail="Organisation context required")
    if session.user.account_type != "broker":
        raise HTTPException(status_code=403, detail="Broker account required")
    return int(org_id)


@router.get("/contract-shares", summary="Contracts sent to this organisation")
def list_received_contract_shares(request: Request) -> dict[str, Any]:
    session = _session(request)
    org_id = session.user.organisation_id
    if org_id is None:
        raise HTTPException(status_code=403, detail="Organisation context required")
    from .broker_shares_repository import list_shares_for_organisation

    if uses_postgres():
        with _pg_connect() as conn:
            return {"shares": list_shares_for_organisation(conn, int(org_id))}
    with _sqlite_connect() as conn:
        return {"shares": list_shares_for_organisation(conn, int(org_id))}


@router.get("/broker/organisations", summary="Look up a buyer or seller by organisation code")
def lookup_broker_organisation(request: Request, code: str = "") -> dict[str, Any]:
    session = _session(request)
    _require_broker(session)
    from .broker_shares_repository import lookup_organisation_by_code

    if uses_postgres():
        with _pg_connect() as conn:
            return {"organisation": lookup_organisation_by_code(conn, code)}
    with _sqlite_connect() as conn:
        return {"organisation": lookup_organisation_by_code(conn, code)}


@router.get("/broker/shares", summary="Contracts this broker firm has sent")
def list_broker_contract_shares(request: Request) -> dict[str, Any]:
    session = _session(request)
    org_id = _require_broker(session)
    from .broker_shares_repository import list_shares_for_broker

    if uses_postgres():
        with _pg_connect() as conn:
            return {"shares": list_shares_for_broker(conn, org_id)}
    with _sqlite_connect() as conn:
        return {"shares": list_shares_for_broker(conn, org_id)}


@router.post("/broker/shares", summary="Send a contract PDF to the buyer and the seller")
def create_broker_contract_share(body: BrokerContractShareBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    org_id = _require_broker(session)
    from .broker_shares_repository import share_contract

    kwargs = dict(
        sender_organisation_id=org_id,
        sender_user_id=int(session.user.id),
        sender_org_name=session.user.organisation_name or "",
        buyer_org_code=body.buyer_org_code,
        seller_org_code=body.seller_org_code,
        buyer_external_name=body.buyer_external_name,
        buyer_external_email=body.buyer_external_email,
        buyer_external_phone=body.buyer_external_phone,
        seller_external_name=body.seller_external_name,
        seller_external_email=body.seller_external_email,
        seller_external_phone=body.seller_external_phone,
        contract_ref=body.contract_ref,
        note=body.note,
        filename=body.filename,
        pdf_data_url=body.pdf_data,
        item_name=body.item_name,
        quantity=body.quantity,
        rate=body.rate,
        brokerage=body.brokerage,
        delivery_period=body.delivery_period,
        payment_terms=body.payment_terms,
    )
    if uses_postgres():
        with _pg_connect() as conn:
            return share_contract(conn, **kwargs)
    with _sqlite_connect() as conn:
        return share_contract(conn, **kwargs)


@router.patch("/broker/shares/{share_id}", summary="Update a contract this broker sent")
def update_broker_contract_share(share_id: int, body: BrokerContractShareBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    org_id = _require_broker(session)
    from .broker_shares_repository import update_share

    kwargs = dict(
        share_id=share_id,
        sender_organisation_id=org_id,
        sender_user_id=int(session.user.id),
        sender_org_name=session.user.organisation_name or "",
        buyer_org_code=body.buyer_org_code,
        seller_org_code=body.seller_org_code,
        note=body.note,
        item_name=body.item_name,
        quantity=body.quantity,
        rate=body.rate,
        brokerage=body.brokerage,
        delivery_period=body.delivery_period,
        payment_terms=body.payment_terms,
    )
    if uses_postgres():
        with _pg_connect() as conn:
            return {"share": update_share(conn, **kwargs)}
    with _sqlite_connect() as conn:
        return {"share": update_share(conn, **kwargs)}


@router.delete("/broker/shares/{share_id}", summary="Delete a contract this broker sent")
def delete_broker_contract_share(share_id: int, request: Request) -> dict[str, Any]:
    session = _session(request)
    org_id = _require_broker(session)
    from .broker_shares_repository import delete_share

    kwargs = dict(
        share_id=share_id,
        sender_organisation_id=org_id,
        sender_user_id=int(session.user.id),
        sender_org_name=session.user.organisation_name or "",
    )
    if uses_postgres():
        with _pg_connect() as conn:
            return {"share": delete_share(conn, **kwargs)}
    with _sqlite_connect() as conn:
        return {"share": delete_share(conn, **kwargs)}


@router.post("/broker/lift-events/{event_id}/read", summary="Mark a broker lift as read")
def read_broker_lift_event(event_id: int, request: Request) -> dict[str, Any]:
    session = _session(request)
    org_id = _require_broker(session)
    from .broker_shares_repository import mark_broker_lift_read

    if uses_postgres():
        with _pg_connect() as conn:
            return mark_broker_lift_read(conn, event_id, org_id)
    with _sqlite_connect() as conn:
        return mark_broker_lift_read(conn, event_id, org_id)


@router.post("/broker/shares/{share_id}/lifts", summary="Record a lift on a broker contract")
def create_broker_recorded_lift(share_id: int, body: CreateBrokerRecordedLiftBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    org_id = _require_broker(session)
    from .broker_shares_repository import create_broker_recorded_lift as create_lift

    tankers: list[dict[str, str | float]] = []
    if body.tanker_no.strip() or body.transport_name.strip() or body.lr_no.strip():
        tankers.append({
            "tanker_no": body.tanker_no.strip(),
            "transport_name": body.transport_name.strip(),
            "driver_mobile": body.driver_mobile.strip(),
            "lr_no": body.lr_no.strip(),
            "qty_mt": body.qty_mt,
            "sales_invoice_no": "",
            "po_invoice_no": "",
        })
    kwargs = dict(
        share_id=share_id,
        sender_organisation_id=org_id,
        actor_user_id=int(session.user.id),
        party_role=body.party_role,
        qty_mt=body.qty_mt,
        status=body.status,
        event_at=body.event_at,
        tankers=tankers,
    )
    if uses_postgres():
        with _pg_connect() as conn:
            return {"share": create_lift(conn, **kwargs)}
    with _sqlite_connect() as conn:
        return {"share": create_lift(conn, **kwargs)}


@router.post("/broker/lift-events/{event_id}/complete", summary="Mark a broker lift complete")
def complete_broker_lift_event(event_id: int, request: Request) -> dict[str, Any]:
    session = _session(request)
    org_id = _require_broker(session)
    from .broker_shares_repository import complete_broker_lift

    if uses_postgres():
        with _pg_connect() as conn:
            return complete_broker_lift(conn, event_id, org_id)
    with _sqlite_connect() as conn:
        return complete_broker_lift(conn, event_id, org_id)


@router.get("/broker/shares/{share_id}", summary="A contract shared with this organisation")
def read_broker_contract_share(share_id: int, request: Request, file: bool = False) -> dict[str, Any]:
    session = _session(request)
    org_id = session.user.organisation_id
    if org_id is None:
        raise HTTPException(status_code=403, detail="Organisation context required")
    from .broker_shares_repository import get_share

    if uses_postgres():
        with _pg_connect() as conn:
            return {"share": get_share(conn, share_id, int(org_id), include_pdf=file)}
    with _sqlite_connect() as conn:
        return {"share": get_share(conn, share_id, int(org_id), include_pdf=file)}


@router.post("/broker/shares/{share_id}/confirm", summary="Buyer or seller confirms a broker contract")
def confirm_broker_contract_share(share_id: int, request: Request) -> dict[str, Any]:
    session = _session(request)
    org_id = session.user.organisation_id
    if org_id is None:
        raise HTTPException(status_code=403, detail="Organisation context required")
    from .broker_shares_repository import confirm_share

    if uses_postgres():
        with _pg_connect() as conn:
            return {"share": confirm_share(conn, share_id, int(org_id), int(session.user.id))}
    with _sqlite_connect() as conn:
        return {"share": confirm_share(conn, share_id, int(org_id), int(session.user.id))}


@router.post("/broker/shares/{share_id}/book", summary="Record this organisation's order for a broker contract")
def book_broker_contract_share(share_id: int, body: BookBrokerContractBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    org_id = session.user.organisation_id
    if org_id is None:
        raise HTTPException(status_code=403, detail="Organisation context required")
    from .broker_shares_repository import book_share

    if uses_postgres():
        with _pg_connect() as conn:
            return {"share": book_share(conn, share_id, int(org_id), body.order_ref)}
    with _sqlite_connect() as conn:
        return {"share": book_share(conn, share_id, int(org_id), body.order_ref)}


@router.post("/contract-shares/report-lift", summary="Report a lift against a booked broker contract order")
def report_contract_share_lift(body: ReportBrokerShareLiftBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    org_id = session.user.organisation_id
    if org_id is None:
        raise HTTPException(status_code=403, detail="Organisation context required")
    if session.user.account_type == "broker":
        raise HTTPException(status_code=403, detail="Buyer or seller organisation required")
    from .broker_shares_repository import report_share_lift

    kwargs = dict(
        organisation_id=int(org_id),
        actor_user_id=int(session.user.id),
        lift_id=body.lift_id,
        lift_ref=body.lift_ref,
        order_ref=body.order_ref,
        qty_mt=body.qty_mt,
        status=body.status,
        event_at=body.event_at,
        tankers=[tanker.model_dump() for tanker in body.tankers],
    )
    if uses_postgres():
        with _pg_connect() as conn:
            return report_share_lift(conn, **kwargs)
    with _sqlite_connect() as conn:
        return report_share_lift(conn, **kwargs)


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
