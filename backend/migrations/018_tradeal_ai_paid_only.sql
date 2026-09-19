-- Revoke Tradeal AI auto-grants; keep catalog offer paid until org purchases.

UPDATE platform_feature_offers
SET pricing_type = 'paid',
    updated_at = (NOW() AT TIME ZONE 'utc')::text
WHERE feature_key = 'tradeal-ai' AND pricing_type <> 'paid';

DELETE FROM organisation_applied_updates WHERE feature_key = 'tradeal-ai';
DELETE FROM user_applied_updates WHERE feature_key = 'tradeal-ai';
