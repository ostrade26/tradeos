"""Session-scoped endpoints for any signed-in user (org members and platform admin)."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Path, Query, Request
from pydantic import BaseModel, Field

from .. import auth
from ..db import _pg_connect, _sqlite_connect, uses_postgres

router = APIRouter(prefix="/api/v1/me", tags=["auth"])


def _session(request: Request) -> auth.Session:
    session = getattr(request.state, "session", None)
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return session


@router.get("/inbox/summary", summary="Open inbox count for the bell badge")
def inbox_summary(request: Request) -> dict[str, int]:
    session = _session(request)
    from .inbox_repository import inbox_bell_count

    org_id = session.user.organisation_id
    if uses_postgres():
        with _pg_connect() as conn:
            return {
                "open_count": inbox_bell_count(
                    conn, session.user.id, session.user.role_slug, organisation_id=org_id
                )
            }
    with _sqlite_connect() as conn:
        return {
            "open_count": inbox_bell_count(
                conn, session.user.id, session.user.role_slug, organisation_id=org_id
            )
        }


@router.get("/inbox", summary="Unified inbox — Received (to me) or Sent (outbox)")
def list_inbox(
    request: Request,
    filter: Literal["open", "all"] = Query(default="all", alias="filter"),
    box: Literal["received", "sent"] = Query(default="received"),
    limit: int = Query(default=100, ge=1, le=200),
) -> dict[str, Any]:
    session = _session(request)
    from .inbox_repository import (
        inbox_bell_count,
        inbox_notice_unread,
        inbox_open_count,
        list_inbox_for_session,
    )

    fk = filter if filter in ("open", "all") else "all"
    box_kind = box if box in ("received", "sent") else "received"
    org_id = session.user.organisation_id
    if uses_postgres():
        with _pg_connect() as conn:
            items = list_inbox_for_session(
                conn,
                user_id=session.user.id,
                role_slug=session.user.role_slug,
                organisation_id=org_id,
                filter_kind=fk,
                box=box_kind,
                limit=limit,
            )
            return {
                "items": items,
                "box": box_kind,
                "open_count": inbox_open_count(
                    conn, session.user.id, session.user.role_slug, organisation_id=org_id
                ),
                "bell_count": inbox_bell_count(
                    conn, session.user.id, session.user.role_slug, organisation_id=org_id
                ),
                "notice_unread": inbox_notice_unread(conn, session.user.id),
            }
    with _sqlite_connect() as conn:
        items = list_inbox_for_session(
            conn,
            user_id=session.user.id,
            role_slug=session.user.role_slug,
            organisation_id=org_id,
            filter_kind=fk,
            box=box_kind,
            limit=limit,
        )
        return {
            "items": items,
            "box": box_kind,
            "open_count": inbox_open_count(
                conn, session.user.id, session.user.role_slug, organisation_id=org_id
            ),
            "bell_count": inbox_bell_count(
                conn, session.user.id, session.user.role_slug, organisation_id=org_id
            ),
            "notice_unread": inbox_notice_unread(conn, session.user.id),
        }


@router.post("/inbox/read-all", summary="Mark all notice items read")
def inbox_read_all(request: Request) -> dict[str, Any]:
    session = _session(request)
    from .inbox_repository import mark_all_inbox_notices_read

    if uses_postgres():
        with _pg_connect() as conn:
            count = mark_all_inbox_notices_read(conn, session.user.id)
            conn.commit()
            return {"ok": True, "updated": count}
    with _sqlite_connect() as conn:
        count = mark_all_inbox_notices_read(conn, session.user.id)
        conn.commit()
        return {"ok": True, "updated": count}


class AckDeployReviewsBody(BaseModel):
    cta: Literal["review_features", "review_release"]


@router.post(
    "/inbox/ack-deploy-reviews",
    summary="Mark unread deploy-review notices read for a destination CTA",
)
def inbox_ack_deploy_reviews(body: AckDeployReviewsBody, request: Request) -> dict[str, Any]:
    """Called when Features & Access or Releases opens so inbox stays in sync."""
    session = _session(request)
    from .inbox_repository import ack_inbox_deploy_reviews

    if uses_postgres():
        with _pg_connect() as conn:
            count = ack_inbox_deploy_reviews(conn, session.user.id, body.cta)
            conn.commit()
            return {"ok": True, "updated": count}
    with _sqlite_connect() as conn:
        count = ack_inbox_deploy_reviews(conn, session.user.id, body.cta)
        conn.commit()
        return {"ok": True, "updated": count}


@router.post("/inbox/items/{item_id}/read", summary="Mark a notice item read")
def inbox_item_read(
    request: Request,
    item_id: str = Path(..., min_length=1, max_length=80),
) -> dict[str, Any]:
    session = _session(request)
    from .inbox_repository import mark_inbox_item_read

    if uses_postgres():
        with _pg_connect() as conn:
            item = mark_inbox_item_read(conn, item_id, session.user.id)
            if item is None:
                raise HTTPException(status_code=400, detail="This item cannot be marked read")
            conn.commit()
            return {"ok": True, "notification": item}
    with _sqlite_connect() as conn:
        item = mark_inbox_item_read(conn, item_id, session.user.id)
        if item is None:
            raise HTTPException(status_code=400, detail="This item cannot be marked read")
        conn.commit()
        return {"ok": True, "notification": item}


class InboxDeleteBody(BaseModel):
    ids: list[str] = Field(default_factory=list, max_length=100)


@router.delete("/inbox/items/{item_id}", summary="Delete an inbox item (Received notice or Sent outbox)")
def inbox_item_delete(
    request: Request,
    item_id: str = Path(..., min_length=1, max_length=80),
) -> dict[str, Any]:
    session = _session(request)
    from .inbox_repository import delete_inbox_item

    org_id = session.user.organisation_id
    if uses_postgres():
        with _pg_connect() as conn:
            ok = delete_inbox_item(
                conn,
                item_id,
                session.user.id,
                organisation_id=org_id,
            )
            if not ok:
                raise HTTPException(
                    status_code=400,
                    detail="This item cannot be deleted from inbox",
                )
            conn.commit()
            return {"ok": True, "deleted": 1}
    with _sqlite_connect() as conn:
        ok = delete_inbox_item(
            conn,
            item_id,
            session.user.id,
            organisation_id=org_id,
        )
        if not ok:
            raise HTTPException(
                status_code=400,
                detail="This item cannot be deleted from inbox",
            )
        conn.commit()
        return {"ok": True, "deleted": 1}


@router.post("/inbox/delete", summary="Delete inbox items (Received notices or Sent outbox)")
def inbox_items_delete(body: InboxDeleteBody, request: Request) -> dict[str, Any]:
    session = _session(request)
    from .inbox_repository import delete_inbox_items

    ids = [str(i).strip() for i in body.ids if str(i).strip()]
    if not ids:
        raise HTTPException(status_code=400, detail="No items to delete")
    org_id = session.user.organisation_id
    if uses_postgres():
        with _pg_connect() as conn:
            count = delete_inbox_items(
                conn,
                ids,
                session.user.id,
                organisation_id=org_id,
            )
            conn.commit()
            return {"ok": True, "deleted": count}
    with _sqlite_connect() as conn:
        count = delete_inbox_items(
            conn,
            ids,
            session.user.id,
            organisation_id=org_id,
        )
        conn.commit()
        return {"ok": True, "deleted": count}


# Legacy aliases — prefer /me/inbox
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


class ApplyNotificationBody(BaseModel):
    feature_keys: list[str] = Field(default_factory=list)


class ExpressFeatureInterestBody(BaseModel):
    feature_keys: list[str] = Field(default_factory=list)


@router.post(
    "/notifications/{notification_id}/express-interest",
    summary="Request access to a launched feature (sales flow)",
)
def express_feature_interest(
    notification_id: int,
    request: Request,
    body: ExpressFeatureInterestBody,
) -> dict[str, Any]:
    session = _session(request)
    if not session.user.organisation_id:
        raise HTTPException(status_code=400, detail="Organisation account required")
    from .feature_interests_repository import express_interest_from_notification

    if uses_postgres():
        with _pg_connect() as conn:
            result = express_interest_from_notification(
                conn,
                notification_id=notification_id,
                user_id=session.user.id,
                organisation_id=int(session.user.organisation_id),
                feature_keys=body.feature_keys,
            )
            conn.commit()
            return result
    with _sqlite_connect() as conn:
        result = express_interest_from_notification(
            conn,
            notification_id=notification_id,
            user_id=session.user.id,
            organisation_id=int(session.user.organisation_id),
            feature_keys=body.feature_keys,
        )
        conn.commit()
        return result


@router.post("/notifications/{notification_id}/apply", summary="Apply a product update from a notice")
def apply_my_notification_update(
    notification_id: int,
    request: Request,
    body: ApplyNotificationBody | None = None,
) -> dict[str, Any]:
    session = _session(request)
    from .notifications_repository import apply_notification_update

    selected = body.feature_keys if body and body.feature_keys else None
    if uses_postgres():
        with _pg_connect() as conn:
            item = apply_notification_update(
                conn,
                notification_id,
                session.user.id,
                selected_feature_keys=selected,
            )
            conn.commit()
            return {"notification": item, "applied": bool(item.get("applied_at"))}
    with _sqlite_connect() as conn:
        item = apply_notification_update(
            conn,
            notification_id,
            session.user.id,
            selected_feature_keys=selected,
        )
        conn.commit()
        return {"notification": item, "applied": bool(item.get("applied_at"))}
