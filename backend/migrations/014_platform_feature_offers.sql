CREATE TABLE IF NOT EXISTS platform_feature_offers (
    id SERIAL PRIMARY KEY,
    feature_key TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    pricing_type TEXT NOT NULL DEFAULT 'free',
    price_cents INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'INR',
    catalog_status TEXT NOT NULL DEFAULT 'draft',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    listed_at TEXT,
    listed_by_user_id INTEGER REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_platform_feature_offers_status
    ON platform_feature_offers(catalog_status, sort_order, id);
