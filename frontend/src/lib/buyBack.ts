import type { BuyBack, Lift, TradeOrder } from '../data/mockData'
import { liftTouchesRef } from './liftAllocations'
import { contractRateFromOrder } from './orderRate'
import { refsMatch } from './tradeRefs'

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

/** Sales orders the user booked on this purchase. Lift-only SOs stay out of buy-back. */
export function sosBookedOnPo(linkedSOs: TradeOrder[], poRef: string): TradeOrder[] {
  return linkedSOs.filter(so => refsMatch(so.poRef, poRef, 'purchase'))
}

/** PO qty still active after buy backs (contract minus bought back). */
export function effectivePoQty(po: Pick<TradeOrder, 'orderQty' | 'buyBacks'>): number {
  return Math.max(0, po.orderQty - totalBuyBackQty(po))
}

/** Unlifted qty not allocated to linked SOs — available for buy back. */
export function maxBuyBackQty(order: TradeOrder, linkedSOs: TradeOrder[] = []): number {
  const leftover = order.orderQty - totalBuyBackQty(order) - order.liftedQty
  if (order.side === 'sale') {
    return Math.max(0, leftover)
  }
  return Math.max(0, leftover - getAllocatedSoQty(linkedSOs))
}

export function totalBuyBackQty(order: Pick<TradeOrder, 'buyBacks'>): number {
  return (order.buyBacks ?? []).reduce((sum, b) => sum + b.qtyMt, 0)
}

export function hasBuyBacks(order: Pick<TradeOrder, 'buyBacks'>): boolean {
  return (order.buyBacks?.length ?? 0) > 0
}

export function canBuyBackOrder(
  order: TradeOrder,
  lifts: Lift[],
  linkedSOs: TradeOrder[] = [],
  hasPendingLift?: boolean,
): { ok: boolean; reason?: string } {
  if (order.status === 'cancelled') {
    return { ok: false, reason: 'This order is already closed.' }
  }
  const side = order.side === 'sale' ? 'sale' : 'purchase'
  const pending = hasPendingLift ?? lifts.some(l => liftTouchesRef(l, order.ref, side) && l.status === 'pending')
  if (pending) {
    return { ok: false, reason: 'Remove or complete scheduled lifts before recording a buy back.' }
  }
  const maxQty = maxBuyBackQty(order, linkedSOs)
  if (maxQty <= 0) {
    if (order.side === 'purchase' && linkedSOs.length > 0 && order.liftedQty > 0) {
      return { ok: false, reason: 'No unlifted quantity left to buy back. Reduce SO qty or wait for pending lifts.' }
    }
    if (order.side === 'purchase' && linkedSOs.length > 0) {
      return { ok: false, reason: 'All quantity is allocated to sales orders. Reduce SO qty first.' }
    }
    if (order.liftedQty > 0) {
      return { ok: false, reason: 'All remaining quantity has already been lifted.' }
    }
    return { ok: false, reason: 'No quantity available for buy back.' }
  }
  return { ok: true }
}

/** @deprecated Use canBuyBackOrder */
export const canBuyBackPO = canBuyBackOrder

/** Suggested buy-back rate in ₹/10 KG — nudged slightly above PO rate when known. */
export function suggestedBuyBackRatePer10Kg(po: TradeOrder): number {
  const poRate = contractRateFromOrder(po.rate, po.rateBasis, po.ratePerBasis)
  if (!Number.isFinite(poRate) || poRate <= 0) return 0
  return poRate + 3
}
