import { storageGet, storageRemove, storageSet } from './storage'

const PREFIX = 'tradeal-register-detail-ref:'

/** Last opened detail ref for a register route (e.g. `/purchase-orders`). */
export function loadRegisterDetailRef(registerKey: string): string | null {
  const value = storageGet(`${PREFIX}${registerKey}`)
  return value && value.length > 0 ? value : null
}

export function saveRegisterDetailRef(registerKey: string, ref: string | null) {
  const key = `${PREFIX}${registerKey}`
  if (ref) storageSet(key, ref)
  else storageRemove(key)
}
