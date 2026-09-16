-- Optional PostgreSQL RLS (run manually after deploy).
-- Application enforces organisation_id in Python; RLS adds defense in depth.
-- Requires setting per-request: SET LOCAL app.organisation_id = '<id>';

ALTER TABLE trade_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trade_state_org_isolation ON trade_state;
CREATE POLICY trade_state_org_isolation ON trade_state
  FOR ALL
  USING (
    organisation_id = NULLIF(current_setting('app.organisation_id', true), '')::integer
  )
  WITH CHECK (
    organisation_id = NULLIF(current_setting('app.organisation_id', true), '')::integer
  );
