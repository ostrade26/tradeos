"""In-process worker for notification campaign fan-out.

v1 is intentionally small: campaigns are stored in SQLite/Postgres, then a
background thread (and FastAPI BackgroundTasks after send/publish) inserts
per-user `user_notifications` rows.

Local observe
-------------
1. Start the API as usual (`./run.sh` or `npm run dev:backend`). The worker
   thread starts with the app unless `TRADEAL_NOTIFICATION_WORKER=0`.
2. Send a multi-recipient notice (audience `active_licences` or `org`).
   The HTTP response returns immediately with `queued: true` and `campaign_id`.
3. Poll `GET /api/v1/platform/notification-campaigns/{id}` (platform admin
   session). `status` goes pending → processing → complete; `sent_count`
   is the number of `user_notifications` rows.
4. Retry a failed campaign: `POST /api/v1/platform/notification-campaigns/{id}/process`.
5. Drain the queue from a shell (backend venv, repo `backend/` cwd):

       python -m app.identity.notification_worker
"""

from __future__ import annotations

import logging
import os
import threading
import time

from ..db import _pg_connect, _sqlite_connect, uses_postgres

logger = logging.getLogger(__name__)

_worker_stop = threading.Event()
_worker_thread: threading.Thread | None = None


def _worker_enabled() -> bool:
    raw = (os.environ.get("TRADEAL_NOTIFICATION_WORKER") or "1").strip().lower()
    return raw not in ("0", "false", "off", "no")


def _interval_seconds() -> float:
    raw = (os.environ.get("TRADEAL_NOTIFICATION_WORKER_INTERVAL_MS") or "2000").strip()
    try:
        ms = max(250, int(raw))
    except ValueError:
        ms = 2000
    return ms / 1000.0


def process_notification_campaigns_once(*, limit: int = 5) -> int:
    """Open a fresh connection and process pending/failed campaigns. Returns how many ran."""
    from .notification_campaigns_repository import process_pending_campaigns

    try:
        if uses_postgres():
            with _pg_connect() as conn:
                results = process_pending_campaigns(conn, limit=limit)
                conn.commit()
                return len(results)
        with _sqlite_connect() as conn:
            results = process_pending_campaigns(conn, limit=limit)
            conn.commit()
            return len(results)
    except Exception:
        logger.exception("Notification campaign worker failed")
        return 0


def schedule_campaign_processing(background_tasks=None) -> None:
    """Kick fan-out after the HTTP transaction commits (FastAPI BackgroundTasks)."""
    if background_tasks is None:
        return
    background_tasks.add_task(process_notification_campaigns_once)


def _loop() -> None:
    interval = _interval_seconds()
    while not _worker_stop.wait(interval):
        process_notification_campaigns_once(limit=10)


def start_campaign_worker() -> None:
    global _worker_thread
    if not _worker_enabled():
        logger.info("Notification campaign worker disabled (TRADEAL_NOTIFICATION_WORKER=0)")
        return
    if _worker_thread and _worker_thread.is_alive():
        return
    _worker_stop.clear()
    _worker_thread = threading.Thread(
        target=_loop,
        name="notification-campaign-worker",
        daemon=True,
    )
    _worker_thread.start()
    logger.info("Notification campaign worker started")


def stop_campaign_worker() -> None:
    _worker_stop.set()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    from ..db import init_db

    init_db()
    n = process_notification_campaigns_once(limit=50)
    print(f"processed {n} campaign(s)")


if __name__ == "__main__":
    main()
