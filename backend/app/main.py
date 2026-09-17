"""FastAPI trade engine API."""

from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, ConfigDict

from . import auth
from .db import init_db, insert_demo_request, ping_db
from .identity.me_api import router as me_router
from .identity.org_api import router as organisation_router
from .identity.platform_api import router as platform_router
from .trade.service import TradeService
import os

OPENAPI_TAGS = [
    {"name": "auth", "description": "Login, logout, and session."},
    {"name": "health", "description": "Service health and discovery."},
    {"name": "state", "description": "Full trade state snapshot."},
    {"name": "admin", "description": "Export/import backup, seed demo data, or reset the database."},
    {"name": "orders", "description": "Purchase and sales order CRUD."},
    {"name": "contracts", "description": "Contract confirmations."},
    {"name": "lifts", "description": "Lift scheduling, updates, and delivery."},
    {"name": "directory", "description": "Brokers, producers, and retailers."},
    {"name": "catalog", "description": "Items and delivery spots."},
    {"name": "companies", "description": "Company linking from contract PDFs."},
    {"name": "leads", "description": "Marketing demo requests from the Tradeal website."},
    {"name": "platform", "description": "Tradeal platform admin — organisations and users."},
]

app = FastAPI(
    title="Tradeal API",
    description=(
        "REST API for Tradeal — purchase/sales orders, lifts, allocations, and directory data.\n\n"
        "**Swagger UI:** [/docs](/docs) · **ReDoc:** [/redoc](/redoc) · **OpenAPI JSON:** [/openapi.json](/openapi.json)"
    ),
    version="1.0.0",
    openapi_tags=OPENAPI_TAGS,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)
app.include_router(platform_router)
app.include_router(organisation_router)
app.include_router(me_router)


def _integrity_error_detail(exc: BaseException) -> str:
    text = str(exc).casefold()
    if "row-level security" in text:
        return "Could not save organisation trade data. Retry after deploy, or contact support."
    if "users" in text and ("username" in text or "email" in text or "unique" in text):
        return "This username or email is already in use."
    if "unique" in text or "duplicate" in text:
        return "This conflicts with an existing record."
    return "Database constraint violation."


@app.exception_handler(sqlite3.IntegrityError)
async def sqlite_integrity_handler(_request: Request, exc: sqlite3.IntegrityError) -> JSONResponse:
    return JSONResponse(status_code=409, content={"detail": _integrity_error_detail(exc)})


try:
    from psycopg.errors import IntegrityError as PsycopgIntegrityError

    @app.exception_handler(PsycopgIntegrityError)
    async def psycopg_integrity_handler(_request: Request, exc: PsycopgIntegrityError) -> JSONResponse:
        return JSONResponse(status_code=409, content={"detail": _integrity_error_detail(exc)})
except ImportError:
    pass


def _cors_origins() -> list[str]:
    extra = [origin.strip() for origin in os.environ.get("CORS_ORIGINS", "").split(",") if origin.strip()]
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "https://www.tradeal.in",
        "https://tradeal.in",
        *extra,
    ]




class DictBody(BaseModel):
    model_config = ConfigDict(extra="allow")


class NameBody(BaseModel):
    name: str


class LinkHighConfidenceBody(BaseModel):
    result: dict[str, Any]
    type: str


class DemoRequestBody(BaseModel):
    name: str
    company: str
    phone: str = ""
    email: str = ""
    message: str = ""


class ImportBody(BaseModel):
    model_config = ConfigDict(extra="allow")

    version: int | None = None
    data: dict[str, Any]


class LoginBody(BaseModel):
    username: str
    password: str


class ProfilePatchBody(BaseModel):
    name: str | None = None
    phone: str | None = None
    location: str | None = None
    username: str | None = None


class PreferencesPatchBody(BaseModel):
    theme: str | None = None
    accentId: str | None = None
    customHex: str | None = None
    tableDensity: str | None = None
    lastSeenPlatformWhatsNew: str | None = None


class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: str


def _session(request: Request) -> auth.Session:
    session = getattr(request.state, "session", None)
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return session


def _trade_service(request: Request) -> TradeService:
    session = _session(request)
    org_id = auth.resolve_organisation_id(session, request)
    return TradeService(org_id)


def _order_perm(side: str, action: str) -> str:
    prefix = "purchase" if side == "purchase" else "sales"
    return f"{prefix}.{action}"


def _require_order_perm(session: auth.Session, body: dict, action: str) -> None:
    side = (body.get("side") or "purchase").strip()
    auth.require_permission(session, _order_perm(side, action))


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.middleware("http")
async def auth_guard(request: Request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)

    path = request.url.path
    if not path.startswith("/api/v1/") or path in auth.PUBLIC_PATHS:
        return await call_next(request)

    session = auth.session_from_request(request)

    if path.startswith("/api/v1/platform"):
        if session and session.user.role_slug == "platform_admin":
            request.state.session = session
            return await call_next(request)
        if auth.is_api_token_request(request):
            return await call_next(request)
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)

    if path.startswith("/api/v1/admin"):
        if auth.is_api_token_request(request):
            return await call_next(request)
        if session:
            request.state.session = session
            return await call_next(request)
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)

    if not session:
        return JSONResponse({"detail": "Not authenticated"}, status_code=401)

    request.state.session = session
    if session.user.role_slug != "platform_admin":
        from .identity.repository import touch_user_activity

        touch_user_activity(session.user.id)
    return await call_next(request)


# Register CORS *after* auth_guard so it wraps all responses (including 401 JSON from auth).
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    # Local LAN / Bonjour, plus Vercel production and preview hosts.
    allow_origin_regex=(
        r"https?://((localhost|127\.0\.0\.1)(:\d+)?"
        r"|([\w-]+\.local)(:\d+)?"
        r"|(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?"
        r"|([\w-]+\.)*vercel\.app"
        r"|([\w-]+\.)*tradeal\.in)"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _mutation(result: Any, state: dict) -> dict:
    return {"data": state, "result": result}


def _handle(fn):
    try:
        return fn()
    except HTTPException:
        raise
    except (ValueError, KeyError, StopIteration, TypeError) as exc:
        message = str(exc).strip() or exc.__class__.__name__
        raise HTTPException(status_code=400, detail=message) from exc


@app.get("/")
def root() -> dict:
    return {
        "name": "Tradeal API",
        "swagger": "/docs",
        "redoc": "/redoc",
        "openapi": "/openapi.json",
        "health": "/api/v1/health",
        "state": "/api/v1/state",
        "hint": "Open the React app at http://localhost:5173 (not this port).",
    }


@app.get("/swagger", include_in_schema=False)
def swagger_redirect() -> RedirectResponse:
    """Shortcut to Swagger UI."""
    return RedirectResponse(url="/docs")


@app.get("/api/v1/health", tags=["health"], summary="Health check")
def health() -> dict:
    """Returns `{"status": "ok", "db": "sqlite"|"postgres"}` when the API and database are up."""
    try:
        return {"status": "ok", "db": ping_db()}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"database unavailable: {exc}") from exc


@app.post("/api/v1/auth/login", tags=["auth"], summary="Sign in")
def auth_login(body: LoginBody) -> dict:
    token, session = auth.login(body.username, body.password)
    return {"token": token, **auth.session_to_dict(session)}


@app.post("/api/v1/auth/logout", tags=["auth"], summary="Sign out")
def auth_logout(request: Request) -> dict:
    token = auth.extract_bearer_token(request)
    if token:
        auth.logout(token)
    return {"ok": True}


@app.get("/api/v1/auth/me", tags=["auth"], summary="Current session")
def auth_me(request: Request) -> dict:
    return auth.session_to_dict(_session(request))


@app.patch("/api/v1/auth/profile", tags=["auth"], summary="Update your profile")
def auth_update_profile(body: ProfilePatchBody, request: Request) -> dict:
    session = _session(request)
    from .identity.repository import append_audit_log, update_user_profile

    user = update_user_profile(
        session.user.id,
        name=body.name,
        phone=body.phone,
        location=body.location,
        username=body.username,
    )
    append_audit_log(
        organisation_id=session.user.organisation_id,
        actor_user_id=session.user.id,
        action="user.profile_updated",
        entity_type="user",
        entity_id=str(session.user.id),
    )
    from .identity.repository import Session as AuthSessionModel

    return auth.session_to_dict(AuthSessionModel(token=session.token, user=user, created_at=session.created_at))


@app.patch("/api/v1/auth/preferences", tags=["auth"], summary="Update appearance preferences")
def auth_update_preferences(body: PreferencesPatchBody, request: Request) -> dict:
    session = _session(request)
    from .identity.repository import Session as AuthSessionModel, merge_user_preferences

    patch = body.model_dump(exclude_unset=True)
    user = merge_user_preferences(session.user.id, patch)
    return auth.session_to_dict(AuthSessionModel(token=session.token, user=user, created_at=session.created_at))


@app.post("/api/v1/auth/change-password", tags=["auth"], summary="Change your password")
def auth_change_password(body: ChangePasswordBody, request: Request) -> dict:
    session = _session(request)
    from .identity.repository import append_audit_log, change_user_password

    change_user_password(session.user.id, body.current_password, body.new_password)
    append_audit_log(
        organisation_id=session.user.organisation_id,
        actor_user_id=session.user.id,
        action="auth.password_changed",
        entity_type="user",
        entity_id=str(session.user.id),
    )
    return {"ok": True}


@app.get("/api/v1/state", tags=["state"], summary="Get full trade state")
def get_state(request: Request) -> dict:
    """Returns orders, lifts, directory entries, companies, counters, and related data."""
    session = _session(request)
    if session.user.role_slug == "platform_admin":
        raise HTTPException(
            status_code=403,
            detail="Tradeal platform admin accounts cannot access organisation trade data",
        )
    if not (
        auth.user_has_permission(session, "purchase.view")
        or auth.user_has_permission(session, "sales.view")
    ):
        auth.require_permission(session, "purchase.view")
    return _trade_service(request).get_state()


@app.post("/api/v1/admin/seed", tags=["admin"], summary="Load demo data")
def seed(request: Request) -> dict:
    """Replaces current data with seeded demo POs, SOs, lifts, and directory entries (sandbox org only)."""
    auth.require_sandbox_demo_tools(_session(request), request)
    state = _trade_service(request).seed()
    return {"data": state, "result": {"seeded": True}}


@app.post("/api/v1/admin/reset", tags=["admin"], summary="Clear all data")
def reset(request: Request) -> dict:
    """Wipes trade data for this organisation (sandbox org only)."""
    auth.require_sandbox_demo_tools(_session(request), request)
    state = _trade_service(request).reset()
    return {"data": state, "result": {"reset": True}}


@app.post("/api/v1/admin/import", tags=["admin"], summary="Import full backup")
def import_backup(body: ImportBody, request: Request) -> dict:
    """Replaces current data with a JSON backup (same format as Settings export)."""
    session = _session(request)
    auth.require_permission(session, "organisation.edit")

    def run():
        state = _trade_service(request).import_state(body.model_dump())
        return _mutation({"imported": True}, state)

    return _handle(run)


@app.post("/api/v1/contracts", tags=["contracts"], summary="Create contract")
def create_contract(body: DictBody, request: Request) -> dict:
    auth.require_permission(_session(request), "contracts.create")

    def run():
        contract, state = _trade_service(request).add_contract(body.model_dump())
        return _mutation(contract, state)

    return _handle(run)


@app.post("/api/v1/orders", tags=["orders"], summary="Create order")
def create_order(body: DictBody, request: Request) -> dict:
    _require_order_perm(_session(request), body.model_dump(), "create")

    def run():
        order, state = _trade_service(request).add_order(body.model_dump())
        return _mutation(order, state)

    return _handle(run)


@app.patch("/api/v1/orders/{order_id}", tags=["orders"], summary="Update order")
def update_order(order_id: str, body: DictBody, request: Request) -> dict:
    _require_order_perm(_session(request), body.model_dump(), "edit")

    def run():
        order, state = _trade_service(request).update_order(order_id, body.model_dump())
        return _mutation(order, state)

    return _handle(run)


@app.post("/api/v1/orders/{order_id}/buy-back", tags=["orders"], summary="Record PO buy back")
def buy_back_po(order_id: str, body: DictBody, request: Request) -> dict:
    auth.require_permission(_session(request), "purchase.edit")

    def run():
        order, state = _trade_service(request).buy_back_po(order_id, body.model_dump())
        return _mutation(order, state)

    return _handle(run)


@app.post("/api/v1/orders/{order_id}/close", tags=["orders"], summary="Close order with settlement")
def close_order(order_id: str, body: DictBody, request: Request) -> dict:
    _require_order_perm(_session(request), body.model_dump(), "edit")

    def run():
        order, state = _trade_service(request).close_order(order_id, body.model_dump())
        return _mutation(order, state)

    return _handle(run)


@app.post("/api/v1/orders/{order_id}/schedule-deletion", tags=["orders"], summary="Schedule order deletion")
def schedule_order_deletion(order_id: str, request: Request) -> dict:
    session = _session(request)
    svc = _trade_service(request)
    order = next(
        (o for o in svc.get_state().get("tradeOrders", []) if o.get("id") == order_id),
        None,
    )
    side = (order or {}).get("side") or "purchase"
    auth.require_permission(session, _order_perm(side, "delete"))

    def run():
        _, state = svc.schedule_order_deletion(order_id)
        return _mutation({"scheduled": True}, state)

    return _handle(run)


@app.delete("/api/v1/orders/{order_id}/schedule-deletion", tags=["orders"], summary="Cancel scheduled deletion")
def cancel_order_deletion(order_id: str, request: Request) -> dict:
    session = _session(request)
    svc = _trade_service(request)
    order = next(
        (o for o in svc.get_state().get("tradeOrders", []) if o.get("id") == order_id),
        None,
    )
    side = (order or {}).get("side") or "purchase"
    auth.require_permission(session, _order_perm(side, "delete"))

    def run():
        _, state = svc.cancel_order_deletion(order_id)
        return _mutation({"cancelled": True}, state)

    return _handle(run)


@app.get("/api/v1/orders/{order_id}/can-delete", tags=["orders"], summary="Check if order can be deleted")
def can_delete_order(order_id: str, request: Request) -> dict:
    _session(request)
    return _trade_service(request).can_delete_order(order_id)


@app.post("/api/v1/lifts", tags=["lifts"], summary="Create lift")
def create_lift(body: DictBody, request: Request) -> dict:
    auth.require_permission(_session(request), "lifts.create")

    def run():
        lift, state = _trade_service(request).add_lift(body.model_dump())
        return _mutation(lift, state)

    return _handle(run)


@app.patch("/api/v1/lifts/{lift_id}", tags=["lifts"], summary="Update lift")
def update_lift(lift_id: str, body: DictBody, request: Request) -> dict:
    auth.require_permission(_session(request), "lifts.edit")

    def run():
        lift, state = _trade_service(request).update_lift(lift_id, body.model_dump())
        return _mutation(lift, state)

    return _handle(run)


@app.post("/api/v1/lifts/{lift_id}/deliver", tags=["lifts"], summary="Mark lift delivered")
def mark_lift_delivered(lift_id: str, body: DictBody, request: Request) -> dict:
    auth.require_permission(_session(request), "lifts.edit")

    def run():
        lift, state = _trade_service(request).mark_lift_delivered(lift_id, body.model_dump())
        return _mutation(lift, state)

    return _handle(run)


@app.post("/api/v1/brokers", tags=["directory"], summary="Create broker")
def create_broker(body: DictBody, request: Request) -> dict:
    auth.require_permission(_session(request), "organisation.edit")

    def run():
        broker, state = _trade_service(request).add_broker(body.model_dump())
        return _mutation(broker, state)

    return _handle(run)


@app.patch("/api/v1/brokers/{broker_id}", tags=["directory"], summary="Update broker")
def update_broker(broker_id: str, body: DictBody, request: Request) -> dict:
    auth.require_permission(_session(request), "organisation.edit")

    def run():
        broker, state = _trade_service(request).update_broker(broker_id, body.model_dump())
        return _mutation(broker, state)

    return _handle(run)


@app.delete("/api/v1/brokers/{broker_id}", tags=["directory"], summary="Delete broker")
def delete_broker(broker_id: str, request: Request) -> dict:
    auth.require_permission(_session(request), "organisation.edit")

    def run():
        _, state = _trade_service(request).delete_broker(broker_id)
        return _mutation({"deleted": True}, state)

    return _handle(run)


@app.get("/api/v1/brokers/{broker_id}/can-delete", tags=["directory"], summary="Check if broker can be deleted")
def can_delete_broker(broker_id: str, request: Request) -> dict:
    _session(request)
    return _trade_service(request).can_delete_broker(broker_id)


@app.post("/api/v1/producers", tags=["directory"], summary="Create producer")
def create_producer(body: DictBody, request: Request) -> dict:
    auth.require_permission(_session(request), "organisation.edit")

    def run():
        producer, state = _trade_service(request).add_producer(body.model_dump())
        return _mutation(producer, state)

    return _handle(run)


@app.patch("/api/v1/producers/{producer_id}", tags=["directory"], summary="Update producer")
def update_producer(producer_id: str, body: DictBody, request: Request) -> dict:
    auth.require_permission(_session(request), "organisation.edit")

    def run():
        producer, state = _trade_service(request).update_producer(producer_id, body.model_dump())
        return _mutation(producer, state)

    return _handle(run)


@app.delete("/api/v1/producers/{producer_id}", tags=["directory"], summary="Delete producer")
def delete_producer(producer_id: str, request: Request) -> dict:
    auth.require_permission(_session(request), "organisation.edit")

    def run():
        _, state = _trade_service(request).delete_producer(producer_id)
        return _mutation({"deleted": True}, state)

    return _handle(run)


@app.get("/api/v1/producers/{producer_id}/can-delete", tags=["directory"], summary="Check if producer can be deleted")
def can_delete_producer(producer_id: str, request: Request) -> dict:
    _session(request)
    return _trade_service(request).can_delete_producer(producer_id)


@app.post("/api/v1/retailers", tags=["directory"], summary="Create retailer")
def create_retailer(body: DictBody, request: Request) -> dict:
    auth.require_permission(_session(request), "organisation.edit")

    def run():
        retailer, state = _trade_service(request).add_retailer(body.model_dump())
        return _mutation(retailer, state)

    return _handle(run)


@app.patch("/api/v1/retailers/{retailer_id}", tags=["directory"], summary="Update retailer")
def update_retailer(retailer_id: str, body: DictBody, request: Request) -> dict:
    auth.require_permission(_session(request), "organisation.edit")

    def run():
        retailer, state = _trade_service(request).update_retailer(retailer_id, body.model_dump())
        return _mutation(retailer, state)

    return _handle(run)


@app.delete("/api/v1/retailers/{retailer_id}", tags=["directory"], summary="Delete retailer")
def delete_retailer(retailer_id: str, request: Request) -> dict:
    auth.require_permission(_session(request), "organisation.edit")

    def run():
        _, state = _trade_service(request).delete_retailer(retailer_id)
        return _mutation({"deleted": True}, state)

    return _handle(run)


@app.get("/api/v1/retailers/{retailer_id}/can-delete", tags=["directory"], summary="Check if retailer can be deleted")
def can_delete_retailer(retailer_id: str, request: Request) -> dict:
    _session(request)
    return _trade_service(request).can_delete_retailer(retailer_id)


@app.post("/api/v1/items", tags=["catalog"], summary="Add item")
def create_item(body: NameBody, request: Request) -> dict:
    auth.require_permission(_session(request), "organisation.edit")

    def run():
        item, state = _trade_service(request).add_item(body.name)
        return _mutation(item, state)

    return _handle(run)


@app.post("/api/v1/spots", tags=["catalog"], summary="Add spot")
def create_spot(body: NameBody, request: Request) -> dict:
    auth.require_permission(_session(request), "organisation.edit")

    def run():
        spot, state = _trade_service(request).add_spot(body.name)
        return _mutation(spot, state)

    return _handle(run)


@app.post("/api/v1/companies/confirm-link", tags=["companies"], summary="Confirm company link")
def confirm_company_link(body: DictBody, request: Request) -> dict:
    auth.require_permission(_session(request), "contracts.edit")

    def run():
        company, state = _trade_service(request).confirm_company_link(body.model_dump())
        return _mutation(company, state)

    return _handle(run)


@app.post("/api/v1/companies/link-high-confidence", tags=["companies"], summary="Link high-confidence company match")
def link_high_confidence_company(body: LinkHighConfidenceBody, request: Request) -> dict:
    auth.require_permission(_session(request), "contracts.edit")

    def run():
        company, state = _trade_service(request).link_high_confidence_company(body.result, body.type)
        return _mutation(company, state)

    return _handle(run)


@app.post("/api/v1/demo-requests", tags=["leads"], summary="Submit a demo request")
def create_demo_request(body: DemoRequestBody) -> dict:
    name = body.name.strip()
    company = body.company.strip()
    phone = body.phone.strip()
    email = body.email.strip()
    message = body.message.strip()

    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    if not company:
        raise HTTPException(status_code=400, detail="Company is required")
    if not phone and not email:
        raise HTTPException(status_code=400, detail="Add a phone number or email so we can reach you")
    if len(name) > 120 or len(company) > 160 or len(phone) > 40 or len(email) > 120 or len(message) > 2000:
        raise HTTPException(status_code=400, detail="One or more fields are too long")

    result = insert_demo_request(
        name=name,
        company=company,
        phone=phone,
        email=email,
        message=message,
    )
    return {"ok": True, **result}
