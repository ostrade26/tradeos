-- Allow declining a feature request after a prior rejection for the same org+feature.
-- Old UNIQUE(organisation_id, feature_key, status) blocked status → rejected when a rejected row already existed.

ALTER TABLE feature_launch_interests
    DROP CONSTRAINT IF EXISTS feature_launch_interests_organisation_id_feature_key_status_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_launch_interests_one_open
    ON feature_launch_interests(organisation_id, feature_key)
    WHERE status = 'interested';
