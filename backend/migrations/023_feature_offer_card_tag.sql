-- Optional marketplace card category tag (overrides tone-derived label).
ALTER TABLE platform_feature_offers
  ADD COLUMN IF NOT EXISTS card_tag TEXT NOT NULL DEFAULT '';
