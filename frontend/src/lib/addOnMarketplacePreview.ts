import type { OrgFeatureOffer } from '../api/organisationApi'

/**
 * Local UI preview for marketplace cards.
 * Never enabled in production builds — even if someone flips the flag.
 */
const ALLOW_LOCAL_ADDON_PREVIEW =
  import.meta.env.DEV &&
  // Flip to true only while designing cards locally.
  false

export const SHOW_ADDON_MARKETPLACE_PREVIEW = ALLOW_LOCAL_ADDON_PREVIEW

/** Keep empty in git. Populate temporarily for local design only. */
export const PREVIEW_ADDON_OFFERS: OrgFeatureOffer[] = []

export function mergeAddOnOffersWithPreview(apiOffers: OrgFeatureOffer[]): OrgFeatureOffer[] {
  if (!SHOW_ADDON_MARKETPLACE_PREVIEW || PREVIEW_ADDON_OFFERS.length === 0) return apiOffers
  const keys = new Set(apiOffers.map(o => o.feature_key))
  const extras = PREVIEW_ADDON_OFFERS.filter(o => !keys.has(o.feature_key))
  return [...apiOffers, ...extras]
}

export function isPreviewAddOnKey(featureKey: string): boolean {
  return featureKey.startsWith('preview_')
}
