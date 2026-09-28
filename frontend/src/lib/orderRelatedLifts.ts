import type { Lift, TradeOrder } from '../data/mockData'
import { getLiftAllocations } from './liftAllocations'
import { STOCK_LIFT_LABEL } from './stockLift'
import { refsMatch } from './tradeRefs'
import { roundQtyMt } from './utils'

export type SoLiftEntry = {
  lift: Lift
  qtyMt: number
}

export type SoLiftGroup = {
  so: TradeOrder
  deliveredQty: number
  pendingQty: number
  lifts: SoLiftEntry[]
}

function liftsMatching(
  lifts: Lift[],
  match: (poRef: string, soRef: string | undefined) => boolean,
): SoLiftEntry[] {
  const entries: SoLiftEntry[] = []
  for (const lift of lifts) {
    for (const a of getLiftAllocations(lift)) {
      if (match(a.poRef, a.soRef)) {
        entries.push({ lift, qtyMt: a.qtyMt })
      }
    }
  }
  return entries.sort((a, b) => a.lift.liftRef - b.lift.liftRef)
}

export function liftsForSoOnPo(lifts: Lift[], poRef: string, soRef: string): SoLiftEntry[] {
  return liftsMatching(lifts, (p, s) => refsMatch(p, poRef, 'purchase') && Boolean(s) && refsMatch(s, soRef, 'sale'))
}

/** All lift allocations for an SO (any PO). */
export function liftsForSo(lifts: Lift[], soRef: string): SoLiftEntry[] {
  return liftsMatching(lifts, (_p, s) => Boolean(s) && refsMatch(s, soRef, 'sale'))
}

export function stockLiftsForPo(lifts: Lift[], poRef: string): SoLiftEntry[] {
  return liftsMatching(lifts, (p, s) => refsMatch(p, poRef, 'purchase') && !s)
}

function sumEntries(entries: SoLiftEntry[], pending: boolean): number {
  return roundQtyMt(
    entries
      .filter(entry => (entry.lift.status === 'pending') === pending)
      .reduce((sum, entry) => sum + entry.qtyMt, 0),
  )
}

function groupForSo(so: TradeOrder, entries: SoLiftEntry[]): SoLiftGroup {
  if (!so.poRef) {
    return {
      so,
      deliveredQty: sumEntries(entries, false),
      pendingQty: sumEntries(entries, true),
      lifts: entries,
    }
  }
  return {
    so,
    deliveredQty: so.liftedQty,
    pendingQty: roundQtyMt(Math.max(0, so.orderQty - so.liftedQty)),
    lifts: entries,
  }
}

/** Every lift on this purchase, including imported rows that are not booked as the SO's purchase. */
export function liftGroupsForPurchase(
  poRef: string,
  orders: TradeOrder[],
  lifts: Lift[],
): { soGroups: SoLiftGroup[]; stockLifts: SoLiftEntry[] } {
  const bySo = new Map<string, SoLiftEntry[]>()
  const stockLifts: SoLiftEntry[] = []

  for (const lift of lifts) {
    if (lift.deletedAt) continue
    for (const allocation of getLiftAllocations(lift)) {
      if (!refsMatch(allocation.poRef, poRef, 'purchase')) continue
      const entry = { lift, qtyMt: allocation.qtyMt }
      const soRef = allocation.soRef?.trim()
      if (!soRef || soRef === STOCK_LIFT_LABEL || lift.stockLift) {
        stockLifts.push(entry)
        continue
      }
      const list = bySo.get(soRef) ?? []
      list.push(entry)
      bySo.set(soRef, list)
    }
  }

  const soGroups = [...bySo.entries()].map(([soRef, entries]) => {
    const so = orders.find(order => order.side === 'sale' && refsMatch(order.ref, soRef, 'sale'))
    const sorted = [...entries].sort((a, b) => a.lift.liftRef - b.lift.liftRef)
    if (so) return groupForSo(so, sorted)
    const deliveredQty = sumEntries(sorted, false)
    const pendingQty = sumEntries(sorted, true)
    return {
      so: {
        id: `lift-${soRef}`,
        ref: soRef,
        side: 'sale' as const,
        partyName: sorted[0]?.lift.buyerName || '',
        itemName: sorted[0]?.lift.itemName || '',
        spot: '',
        deliveryType: 'period' as const,
        deliveryPeriodStart: '',
        deliveryPeriodEnd: '',
        deliveryPeriodVerified: false,
        rate: 0,
        taxRate: 0,
        orderQty: roundQtyMt(deliveredQty + pendingQty),
        liftedQty: deliveredQty,
        committedLiftQty: roundQtyMt(deliveredQty + pendingQty),
        unit: 'MT',
        brokerName: '',
        brokeragePct: 0,
        date: sorted[0]?.lift.date || '',
        status: 'pending' as const,
      },
      deliveredQty,
      pendingQty,
      lifts: sorted,
    }
  })

  stockLifts.sort((a, b) => a.lift.liftRef - b.lift.liftRef)
  return { soGroups, stockLifts }
}

export function groupLiftsBySoForPo(
  poRef: string,
  linkedSOs: TradeOrder[],
  lifts: Lift[],
): SoLiftGroup[] {
  return linkedSOs.map(so => groupForSo(so, liftsForSoOnPo(lifts, poRef, so.ref)))
}
