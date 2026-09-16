-- Organisation subscription, seats, and membership foundation (PostgreSQL reference).
-- SQLite applies the same changes via init_identity_schema / billing_schema.py on startup.

-- Organisation profile (extend existing organisations table)
-- org_code, legal_name, gstin, pan, business_address, city, state, country, pincode,
-- primary_contact_name, primary_contact_email, primary_contact_mobile

-- subscription_plans, subscriptions, organisation_seats, organisation_members

-- Optional RLS (defense in depth) — application enforces membership in Python.
-- ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
