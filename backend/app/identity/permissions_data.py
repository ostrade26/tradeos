"""Permission definitions and role → permission matrix."""

from __future__ import annotations

# All permission slugs (extensible).
PERMISSIONS: list[tuple[str, str]] = [
    ("purchase.view", "View purchase orders"),
    ("purchase.create", "Create purchase orders"),
    ("purchase.edit", "Edit purchase orders"),
    ("purchase.delete", "Delete or void purchase orders"),
    ("sales.view", "View sales orders"),
    ("sales.create", "Create sales orders"),
    ("sales.edit", "Edit sales orders"),
    ("sales.delete", "Delete or void sales orders"),
    ("contracts.view", "View contracts"),
    ("contracts.create", "Create contracts"),
    ("contracts.edit", "Edit contracts"),
    ("contracts.delete", "Delete contracts"),
    ("lifts.view", "View lifts"),
    ("lifts.create", "Create lifts"),
    ("lifts.edit", "Edit lifts"),
    ("lifts.delete", "Delete lifts"),
    ("inventory.view", "View inventory"),
    ("inventory.create", "Create inventory"),
    ("inventory.edit", "Edit inventory"),
    ("inventory.adjust", "Adjust inventory"),
    ("payments.view", "View payments"),
    ("payments.create", "Create payments"),
    ("payments.edit", "Edit payments"),
    ("reports.view", "View reports"),
    ("reports.export", "Export reports"),
    ("audit.view", "View audit logs"),
    ("organisation.view", "View organisation settings"),
    ("organisation.edit", "Edit organisation settings"),
    # Platform-only (never assigned to organisation roles)
    ("users.create", "Create users"),
    ("users.invite", "Invite users"),
    ("users.disable", "Disable users"),
    ("users.role_change", "Change user roles"),
    ("users.delete", "Delete users"),
    ("organisations.create", "Create organisations"),
    ("organisations.view", "View organisations"),
    ("organisations.edit", "Edit organisations"),
    ("subscriptions.view", "View subscriptions"),
    ("subscriptions.manage", "Manage subscriptions and seats"),
    ("subscription_plans.manage", "Manage subscription plans"),
    ("platform.audit", "View platform audit logs"),
    ("organisation.subscription.view", "View organisation subscription and seats"),
    ("organisation.seats.request", "Request additional subscription seats"),
    ("platform.settings", "Manage platform settings"),
]

ROLE_DEFS: list[tuple[str, str, str]] = [
    ("platform_admin", "Tradeal Admin", "platform"),
    ("organisation_admin", "Organisation Admin", "organisation"),
    ("operator", "Organisation Operator", "organisation"),
    ("view_only", "Organisation Viewer", "organisation"),
]

_BUSINESS = {slug for slug, _ in PERMISSIONS if not slug.startswith(("users.", "organisations.", "platform."))}

_ORG_ADMIN = set(_BUSINESS) | {"organisation.subscription.view", "organisation.seats.request"}

_OPERATOR = {
    p
    for p in _BUSINESS
    if p.endswith(".view") or p.endswith(".create") or p in ("reports.view",)
}

_VIEW_ONLY = {p for p in _BUSINESS if p.endswith(".view") or p == "reports.view"}

# Platform Admin: RBAC and platform config only — no PO/SO/lift business permissions.
_PLATFORM = {
    slug
    for slug, _ in PERMISSIONS
    if slug.startswith(("users.", "organisations.", "subscriptions.", "subscription_plans.", "platform."))
}

ROLE_PERMISSION_SLUGS: dict[str, set[str]] = {
    "platform_admin": _PLATFORM,
    "organisation_admin": _ORG_ADMIN,
    "operator": _OPERATOR,
    "view_only": _VIEW_ONLY,
}
