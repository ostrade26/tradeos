import type { AuthSession } from './auth'

const PENDING_WELCOME_SESSION_KEY = 'tradeal-pending-account-welcome'

export function markPendingAccountWelcome() {
  try {
    sessionStorage.setItem(PENDING_WELCOME_SESSION_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function clearPendingAccountWelcome() {
  try {
    sessionStorage.removeItem(PENDING_WELCOME_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

function hasPendingAccountWelcome(): boolean {
  try {
    return sessionStorage.getItem(PENDING_WELCOME_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

export function shouldShowAccountWelcome(session: AuthSession | null): boolean {
  if (!session || session.isPlatformAdmin) return false
  if (session.preferences?.completedOrgAccountWelcome) return false
  return hasPendingAccountWelcome()
}
