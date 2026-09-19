"""Load, update, and run scheduled backup reminders."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import HTTPException

from ..db import row_dict, uses_postgres

logger = logging.getLogger(__name__)

FREQUENCIES = frozenset({"daily", "twice_weekly", "weekly", "off"})
DEFAULT_TITLE = "Backup reminder"
DEFAULT_BODY = (
    "Please export a Tradeal backup from Settings → Data and store it safely. "
    "During early testing this helps you recover quickly if something goes wrong."
)
BACKUP_HREF = "/app/settings/data"


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _parse_weekdays(raw: str) -> list[int]:
    days: list[int] = []
    for part in (raw or "").split(","):
        part = part.strip()
        if not part:
            continue
        try:
            day = int(part)
        except ValueError:
            continue
        if 0 <= day <= 6:
            days.append(day)
    return days or [1, 4]


def _settings_row(row: Any) -> dict[str, Any]:
    data = dict(row_dict(row))
    return {
        "enabled": bool(int(data.get("enabled") or 0)),
        "frequency": str(data.get("frequency") or "daily"),
        "send_hour": int(data.get("send_hour") if data.get("send_hour") is not None else 18),
        "send_minute": int(data.get("send_minute") or 0),
        "timezone": str(data.get("timezone") or "Asia/Kolkata"),
        "weekdays": _parse_weekdays(str(data.get("weekdays") or "1,4")),
        "title": str(data.get("title") or DEFAULT_TITLE),
        "body": str(data.get("body") or DEFAULT_BODY),
        "recipient_scope": "all_users",
        "exclude_expired_amc": bool(int(data.get("exclude_expired_amc") if data.get("exclude_expired_amc") is not None else 1)),
        "last_sent_at": data.get("last_sent_at") or None,
        "last_sent_local_date": data.get("last_sent_local_date") or None,
        "updated_at": data.get("updated_at") or None,
    }


def get_backup_reminder_settings(conn) -> dict[str, Any]:
    if uses_postgres():
        row = conn.execute("SELECT * FROM backup_reminder_settings WHERE id = 1").fetchone()
    else:
        row = conn.execute("SELECT * FROM backup_reminder_settings WHERE id = 1").fetchone()
    if not row:
        return {
            "enabled": True,
            "frequency": "daily",
            "send_hour": 18,
            "send_minute": 0,
            "timezone": "Asia/Kolkata",
            "weekdays": [1, 4],
            "title": DEFAULT_TITLE,
            "body": DEFAULT_BODY,
            "recipient_scope": "all_users",
            "exclude_expired_amc": True,
            "last_sent_at": None,
            "last_sent_local_date": None,
            "updated_at": None,
        }
    return _settings_row(row)


def update_backup_reminder_settings(conn, patch: dict[str, Any]) -> dict[str, Any]:
    current = get_backup_reminder_settings(conn)
    enabled = current["enabled"] if "enabled" not in patch else bool(patch["enabled"])
    frequency = str(patch.get("frequency", current["frequency"])).strip()
    if frequency not in FREQUENCIES:
        raise HTTPException(status_code=400, detail="Invalid frequency")
    if frequency == "off":
        enabled = False
        frequency = current["frequency"] if current["frequency"] != "off" else "daily"

    send_hour = int(patch.get("send_hour", current["send_hour"]))
    send_minute = int(patch.get("send_minute", current["send_minute"]))
    if not (0 <= send_hour <= 23) or not (0 <= send_minute <= 59):
        raise HTTPException(status_code=400, detail="Invalid send time")

    tz_name = str(patch.get("timezone", current["timezone"])).strip() or "Asia/Kolkata"
    try:
        ZoneInfo(tz_name)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid timezone") from exc

    weekdays = patch.get("weekdays", current["weekdays"])
    if isinstance(weekdays, str):
        weekdays = _parse_weekdays(weekdays)
    weekdays = [int(d) for d in weekdays if 0 <= int(d) <= 6]
    if not weekdays:
        weekdays = [1, 4]
    weekdays_csv = ",".join(str(d) for d in sorted(set(weekdays)))

    title = str(patch.get("title", current["title"])).strip() or DEFAULT_TITLE
    body = str(patch.get("body", current["body"])).strip() or DEFAULT_BODY
    # Scheduled backups always reach organisation admins and licensed users.
    scope = "all_users"
    exclude = (
        current["exclude_expired_amc"]
        if "exclude_expired_amc" not in patch
        else bool(patch["exclude_expired_amc"])
    )
    now = _now_utc().isoformat()

    vals = (
        1 if enabled else 0,
        frequency,
        send_hour,
        send_minute,
        tz_name,
        weekdays_csv,
        title,
        body,
        scope,
        1 if exclude else 0,
        now,
    )
    if uses_postgres():
        conn.execute(
            """
            INSERT INTO backup_reminder_settings
            (id, enabled, frequency, send_hour, send_minute, timezone, weekdays,
             title, body, recipient_scope, exclude_expired_amc, updated_at)
            VALUES (1, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                enabled = EXCLUDED.enabled,
                frequency = EXCLUDED.frequency,
                send_hour = EXCLUDED.send_hour,
                send_minute = EXCLUDED.send_minute,
                timezone = EXCLUDED.timezone,
                weekdays = EXCLUDED.weekdays,
                title = EXCLUDED.title,
                body = EXCLUDED.body,
                recipient_scope = EXCLUDED.recipient_scope,
                exclude_expired_amc = EXCLUDED.exclude_expired_amc,
                updated_at = EXCLUDED.updated_at
            """,
            vals,
        )
    else:
        exists = conn.execute("SELECT id FROM backup_reminder_settings WHERE id = 1").fetchone()
        if exists:
            conn.execute(
                """
                UPDATE backup_reminder_settings SET
                    enabled = ?, frequency = ?, send_hour = ?, send_minute = ?,
                    timezone = ?, weekdays = ?, title = ?, body = ?,
                    recipient_scope = ?, exclude_expired_amc = ?, updated_at = ?
                WHERE id = 1
                """,
                vals,
            )
        else:
            conn.execute(
                """
                INSERT INTO backup_reminder_settings
                (id, enabled, frequency, send_hour, send_minute, timezone, weekdays,
                 title, body, recipient_scope, exclude_expired_amc, updated_at)
                VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                vals,
            )
    return get_backup_reminder_settings(conn)


def _is_send_weekday(local_now: datetime, frequency: str, weekdays: list[int]) -> bool:
    wd = local_now.weekday()
    if frequency == "daily":
        return True
    if frequency == "weekly":
        # Default weekly send day = Friday (4), or first configured weekday
        target = weekdays[0] if weekdays else 4
        return wd == target
    if frequency == "twice_weekly":
        return wd in set(weekdays)
    return False


def is_backup_reminder_due(settings: dict[str, Any], *, now: datetime | None = None) -> bool:
    if not settings.get("enabled"):
        return False
    frequency = str(settings.get("frequency") or "daily")
    if frequency == "off":
        return False

    tz_name = str(settings.get("timezone") or "Asia/Kolkata")
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("Asia/Kolkata")

    local_now = (now or _now_utc()).astimezone(tz)
    send_hour = int(settings.get("send_hour") if settings.get("send_hour") is not None else 18)
    send_minute = int(settings.get("send_minute") or 0)

    # Fire in the matching minute window (scheduler ticks ~every 60s).
    if local_now.hour != send_hour or local_now.minute != send_minute:
        return False

    if not _is_send_weekday(local_now, frequency, list(settings.get("weekdays") or [1, 4])):
        return False

    local_date = local_now.date().isoformat()
    if settings.get("last_sent_local_date") == local_date:
        return False
    return True


def mark_backup_reminder_sent(conn, *, local_date: str, sent_at: str | None = None) -> None:
    sent_at = sent_at or _now_utc().isoformat()
    if uses_postgres():
        conn.execute(
            """
            UPDATE backup_reminder_settings
            SET last_sent_at = %s, last_sent_local_date = %s, updated_at = %s
            WHERE id = 1
            """,
            (sent_at, local_date, sent_at),
        )
    else:
        conn.execute(
            """
            UPDATE backup_reminder_settings
            SET last_sent_at = ?, last_sent_local_date = ?, updated_at = ?
            WHERE id = 1
            """,
            (sent_at, local_date, sent_at),
        )


def run_backup_reminder_tick(conn) -> dict[str, Any] | None:
    """Send backup reminders if due. Returns send result or None if skipped."""
    from .notifications_repository import create_notifications_for_audience

    settings = get_backup_reminder_settings(conn)
    if not is_backup_reminder_due(settings):
        return None

    tz = ZoneInfo(str(settings.get("timezone") or "Asia/Kolkata"))
    local_now = _now_utc().astimezone(tz)
    local_date = local_now.date().isoformat()

    try:
        result = create_notifications_for_audience(
            conn,
            audience="active_licences",
            organisation_id=None,
            recipient_user_id=None,
            recipient_scope="all_users",
            exclude_expired_amc=bool(settings.get("exclude_expired_amc", True)),
            kind="backup_reminder",
            title=str(settings.get("title") or DEFAULT_TITLE),
            body=str(settings.get("body") or DEFAULT_BODY),
            payload={"cta": "acknowledge", "source": "schedule"},
            href=BACKUP_HREF,
            actor_user_id=None,
        )
    except HTTPException as exc:
        # No recipients is not fatal for the scheduler.
        if exc.status_code == 400:
            logger.info("Backup reminder skipped: %s", exc.detail)
            mark_backup_reminder_sent(conn, local_date=local_date)
            return {"sent": 0, "skipped": True, "detail": str(exc.detail)}
        raise

    mark_backup_reminder_sent(conn, local_date=local_date)
    result.pop("notifications", None)
    result["local_date"] = local_date
    return result
