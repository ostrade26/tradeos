import { partyMatches } from './assistant/partyMatch'
import {
  filterOrdersByDate,
  filterByDeliveryPeriod,
  formatDateFilterLabel,
  formatDeliveryPeriodFilterLabel,
  type AppliedFilterChip,
  uniqueSorted,
} from './orderFilters'
import { getLiftTankers } from './liftTankers'
import { getLiftAllocations } from './liftAllocations'
import type { Lift, TradeOrder } from '../data/mockData'

export interface LiftFilterState {
  dateFrom: string
  dateTo: string
  deliveryPeriodFrom: string
  deliveryPeriodTo: string
  items: string[]
  parties: string[]
  brokers: string[]
  spots: string[]
  selfLiftOnly: boolean
}

export const emptyLiftFilters: LiftFilterState = {
  dateFrom: '',
  dateTo: '',
  deliveryPeriodFrom: '',
  deliveryPeriodTo: '',
  items: [],
  parties: [],
  brokers: [],
  spots: [],
  selfLiftOnly: false,
}

export function hasActiveLiftFilters(filters: LiftFilterState, search = '') {
  return Boolean(
    search.trim()
    || filters.dateFrom
    || filters.dateTo
    || filters.deliveryPeriodFrom
    || filters.deliveryPeriodTo
    || filters.items.length
    || filters.parties.length
    || filters.brokers.length
    || filters.spots.length
    || filters.selfLiftOnly,
  )
}

function liftBrokerNames(lift: Lift, orders: TradeOrder[]): string[] {
  const names = new Set<string>()
  for (const alloc of getLiftAllocations(lift)) {
    const so = orders.find(o => o.ref === alloc.soRef && o.side === 'sale')
    const po = orders.find(o => o.ref === alloc.poRef && o.side === 'purchase')
    if (so?.brokerName) names.add(so.brokerName)
    else if (po?.brokerName) names.add(po.brokerName)
  }
  return [...names]
}

function liftSpots(lift: Lift, orders: TradeOrder[]): string[] {
  const spots = new Set<string>()
  for (const alloc of getLiftAllocations(lift)) {
    const so = orders.find(o => o.ref === alloc.soRef && o.side === 'sale')
    const po = orders.find(o => o.ref === alloc.poRef && o.side === 'purchase')
    if (so?.spot) spots.add(so.spot)
    else if (po?.spot) spots.add(po.spot)
  }
  return [...spots]
}

export function applyLiftFilters(
  lifts: Lift[],
  filters: LiftFilterState,
  search: string,
  tradeOrders: TradeOrder[] = [],
): Lift[] {
  let result = filterOrdersByDate(lifts, filters.dateFrom, filters.dateTo)
  result = filterByDeliveryPeriod(result, filters.deliveryPeriodFrom, filters.deliveryPeriodTo)

  if (filters.items.length) {
    result = result.filter(l => filters.items.includes(l.itemName))
  }
  if (filters.parties.length) {
    result = result.filter(l =>
      filters.parties.some(p =>
        partyMatches(l.buyerName, p) || partyMatches(l.sellerName, p),
      ),
    )
  }
  if (filters.brokers.length) {
    result = result.filter(l =>
      liftBrokerNames(l, tradeOrders).some(b => filters.brokers.some(sel => partyMatches(b, sel))),
    )
  }
  if (filters.spots.length) {
    result = result.filter(l =>
      liftSpots(l, tradeOrders).some(s => filters.spots.includes(s)),
    )
  }
  if (filters.selfLiftOnly) {
    result = result.filter(l => l.isSelfLift)
  }

  if (search.trim()) {
    const q = search.toLowerCase()
    result = result.filter(l =>
      String(l.liftRef).includes(q)
      || getLiftAllocations(l).some(a =>
        a.poRef.toLowerCase().includes(q) || (a.soRef?.toLowerCase().includes(q) ?? false),
      )
      || l.poRef.toLowerCase().includes(q)
      || l.soRef.toLowerCase().includes(q)
      || l.buyerName.toLowerCase().includes(q)
      || l.sellerName.toLowerCase().includes(q)
      || l.itemName.toLowerCase().includes(q)
      || (l.salesInvoiceNo?.toLowerCase().includes(q) ?? false)
      || getLiftTankers(l).some(t =>
        t.tankerNo.toLowerCase().includes(q)
        || t.lrNo.toLowerCase().includes(q)
        || t.transportName.toLowerCase().includes(q)
        || t.driverMobile.includes(q),
      ),
    )
  }

  return result
}

export function liftFilterOptions(lifts: Lift[], tradeOrders: TradeOrder[] = []) {
  const brokers = new Set<string>()
  const spots = new Set<string>()
  for (const lift of lifts) {
    for (const name of liftBrokerNames(lift, tradeOrders)) brokers.add(name)
    for (const spot of liftSpots(lift, tradeOrders)) spots.add(spot)
  }
  return {
    items: uniqueSorted(lifts.map(l => l.itemName)),
    parties: uniqueSorted(lifts.flatMap(l => [l.buyerName, l.sellerName])),
    brokers: uniqueSorted([...brokers]),
    spots: uniqueSorted([...spots]),
  }
}

export function getLiftFilterChips(filters: LiftFilterState, search: string): AppliedFilterChip[] {
  const chips: AppliedFilterChip[] = []
  const createdLabel = formatDateFilterLabel(filters.dateFrom, filters.dateTo)
  if (createdLabel) chips.push({ id: 'date', prefix: 'Created', value: createdLabel })
  const deliveryLabel = formatDeliveryPeriodFilterLabel(filters.deliveryPeriodFrom, filters.deliveryPeriodTo)
  if (deliveryLabel) chips.push({ id: 'deliveryPeriod', prefix: 'Delivery period', value: deliveryLabel })
  for (const item of filters.items) chips.push({ id: `items:${item}`, prefix: 'Item', value: item })
  for (const party of filters.parties) chips.push({ id: `parties:${party}`, prefix: 'Party', value: party })
  for (const broker of filters.brokers) chips.push({ id: `brokers:${broker}`, prefix: 'Broker', value: broker })
  for (const spot of filters.spots) chips.push({ id: `spots:${spot}`, prefix: 'Spot', value: spot })
  if (filters.selfLiftOnly) chips.push({ id: 'selfLift', prefix: 'Lift type', value: 'Self lift' })
  if (search.trim()) chips.push({ id: 'search', prefix: 'Search', value: search.trim() })
  return chips
}

export function clearLiftFilterField(
  filters: LiftFilterState,
  id: string,
): LiftFilterState {
  if (id === 'date') return { ...filters, dateFrom: '', dateTo: '' }
  if (id === 'deliveryPeriod') return { ...filters, deliveryPeriodFrom: '', deliveryPeriodTo: '' }
  if (id === 'selfLift') return { ...filters, selfLiftOnly: false }

  const multiMatch = id.match(/^(items|parties|brokers|spots):(.+)$/)
  if (multiMatch) {
    const field = multiMatch[1] as keyof Pick<LiftFilterState, 'items' | 'parties' | 'brokers' | 'spots'>
    const value = multiMatch[2]
    return { ...filters, [field]: filters[field].filter(v => v !== value) }
  }

  return filters
}
