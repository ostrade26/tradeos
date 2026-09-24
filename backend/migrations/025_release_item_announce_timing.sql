-- Product-update announce timing: publish now vs ship later (Ship queue).
ALTER TABLE platform_release_items
  ADD COLUMN IF NOT EXISTS announce_timing TEXT NOT NULL DEFAULT 'now';
ALTER TABLE platform_release_items
  ADD COLUMN IF NOT EXISTS announced_at TEXT;
ALTER TABLE platform_release_items
  ADD COLUMN IF NOT EXISTS ready_to_ship INTEGER NOT NULL DEFAULT 0;
ALTER TABLE platform_release_items
  ADD COLUMN IF NOT EXISTS target_ship_date TEXT NOT NULL DEFAULT '';
ALTER TABLE platform_release_items
  ADD COLUMN IF NOT EXISTS ship_notes TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_platform_release_items_deferred
  ON platform_release_items (announce_timing, announced_at);
