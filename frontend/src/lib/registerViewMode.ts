import { storageGet, storageRemove, storageSet } from './storage'
import type { OrderListMode } from '../components/registers/OrderRegisterView'
import type { TradeOrder } from '../data/mockData'
import { appPath } from './appShellMode'

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

export function registerModeForOrder(
  order: Pick<TradeOrder, 'status' | 'deleteScheduledAt'>,
): OrderListMode {
  if (order.deleteScheduledAt) return 'deleted'
  if (order.status === 'completed') return 'completed'
  return 'pending'
}

export function viewParamForMode(mode: OrderListMode): string | null {
  if (mode === 'completed') return 'completed'
  if (mode === 'deleted') return 'deleted'
  return null
}

/** PO/SO register URL that opens the row detail on the tab where that order lives. */
export function orderRegisterHref(
  side: 'purchase' | 'sale',
  orderRef: string,
  mode?: OrderListMode,
): string {
  const register = appPath(side === 'purchase' ? '/purchase-orders' : '/sales-orders')
  const params = new URLSearchParams()
  params.set('ref', orderRef)
  const view = mode ? viewParamForMode(mode) : null
  if (view) params.set('view', view)
  return `${register}?${params.toString()}`
}
