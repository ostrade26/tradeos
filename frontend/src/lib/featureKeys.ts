/** Stable entitlement keys for `hasAppliedUpdate` / Features catalog / Ship queue. */

export const TRADEAL_AI_FEATURE_KEY = 'tradeal-ai'
export const CUSTOM_BRANDING_FEATURE_KEY = 'custom-branding'

/** Keys that gate product surfaces — keep in sync with Features offers when holdable. */
export const GATED_FEATURE_KEYS = [
  TRADEAL_AI_FEATURE_KEY,
  CUSTOM_BRANDING_FEATURE_KEY,
] as const

export type GatedFeatureKey = (typeof GATED_FEATURE_KEYS)[number]

export function isGatedFeatureKey(key: string): boolean {
  return (GATED_FEATURE_KEYS as readonly string[]).includes(key)
}
