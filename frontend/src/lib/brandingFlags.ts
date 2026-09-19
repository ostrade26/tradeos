import { hasAppliedUpdate, type AuthSession } from './auth'
import { CUSTOM_BRANDING_FEATURE_KEY } from './featureKeys'

/** Catalog / entitlement key for primary colour + side navigation theme. */
export const BRANDING_FEATURE_KEY = CUSTOM_BRANDING_FEATURE_KEY

/** Whether Custom branding controls are unlocked for this session. */
export function isCustomBrandingEnabled(
  session: AuthSession | null,
  isPlatformAdmin: boolean,
): boolean {
  if (isPlatformAdmin) return true
  return hasAppliedUpdate(session, BRANDING_FEATURE_KEY)
}
