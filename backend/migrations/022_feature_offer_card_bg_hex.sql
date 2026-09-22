-- Custom feature-card background colour (details panel).
ALTER TABLE platform_feature_offers
  ADD COLUMN IF NOT EXISTS card_bg_hex TEXT NOT NULL DEFAULT '';
