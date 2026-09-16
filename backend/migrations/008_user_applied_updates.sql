-- Per-user product updates applied from in-app notices.

ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS applied_at TEXT;
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS feature_key TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS user_applied_updates (
    id SERIAL PRIMARY KEY,
    organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    notification_id INTEGER REFERENCES user_notifications(id) ON DELETE SET NULL,
    applied_at TEXT NOT NULL,
    UNIQUE (user_id, feature_key)
);
CREATE INDEX IF NOT EXISTS idx_user_applied_updates_user ON user_applied_updates(user_id);
