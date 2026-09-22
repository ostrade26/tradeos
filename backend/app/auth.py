"""Session auth and permission checks for Tradeal API."""

from __future__ import annotations

import os
from typing import Any

from fastapi import HTTPException, Request

from .identity.repository import (
    AuthUser,
    Session,
    append_audit_log,
    authenticate,
    auth_failure_detail,
    create_session,
    delete_session,
    get_session,
    organisation_has_sandbox_tools,
    require_permission,
    resolve_organisation_id,
    touch_user_login,
    user_has_permission,
)

# Re-export for type hints in main.py
__all__ = [
    "Session",
    "AuthUser",
    "PUBLIC_PATHS",
    "extract_bearer_token",
    "login",
    "logout",
    "session_from_request",
    "unauthorized_detail",
    "require_session",
    "require_admin",
    "require_platform",
    "require_platform_settings",
    "require_can_edit_orders",
    "require_permission",
    "user_has_permission",
    "resolve_organisation_id",
    "session_to_dict",
    "append_audit_log",
]

PUBLIC_PATHS = {
    "/api/v1/health",
    "/api/v1/auth/login",
    "/api/v1/auth/forgot-password",
    "/api/v1/auth/reset-password",
    "/api/v1/demo-requests",
}


def extract_bearer_token(request: Request) -> str:
    auth = (request.headers.get("authorization") or "").strip()
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return ""


def login(username: str, password: str, *, remember: bool = True) -> tuple[str, Session, bool]:
    from .identity.repository import user_has_prior_login

    user = authenticate(username, password)
    is_first_login = not user_has_prior_login(user.id)
    touch_user_login(user.id)
    token, session = create_session(user, remember=remember)
    append_audit_log(
        organisation_id=user.organisation_id,
        actor_user_id=user.id,
        action="auth.login",
        entity_type="user",
        entity_id=str(user.id),
    )
    return token, session, is_first_login


def logout(token: str) -> None:
    delete_session(token)


def session_from_request(request: Request) -> Session | None:
    return get_session(extract_bearer_token(request))


def unauthorized_detail(request: Request) -> str | dict[str, str]:
    token = extract_bearer_token(request)
    if not token:
        return "Not authenticated"
    return auth_failure_detail(token)


def require_session(request: Request) -> Session:
    session = session_from_request(request)
    if not session:
        raise HTTPException(status_code=401, detail=unauthorized_detail(request))
    return session


def require_admin(session: Session) -> None:
    """Organisation-level delete/void operations (not platform user management)."""
    if session.user.role_slug == "platform_admin":
        return
    if not (
        user_has_permission(session, "purchase.delete")
        and user_has_permission(session, "sales.delete")
    ):
        raise HTTPException(status_code=403, detail="Admin access required")


def require_can_edit_orders(session: Session) -> None:
    if user_has_permission(session, "purchase.edit") or user_has_permission(session, "sales.edit"):
        return
    raise HTTPException(status_code=403, detail="You do not have permission to edit orders")


def require_sandbox_demo_tools(session: Session, request: Request) -> int:
    """Org-scoped demo load/clear — only the test/sandbox organisation."""
    require_permission(session, "organisation.edit")
    org_id = resolve_organisation_id(session, request)
    if not organisation_has_sandbox_tools(org_id):
        raise HTTPException(
            status_code=403,
            detail="Demo data tools are not available for this organisation",
        )
    return org_id


def require_platform(session: Session) -> None:
    """Platform console access — gated by role (same as /api/v1/platform middleware)."""
    if session.user.role_slug != "platform_admin":
        raise HTTPException(status_code=403, detail="Tradeal platform admin required")


def require_platform_settings(session: Session) -> None:
    require_platform(session)
    if not user_has_permission(session, "platform.settings"):
        raise HTTPException(status_code=403, detail="Platform settings permission required")


def session_to_dict(session: Session) -> dict[str, Any]:
    u = session.user
    # Legacy role aliases for older clients (organisation roles only)
    legacy_role = u.role_slug
    if legacy_role == "platform_admin":
        legacy_role = "platform_admin"
    elif legacy_role == "organisation_admin":
        legacy_role = "admin"
    elif legacy_role == "view_only":
        legacy_role = "view_only"
    elif legacy_role == "operator":
        legacy_role = "operator"
    from .identity.repository import parse_user_preferences
    from .identity.notifications_repository import (
        applied_feature_keys_for_user,
        applied_version_for_user,
    )

    return {
        "userId": u.id,
        "username": u.username,
        "email": u.email,
        "name": u.name,
        "phone": u.phone,
        "location": u.location,
        "preferences": parse_user_preferences(u.preferences_raw),
        "role": legacy_role,
        "roleSlug": u.role_slug,
        "roleName": u.role_name,
        "organisationId": u.organisation_id,
        "organisationName": u.organisation_name,
        "accountType": u.account_type,
        "permissions": sorted(u.permissions),
        "isPlatformAdmin": u.role_slug == "platform_admin",
        "organisationSandboxTools": u.organisation_sandbox_tools,
        "organisationIsTest": u.organisation_is_test,
        "appliedUpdates": applied_feature_keys_for_user(u.id, u.organisation_id),
        "appliedVersion": applied_version_for_user(u.id, u.organisation_id),
    }


API_TOKEN = (
    os.environ.get("TRADEAL_API_TOKEN") or os.environ.get("TRADEOS_API_TOKEN") or ""
).strip()


def is_api_token_request(request: Request) -> bool:
    if not API_TOKEN:
        return False
    header = request.headers.get("x-tradeal-token") or request.headers.get("x-tradeos-token") or ""
    auth_header = request.headers.get("authorization") or ""
    token = header.strip() or (
        auth_header[7:].strip() if auth_header.lower().startswith("bearer ") else ""
    )
    return token == API_TOKEN
