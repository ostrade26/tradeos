-- Org-to-Tradeal product requests. Applied on startup via identity/product_requests_schema.py.

CREATE TABLE IF NOT EXISTS product_requests (
    id SERIAL PRIMARY KEY,
    organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    requested_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    message TEXT NOT NULL,
    page_path TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'received',
    reply TEXT NOT NULL DEFAULT '',
    reviewed_by_user_id INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_requests_org ON product_requests(organisation_id);
CREATE INDEX IF NOT EXISTS idx_product_requests_status ON product_requests(status);
