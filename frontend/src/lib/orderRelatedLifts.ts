import type { Lift, TradeOrder } from '../data/mockData'
import { getLiftAllocations } from './liftAllocations'
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

export function groupLiftsBySoForPo(
  poRef: string,
  linkedSOs: TradeOrder[],
  lifts: Lift[],
): SoLiftGroup[] {
  return linkedSOs.map(so => {
    const entries = liftsForSoOnPo(lifts, poRef, so.ref)
    if (!so.poRef) {
      const deliveredQty = roundQtyMt(
        entries.filter(e => e.lift.status !== 'pending').reduce((sum, e) => sum + e.qtyMt, 0),
      )
      const pendingQty = roundQtyMt(
        entries.filter(e => e.lift.status === 'pending').reduce((sum, e) => sum + e.qtyMt, 0),
      )
      return { so, deliveredQty, pendingQty, lifts: entries }
    }
    return {
      so,
      deliveredQty: so.liftedQty,
      pendingQty: roundQtyMt(Math.max(0, so.orderQty - so.liftedQty)),
      lifts: entries,
    }
  })
}
