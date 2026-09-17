-- Notification campaigns (PostgreSQL). Applied on startup via identity/notifications_schema.py.
-- SQLite applies the same changes in that module (PRAGMA table_info + ALTER).

CREATE TABLE IF NOT EXISTS notification_campaigns (
    id SERIAL PRIMARY KEY,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    payload_json TEXT NOT NULL DEFAULT '{}',
    href TEXT NOT NULL DEFAULT '',
    feature_key TEXT NOT NULL DEFAULT '',
    audience TEXT NOT NULL,
    organisation_id INTEGER REFERENCES organisations(id) ON DELETE SET NULL,
    recipient_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    recipient_scope TEXT NOT NULL DEFAULT 'org_admin',
    exclude_expired_amc INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    target_count INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    skipped_expired_amc INTEGER NOT NULL DEFAULT 0,
    error_message TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'manual',
    source_id INTEGER,
    created_by_user_id INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_notification_campaigns_status
    ON notification_campaigns(status, id);

ALTER TABLE user_notifications
    ADD COLUMN IF NOT EXISTS campaign_id INTEGER REFERENCES notification_campaigns(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_notifications_campaign_recipient
    ON user_notifications(campaign_id, recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_campaign
    ON user_notifications(campaign_id);
