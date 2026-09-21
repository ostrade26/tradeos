-- Featured catalog card (spans 2x2 in the marketplace grid).
ALTER TABLE platform_feature_offers
  ADD COLUMN IF NOT EXISTS card_featured INTEGER NOT NULL DEFAULT 0;
