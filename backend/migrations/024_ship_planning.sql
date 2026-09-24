-- Ship-later planning fields for draft offers and draft releases.
ALTER TABLE platform_feature_offers
  ADD COLUMN IF NOT EXISTS ready_to_ship INTEGER NOT NULL DEFAULT 0;
ALTER TABLE platform_feature_offers
  ADD COLUMN IF NOT EXISTS target_ship_date TEXT NOT NULL DEFAULT '';
ALTER TABLE platform_feature_offers
  ADD COLUMN IF NOT EXISTS ship_notes TEXT NOT NULL DEFAULT '';

ALTER TABLE platform_releases
  ADD COLUMN IF NOT EXISTS ready_to_ship INTEGER NOT NULL DEFAULT 0;
ALTER TABLE platform_releases
  ADD COLUMN IF NOT EXISTS target_ship_date TEXT NOT NULL DEFAULT '';
ALTER TABLE platform_releases
  ADD COLUMN IF NOT EXISTS ship_notes TEXT NOT NULL DEFAULT '';

-- Backfill notes on existing drafts so Ship queue is honest about origin.
UPDATE platform_feature_offers
SET ship_notes = 'Draft — not listed for organisations yet. Review in Ship queue before listing.'
WHERE catalog_status = 'draft'
  AND (ship_notes IS NULL OR TRIM(ship_notes) = '');

UPDATE platform_releases
SET ship_notes = 'Draft release — not published to organisations yet. Review in Ship queue before publishing.'
WHERE status = 'draft'
  AND (ship_notes IS NULL OR TRIM(ship_notes) = '');
