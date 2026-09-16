import type { BuyBack, Lift, TradeOrder } from '../data/mockData'
import { liftTouchesRef } from './liftAllocations'
import { contractRateFromOrder } from './orderRate'

export type { BuyBack }

export interface BuyBackInput {
  qtyMt: number
  rate: number
  rateBasis?: string
  ratePerBasis?: number
  date: string
  remarks?: string
}

export function getAllocatedSoQty(linkedSOs: TradeOrder[]): number {
  return linkedSOs.reduce((sum, o) => sum + o.orderQty, 0)
}

/** PO qty still active after buy backs (contract minus bought back). */
export function effectivePoQty(po: Pick<TradeOrder, 'orderQty' | 'buyBacks'>): number {
  return Math.max(0, po.orderQty - totalBuyBackQty(po))
}

/** Unlifted qty not allocated to linked SOs — available for buy back. */
export function maxBuyBackQty(po: TradeOrder, linkedSOs: TradeOrder[]): number {
  return Math.max(
    0,
    po.orderQty - totalBuyBackQty(po) - getAllocatedSoQty(linkedSOs) - po.liftedQty,
  )
}

export function totalBuyBackQty(po: Pick<TradeOrder, 'buyBacks'>): number {
  return (po.buyBacks ?? []).reduce((sum, b) => sum + b.qtyMt, 0)
}

export function hasBuyBacks(order: Pick<TradeOrder, 'buyBacks'>): boolean {
  return (order.buyBacks?.length ?? 0) > 0
}

export function canBuyBackPO(
  po: TradeOrder,
  lifts: Lift[],
  linkedSOs: TradeOrder[],
): { ok: boolean; reason?: string } {
  if (po.side !== 'purchase') {
    return { ok: false, reason: 'Only purchase orders support buy back.' }
  }
  if (po.status === 'cancelled') {
    return { ok: false, reason: 'This order is already closed.' }
  }
  if (lifts.some(l => liftTouchesRef(l, po.ref) && l.status === 'pending')) {
    return { ok: false, reason: 'Remove or complete scheduled lifts before recording a buy back.' }
  }
  const maxQty = maxBuyBackQty(po, linkedSOs)
  if (maxQty <= 0) {
    if (linkedSOs.length > 0 && po.liftedQty > 0) {
      return { ok: false, reason: 'No unlifted quantity left to buy back. Reduce SO qty or wait for pending lifts.' }
    }
    if (linkedSOs.length > 0) {
      return { ok: false, reason: 'All quantity is allocated to sales orders. Reduce SO qty first.' }
    }
    if (po.liftedQty > 0) {
      return { ok: false, reason: 'All remaining quantity has already been lifted.' }
    }
    return { ok: false, reason: 'No quantity available for buy back.' }
  }
  return { ok: true }
}

/** Suggested buy-back rate in ₹/10 KG — nudged slightly above PO rate when known. */
export function suggestedBuyBackRatePer10Kg(po: TradeOrder): number {
  const poRate = contractRateFromOrder(po.rate, po.rateBasis, po.ratePerBasis)
  if (!Number.isFinite(poRate) || poRate <= 0) return 0
  return poRate + 3
}
