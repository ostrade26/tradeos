"""Password reset tokens table."""

from __future__ import annotations

from ..db import _pg_connect, _sqlite_connect, uses_postgres


def init_password_reset_schema() -> None:
    if uses_postgres():
        with _pg_connect() as conn:
            _create_table(conn)
            conn.commit()
        return
    with _sqlite_connect() as conn:
        _create_table(conn)
        conn.commit()


def _create_table(conn) -> None:
    pk = "SERIAL PRIMARY KEY" if uses_postgres() else "INTEGER PRIMARY KEY AUTOINCREMENT"
    ref = (
        "INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE"
        if uses_postgres()
        else "INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE"
    )
    conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id {pk},
            user_id {ref},
            token_hash TEXT NOT NULL UNIQUE,
            expires_at TEXT NOT NULL,
            used_at TEXT,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
        ON password_reset_tokens (user_id)
        """
    )
