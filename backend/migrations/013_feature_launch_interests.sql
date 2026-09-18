-- Feature launch interest → platform approve/decline → org enablement
-- One open (interested) request per org+feature; approved/rejected may repeat over time.

CREATE TABLE IF NOT EXISTS feature_launch_interests (
    id SERIAL PRIMARY KEY,
    organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    requested_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    feature_title TEXT NOT NULL DEFAULT '',
    feature_detail TEXT NOT NULL DEFAULT '',
    source_notification_id INTEGER REFERENCES user_notifications(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'interested',
    platform_note TEXT NOT NULL DEFAULT '',
    reviewed_by_user_id INTEGER REFERENCES users(id),
    reviewed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feature_launch_interests_status
    ON feature_launch_interests(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_launch_interests_one_open
    ON feature_launch_interests(organisation_id, feature_key)
    WHERE status = 'interested';
