import { hasAppliedUpdate, type AuthSession } from '../auth'
import { TRADEAL_AI_FEATURE_KEY } from '../featureKeys'

/** Master product switch — keep true; org access is via Features entitlement. */
export const ASSISTANT_PRODUCT_ENABLED = true

/** Catalog / entitlement key (platform admin sets free vs paid on Features & Access). */
export const ASSISTANT_FEATURE_KEY = TRADEAL_AI_FEATURE_KEY

/** Whether Tradeal AI UI should render for this session. */
export function isAssistantEnabled(session: AuthSession | null, isPlatformAdmin: boolean): boolean {
  if (!ASSISTANT_PRODUCT_ENABLED) return false
  // Org users: only after Features purchase/approval. Platform admins can preview.
  if (isPlatformAdmin) return true
  return hasAppliedUpdate(session, ASSISTANT_FEATURE_KEY)
}

/** @deprecated Use isAssistantEnabled / useAssistantEnabled — kept for quick grep. */
export const ASSISTANT_ENABLED = ASSISTANT_PRODUCT_ENABLED
