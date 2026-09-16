-- Curated, versioned product releases for platform admin to publish.

CREATE TABLE IF NOT EXISTS platform_releases (
    id SERIAL PRIMARY KEY,
    version TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    created_by_user_id INTEGER REFERENCES users(id),
    published_at TEXT,
    published_by_user_id INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS platform_release_items (
    id SERIAL PRIMARY KEY,
    release_id INTEGER NOT NULL REFERENCES platform_releases(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    feature_key TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_platform_release_items_release ON platform_release_items(release_id, sort_order);

CREATE TABLE IF NOT EXISTS organisation_applied_updates (
    id SERIAL PRIMARY KEY,
    organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '',
    release_id INTEGER REFERENCES platform_releases(id) ON DELETE SET NULL,
    notification_id INTEGER REFERENCES user_notifications(id) ON DELETE SET NULL,
    applied_by_user_id INTEGER REFERENCES users(id),
    applied_at TEXT NOT NULL,
    UNIQUE (organisation_id, feature_key)
);
CREATE INDEX IF NOT EXISTS idx_org_applied_updates_org ON organisation_applied_updates(organisation_id);

ALTER TABLE user_applied_updates ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT '';
ALTER TABLE user_applied_updates ADD COLUMN IF NOT EXISTS release_id INTEGER REFERENCES platform_releases(id) ON DELETE SET NULL;
