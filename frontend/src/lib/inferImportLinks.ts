import { CURRENT_TRADER, type Lift, type TradeOrder } from '../data/mockData'
import { getLiftAllocations } from './liftAllocations'
import { randomUUID } from './randomId'
import { findTradeOrder, refCore } from './tradeRefs'
import { roundQtyMt } from './utils'

const STUB_REMARK = 'Imported from lift register — complete details when available'

function orderRefSet(orders: TradeOrder[], side: TradeOrder['side']): Set<string> {
  return new Set(orders.filter(o => o.side === side).map(o => refCore(o.ref)).filter(Boolean))
}

function findOrderRef(orders: TradeOrder[], side: TradeOrder['side'], ref: string): string | undefined {
  return findTradeOrder(orders, side, ref)?.ref
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

/**
 * A lift never books a sales order onto a purchase.
 * The sale keeps a purchase ref only when its own sheet names one.
 */
export function inferSoPoRefsFromLifts(orders: TradeOrder[], lifts: Lift[]): TradeOrder[] {
  void lifts
  return orders
}

/** Point SO.poRef at the stored PO.ref when Excel used PO24 vs 24. */
export function normalizeLinkedPoRefs(orders: TradeOrder[]): TradeOrder[] {
  return orders.map(order => {
    if (order.side !== 'sale' || !order.poRef) return order
    const resolved = findOrderRef(orders, 'purchase', order.poRef)
    if (!resolved || resolved === order.poRef) return order
    return { ...order, poRef: resolved }
  })
}

/** Normalize lift PO/SO refs to match order.ref storage (no PO/SO prefix). */
export function normalizeLiftOrderRefs(orders: TradeOrder[], lifts: Lift[]): Lift[] {
  return lifts.map(lift => {
    const poRef = findOrderRef(orders, 'purchase', lift.poRef) ?? refCore(lift.poRef)
    const soRef = lift.soRef
      ? (findOrderRef(orders, 'sale', lift.soRef) ?? refCore(lift.soRef))
      : ''
    const withRefs = { ...lift, poRef, soRef }
    const allocations = getLiftAllocations(withRefs).map(a => ({
      ...a,
      poRef: findOrderRef(orders, 'purchase', a.poRef) ?? refCore(a.poRef),
      soRef: a.soRef
        ? (findOrderRef(orders, 'sale', a.soRef) ?? refCore(a.soRef))
        : undefined,
    }))
    return {
      ...withRefs,
      allocations,
    }
  })
}

/** Problems that would make remaining-to-lift lie if we guessed. */
export function importIntegrityWarnings(orders: TradeOrder[], lifts: Lift[]): string[] {
  const warnings: string[] = []
  const stubs = orders.filter(o => (o.remarks ?? '').includes(STUB_REMARK)).length
  if (stubs > 0) {
    warnings.push(
      `${stubs} order${stubs === 1 ? '' : 's'} were created from lift refs only. Complete party, rate, and qty before relying on remaining-to-lift.`,
    )
  }

  let liftsWithoutPo = 0
  let liftsUnknownPo = 0
  let liftsUnknownSo = 0
  for (const lift of lifts) {
    if (lift.deletedAt) continue
    for (const a of getLiftAllocations(lift)) {
      if (!refCore(a.poRef)) {
        liftsWithoutPo += 1
        continue
      }
      if (!findOrderRef(orders, 'purchase', a.poRef)) liftsUnknownPo += 1
      if (a.soRef && !findOrderRef(orders, 'sale', a.soRef)) liftsUnknownSo += 1
    }
  }
  if (liftsWithoutPo > 0) {
    warnings.push(`${liftsWithoutPo} lift line${liftsWithoutPo === 1 ? '' : 's'} have no PO ref. Remaining-to-lift cannot use them.`)
  }
  if (liftsUnknownPo > 0) {
    warnings.push(`${liftsUnknownPo} lift line${liftsUnknownPo === 1 ? '' : 's'} point at a PO that is not in this file.`)
  }
  if (liftsUnknownSo > 0) {
    warnings.push(`${liftsUnknownSo} lift line${liftsUnknownSo === 1 ? '' : 's'} point at an SO that is not in this file.`)
  }
  return warnings
}
