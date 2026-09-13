import type { BalanceSettlement, Lift, TradeOrder } from '../data/mockData'
import { roundQtyMt } from './liftTankers'
import { getLiftAllocations } from './liftAllocations'
import { cashSettledQty } from './orderClosure'

export type SellerBalanceLine = {
  poRef: string
  soRef: string
  qtyMt: number
}

function purchaseSellerName(orders: TradeOrder[], poRef: string, fallback = ''): string {
  const po = orders.find(o => o.ref === poRef && o.side === 'purchase')
  return (po?.sellerName || po?.partyName || fallback).trim()
}

function settlementForSeller(settlement: BalanceSettlement, orders: TradeOrder[], sellerNorm: string) {
  return purchaseSellerName(orders, settlement.poRef).toLowerCase() === sellerNorm
}

/** Unapplied qty owed by a seller — delivery shortfalls plus qty carried to the next lift. */
export function getSellerOutstandingBalance(
  lifts: Lift[],
  orders: TradeOrder[],
  sellerName: string,
  settlements: BalanceSettlement[] = [],
  excludeLiftId?: string,
): { total: number; lines: SellerBalanceLine[] } {
  const normalized = sellerName.trim().toLowerCase()
  if (!normalized) return { total: 0, lines: [] }

  const seen = new Set<string>()
  const lines: SellerBalanceLine[] = []
  let shortfall = 0
  let applied = 0

  for (const lift of lifts) {
    if (excludeLiftId && lift.id === excludeLiftId) continue
    const allocs = getLiftAllocations(lift)
    const touchesSeller = allocs.some(a => purchaseSellerName(orders, a.poRef, lift.sellerName).toLowerCase() === normalized)
    if (!touchesSeller) continue
    shortfall += getLiftBalanceQty(lift)
    applied += lift.balanceAppliedQtyMt ?? 0
    for (const a of allocs) {
      if (!a.soRef) continue
      const seller = purchaseSellerName(orders, a.poRef, lift.sellerName)
      if (seller.toLowerCase() !== normalized) continue
      const key = `${a.poRef}\0${a.soRef}`
      if (seen.has(key)) continue
      seen.add(key)
      const qtyMt = getOutstandingBalance(lifts, a.poRef, a.soRef, settlements)
      if (qtyMt > 0) lines.push({ poRef: a.poRef, soRef: a.soRef, qtyMt })
    }
  }

  for (const s of settlements) {
    if (s.method !== 'carried_forward' || s.source !== 'unlifted') continue
    if (!settlementForSeller(s, orders, normalized)) continue
    const key = `carry\0${s.poRef}\0${s.soRef}`
    if (seen.has(key)) continue
    seen.add(key)
    if (s.qtyMt > 0) lines.push({ poRef: s.poRef, soRef: s.soRef || '—', qtyMt: s.qtyMt })
  }

  const cash = settlements
    .filter(s => s.method === 'cash' && s.source !== 'unlifted' && settlementForSeller(s, orders, normalized))
    .reduce((sum, s) => sum + s.qtyMt, 0)
  const unlifted = settlements
    .filter(s => s.method === 'carried_forward' && s.source === 'unlifted' && settlementForSeller(s, orders, normalized))
    .reduce((sum, s) => sum + s.qtyMt, 0)

  lines.sort((a, b) => a.poRef.localeCompare(b.poRef) || a.soRef.localeCompare(b.soRef))
  const total = roundQtyMt(Math.max(0, shortfall + unlifted - applied - cash))
  return { total, lines }
}

/** Planned dispatch qty — preserved after delivery. */
export function getLiftPlannedQty(lift: Lift): number {
  if (lift.plannedQtyMt != null) return lift.plannedQtyMt
  if (lift.status === 'pending') return lift.liftedQty
  return roundQtyMt(lift.liftedQty + (lift.balanceQtyMt ?? 0))
}

/** Shortfall on a delivered lift (seller owes this qty for this DO). */
export function getLiftBalanceQty(lift: Lift): number {
  if (lift.balanceQtyMt != null) return lift.balanceQtyMt
  if (lift.status !== 'delivered') return 0
  const planned = getLiftPlannedQty(lift)
  return roundQtyMt(Math.max(0, planned - lift.liftedQty))
}

/** Unapplied shortfall across prior delivered lifts on this PO/SO pair. */
export function getOutstandingBalance(
  lifts: Lift[],
  poRef: string,
  soRef: string,
  settlements: BalanceSettlement[] = [],
): number {
  const pairLifts = lifts.filter(l =>
    getLiftAllocations(l).some(a => a.poRef === poRef && a.soRef === soRef),
  )
  const totalBalance = pairLifts.reduce((sum, l) => {
    const allocs = getLiftAllocations(l)
    const total = allocs.reduce((s, a) => s + a.qtyMt, 0)
    const share = total > 0
      ? allocs.filter(a => a.poRef === poRef && a.soRef === soRef).reduce((s, a) => s + a.qtyMt, 0) / total
      : 0
    return sum + getLiftBalanceQty(l) * share
  }, 0)
  const totalApplied = pairLifts.reduce((sum, l) => {
    const allocs = getLiftAllocations(l)
    const total = allocs.reduce((s, a) => s + a.qtyMt, 0)
    const share = total > 0
      ? allocs.filter(a => a.poRef === poRef && a.soRef === soRef).reduce((s, a) => s + a.qtyMt, 0) / total
      : 0
    return sum + (l.balanceAppliedQtyMt ?? 0) * share
  }, 0)
  const settled = cashSettledQty(settlements, poRef, soRef)
  return roundQtyMt(Math.max(0, totalBalance - totalApplied - settled))
}

export function computeBalanceQty(plannedQtyMt: number, actualQtyMt: number): number {
  return roundQtyMt(Math.max(0, plannedQtyMt - actualQtyMt))
}
