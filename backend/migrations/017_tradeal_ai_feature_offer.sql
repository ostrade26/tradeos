-- Tradeal AI: listed as a paid Features offer. No org access until purchase/approval.

INSERT INTO platform_feature_offers (
    feature_key,
    title,
    description,
    pricing_type,
    price_cents,
    currency,
    catalog_status,
    sort_order,
    created_at,
    updated_at,
    listed_at,
    listed_by_user_id
)
SELECT
    'tradeal-ai',
    'Tradeal AI',
    'Ask about earnings, balances, and pending orders — or create a PO, sales order, or lift from chat.',
    'paid',
    0,
    'INR',
    'listed',
    10,
    (NOW() AT TIME ZONE 'utc')::text,
    (NOW() AT TIME ZONE 'utc')::text,
    (NOW() AT TIME ZONE 'utc')::text,
    NULL
WHERE NOT EXISTS (
    SELECT 1 FROM platform_feature_offers WHERE feature_key = 'tradeal-ai'
);

UPDATE platform_feature_offers
SET pricing_type = 'paid',
    updated_at = (NOW() AT TIME ZONE 'utc')::text
WHERE feature_key = 'tradeal-ai' AND pricing_type = 'free';

-- Revoke any auto-granted access from earlier launch seed.
DELETE FROM organisation_applied_updates WHERE feature_key = 'tradeal-ai';
DELETE FROM user_applied_updates WHERE feature_key = 'tradeal-ai';
