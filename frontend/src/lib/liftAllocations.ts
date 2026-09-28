import type { Lift, LiftAllocation, OrderCompletionType, OrderStatus, OrderSide, TradeOrder } from '../data/mockData'
import { unliftedQty } from '../data/mockData'
import { canLiftSoAgainstPo, isCrossPoAllocation, liftPoolMismatchMessage } from './sellerLiftPool'
import { allocationActualKey, formatLiftSoRefsWithStock, STOCK_LIFT_LABEL } from './stockLift'
import { inventoryStockRef, purchaseIsClosed } from './stockPo'
import { findTradeOrder, formatLotRef, formatPoRef, formatSoRef, attachOrderPrefix, refsMatch } from './tradeRefs'
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

export function liftTouchesRef(
  lift: Pick<Lift, 'poRef' | 'soRef' | 'liftedQty' | 'allocations'>,
  ref: string,
  side: OrderSide,
): boolean {
  return getLiftAllocations(lift).some(a =>
    side === 'purchase'
      ? refsMatch(a.poRef, ref, 'purchase')
      : Boolean(a.soRef) && refsMatch(a.soRef, ref, 'sale'),
  )
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
            order.side === 'purchase'
              ? refsMatch(a.poRef, order.ref, 'purchase')
              : Boolean(a.soRef) && refsMatch(a.soRef, order.ref, 'sale'),
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

export function allocationIsInventoryStock(
  poRef: string,
  allocations: LiftAllocation[],
  orders: TradeOrder[] | undefined,
): boolean {
  if (!orders?.length) return false
  const po = findTradeOrder(orders, 'purchase', poRef)
  const onPo = allocations.filter(a => refsMatch(a.poRef, poRef, 'purchase'))
  if (onPo.length === 0) return false
  if (purchaseIsClosed(po)) {
    return onPo.every(a => {
      if (!a.soRef) return true
      const so = findTradeOrder(orders, 'sale', a.soRef)
      return Boolean(inventoryStockRef(so, po))
    })
  }
  return onPo.every(a => {
    if (!a.soRef) return false
    const so = findTradeOrder(orders, 'sale', a.soRef)
    return Boolean(inventoryStockRef(so, po))
  })
}

export function formatPoRefForAllocation(
  poRef: string,
  allocations: LiftAllocation[],
  orders?: TradeOrder[],
): string {
  return allocationIsInventoryStock(poRef, allocations, orders) ? formatLotRef(poRef) : formatPoRef(poRef)
}

export function formatLiftPoRefs(
  lift: Pick<Lift, 'poRef' | 'soRef' | 'liftedQty' | 'allocations'>,
  orders?: TradeOrder[],
): string {
  const allocations = getLiftAllocations(lift)
  return uniqueLiftRefs(lift, 'poRef')
    .map(poRef => formatPoRefForAllocation(poRef, allocations, orders))
    .join(', ')
}

export function formatLiftSoRefs(lift: Pick<Lift, 'poRef' | 'soRef' | 'liftedQty' | 'allocations' | 'stockLift'>): string {
  return formatLiftSoRefsWithStock(lift)
}

export function formatAllocationsSummary(
  allocations: LiftAllocation[],
  stockLift?: boolean,
  orders?: TradeOrder[],
): string {
  const pos = [...new Set(allocations.map(a => a.poRef))]
  const sos = [...new Set(allocations.map(a => a.soRef).filter(Boolean) as string[])]
  const poLabels = pos.map(poRef => formatPoRefForAllocation(poRef, allocations, orders))
  const soLabels = sos.map(formatSoRef)
  if (stockLift || sos.length === 0) {
    return poLabels.length === 1 ? `${poLabels[0]} → ${STOCK_LIFT_LABEL}` : `${poLabels.join(', ')} → ${STOCK_LIFT_LABEL}`
  }
  if (poLabels.length === 1 && soLabels.length === 1) return `${poLabels[0]} → ${soLabels[0]}`
  return `${soLabels.join(', ')} · ${poLabels.join(', ')}`
}

export function formatLiftOrderSummary(
  lift: Pick<Lift, 'poRef' | 'soRef' | 'liftedQty' | 'allocations' | 'stockLift'>,
  orders?: TradeOrder[],
): string {
  return formatAllocationsSummary(getLiftAllocations(lift), lift.stockLift, orders)
}

export function liftHasCrossPoAllocations(
  lift: Pick<Lift, 'poRef' | 'soRef' | 'liftedQty' | 'allocations'>,
  orders: TradeOrder[],
): boolean {
  return getLiftAllocations(lift).some(a => {
    const so = findTradeOrder(orders, 'sale', a.soRef)
    return isCrossPoAllocation(so, a.poRef)
  })
}

export function crossPoAllocationsForLift(
  lift: Pick<Lift, 'poRef' | 'soRef' | 'liftedQty' | 'allocations'>,
  orders: TradeOrder[],
): { soRef: string; bookedPoRef: string; dispatchPoRef: string }[] {
  return getLiftAllocations(lift).flatMap(a => {
    if (!a.soRef) return []
    const so = findTradeOrder(orders, 'sale', a.soRef)
    if (!so?.poRef || !isCrossPoAllocation(so, a.poRef)) return []
    return [{ soRef: a.soRef, bookedPoRef: so.poRef, dispatchPoRef: a.poRef }]
  })
}

export function allocationTotal(allocations: LiftAllocation[]): number {
  return roundQtyMt(allocations.reduce((sum, a) => sum + a.qtyMt, 0))
}

/** Lift qty on this sales order only — PO and SO numbers can collide (PO24 vs SO24). */
export function qtyCommittedOnSo(lifts: Lift[], soRef: string, excludeLiftId?: string): number {
  return roundQtyMt(lifts
    .filter(l => l.id !== excludeLiftId && !l.deletedAt)
    .reduce((sum, l) => {
      const part = getLiftAllocations(l)
        .filter(a => Boolean(a.soRef) && refsMatch(a.soRef, soRef, 'sale'))
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
        .filter(a => refsMatch(a.poRef, poRef, 'purchase') && Boolean(a.soRef))
        .reduce((s, a) => s + a.qtyMt, 0)
      return sum + part
    }, 0))
}

/** Tonnes of one SO lifted from one PO. Pending lifts are in transit. */
export function qtySoSliceOnPo(
  lifts: Lift[],
  poRef: string,
  soRef: string,
): { delivered: number; inTransit: number } {
  let delivered = 0
  let inTransit = 0
  for (const lift of lifts) {
    if (lift.deletedAt) continue
    const pending = lift.status === 'pending'
    for (const a of getLiftAllocations(lift)) {
      if (!a.soRef || !refsMatch(a.soRef, soRef, 'sale') || !refsMatch(a.poRef, poRef, 'purchase')) continue
      if (pending) inTransit += a.qtyMt
      else delivered += a.qtyMt
    }
  }
  return { delivered: roundQtyMt(delivered), inTransit: roundQtyMt(inTransit) }
}

/** Own-stock / stock-in qty on this PO (allocations with no soRef). */
export function qtyStockOnPo(lifts: Lift[], poRef: string, excludeLiftId?: string): number {
  const split = qtyStockSplitOnPo(lifts, poRef, excludeLiftId)
  return roundQtyMt(split.delivered + split.inTransit)
}

export function qtyStockSplitOnPo(
  lifts: Lift[],
  poRef: string,
  excludeLiftId?: string,
): { delivered: number; inTransit: number } {
  let delivered = 0
  let inTransit = 0
  for (const lift of lifts) {
    if (lift.id === excludeLiftId || lift.deletedAt) continue
    const pending = lift.status === 'pending'
    for (const a of getLiftAllocations(lift)) {
      if (!refsMatch(a.poRef, poRef, 'purchase') || a.soRef) continue
      if (pending) inTransit += a.qtyMt
      else delivered += a.qtyMt
    }
  }
  return { delivered: roundQtyMt(delivered), inTransit: roundQtyMt(inTransit) }
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
    return roundQtyMt(cap - Math.max(stock, soDispatch))
  }
    const boughtBack = (order.buyBacks ?? []).reduce((s, b) => s + b.qtyMt, 0)
    const cap = Math.max(0, order.orderQty - boughtBack)
    return roundQtyMt(cap - qtyCommittedOnSo(lifts, order.ref, excludeLiftId))
}

/**
 * PO register lift columns: Allocation / Delivered / In transit / To be lift.
 * Linked SOs plus own-stock lifts (no SO) on this PO.
 *
 * Per SO: orderQty = delivered + inTransit + toBeLift.
 * Own stock: qty = delivered + inTransit (no leftover-to-lift line).
 */
const EMPTY_PO_ROLLUP: {
  allocation: number
  delivered: number
  inTransit: number
  toBeLift: number
  lines: {
    soRef: string
    allocation: number
    delivered: number
    inTransit: number
    toBeLift: number
  }[]
} = { allocation: 0, delivered: 0, inTransit: 0, toBeLift: 0, lines: [] }

export interface PoRegisterFigures {
  rollup: typeof EMPTY_PO_ROLLUP
  available: number
  /** Same membership as getSOsForPO, including delete-scheduled sales. */
  linkedSos: TradeOrder[]
}

/**
 * One pass over orders and lifts for the purchase register.
 * Same numbers as calling linkedSoLiftRollup and getRemainingSellQty per row.
 */
export function buildPoRegisterIndex(
  orders: TradeOrder[],
  lifts: Lift[],
): Map<string, PoRegisterFigures> {
  const soCommitted = new Map<string, number>()
  const soTransit = new Map<string, number>()
  const soSliceOnPo = new Map<string, { delivered: number; inTransit: number }>()
  const poToLiftSoKeys = new Map<string, Set<string>>()
  const poStock = new Map<string, { delivered: number; inTransit: number }>()

  const linkLiftSo = (soKey: string, poKey: string) => {
    if (!soKey || !poKey) return
    const linked = poToLiftSoKeys.get(poKey) ?? new Set<string>()
    linked.add(soKey)
    poToLiftSoKeys.set(poKey, linked)
  }

  for (const lift of lifts) {
    if (lift.deletedAt) continue
    const pending = lift.status === 'pending'
    for (const a of getLiftAllocations(lift)) {
      const poKey = attachOrderPrefix(a.poRef, 'purchase')
      if (!a.soRef) {
        if (!poKey) continue
        const stock = poStock.get(poKey) ?? { delivered: 0, inTransit: 0 }
        if (pending) stock.inTransit += a.qtyMt
        else stock.delivered += a.qtyMt
        poStock.set(poKey, stock)
        continue
      }
      const soKey = attachOrderPrefix(a.soRef, 'sale')
      if (!soKey) continue
      soCommitted.set(soKey, (soCommitted.get(soKey) ?? 0) + a.qtyMt)
      if (pending) soTransit.set(soKey, (soTransit.get(soKey) ?? 0) + a.qtyMt)
      if (!poKey) continue
      linkLiftSo(soKey, poKey)
      const sliceKey = `${poKey}|${soKey}`
      const slice = soSliceOnPo.get(sliceKey) ?? { delivered: 0, inTransit: 0 }
      if (pending) slice.inTransit += a.qtyMt
      else slice.delivered += a.qtyMt
      soSliceOnPo.set(sliceKey, slice)
    }
  }

  const soByKey = new Map<string, TradeOrder[]>()
  const soByKeyAny = new Map<string, TradeOrder[]>()
  const purchaseByKey = new Map<string, TradeOrder>()
  const pushSo = (map: Map<string, TradeOrder[]>, key: string, order: TradeOrder) => {
    const list = map.get(key) ?? []
    list.push(order)
    map.set(key, list)
  }

  for (const order of orders) {
    if (order.side === 'purchase') {
      const poKey = attachOrderPrefix(order.ref, 'purchase')
      if (poKey && !purchaseByKey.has(poKey)) purchaseByKey.set(poKey, order)
      continue
    }
    if (order.status === 'cancelled') continue
    if (order.stockPoRef && !order.poRef) continue
    const soKey = attachOrderPrefix(order.ref, 'sale')
    if (!soKey) continue
    pushSo(soByKeyAny, soKey, order)
    if (!order.deleteScheduledAt) pushSo(soByKey, soKey, order)
  }

  const poToActive = new Map<string, TradeOrder[]>()
  const poToAny = new Map<string, TradeOrder[]>()
  const addOrder = (map: Map<string, TradeOrder[]>, poKey: string, order: TradeOrder) => {
    if (!poKey) return
    const list = map.get(poKey) ?? []
    if (list.includes(order)) return
    list.push(order)
    map.set(poKey, list)
  }
  for (const group of soByKeyAny.values()) {
    for (const order of group) {
      if (!order.poRef) continue
      const poKey = attachOrderPrefix(order.poRef, 'purchase')
      addOrder(poToAny, poKey, order)
      if (!order.deleteScheduledAt) addOrder(poToActive, poKey, order)
    }
  }
  for (const [poKey, soKeys] of poToLiftSoKeys) {
    for (const soKey of soKeys) {
      for (const order of soByKeyAny.get(soKey) ?? []) addOrder(poToAny, poKey, order)
      for (const order of soByKey.get(soKey) ?? []) addOrder(poToActive, poKey, order)
    }
  }

  const poKeys = new Set<string>([
    ...purchaseByKey.keys(),
    ...poToActive.keys(),
    ...poToAny.keys(),
    ...poStock.keys(),
  ])

  const index = new Map<string, PoRegisterFigures>()
  for (const poKey of poKeys) {
    const sos = poToActive.get(poKey) ?? []
    const linkedSos = poToAny.get(poKey) ?? []

    let allocation = 0
    let delivered = 0
    let inTransit = 0
    let toBeLift = 0
    let soldQty = 0
    const lines: typeof EMPTY_PO_ROLLUP.lines = []
    for (const so of sos) {
      const soKey = attachOrderPrefix(so.ref, 'sale')
      if (!so.poRef) {
        const slice = soSliceOnPo.get(`${poKey}|${soKey}`) ?? { delivered: 0, inTransit: 0 }
        const deliveredQty = roundQtyMt(slice.delivered)
        const transit = roundQtyMt(slice.inTransit)
        const alloc = roundQtyMt(deliveredQty + transit)
        allocation += alloc
        delivered += deliveredQty
        inTransit += transit
        soldQty += alloc
        if (alloc > 0) {
          lines.push({
            soRef: so.ref,
            allocation: alloc,
            delivered: deliveredQty,
            inTransit: transit,
            toBeLift: 0,
          })
        }
        continue
      }
      const boughtBack = (so.buyBacks ?? []).reduce((sum, b) => sum + b.qtyMt, 0)
      const cap = Math.max(0, so.orderQty - boughtBack)
      const left = roundQtyMt(cap - (soCommitted.get(soKey) ?? 0))
      const transit = roundQtyMt(soTransit.get(soKey) ?? 0)
      const deliveredQty = roundQtyMt(Math.max(0, so.orderQty - left - transit))
      allocation += so.orderQty
      toBeLift += left
      inTransit += transit
      delivered += deliveredQty
      soldQty += so.orderQty
      lines.push({
        soRef: so.ref,
        allocation: roundQtyMt(so.orderQty),
        delivered: deliveredQty,
        inTransit: transit,
        toBeLift: left,
      })
    }

    const stock = poStock.get(poKey) ?? { delivered: 0, inTransit: 0 }
    const stockDelivered = roundQtyMt(stock.delivered)
    const stockInTransit = roundQtyMt(stock.inTransit)
    const stockAlloc = roundQtyMt(stockDelivered + stockInTransit)
    if (stockAlloc > 0) {
      allocation += stockAlloc
      delivered += stockDelivered
      inTransit += stockInTransit
      lines.push({
        soRef: STOCK_LIFT_LABEL,
        allocation: stockAlloc,
        delivered: stockDelivered,
        inTransit: stockInTransit,
        toBeLift: 0,
      })
    }

    const po = purchaseByKey.get(poKey)
    const closed = Boolean(
      po && (
        po.status === 'cancelled'
        || (po.completionType && (po.completionType === 'cash_settled' || po.completionType === 'carried_forward' || po.completionType === 'short_closed' || po.completionType === 'delivered'))
      ),
    )
    const boughtBack = (po?.buyBacks ?? []).reduce((sum, b) => sum + b.qtyMt, 0)
    const sellCap = Math.max(0, (po?.orderQty ?? 0) - boughtBack)
    const stockQty = roundQtyMt(stock.delivered + stock.inTransit)
    const available = !po || closed
      ? 0
      : roundQtyMt(Math.max(0, sellCap - roundQtyMt(soldQty) - stockQty))

    index.set(poKey, {
      rollup: {
        allocation: roundQtyMt(allocation),
        delivered: roundQtyMt(delivered),
        inTransit: roundQtyMt(inTransit),
        toBeLift: roundQtyMt(toBeLift),
        lines,
      },
      available,
      linkedSos,
    })
  }
  return index
}

const EMPTY_PO_FIGURES: PoRegisterFigures = { rollup: EMPTY_PO_ROLLUP, available: 0, linkedSos: [] }

export function poRegisterFigures(
  index: Map<string, PoRegisterFigures>,
  poRef: string,
): PoRegisterFigures {
  return index.get(attachOrderPrefix(poRef, 'purchase')) ?? EMPTY_PO_FIGURES
}

/** Refs that appear on a lift, keyed as `purchase:PO1` / `sale:SO1`. */
export function liftTouchKeys(lifts: Lift[]): Set<string> {
  const keys = new Set<string>()
  for (const lift of lifts) {
    if (lift.deletedAt) continue
    for (const a of getLiftAllocations(lift)) {
      const poKey = attachOrderPrefix(a.poRef, 'purchase')
      if (poKey) keys.add(`purchase:${poKey}`)
      if (!a.soRef) continue
      const soKey = attachOrderPrefix(a.soRef, 'sale')
      if (soKey) keys.add(`sale:${soKey}`)
    }
  }
  return keys
}

/** Refs that have a pending lift, keyed as `purchase:PO1` / `sale:SO1`. */
export function pendingLiftKeys(lifts: Lift[]): Set<string> {
  const keys = new Set<string>()
  for (const lift of lifts) {
    if (lift.deletedAt || lift.status !== 'pending') continue
    for (const a of getLiftAllocations(lift)) {
      const poKey = attachOrderPrefix(a.poRef, 'purchase')
      if (poKey) keys.add(`purchase:${poKey}`)
      if (!a.soRef) continue
      const soKey = attachOrderPrefix(a.soRef, 'sale')
      if (soKey) keys.add(`sale:${soKey}`)
    }
  }
  return keys
}

export function orderHasPendingLift(keys: Set<string>, order: Pick<TradeOrder, 'ref' | 'side'>): boolean {
  const key = attachOrderPrefix(order.ref, order.side)
  return Boolean(key) && keys.has(`${order.side}:${key}`)
}

export function linkedSoLiftRollup(
  poRef: string,
  orders: TradeOrder[],
  lifts: Lift[],
): {
  allocation: number
  delivered: number
  inTransit: number
  toBeLift: number
  lines: {
    soRef: string
    allocation: number
    delivered: number
    inTransit: number
    toBeLift: number
  }[]
} {
  const sos = orders.filter(
    o =>
      o.side === 'sale'
      && o.status !== 'cancelled'
      && !o.deleteScheduledAt
      && !(o.stockPoRef && !o.poRef)
      && (
        refsMatch(o.poRef, poRef, 'purchase')
        || lifts.some(l =>
          !l.deletedAt
          && getLiftAllocations(l).some(a =>
            Boolean(a.soRef)
            && refsMatch(a.soRef, o.ref, 'sale')
            && refsMatch(a.poRef, poRef, 'purchase'),
          ),
        )
      ),
  )
  let allocation = 0
  let delivered = 0
  let inTransit = 0
  let toBeLift = 0
  const lines: {
    soRef: string
    allocation: number
    delivered: number
    inTransit: number
    toBeLift: number
  }[] = []
  for (const so of sos) {
    if (!so.poRef) {
      const slice = qtySoSliceOnPo(lifts, poRef, so.ref)
      const alloc = roundQtyMt(slice.delivered + slice.inTransit)
      allocation += alloc
      delivered += slice.delivered
      inTransit += slice.inTransit
      if (alloc > 0) {
        lines.push({
          soRef: so.ref,
          allocation: alloc,
          delivered: slice.delivered,
          inTransit: slice.inTransit,
          toBeLift: 0,
        })
      }
      continue
    }
    const left = remainingOnOrder(so, lifts)
    const transit = inTransitQtyOnOrder(lifts, so)
    const deliveredQty = roundQtyMt(Math.max(0, so.orderQty - left - transit))
    allocation += so.orderQty
    toBeLift += left
    inTransit += transit
    delivered += deliveredQty
    lines.push({
      soRef: so.ref,
      allocation: roundQtyMt(so.orderQty),
      delivered: deliveredQty,
      inTransit: roundQtyMt(transit),
      toBeLift: roundQtyMt(left),
    })
  }
  const stock = qtyStockSplitOnPo(lifts, poRef)
  const stockAlloc = roundQtyMt(stock.delivered + stock.inTransit)
  if (stockAlloc > 0) {
    allocation += stockAlloc
    delivered += stock.delivered
    inTransit += stock.inTransit
    lines.push({
      soRef: STOCK_LIFT_LABEL,
      allocation: stockAlloc,
      delivered: stock.delivered,
      inTransit: stock.inTransit,
      toBeLift: 0,
    })
  }
  return {
    allocation: roundQtyMt(allocation),
    delivered: roundQtyMt(delivered),
    inTransit: roundQtyMt(inTransit),
    toBeLift: roundQtyMt(toBeLift),
    lines,
  }
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

/**
 * Qty still free to put on a new tanker for this SO.
 * If lifts are not linked to the SO, do not pretend leftover PO qty is available.
 */
export function soQtyLeftToLift(
  so: TradeOrder,
  lifts: Lift[],
  excludeLiftId?: string,
): { qty: number | null; warning?: string } {
  const remaining = remainingOnOrder(so, lifts, excludeLiftId)
  const unlifted = unliftedQty(so)
  const inTransit = inTransitQtyOnOrder(lifts, so)
  const expected = roundQtyMt(Math.max(0, unlifted - inTransit))
  if (unlifted > 0.001 && remaining + 0.001 < expected && inTransit < 0.001) {
    return {
      qty: null,
      warning: `${formatSoRef(so.ref)} still has ${formatQty(unlifted)} not delivered, but no lift is linked to this SO. Fix SO Ref# on the lift register — available is hidden so it is not guessed.`,
    }
  }
  return { qty: remaining }
}

const CLOSED_COMPLETION: OrderCompletionType[] = ['cash_settled', 'carried_forward', 'short_closed', 'delivered']

function statusAfterLiftTotals(order: TradeOrder, liftedQty: number): OrderStatus {
  if (order.status === 'cancelled') return 'cancelled'
  if (order.completionType && CLOSED_COMPLETION.includes(order.completionType)) return 'completed'
  if (liftedQty > 0) return 'partial'
  return 'pending'
}

/** Recompute committed / delivered qty from lift allocations. PO and SO maps stay separate. */
export function applyLiftTotals<T extends { tradeOrders?: TradeOrder[]; lifts?: Lift[] }>(data: T): T {
  const lifts = data.lifts ?? []
  const linkedOrders = linkUnlinkedSalesOrdersFromLifts(data.tradeOrders ?? [], lifts)
  const poStockC = new Map<string, number>()
  const poSoC = new Map<string, number>()
  const poStockD = new Map<string, number>()
  const poSoD = new Map<string, number>()
  const soC = new Map<string, number>()
  const soD = new Map<string, number>()
  const add = (map: Map<string, number>, key: string, qty: number) => {
    map.set(key, (map.get(key) ?? 0) + qty)
  }

  for (const lift of lifts) {
    if (lift.deletedAt) continue
    const delivered = (lift.status || 'delivered') === 'delivered'
    for (const a of getLiftAllocations(lift)) {
      const poRef = attachOrderPrefix(a.poRef, 'purchase')
      const qty = a.qtyMt || 0
      const soRef = a.soRef ? attachOrderPrefix(a.soRef, 'sale') : ''
      if (!poRef || qty <= 0) continue
      if (soRef) {
        add(poSoC, poRef, qty)
        add(soC, soRef, qty)
        if (delivered) {
          add(poSoD, poRef, qty)
          add(soD, soRef, qty)
        }
      } else {
        add(poStockC, poRef, qty)
        if (delivered) add(poStockD, poRef, qty)
      }
    }
  }

  const tradeOrders = linkedOrders.map(o => {
    const ref = attachOrderPrefix(o.ref, o.side)
    let committed: number
    let lifted: number
    if (o.side === 'purchase') {
      committed = roundQtyMt(Math.max(poStockC.get(ref) ?? 0, poSoC.get(ref) ?? 0))
      lifted = roundQtyMt(Math.max(poStockD.get(ref) ?? 0, poSoD.get(ref) ?? 0))
    } else {
      committed = roundQtyMt(soC.get(ref) ?? 0)
      lifted = roundQtyMt(soD.get(ref) ?? 0)
    }
    const updated = { ...o, committedLiftQty: committed, liftedQty: lifted }
    return { ...updated, status: statusAfterLiftTotals(updated, lifted) }
  })

  return { ...data, tradeOrders }
}

/** A lift never writes a purchase onto a sales order. Booking happens on the SO itself. */
function linkUnlinkedSalesOrdersFromLifts(orders: TradeOrder[], lifts: Lift[]): TradeOrder[] {
  void lifts
  return orders
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
    const soKey = attachOrderPrefix(a.soRef, 'sale')
    if (soSeen.has(soKey)) return `${formatSoRef(a.soRef)} is listed more than once`
    soSeen.add(soKey)
  }

  const itemNames = new Set<string>()
  const usedOnPo = new Map<string, number>()
  const usedOnSo = new Map<string, number>()

  for (const a of allocations) {
    const po = findTradeOrder(orders, 'purchase', a.poRef)
    const so = findTradeOrder(orders, 'sale', a.soRef)
    if (!po || !so) return 'PO or SO not found'
    if (so.itemName !== po.itemName) {
      return `${formatSoRef(so.ref)} is ${so.itemName}; ${formatPoRef(po.ref)} is ${po.itemName}`
    }
    if (!canLiftSoAgainstPo(so, po, orders)) {
      return liftPoolMismatchMessage(so, po, orders)
    }
    itemNames.add(so.itemName)
    const poKey = attachOrderPrefix(a.poRef, 'purchase')
    usedOnPo.set(poKey, roundQtyMt((usedOnPo.get(poKey) ?? 0) + a.qtyMt))
    if (a.soRef) {
      const soKey = attachOrderPrefix(a.soRef, 'sale')
      usedOnSo.set(soKey, roundQtyMt((usedOnSo.get(soKey) ?? 0) + a.qtyMt))
    }
  }

  if (itemNames.size > 1) return 'All SOs on one tanker must be the same item'

  for (const [soRef, qty] of usedOnSo) {
    const so = findTradeOrder(orders, 'sale', soRef)
    if (!so) continue
    const remaining = remainingOnOrder(so, lifts, excludeLiftId)
    if (qty > remaining) {
      return `${soRef} only has ${formatQty(remaining)} left to lift`
    }
  }

  for (const [poRef, qty] of usedOnPo) {
    const po = findTradeOrder(orders, 'purchase', poRef)
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

  const po = findTradeOrder(orders, 'purchase', a.poRef)
  if (!po) return 'PO not found'
  const remaining = remainingOnOrder(po, lifts, excludeLiftId)
  if (a.qtyMt > remaining) {
    return `${a.poRef} only has ${formatQty(remaining)} left to lift`
  }
  return undefined
}
