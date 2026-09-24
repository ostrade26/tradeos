import type { Lift, LiftAllocation, TradeOrder } from '../data/mockData'
import { canLiftSoAgainstPo, isCrossPoAllocation, liftPoolMismatchMessage } from './sellerLiftPool'
import { allocationActualKey, formatLiftSoRefsWithStock, STOCK_LIFT_LABEL } from './stockLift'
import { formatPoRef, formatSoRef } from './tradeRefs'
import { formatQty, roundQtyMt } from './utils'

export function getLiftAllocations(lift: Pick<Lift, 'poRef' | 'soRef' | 'liftedQty' | 'allocations'>): LiftAllocation[] {
  if (lift.allocations?.length) {
    return lift.allocations.map(a => ({
      poRef: a.poRef,
      soRef: a.soRef,
      qtyMt: roundQtyMt(a.qtyMt),
    }))
  }
  return [{ poRef: lift.poRef, soRef: lift.soRef, qtyMt: roundQtyMt(lift.liftedQty) }]
}

export function liftTouchesRef(lift: Pick<Lift, 'poRef' | 'soRef' | 'liftedQty' | 'allocations'>, ref: string): boolean {
  return getLiftAllocations(lift).some(a => a.poRef === ref || a.soRef === ref)
}

/** Pending (not yet delivered) lift qty allocated to this PO or SO. */
export function inTransitQtyOnOrder(
  lifts: Lift[],
  order: Pick<TradeOrder, 'ref' | 'side'>,
): number {
  return roundQtyMt(
    lifts
      .filter(l => l.status === 'pending' && !l.deletedAt)
      .reduce((sum, l) => {
        const part = getLiftAllocations(l)
          .filter(a =>
            order.side === 'purchase' ? a.poRef === order.ref : Boolean(a.soRef) && a.soRef === order.ref,
          )
          .reduce((s, a) => s + a.qtyMt, 0)
        return sum + part
      }, 0),
  )
}

export function uniqueLiftRefs(
  lift: Pick<Lift, 'poRef' | 'soRef' | 'liftedQty' | 'allocations'>,
  key: 'poRef' | 'soRef',
): string[] {
  return [...new Set(getLiftAllocations(lift).map(a => a[key]).filter((ref): ref is string => Boolean(ref)))]
}

export function formatLiftPoRefs(lift: Pick<Lift, 'poRef' | 'soRef' | 'liftedQty' | 'allocations'>): string {
  return uniqueLiftRefs(lift, 'poRef').map(formatPoRef).join(', ')
}

export function formatLiftSoRefs(lift: Pick<Lift, 'poRef' | 'soRef' | 'liftedQty' | 'allocations' | 'stockLift'>): string {
  return formatLiftSoRefsWithStock(lift)
}

export function formatAllocationsSummary(allocations: LiftAllocation[], stockLift?: boolean): string {
  const pos = [...new Set(allocations.map(a => a.poRef))]
  const sos = [...new Set(allocations.map(a => a.soRef).filter(Boolean) as string[])]
  const poLabels = pos.map(formatPoRef)
  const soLabels = sos.map(formatSoRef)
  if (stockLift || sos.length === 0) {
    return poLabels.length === 1 ? `${poLabels[0]} → ${STOCK_LIFT_LABEL}` : `${poLabels.join(', ')} → ${STOCK_LIFT_LABEL}`
  }
  if (poLabels.length === 1 && soLabels.length === 1) return `${poLabels[0]} → ${soLabels[0]}`
  return `${soLabels.join(', ')} · ${poLabels.join(', ')}`
}

export function formatLiftOrderSummary(lift: Pick<Lift, 'poRef' | 'soRef' | 'liftedQty' | 'allocations' | 'stockLift'>): string {
  return formatAllocationsSummary(getLiftAllocations(lift), lift.stockLift)
}

export function liftHasCrossPoAllocations(
  lift: Pick<Lift, 'poRef' | 'soRef' | 'liftedQty' | 'allocations'>,
  orders: TradeOrder[],
): boolean {
  return getLiftAllocations(lift).some(a => {
    const so = orders.find(o => o.ref === a.soRef && o.side === 'sale')
    return isCrossPoAllocation(so, a.poRef)
  })
}

export function crossPoAllocationsForLift(
  lift: Pick<Lift, 'poRef' | 'soRef' | 'liftedQty' | 'allocations'>,
  orders: TradeOrder[],
): { soRef: string; bookedPoRef: string; dispatchPoRef: string }[] {
  return getLiftAllocations(lift).flatMap(a => {
    if (!a.soRef) return []
    const so = orders.find(o => o.ref === a.soRef && o.side === 'sale')
    if (!so?.poRef || !isCrossPoAllocation(so, a.poRef)) return []
    return [{ soRef: a.soRef, bookedPoRef: so.poRef, dispatchPoRef: a.poRef }]
  })
}

export function allocationTotal(allocations: LiftAllocation[]): number {
  return roundQtyMt(allocations.reduce((sum, a) => sum + a.qtyMt, 0))
}

/** Qty already committed to a PO or SO by other lifts. */
export function qtyCommittedOnRef(lifts: Lift[], ref: string, excludeLiftId?: string): number {
  return roundQtyMt(lifts
    .filter(l => l.id !== excludeLiftId && !l.deletedAt)
    .reduce((sum, l) => {
      const part = getLiftAllocations(l)
        .filter(a => a.poRef === ref || (a.soRef && a.soRef === ref))
        .reduce((s, a) => s + a.qtyMt, 0)
      return sum + part
    }, 0))
}

/** SO-linked lift qty against a PO (excludes own-stock lifts). */
export function qtySoDispatchOnPo(lifts: Lift[], poRef: string, excludeLiftId?: string): number {
  return roundQtyMt(lifts
    .filter(l => l.id !== excludeLiftId && !l.deletedAt)
    .reduce((sum, l) => {
      const part = getLiftAllocations(l)
        .filter(a => a.poRef === poRef && Boolean(a.soRef))
        .reduce((s, a) => s + a.qtyMt, 0)
      return sum + part
    }, 0))
}

/** Own-stock / stock-in qty on this PO (allocations with no soRef). */
export function qtyStockOnPo(lifts: Lift[], poRef: string, excludeLiftId?: string): number {
  return roundQtyMt(lifts
    .filter(l => l.id !== excludeLiftId && !l.deletedAt)
    .reduce((sum, l) => {
      const part = getLiftAllocations(l)
        .filter(a => a.poRef === poRef && !a.soRef)
        .reduce((s, a) => s + a.qtyMt, 0)
      return sum + part
    }, 0))
}

export function remainingOnOrder(
  order: TradeOrder,
  lifts: Lift[],
  excludeLiftId?: string,
): number {
  if (order.side === 'purchase') {
    // Qty still at seller: contract − max(stock-in, SO-dispatch) so stock+dispatch
    // from the same tonnes does not double-consume capacity.
    const boughtBack = (order.buyBacks ?? []).reduce((s, b) => s + b.qtyMt, 0)
    const cap = Math.max(0, order.orderQty - boughtBack)
    const stock = qtyStockOnPo(lifts, order.ref, excludeLiftId)
    const soDispatch = qtySoDispatchOnPo(lifts, order.ref, excludeLiftId)
    return roundQtyMt(Math.max(0, cap - Math.max(stock, soDispatch)))
  }
  return roundQtyMt(Math.max(0, order.orderQty - qtyCommittedOnRef(lifts, order.ref, excludeLiftId)))
}

/**
 * PO qty still available for SO dispatch lifts.
 * Own-stock lifts already brought goods in — they do not block dispatching that stock to an SO.
 */
export function remainingOnPoForDispatch(
  po: TradeOrder,
  lifts: Lift[],
  excludeLiftId?: string,
): number {
  if (po.side !== 'purchase') return remainingOnOrder(po, lifts, excludeLiftId)
  const boughtBack = (po.buyBacks ?? []).reduce((s, b) => s + b.qtyMt, 0)
  const cap = Math.max(0, po.orderQty - boughtBack)
  return roundQtyMt(Math.max(0, cap - qtySoDispatchOnPo(lifts, po.ref, excludeLiftId)))
}

export function scaleAllocations(allocations: LiftAllocation[], nextTotal: number): LiftAllocation[] {
  const current = allocationTotal(allocations)
  if (current <= 0) return allocations
  const target = roundQtyMt(nextTotal)
  if (target === current) return allocations.map(a => ({ ...a, qtyMt: roundQtyMt(a.qtyMt) }))

  const scaled = allocations.map(a => ({
    ...a,
    qtyMt: roundQtyMt(a.qtyMt * (target / current)),
  }))
  const drift = roundQtyMt(target - allocationTotal(scaled))
  if (drift !== 0 && scaled.length > 0) {
    scaled[scaled.length - 1] = {
      ...scaled[scaled.length - 1],
      qtyMt: roundQtyMt(scaled[scaled.length - 1].qtyMt + drift),
    }
  }
  return scaled
}

/** Apply weighed qty per SO. Same PO/SO pairs as planned — only qty changes. */
export function applyAllocationActuals(
  planned: LiftAllocation[],
  actualByKey: Record<string, number>,
): LiftAllocation[] {
  return planned.map(a => ({
    ...a,
    qtyMt: roundQtyMt(actualByKey[allocationActualKey(a)] ?? 0),
  }))
}

export function collectAllocationActualFieldErrors(
  planned: LiftAllocation[],
  actualByKey: Record<string, number>,
): { message?: string; fields: Record<string, string> } {
  const fields: Record<string, string> = {}
  for (const a of planned) {
    const key = allocationActualKey(a)
    const qty = actualByKey[key]
    const label = a.soRef ?? STOCK_LIFT_LABEL
    if (qty == null || !Number.isFinite(qty) || qty <= 0) {
      fields[key] = `Enter actual quantity for ${label}`
    }
  }
  const message = Object.values(fields)[0]
  return { message, fields }
}

export function validateAllocationActuals(
  planned: LiftAllocation[],
  actualByKey: Record<string, number>,
): string | undefined {
  return collectAllocationActualFieldErrors(planned, actualByKey).message
}

export function uniquePartyNames(names: string[]): string {
  return [...new Set(names.map(n => n.trim()).filter(Boolean))].join(', ')
}

export function validateLiftAllocations(
  allocations: LiftAllocation[],
  orders: TradeOrder[],
  lifts: Lift[],
  excludeLiftId?: string,
): string | undefined {
  if (allocations.length === 0) return 'Add at least one SO'
  if (allocations.some(a => !a.soRef || !a.poRef)) return 'Each line needs an SO and a PO'
  if (allocations.some(a => a.qtyMt <= 0)) return 'Enter a quantity on each SO'

  const soSeen = new Set<string>()
  for (const a of allocations) {
    if (!a.soRef) continue
    if (soSeen.has(a.soRef)) return `${a.soRef} is listed more than once`
    soSeen.add(a.soRef)
  }

  const itemNames = new Set<string>()
  const usedOnPo = new Map<string, number>()
  const usedOnSo = new Map<string, number>()

  for (const a of allocations) {
    const po = orders.find(o => o.ref === a.poRef && o.side === 'purchase')
    const so = orders.find(o => o.ref === a.soRef && o.side === 'sale')
    if (!po || !so) return 'PO or SO not found'
    if (so.itemName !== po.itemName) {
      return `${formatSoRef(so.ref)} is ${so.itemName}; ${formatPoRef(po.ref)} is ${po.itemName}`
    }
    if (!canLiftSoAgainstPo(so, po, orders)) {
      return liftPoolMismatchMessage(so, po, orders)
    }
    itemNames.add(so.itemName)
    usedOnPo.set(a.poRef, roundQtyMt((usedOnPo.get(a.poRef) ?? 0) + a.qtyMt))
    if (a.soRef) {
      usedOnSo.set(a.soRef, roundQtyMt((usedOnSo.get(a.soRef) ?? 0) + a.qtyMt))
    }
  }

  if (itemNames.size > 1) return 'All SOs on one tanker must be the same item'

  for (const [soRef, qty] of usedOnSo) {
    const so = orders.find(o => o.ref === soRef && o.side === 'sale')
    if (!so) continue
    const remaining = remainingOnOrder(so, lifts, excludeLiftId)
    if (qty > remaining) {
      return `${soRef} only has ${formatQty(remaining)} left to lift`
    }
  }

  for (const [poRef, qty] of usedOnPo) {
    const po = orders.find(o => o.ref === poRef && o.side === 'purchase')
    if (!po) continue
    const remaining = remainingOnPoForDispatch(po, lifts, excludeLiftId)
    if (qty > remaining) {
      return `${poRef} only has ${formatQty(remaining)} left to lift`
    }
  }

  return undefined
}

export function validateStockLiftAllocations(
  allocations: LiftAllocation[],
  orders: TradeOrder[],
  lifts: Lift[],
  excludeLiftId?: string,
): string | undefined {
  if (allocations.length === 0) return 'Select a purchase order'
  if (allocations.length > 1) return 'Stock lift supports one PO at a time'
  const a = allocations[0]
  if (!a.poRef) return 'Select a purchase order'
  if (a.qtyMt <= 0) return 'Enter quantity to stock'
  if (a.soRef) return 'Stock lift cannot include a sales order'

  const po = orders.find(o => o.ref === a.poRef && o.side === 'purchase')
  if (!po) return 'PO not found'
  const remaining = remainingOnOrder(po, lifts, excludeLiftId)
  if (a.qtyMt > remaining) {
    return `${a.poRef} only has ${formatQty(remaining)} left to lift`
  }
  return undefined
}
