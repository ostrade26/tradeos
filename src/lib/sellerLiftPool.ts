import { toBeLifted, type TradeOrder } from '../data/mockData'
import { normalizeCompanyName } from './companyResolution'
import { formatPoRef, formatSoRef } from './tradeRefs'

function sellerIdentity(po: TradeOrder): { id: string; name: string } {
  return {
    id: (po.sellerCompanyId || po.partyCompanyId || '').trim(),
    name: normalizeCompanyName(po.sellerName || po.partyName || ''),
  }
}

/** Two POs are interchangeable stock when they are the same supplier + item. */
export function sameSellerItemPool(a: TradeOrder, b: TradeOrder): boolean {
  if (a.side !== 'purchase' || b.side !== 'purchase') return false
  if (a.itemName !== b.itemName) return false
  const ia = sellerIdentity(a)
  const ib = sellerIdentity(b)
  if (ia.id && ib.id) return ia.id === ib.id
  if (ia.name && ib.name) return ia.name === ib.name
  return false
}

function linkedPurchaseOrder(so: TradeOrder, orders: TradeOrder[]): TradeOrder | undefined {
  if (!so.poRef) return undefined
  return orders.find(o => o.ref === so.poRef && o.side === 'purchase')
}

/** SO is booked on one PO but dispatching stock from another (buyer-first delivery). */
export function isCrossPoAllocation(so: TradeOrder | undefined, dispatchPoRef: string): boolean {
  if (!so?.poRef || !dispatchPoRef) return false
  return so.poRef !== dispatchPoRef
}

export function crossPoAllocationMessage(so: TradeOrder, dispatchPoRef: string): string {
  return `${formatSoRef(so.ref)} is booked on ${formatPoRef(so.poRef!)} but this lift dispatches from ${formatPoRef(dispatchPoRef)}. Stock and balances apply to the dispatch lot.`
}

export function crossPoAllocationSummary(
  soRef: string,
  dispatchPoRef: string,
  orders: TradeOrder[],
): string | null {
  const so = orders.find(o => o.ref === soRef && o.side === 'sale')
  if (!so || !isCrossPoAllocation(so, dispatchPoRef)) return null
  return crossPoAllocationMessage(so, dispatchPoRef)
}

/** SO may lift against this PO: exact booking, unlinked SO, or another PO from the same seller+item. */
export function canLiftSoAgainstPo(so: TradeOrder, po: TradeOrder, orders: TradeOrder[]): boolean {
  if (so.side !== 'sale' || po.side !== 'purchase') return false
  if (so.status === 'completed' || so.status === 'cancelled') return false
  if (po.status === 'completed' || po.status === 'cancelled') return false
  if (so.itemName !== po.itemName) return false
  if (!so.poRef || so.poRef === po.ref) return true
  const booked = linkedPurchaseOrder(so, orders)
  if (!booked) return true
  return sameSellerItemPool(booked, po)
}

function byPoSequence(a: TradeOrder, b: TradeOrder): number {
  const date = a.date.localeCompare(b.date)
  if (date !== 0) return date
  return a.ref.localeCompare(b.ref, undefined, { numeric: true })
}

/** Pending POs this SO can dispatch against (same seller + item). */
export function poolPOsForSo(so: TradeOrder, orders: TradeOrder[]): TradeOrder[] {
  const pending = orders.filter(o => o.side === 'purchase' && o.status !== 'completed' && o.status !== 'cancelled')
  return pending.filter(po => canLiftSoAgainstPo(so, po, orders) && toBeLifted(po) > 0).sort(byPoSequence)
}

/** Pending SOs that can dispatch from this PO (booked here or on another PO from the same seller). */
export function poolSOsForPo(po: TradeOrder, orders: TradeOrder[]): TradeOrder[] {
  const pending = orders.filter(o => o.side === 'sale' && o.status !== 'completed' && o.status !== 'cancelled')
  return pending.filter(so => canLiftSoAgainstPo(so, po, orders) && toBeLifted(so) > 0)
}

export function liftPoolMismatchMessage(so: TradeOrder, po: TradeOrder, orders: TradeOrder[]): string {
  const booked = linkedPurchaseOrder(so, orders)
  if (!booked) {
    return `${formatSoRef(so.ref)} cannot lift against ${formatPoRef(po.ref)}`
  }
  if (booked.itemName !== po.itemName) {
    return `${formatSoRef(so.ref)} is ${so.itemName}; ${formatPoRef(po.ref)} is ${po.itemName}`
  }
  return `${formatSoRef(so.ref)} is booked on ${formatPoRef(booked.ref)} (${booked.partyName}). ${formatPoRef(po.ref)} is ${po.partyName} — pick a PO from the same seller.`
}
