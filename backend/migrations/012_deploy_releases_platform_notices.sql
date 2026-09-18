-- Deploy-triggered draft releases and platform-admin inbox notices (nullable org on notices).

ALTER TABLE user_notifications
    ALTER COLUMN organisation_id DROP NOT NULL;

ALTER TABLE platform_releases ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE platform_releases ADD COLUMN IF NOT EXISTS deploy_commit_sha TEXT;
ALTER TABLE platform_releases ADD COLUMN IF NOT EXISTS deploy_environment TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_releases_deploy_sha
    ON platform_releases(deploy_commit_sha)
    WHERE deploy_commit_sha IS NOT NULL AND deploy_commit_sha <> '';
