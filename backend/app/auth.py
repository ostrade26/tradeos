"""Session auth and role checks for TradeOS API."""

from __future__ import annotations

import os
import secrets
import time
from dataclasses import dataclass
from typing import Literal

from fastapi import HTTPException, Request

Role = Literal["admin", "operator"]


@dataclass(frozen=True)
class UserRecord:
    username: str
    password: str
    role: Role
    name: str


@dataclass(frozen=True)
class Session:
    username: str
    role: Role
    name: str
    created_at: float


_sessions: dict[str, Session] = {}


def _load_users() -> dict[str, UserRecord]:
    raw = (os.environ.get("TRADEOS_USERS") or "").strip()
    users: dict[str, UserRecord] = {}
    if raw:
        for part in raw.split(","):
            part = part.strip()
            if not part:
                continue
            bits = part.split(":")
            if len(bits) < 3:
                continue
            username, password, role = bits[0], bits[1], bits[2]
            if role not in ("admin", "operator"):
                continue
            name = bits[3] if len(bits) > 3 else username.replace("_", " ").title()
            users[username] = UserRecord(username=username, password=password, role=role, name=name)  # type: ignore[arg-type]
    if not users:
        users["admin"] = UserRecord(username="admin", password="admin", role="admin", name="Admin")
        users["operator"] = UserRecord(
            username="operator", password="operator", role="operator", name="Operator"
        )
    return users


USERS = _load_users()

PUBLIC_PATHS = {
    "/api/v1/health",
    "/api/v1/auth/login",
    "/api/v1/demo-requests",
}


def extract_bearer_token(request: Request) -> str:
    auth = (request.headers.get("authorization") or "").strip()
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return ""


def login(username: str, password: str) -> tuple[str, Session]:
    user = USERS.get(username.strip())
    if not user or user.password != password:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = secrets.token_urlsafe(32)
    session = Session(username=user.username, role=user.role, name=user.name, created_at=time.time())
    _sessions[token] = session
    return token, session


def logout(token: str) -> None:
    _sessions.pop(token, None)


def get_session(token: str) -> Session | None:
    if not token:
        return None
    return _sessions.get(token)


def session_from_request(request: Request) -> Session | None:
    return get_session(extract_bearer_token(request))


def require_session(request: Request) -> Session:
    session = session_from_request(request)
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return session


def require_admin(session: Session) -> None:
    if session.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


def require_can_edit_orders(session: Session) -> None:
    if session.role != "admin":
        raise HTTPException(status_code=403, detail="Operators cannot edit existing orders")


def session_to_dict(session: Session) -> dict[str, str]:
    return {
        "username": session.username,
        "name": session.name,
        "role": session.role,
    }
