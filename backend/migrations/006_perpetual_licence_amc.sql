-- Perpetual licence + annual AMC (PostgreSQL).
-- Also applied on startup via identity/licence_schema.py for SQLite and Postgres.

ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS licence_type TEXT NOT NULL DEFAULT 'perpetual';
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS licence_price_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS included_admin_seats INTEGER NOT NULL DEFAULT 1;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS included_operator_seats INTEGER NOT NULL DEFAULT 1;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS additional_seat_licence_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS amc_price_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS additional_seat_amc_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS amc_duration_months INTEGER NOT NULL DEFAULT 12;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS amc_grace_days INTEGER NOT NULL DEFAULT 30;

CREATE TABLE IF NOT EXISTS organisation_licenses (
    id SERIAL PRIMARY KEY,
    organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    plan_id INTEGER REFERENCES subscription_plans(id),
    licence_number TEXT NOT NULL UNIQUE,
    plan_name TEXT NOT NULL DEFAULT '',
    licence_type TEXT NOT NULL DEFAULT 'perpetual',
    licence_price_cents INTEGER NOT NULL DEFAULT 0,
    purchase_date TEXT NOT NULL,
    activation_date TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    included_seats INTEGER NOT NULL DEFAULT 2,
    included_admin_seats INTEGER NOT NULL DEFAULT 1,
    included_operator_seats INTEGER NOT NULL DEFAULT 1,
    purchased_additional_seats INTEGER NOT NULL DEFAULT 0,
    additional_seat_licence_cents INTEGER NOT NULL DEFAULT 0,
    additional_seat_amc_cents INTEGER NOT NULL DEFAULT 0,
    amc_price_cents INTEGER NOT NULL DEFAULT 0,
    amc_duration_months INTEGER NOT NULL DEFAULT 12,
    amc_grace_days INTEGER NOT NULL DEFAULT 30,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_org_licenses_org ON organisation_licenses(organisation_id);

CREATE TABLE IF NOT EXISTS organisation_amcs (
    id SERIAL PRIMARY KEY,
    organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    licence_id INTEGER NOT NULL REFERENCES organisation_licenses(id) ON DELETE CASCADE,
    amc_price_cents INTEGER NOT NULL DEFAULT 0,
    included INTEGER NOT NULL DEFAULT 0,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    grace_until TEXT,
    renewal_date TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    payment_status TEXT NOT NULL DEFAULT 'none',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_org_amcs_licence ON organisation_amcs(licence_id);

CREATE TABLE IF NOT EXISTS organisation_payments (
    id SERIAL PRIMARY KEY,
    organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    licence_id INTEGER REFERENCES organisation_licenses(id),
    amc_id INTEGER REFERENCES organisation_amcs(id),
    payment_type TEXT NOT NULL DEFAULT 'other',
    amount_cents INTEGER NOT NULL DEFAULT 0,
    payment_date TEXT NOT NULL,
    payment_reference TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_org_payments_org ON organisation_payments(organisation_id);

-- AMC expiry MUST NOT delete or lock organisation trade data.
