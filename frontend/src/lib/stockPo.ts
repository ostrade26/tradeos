import type { TradeOrder } from '../data/mockData'
import { refsMatch } from './tradeRefs'

const CLOSED_COMPLETION = new Set<TradeOrder['completionType']>(['cash_settled', 'carried_forward', 'short_closed', 'delivered'])

export function purchaseIsClosed(po: Pick<TradeOrder, 'status' | 'completionType'> | undefined): boolean {
  if (!po) return false
  return po.status === 'completed'
    || po.status === 'cancelled'
    || Boolean(po.completionType && CLOSED_COMPLETION.has(po.completionType))
}

/** A lot is in the godown once stock has been received or a warehouse sale exists. */
export function lotHasReceivedStock(lot: { remaining: number; allocated: number }): boolean {
  return lot.remaining > 0 || lot.allocated > 0
}

/** Lot a sales order is selling from inventory, not as an open purchase booking. */
export function inventoryStockRef(
  so: Pick<TradeOrder, 'poRef' | 'stockPoRef'> | undefined,
  po: Pick<TradeOrder, 'status' | 'completionType' | 'ref'> | undefined,
): string | undefined {
  if (!so?.stockPoRef || so.poRef) return undefined
  if (po?.ref && !refsMatch(so.stockPoRef, po.ref, 'purchase')) return undefined
  return so.stockPoRef
}
