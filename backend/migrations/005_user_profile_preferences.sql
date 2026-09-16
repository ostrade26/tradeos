-- User profile + UI preferences (SQLite; Postgres applied via billing_schema ensure)
ALTER TABLE users ADD COLUMN location TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN preferences TEXT NOT NULL DEFAULT '{}';
