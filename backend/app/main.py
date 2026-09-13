"""FastAPI trade engine API."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, ConfigDict

from . import auth
from .db import init_db, insert_demo_request, ping_db
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
    {"name": "leads", "description": "Marketing demo requests from the TradeOS website."},
]

app = FastAPI(
    title="TradeOS API",
    description=(
        "REST API for TradeOS — purchase/sales orders, lifts, allocations, and directory data.\n\n"
        "**Swagger UI:** [/docs](/docs) · **ReDoc:** [/redoc](/redoc) · **OpenAPI JSON:** [/openapi.json](/openapi.json)"
    ),
    version="1.0.0",
    openapi_tags=OPENAPI_TAGS,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)
service = TradeService()
API_TOKEN = (os.environ.get("TRADEOS_API_TOKEN") or "").strip()


def _cors_origins() -> list[str]:
    extra = [origin.strip() for origin in os.environ.get("CORS_ORIGINS", "").split(",") if origin.strip()]
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        *extra,
    ]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    # Local LAN / Bonjour, plus Vercel production and preview hosts.
    allow_origin_regex=(
        r"https?://((localhost|127\.0\.0\.1)(:\d+)?"
        r"|([\w-]+\.local)(:\d+)?"
        r"|(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?"
        r"|([\w-]+\.)*vercel\.app)"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


def _session(request: Request) -> auth.Session:
    session = getattr(request.state, "session", None)
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return session


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

    if path.startswith("/api/v1/admin"):
        if session and session.role == "admin":
            request.state.session = session
            return await call_next(request)
        if API_TOKEN:
            header = request.headers.get("x-tradeos-token") or ""
            auth_header = request.headers.get("authorization") or ""
            token = header.strip() or (
                auth_header[7:].strip() if auth_header.lower().startswith("bearer ") else ""
            )
            if token == API_TOKEN:
                return await call_next(request)
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)

    if not session:
        return JSONResponse({"detail": "Not authenticated"}, status_code=401)

    request.state.session = session
    return await call_next(request)


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
        "name": "TradeOS API",
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


@app.get("/api/v1/state", tags=["state"], summary="Get full trade state")
def get_state(request: Request) -> dict:
    """Returns orders, lifts, directory entries, companies, counters, and related data."""
    _session(request)
    return service.get_state()


@app.post("/api/v1/admin/seed", tags=["admin"], summary="Load demo data")
def seed() -> dict:
    """Replaces current data with seeded demo POs, SOs, lifts, and directory entries."""
    state = service.seed()
    return {"data": state, "result": {"seeded": True}}


@app.post("/api/v1/admin/reset", tags=["admin"], summary="Clear all data")
def reset() -> dict:
    """Wipes the database and returns an empty trade state."""
    state = service.reset()
    return {"data": state, "result": {"reset": True}}


@app.post("/api/v1/admin/import", tags=["admin"], summary="Import full backup")
def import_backup(body: ImportBody) -> dict:
    """Replaces current data with a JSON backup (same format as Settings export)."""

    def run():
        state = service.import_state(body.model_dump())
        return _mutation({"imported": True}, state)

    return _handle(run)


@app.post("/api/v1/contracts", tags=["contracts"], summary="Create contract")
def create_contract(body: DictBody) -> dict:
    def run():
        contract, state = service.add_contract(body.model_dump())
        return _mutation(contract, state)

    return _handle(run)


@app.post("/api/v1/orders", tags=["orders"], summary="Create order")
def create_order(body: DictBody) -> dict:
    def run():
        order, state = service.add_order(body.model_dump())
        return _mutation(order, state)

    return _handle(run)


@app.patch("/api/v1/orders/{order_id}", tags=["orders"], summary="Update order")
def update_order(order_id: str, body: DictBody, request: Request) -> dict:
    auth.require_can_edit_orders(_session(request))

    def run():
        order, state = service.update_order(order_id, body.model_dump())
        return _mutation(order, state)

    return _handle(run)


@app.post("/api/v1/orders/{order_id}/buy-back", tags=["orders"], summary="Record PO buy back")
def buy_back_po(order_id: str, body: DictBody, request: Request) -> dict:
    auth.require_can_edit_orders(_session(request))

    def run():
        order, state = service.buy_back_po(order_id, body.model_dump())
        return _mutation(order, state)

    return _handle(run)


@app.post("/api/v1/orders/{order_id}/close", tags=["orders"], summary="Close order with settlement")
def close_order(order_id: str, body: DictBody, request: Request) -> dict:
    auth.require_can_edit_orders(_session(request))

    def run():
        order, state = service.close_order(order_id, body.model_dump())
        return _mutation(order, state)

    return _handle(run)


@app.post("/api/v1/orders/{order_id}/schedule-deletion", tags=["orders"], summary="Schedule order deletion")
def schedule_order_deletion(order_id: str, request: Request) -> dict:
    auth.require_admin(_session(request))

    def run():
        _, state = service.schedule_order_deletion(order_id)
        return _mutation({"scheduled": True}, state)

    return _handle(run)


@app.delete("/api/v1/orders/{order_id}/schedule-deletion", tags=["orders"], summary="Cancel scheduled deletion")
def cancel_order_deletion(order_id: str, request: Request) -> dict:
    auth.require_admin(_session(request))

    def run():
        _, state = service.cancel_order_deletion(order_id)
        return _mutation({"cancelled": True}, state)

    return _handle(run)


@app.get("/api/v1/orders/{order_id}/can-delete", tags=["orders"], summary="Check if order can be deleted")
def can_delete_order(order_id: str) -> dict:
    return service.can_delete_order(order_id)


@app.post("/api/v1/lifts", tags=["lifts"], summary="Create lift")
def create_lift(body: DictBody) -> dict:
    def run():
        lift, state = service.add_lift(body.model_dump())
        return _mutation(lift, state)

    return _handle(run)


@app.patch("/api/v1/lifts/{lift_id}", tags=["lifts"], summary="Update lift")
def update_lift(lift_id: str, body: DictBody) -> dict:
    def run():
        lift, state = service.update_lift(lift_id, body.model_dump())
        return _mutation(lift, state)

    return _handle(run)


@app.post("/api/v1/lifts/{lift_id}/deliver", tags=["lifts"], summary="Mark lift delivered")
def mark_lift_delivered(lift_id: str, body: DictBody) -> dict:
    def run():
        lift, state = service.mark_lift_delivered(lift_id, body.model_dump())
        return _mutation(lift, state)

    return _handle(run)


@app.post("/api/v1/brokers", tags=["directory"], summary="Create broker")
def create_broker(body: DictBody) -> dict:
    def run():
        broker, state = service.add_broker(body.model_dump())
        return _mutation(broker, state)

    return _handle(run)


@app.patch("/api/v1/brokers/{broker_id}", tags=["directory"], summary="Update broker")
def update_broker(broker_id: str, body: DictBody) -> dict:
    def run():
        broker, state = service.update_broker(broker_id, body.model_dump())
        return _mutation(broker, state)

    return _handle(run)


@app.delete("/api/v1/brokers/{broker_id}", tags=["directory"], summary="Delete broker")
def delete_broker(broker_id: str) -> dict:
    def run():
        _, state = service.delete_broker(broker_id)
        return _mutation({"deleted": True}, state)

    return _handle(run)


@app.get("/api/v1/brokers/{broker_id}/can-delete", tags=["directory"], summary="Check if broker can be deleted")
def can_delete_broker(broker_id: str) -> dict:
    return service.can_delete_broker(broker_id)


@app.post("/api/v1/producers", tags=["directory"], summary="Create producer")
def create_producer(body: DictBody) -> dict:
    def run():
        producer, state = service.add_producer(body.model_dump())
        return _mutation(producer, state)

    return _handle(run)


@app.patch("/api/v1/producers/{producer_id}", tags=["directory"], summary="Update producer")
def update_producer(producer_id: str, body: DictBody) -> dict:
    def run():
        producer, state = service.update_producer(producer_id, body.model_dump())
        return _mutation(producer, state)

    return _handle(run)


@app.delete("/api/v1/producers/{producer_id}", tags=["directory"], summary="Delete producer")
def delete_producer(producer_id: str) -> dict:
    def run():
        _, state = service.delete_producer(producer_id)
        return _mutation({"deleted": True}, state)

    return _handle(run)


@app.get("/api/v1/producers/{producer_id}/can-delete", tags=["directory"], summary="Check if producer can be deleted")
def can_delete_producer(producer_id: str) -> dict:
    return service.can_delete_producer(producer_id)


@app.post("/api/v1/retailers", tags=["directory"], summary="Create retailer")
def create_retailer(body: DictBody) -> dict:
    def run():
        retailer, state = service.add_retailer(body.model_dump())
        return _mutation(retailer, state)

    return _handle(run)


@app.patch("/api/v1/retailers/{retailer_id}", tags=["directory"], summary="Update retailer")
def update_retailer(retailer_id: str, body: DictBody) -> dict:
    def run():
        retailer, state = service.update_retailer(retailer_id, body.model_dump())
        return _mutation(retailer, state)

    return _handle(run)


@app.delete("/api/v1/retailers/{retailer_id}", tags=["directory"], summary="Delete retailer")
def delete_retailer(retailer_id: str) -> dict:
    def run():
        _, state = service.delete_retailer(retailer_id)
        return _mutation({"deleted": True}, state)

    return _handle(run)


@app.get("/api/v1/retailers/{retailer_id}/can-delete", tags=["directory"], summary="Check if retailer can be deleted")
def can_delete_retailer(retailer_id: str) -> dict:
    return service.can_delete_retailer(retailer_id)


@app.post("/api/v1/items", tags=["catalog"], summary="Add item")
def create_item(body: NameBody) -> dict:
    def run():
        item, state = service.add_item(body.name)
        return _mutation(item, state)

    return _handle(run)


@app.post("/api/v1/spots", tags=["catalog"], summary="Add spot")
def create_spot(body: NameBody) -> dict:
    def run():
        spot, state = service.add_spot(body.name)
        return _mutation(spot, state)

    return _handle(run)


@app.post("/api/v1/companies/confirm-link", tags=["companies"], summary="Confirm company link")
def confirm_company_link(body: DictBody) -> dict:
    def run():
        company, state = service.confirm_company_link(body.model_dump())
        return _mutation(company, state)

    return _handle(run)


@app.post("/api/v1/companies/link-high-confidence", tags=["companies"], summary="Link high-confidence company match")
def link_high_confidence_company(body: LinkHighConfidenceBody) -> dict:
    def run():
        company, state = service.link_high_confidence_company(body.result, body.type)
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
