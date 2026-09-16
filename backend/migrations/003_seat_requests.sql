-- Seat purchase requests + per-plan add-on seat pricing (reference; SQLite via billing_schema.py).

ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS additional_seat_monthly_price_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS additional_seat_annual_price_cents INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS seat_requests (
    id SERIAL PRIMARY KEY,
    organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    requested_seats INTEGER NOT NULL DEFAULT 1,
    amount_cents INTEGER NOT NULL DEFAULT 0,
    billing_cycle TEXT NOT NULL DEFAULT 'annual',
    plan_name TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending_payment',
    payment_reference TEXT NOT NULL DEFAULT '',
    request_note TEXT NOT NULL DEFAULT '',
    admin_note TEXT NOT NULL DEFAULT '',
    requested_by_user_id INTEGER REFERENCES users(id),
    reviewed_by_user_id INTEGER REFERENCES users(id),
    paid_at TEXT,
    approved_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_seat_requests_org ON seat_requests(organisation_id);
CREATE INDEX IF NOT EXISTS idx_seat_requests_status ON seat_requests(status);
