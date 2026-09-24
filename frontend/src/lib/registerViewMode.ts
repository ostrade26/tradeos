import { storageGet, storageRemove, storageSet } from './storage'
import type { OrderListMode } from '../components/registers/OrderRegisterView'

const PREFIX = 'tradeal-register-view:'

function keyFor(registerKey: string) {
  return `${PREFIX}${registerKey}`
}

/** Last selected Pending / Completed / Deleted tab for a register route. */
export function loadRegisterViewMode(registerKey: string): OrderListMode | null {
  const value = storageGet(keyFor(registerKey))
  if (value === 'completed' || value === 'deleted' || value === 'pending') return value
  return null
}

export function saveRegisterViewMode(registerKey: string, mode: OrderListMode) {
  storageSet(keyFor(registerKey), mode)
}

export function clearRegisterViewMode(registerKey: string) {
  storageRemove(keyFor(registerKey))
}
