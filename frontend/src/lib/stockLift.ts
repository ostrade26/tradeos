import type { Lift, LiftAllocation } from '../data/mockData'
import { CURRENT_TRADER } from '../data/mockData'
import { formatSoRef } from './tradeRefs'

export const STOCK_LIFT_LABEL = 'Own stock'

export function isStockLift(lift: Pick<Lift, 'stockLift'>): boolean {
  return lift.stockLift === true
}

export function isStockAllocation(allocation: Pick<LiftAllocation, 'soRef'>): boolean {
  return !allocation.soRef
}

/** Key for actual-qty forms when there is no SO (stock lift). */
export function allocationActualKey(allocation: Pick<LiftAllocation, 'poRef' | 'soRef'>): string {
  return allocation.soRef || `stock:${allocation.poRef}`
}

export function stockLiftBuyerName(): string {
  return CURRENT_TRADER
}

export function formatAllocationSoRef(allocation: Pick<LiftAllocation, 'soRef'>, stockLift?: boolean): string {
  if (stockLift || isStockAllocation(allocation)) return STOCK_LIFT_LABEL
  return allocation.soRef ? formatSoRef(allocation.soRef) : '—'
}

export function formatLiftSoRefsWithStock(lift: Pick<Lift, 'poRef' | 'soRef' | 'liftedQty' | 'allocations' | 'stockLift'>): string {
  if (isStockLift(lift)) return STOCK_LIFT_LABEL
  const allocations = lift.allocations?.length
    ? lift.allocations
    : [{ poRef: lift.poRef, soRef: lift.soRef, qtyMt: lift.liftedQty }]
  const refs = [...new Set(allocations.map(a => formatAllocationSoRef(a, lift.stockLift)).filter(r => r !== '—'))]
  return refs.length ? refs.join(', ') : STOCK_LIFT_LABEL
}
