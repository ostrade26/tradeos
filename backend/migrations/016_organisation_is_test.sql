-- Temporary QA / demo customer organisations (deletable). Distinct from sandbox_tools.
ALTER TABLE organisations
    ADD COLUMN IF NOT EXISTS is_test INTEGER NOT NULL DEFAULT 0;
