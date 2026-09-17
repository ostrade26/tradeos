"""Login username rules for organisation users."""

from __future__ import annotations

import re

from fastapi import HTTPException

_USERNAME_RE = re.compile(r"^(?=.*[a-z0-9])[a-z0-9._]{3,32}$")

_RESERVED = frozenset(
    {
        "admin",
        "administrator",
        "platform",
        "platform.admin",
        "root",
        "system",
        "support",
        "tradeal",
        "tradeos",
        "help",
        "null",
        "undefined",
    }
)


def require_login_username(value: str, *, allow_existing: str | None = None) -> str:
    username = (value or "").strip().lower()
    existing = (allow_existing or "").strip().lower()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if existing and username == existing:
        return username
    if not _USERNAME_RE.fullmatch(username):
        raise HTTPException(
            status_code=400,
            detail="Username must be 3–32 characters: letters, numbers, dots, and underscores.",
        )
    if username in _RESERVED:
        raise HTTPException(status_code=400, detail="That username is reserved. Choose another.")
    return username
