-- Optional hero image on feature catalog cards (URL or data URL).
ALTER TABLE platform_feature_offers
  ADD COLUMN IF NOT EXISTS card_image_url TEXT NOT NULL DEFAULT '';
