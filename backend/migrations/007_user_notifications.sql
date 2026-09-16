-- User notifications (PostgreSQL). Applied on startup via identity/notifications_schema.py.

CREATE TABLE IF NOT EXISTS user_notifications (
    id SERIAL PRIMARY KEY,
    organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    recipient_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    payload_json TEXT NOT NULL DEFAULT '{}',
    href TEXT NOT NULL DEFAULT '',
    read_at TEXT,
    created_at TEXT NOT NULL,
    created_by_user_id INTEGER REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_user_notifications_recipient
    ON user_notifications(recipient_user_id, created_at DESC);
