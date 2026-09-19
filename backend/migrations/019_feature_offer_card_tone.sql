-- Persist marketplace card colour tone (neutral|ai|analytics|connect|ops|spark).
ALTER TABLE platform_feature_offers
  ADD COLUMN IF NOT EXISTS card_tone TEXT NOT NULL DEFAULT '';
