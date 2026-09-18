import { CURRENT_TRADER, type Lift, type TradeOrder } from '../data/mockData'
import { getLiftAllocations } from './liftAllocations'
import { randomUUID } from './randomId'
import { refCore } from './tradeRefs'
import { roundQtyMt } from './utils'

const STUB_REMARK = 'Imported from lift register — complete details when available'

function orderRefSet(orders: TradeOrder[], side: TradeOrder['side']): Set<string> {
  return new Set(orders.filter(o => o.side === side).map(o => refCore(o.ref)).filter(Boolean))
}

function findOrderRef(orders: TradeOrder[], side: TradeOrder['side'], ref: string): string | undefined {
  const core = refCore(ref)
  if (!core) return undefined
  return orders.find(o => o.side === side && refCore(o.ref) === core)?.ref
}

function qtyTotalsByRef(lifts: Lift[], key: 'poRef' | 'soRef'): Map<string, number> {
  const totals = new Map<string, number>()
  for (const lift of lifts) {
    for (const alloc of getLiftAllocations(lift)) {
      const ref = alloc[key] ? refCore(alloc[key]!) : ''
      if (!ref) continue
      totals.set(ref, roundQtyMt((totals.get(ref) ?? 0) + alloc.qtyMt))
    }
  }
  return totals
}

function stubPurchaseOrder(ref: string, lift: Lift, orderQty: number): TradeOrder {
  return {
    id: randomUUID(),
    ref: refCore(ref) || ref,
    side: 'purchase',
    date: lift.date,
    partyName: lift.sellerName || 'Unknown seller',
    sellerName: lift.sellerName || undefined,
    buyerName: CURRENT_TRADER,
    itemName: lift.itemName,
    spot: '',
    deliveryType: 'period',
    deliveryPeriodStart: lift.deliveryPeriodStart || lift.date,
    deliveryPeriodEnd: lift.deliveryPeriodEnd || lift.date,
    deliveryPeriodVerified: false,
    rate: lift.rate,
    taxRate: 0,
    orderQty,
    liftedQty: 0,
    committedLiftQty: 0,
    unit: 'MT',
    brokerName: '',
    brokeragePct: 0,
    status: 'pending',
    remarks: STUB_REMARK,
  }
}

function stubSalesOrder(ref: string, lift: Lift, orderQty: number, poRef: string): TradeOrder {
  return {
    id: randomUUID(),
    ref: refCore(ref) || ref,
    side: 'sale',
    poRef: refCore(poRef) || poRef,
    date: lift.date,
    partyName: lift.buyerName || 'Unknown buyer',
    buyerName: lift.buyerName || undefined,
    sellerName: CURRENT_TRADER,
    itemName: lift.itemName,
    spot: '',
    deliveryType: 'period',
    deliveryPeriodStart: lift.deliveryPeriodStart || lift.date,
    deliveryPeriodEnd: lift.deliveryPeriodEnd || lift.date,
    deliveryPeriodVerified: false,
    rate: lift.rate,
    taxRate: 0,
    orderQty,
    liftedQty: 0,
    committedLiftQty: 0,
    unit: 'MT',
    brokerName: '',
    brokeragePct: 0,
    status: 'pending',
    remarks: STUB_REMARK,
  }
}

/** Create minimal PO/SO rows for refs that appear on lifts but were missing from the import sheets. */
export function ensureOrdersReferencedByLifts(orders: TradeOrder[], lifts: Lift[]): TradeOrder[] {
  if (lifts.length === 0) return orders

  const poRefs = orderRefSet(orders, 'purchase')
  const soRefs = orderRefSet(orders, 'sale')
  const poQty = qtyTotalsByRef(lifts, 'poRef')
  const soQty = qtyTotalsByRef(lifts, 'soRef')
  const stubs: TradeOrder[] = []

  for (const lift of lifts) {
    for (const alloc of getLiftAllocations(lift)) {
      const poRef = alloc.poRef ? refCore(alloc.poRef) : ''
      const soRef = alloc.soRef ? refCore(alloc.soRef) : ''
      const { qtyMt } = alloc
      if (!poRef || qtyMt <= 0) continue

      if (!poRefs.has(poRef)) {
        poRefs.add(poRef)
        stubs.push(stubPurchaseOrder(poRef, lift, poQty.get(poRef) ?? qtyMt))
      }

      if (soRef && !soRefs.has(soRef)) {
        soRefs.add(soRef)
        stubs.push(stubSalesOrder(soRef, lift, soQty.get(soRef) ?? qtyMt, poRef))
      }
    }
  }

  return stubs.length > 0 ? [...orders, ...stubs] : orders
}

/** Pick the PO with the most lifted qty for each SO. */
function dominantPoRef(byPo: Map<string, number>): string | undefined {
  let bestPo: string | undefined
  let bestQty = -1
  for (const [poRef, qty] of byPo) {
    if (qty > bestQty) {
      bestQty = qty
      bestPo = poRef
    }
  }
  return bestPo
}

/**
 * After spreadsheet import, set SO.poRef from lift allocations when the SO sheet
 * did not include a PO link. Skips SOs that already have poRef.
 */
export function inferSoPoRefsFromLifts(orders: TradeOrder[], lifts: Lift[]): TradeOrder[] {
  if (lifts.length === 0) return orders

  const poQtyBySo = new Map<string, Map<string, number>>()

  for (const lift of lifts) {
    for (const alloc of getLiftAllocations(lift)) {
      const soCore = alloc.soRef ? refCore(alloc.soRef) : ''
      const poCore = alloc.poRef ? refCore(alloc.poRef) : ''
      const { qtyMt } = alloc
      if (!soCore || !poCore || qtyMt <= 0) continue

      const resolvedPo = findOrderRef(orders, 'purchase', poCore)
      const resolvedSo = findOrderRef(orders, 'sale', soCore)
      if (!resolvedPo || !resolvedSo) continue

      const byPo = poQtyBySo.get(resolvedSo) ?? new Map<string, number>()
      byPo.set(resolvedPo, roundQtyMt((byPo.get(resolvedPo) ?? 0) + qtyMt))
      poQtyBySo.set(resolvedSo, byPo)
    }
  }

  if (poQtyBySo.size === 0) return orders

  return orders.map(order => {
    if (order.side !== 'sale' || order.poRef) return order
    const poRef = dominantPoRef(poQtyBySo.get(order.ref) ?? new Map())
    if (!poRef) return order
    return { ...order, poRef }
  })
}

/** Normalize lift PO/SO refs to match order.ref storage (no PO/SO prefix). */
export function normalizeLiftOrderRefs(orders: TradeOrder[], lifts: Lift[]): Lift[] {
  return lifts.map(lift => {
    const poRef = findOrderRef(orders, 'purchase', lift.poRef) ?? refCore(lift.poRef)
    const soRef = lift.soRef
      ? (findOrderRef(orders, 'sale', lift.soRef) ?? refCore(lift.soRef))
      : ''
    const allocations = lift.allocations?.map(a => ({
      ...a,
      poRef: findOrderRef(orders, 'purchase', a.poRef) ?? refCore(a.poRef),
      soRef: a.soRef
        ? (findOrderRef(orders, 'sale', a.soRef) ?? refCore(a.soRef))
        : undefined,
    }))
    return {
      ...lift,
      poRef,
      soRef,
      ...(allocations ? { allocations } : {}),
    }
  })
}
