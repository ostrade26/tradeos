import type { BalanceSettlement, Lift, TradeOrder } from '../data/mockData'
import { getSOsForPO, toBeLifted } from '../data/mockData'
import { liftTouchesRef } from './liftAllocations'
import { getOutstandingBalance } from './liftBalance'

export type CloseOrderMethod = 'cash' | 'carried_forward' | 'short_closed'

/** Delivery shortfall below this (MT) shows as "Short" on registers; at or above shows as "Balance". */
export const SHORT_BALANCE_THRESHOLD_MT = 5

export interface CloseOrderContext {
  ok: boolean
  reason?: string
  balanceOwed: number
  toBeLifted: number
  poRef?: string
  soRef?: string
  availableMethods: CloseOrderMethod[]
}

function cashSettledQty(settlements: BalanceSettlement[], poRef: string, soRef: string): number {
  return settlements
    .filter(s => s.poRef === poRef && s.soRef === soRef && s.method === 'cash' && s.source !== 'unlifted')
    .reduce((sum, s) => sum + s.qtyMt, 0)
}

export function getOrderBalanceOwed(
  order: TradeOrder,
  lifts: Lift[],
  settlements: BalanceSettlement[],
  orders: TradeOrder[],
): { balanceOwed: number; poRef?: string; soRef?: string } {
  if (order.side === 'sale' && order.poRef) {
    const poRef = order.poRef
    const soRef = order.ref
    return {
      balanceOwed: getOutstandingBalance(lifts, poRef, soRef, settlements),
      poRef,
      soRef,
    }
  }

  if (order.side === 'purchase') {
    const linked = getSOsForPO(orders, order.ref).filter(
      o => o.status !== 'completed' && o.status !== 'cancelled',
    )
    const withBalance = linked
      .map(so => ({
        soRef: so.ref,
        balance: getOutstandingBalance(lifts, order.ref, so.ref, settlements),
      }))
      .filter(x => x.balance > 0)
    if (withBalance.length === 1) {
      return {
        balanceOwed: withBalance[0].balance,
        poRef: order.ref,
        soRef: withBalance[0].soRef,
      }
    }
  }

  return { balanceOwed: 0 }
}

export function canCloseOrder(
  order: TradeOrder,
  lifts: Lift[],
  settlements: BalanceSettlement[],
  orders: TradeOrder[],
): CloseOrderContext {
  if (order.status === 'completed' || order.status === 'cancelled') {
    return { ok: false, reason: 'Order is already closed.', balanceOwed: 0, toBeLifted: 0, availableMethods: [] }
  }

  if (lifts.some(l => l.status === 'pending' && liftTouchesRef(l, order.ref))) {
    return {
      ok: false,
      reason: 'Complete or remove pending lifts before closing.',
      balanceOwed: 0,
      toBeLifted: 0,
      availableMethods: [],
    }
  }

  const remaining = toBeLifted(order)
  const { balanceOwed, poRef, soRef } = getOrderBalanceOwed(order, lifts, settlements, orders)
  const carryPair = remainingCarryPair(order, orders, poRef, soRef)

  if (balanceOwed <= 0 && remaining <= 0) {
    return {
      ok: false,
      reason: 'Nothing to close — order is fully delivered.',
      balanceOwed: 0,
      toBeLifted: remaining,
      availableMethods: [],
    }
  }

  const availableMethods: CloseOrderMethod[] = ['carried_forward', 'cash', 'short_closed']

  return {
    ok: true,
    balanceOwed,
    toBeLifted: remaining,
    poRef: poRef ?? carryPair?.poRef,
    soRef: soRef ?? carryPair?.soRef,
    availableMethods,
  }
}

/** PO/SO pair used to park remaining qty on the seller for the next lift. */
export function remainingCarryPair(
  order: TradeOrder,
  orders: TradeOrder[],
  balancePoRef?: string,
  balanceSoRef?: string,
): { poRef: string; soRef: string } | null {
  if (balancePoRef && balanceSoRef) return { poRef: balancePoRef, soRef: balanceSoRef }
  if (order.side === 'sale' && order.poRef) {
    return { poRef: order.poRef, soRef: order.ref }
  }
  if (order.side === 'purchase') {
    const linked = getSOsForPO(orders, order.ref).filter(
      o => o.status !== 'completed' && o.status !== 'cancelled',
    )
    return { poRef: order.ref, soRef: linked[0]?.ref ?? '' }
  }
  return null
}

export function completionTypeLabel(type: TradeOrder['completionType']): string | null {
  switch (type) {
    case 'cash_settled': return 'Closed · cash'
    case 'carried_forward': return 'Closed · next delivery'
    case 'short_closed': return 'Closed · write-off'
    default: return null
  }
}

export function getOrderPendingBadges(
  order: TradeOrder,
  lifts: Lift[],
  settlements: BalanceSettlement[],
  orders: TradeOrder[],
): { balance?: number; short?: number } {
  if (order.status === 'completed' || order.status === 'cancelled') return {}
  const { balanceOwed } = getOrderBalanceOwed(order, lifts, settlements, orders)
  if (balanceOwed <= 0) return {}
  if (balanceOwed < SHORT_BALANCE_THRESHOLD_MT) return { short: balanceOwed }
  return { balance: balanceOwed }
}

export { cashSettledQty }
