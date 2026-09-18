import type { OrgFeatureOffer } from '../api/organisationApi'

/** Temporary catalog rows for UI preview — remove when real offers fill the marketplace. */
export const SHOW_ADDON_MARKETPLACE_PREVIEW = true

export const PREVIEW_ADDON_OFFERS: OrgFeatureOffer[] = [
  {
    id: -1,
    feature_key: 'preview_trade_assistant',
    title: 'AI Trade Assistant',
    description:
      'Ask questions about open POs, lifts, and margins in plain language. Summaries and draft replies for your team.',
    pricing_type: 'free',
    price_cents: 0,
    currency: 'INR',
    catalog_status: 'listed',
    entitlement_status: 'available',
  },
  {
    id: -2,
    feature_key: 'preview_analytics_pro',
    title: 'Analytics Pro',
    description:
      'Deeper register views, margin waterfalls, and exportable dashboards for management reviews.',
    pricing_type: 'paid',
    price_cents: 499900,
    currency: 'INR',
    catalog_status: 'listed',
    entitlement_status: 'available',
  },
  {
    id: -3,
    feature_key: 'preview_whatsapp_alerts',
    title: 'WhatsApp dispatch alerts',
    description: 'Notify buyers and sellers on lift milestones, delays, and document readiness.',
    pricing_type: 'contact',
    price_cents: 0,
    currency: 'INR',
    catalog_status: 'listed',
    entitlement_status: 'pending',
  },
  {
    id: -4,
    feature_key: 'preview_lift_scheduler',
    title: 'Lift scheduling',
    description: 'Slot-based lift planning with carrier capacity hints and conflict warnings.',
    pricing_type: 'paid',
    price_cents: 249900,
    currency: 'INR',
    catalog_status: 'listed',
    entitlement_status: 'available',
  },
  {
    id: -5,
    feature_key: 'preview_broker_api',
    title: 'Broker API sync',
    description: 'Two-way sync for brokered deals with partner systems and audit-friendly webhooks.',
    pricing_type: 'free',
    price_cents: 0,
    currency: 'INR',
    catalog_status: 'listed',
    entitlement_status: 'active',
  },
  {
    id: -6,
    feature_key: 'preview_compliance_pack',
    title: 'Compliance audit pack',
    description: 'Export-ready audit trails for lifts, payments, and document sign-offs.',
    pricing_type: 'paid',
    price_cents: 149900,
    currency: 'INR',
    catalog_status: 'listed',
    entitlement_status: 'available',
  },
  {
    id: -7,
    feature_key: 'preview_margin_alerts',
    title: 'Margin guard alerts',
    description: 'Real-time warnings when deal margins slip below your configured thresholds.',
    pricing_type: 'free',
    price_cents: 0,
    currency: 'INR',
    catalog_status: 'listed',
    entitlement_status: 'available',
  },
  {
    id: -8,
    feature_key: 'preview_document_ocr',
    title: 'Document OCR inbox',
    description: 'Extract lift and invoice fields from uploaded PDFs into draft records.',
    pricing_type: 'paid',
    price_cents: 349900,
    currency: 'INR',
    catalog_status: 'listed',
    entitlement_status: 'available',
  },
]

export function mergeAddOnOffersWithPreview(apiOffers: OrgFeatureOffer[]): OrgFeatureOffer[] {
  if (!SHOW_ADDON_MARKETPLACE_PREVIEW) return apiOffers
  const keys = new Set(apiOffers.map(o => o.feature_key))
  const extras = PREVIEW_ADDON_OFFERS.filter(o => !keys.has(o.feature_key))
  return [...apiOffers, ...extras]
}

export function isPreviewAddOnKey(featureKey: string): boolean {
  return featureKey.startsWith('preview_')
}
