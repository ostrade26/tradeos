-- Track login and API activity on organisation users (apply via billing_schema init or manually on PG).

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_at TEXT;
