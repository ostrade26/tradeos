"""SQLite single-row JSON storage for trade state."""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DB_PATH = Path(os.environ.get("TRADEOS_DB_PATH", Path(__file__).resolve().parent.parent / "data" / "trade.db"))

DEFAULT_STATE: dict[str, Any] = {
    "tradeOrders": [],
    "lifts": [],
    "contracts": [],
    "lots": [],
    "payments": [],
    "deliveries": [],
    "brokers": [],
    "producers": [],
    "retailers": [],
    "companies": [],
    "activities": [],
    "balanceSettlements": [],
    "spots": [],
    "items": [],
    "counters": {"po": 0, "so": 0, "lift": 0, "invoice": 0},
}


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.isolation_level = None
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS trade_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                data TEXT NOT NULL
            )
            """
        )
        row = conn.execute("SELECT data FROM trade_state WHERE id = 1").fetchone()
        if row is None:
            conn.execute(
                "INSERT INTO trade_state (id, data) VALUES (1, ?)",
                (json.dumps(DEFAULT_STATE),),
            )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS demo_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                company TEXT NOT NULL,
                phone TEXT NOT NULL DEFAULT '',
                email TEXT NOT NULL DEFAULT '',
                message TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def get_state() -> dict[str, Any]:
    init_db()
    with _connect() as conn:
        row = conn.execute("SELECT data FROM trade_state WHERE id = 1").fetchone()
        if row is None:
            return dict(DEFAULT_STATE)
        return json.loads(row["data"])


def save_state(data: dict[str, Any]) -> None:
    init_db()
    with _connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute(
            "UPDATE trade_state SET data = ? WHERE id = 1",
            (json.dumps(data),),
        )
        conn.commit()


def insert_demo_request(
    *,
    name: str,
    company: str,
    phone: str,
    email: str,
    message: str,
) -> dict[str, Any]:
    init_db()
    created_at = datetime.now(timezone.utc).isoformat()
    with _connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO demo_requests (name, company, phone, email, message, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (name, company, phone, email, message, created_at),
        )
        conn.commit()
        return {"id": cur.lastrowid, "createdAt": created_at}
