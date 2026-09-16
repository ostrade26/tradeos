import { storageGet, storageSet } from './storage'

const STORAGE_KEY = 'tradeal-order-panel-docked'

export function loadOrderPanelDocked(): boolean {
  return storageGet(STORAGE_KEY) === 'true'
}

export function saveOrderPanelDocked(docked: boolean) {
  storageSet(STORAGE_KEY, docked ? 'true' : 'false')
}
