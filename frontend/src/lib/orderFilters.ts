import { partyMatches } from './assistant/partyMatch'
import { formatDate, formatDateRange, formatDeliveryPeriodDate, formatDeliveryPeriodRange } from './utils'

export interface OrderFilterState {
  dateFrom: string
  dateTo: string
  deliveryPeriodFrom: string
  deliveryPeriodTo: string
  items: string[]
  parties: string[]
  brokers: string[]
  spots: string[]
  /** SO only — show orders with no linked PO. */
  unlinkedOnly: boolean
}

export const emptyOrderFilters: OrderFilterState = {
  dateFrom: '',
  dateTo: '',
  deliveryPeriodFrom: '',
  deliveryPeriodTo: '',
  items: [],
  parties: [],
  brokers: [],
  spots: [],
  unlinkedOnly: false,
}

export function hasActiveOrderFilters(filters: OrderFilterState, search = '') {
  return Boolean(
    search
    || filters.dateFrom
    || filters.dateTo
    || filters.deliveryPeriodFrom
    || filters.deliveryPeriodTo
    || filters.items.length
    || filters.parties.length
    || filters.brokers.length
    || filters.spots.length
    || filters.unlinkedOnly,
  )
}

export function filterOrdersByDate<T extends { date: string }>(
  items: T[],
  dateFrom: string,
  dateTo: string,
): T[] {
  if (!dateFrom && !dateTo) return items
  return items.filter(item => {
    const d = item.date.slice(0, 10)
    if (dateFrom && d < dateFrom) return false
    if (dateTo && d > dateTo) return false
    return true
  })
}

export function filterByDeliveryPeriod<T extends {
  deliveryPeriodStart: string
  deliveryPeriodEnd: string
}>(
  items: T[],
  periodFrom: string,
  periodTo: string,
): T[] {
  if (!periodFrom && !periodTo) return items
  return items.filter(item => {
    const start = item.deliveryPeriodStart.slice(0, 10)
    const end = item.deliveryPeriodEnd.slice(0, 10)
    if (periodFrom && end < periodFrom) return false
    if (periodTo && start > periodTo) return false
    return true
  })
}

export function applyOrderFilters<T extends {
  date: string
  deliveryPeriodStart: string
  deliveryPeriodEnd: string
  ref: string
  partyName: string
  itemName: string
  spot: string
  brokerName: string
  poRef?: string
}>(
  items: T[],
  filters: OrderFilterState,
  search: string,
): T[] {
  let result = filterOrdersByDate(items, filters.dateFrom, filters.dateTo)
  result = filterByDeliveryPeriod(result, filters.deliveryPeriodFrom, filters.deliveryPeriodTo)

  if (filters.items.length) {
    result = result.filter(o => filters.items.includes(o.itemName))
  }
  if (filters.parties.length) {
    result = result.filter(o => filters.parties.some(p => partyMatches(o.partyName, p)))
  }
  if (filters.brokers.length) {
    result = result.filter(o => filters.brokers.some(b => partyMatches(o.brokerName, b)))
  }
  if (filters.spots.length) {
    result = result.filter(o => filters.spots.includes(o.spot))
  }
  if (filters.unlinkedOnly) {
    result = result.filter(o => !(o.poRef || '').trim())
  }

  if (search) {
    const q = search.toLowerCase()
    result = result.filter(o =>
      o.ref.toLowerCase().includes(q)
      || o.partyName.toLowerCase().includes(q)
      || o.itemName.toLowerCase().includes(q)
      || o.spot.toLowerCase().includes(q)
      || o.brokerName.toLowerCase().includes(q)
      || (o.poRef || '').toLowerCase().includes(q),
    )
  }

  return result
}

export function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

export function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function formatDeliveryPeriodFilterLabel(dateFrom: string, dateTo: string): string {
  if (!dateFrom && !dateTo) return ''
  if (dateFrom && dateTo) return formatDeliveryPeriodRange(dateFrom, dateTo)
  if (dateFrom) return `From ${formatDeliveryPeriodDate(dateFrom)}`
  return `Until ${formatDeliveryPeriodDate(dateTo)}`
}

export function formatDateFilterLabel(dateFrom: string, dateTo: string): string {
  if (!dateFrom && !dateTo) return ''
  if (dateFrom && dateTo) return formatDateRange(dateFrom, dateTo)
  if (dateFrom) return `From ${formatDate(dateFrom)}`
  return `Until ${formatDate(dateTo)}`
}

export interface AppliedFilterChip {
  id: string
  prefix: string
  value: string
}

export function getAppliedFilterChips(
  filters: OrderFilterState,
  partyLabel: string,
  search: string,
): AppliedFilterChip[] {
  const chips: AppliedFilterChip[] = []
  const createdLabel = formatDateFilterLabel(filters.dateFrom, filters.dateTo)
  if (createdLabel) chips.push({ id: 'date', prefix: 'Created', value: createdLabel })
  const deliveryLabel = formatDeliveryPeriodFilterLabel(filters.deliveryPeriodFrom, filters.deliveryPeriodTo)
  if (deliveryLabel) chips.push({ id: 'deliveryPeriod', prefix: 'Delivery period', value: deliveryLabel })
  for (const item of filters.items) chips.push({ id: `items:${item}`, prefix: 'Item', value: item })
  for (const party of filters.parties) chips.push({ id: `parties:${party}`, prefix: partyLabel, value: party })
  for (const broker of filters.brokers) chips.push({ id: `brokers:${broker}`, prefix: 'Broker', value: broker })
  for (const spot of filters.spots) chips.push({ id: `spots:${spot}`, prefix: 'Spot', value: spot })
  if (filters.unlinkedOnly) chips.push({ id: 'unlinkedOnly', prefix: 'Link', value: 'Unlinked only' })
  if (search.trim()) chips.push({ id: 'search', prefix: 'Search', value: search.trim() })
  return chips
}

export function clearFilterField(
  filters: OrderFilterState,
  id: string,
): OrderFilterState {
  if (id === 'date') return { ...filters, dateFrom: '', dateTo: '' }
  if (id === 'deliveryPeriod') return { ...filters, deliveryPeriodFrom: '', deliveryPeriodTo: '' }
  if (id === 'unlinkedOnly') return { ...filters, unlinkedOnly: false }

  const multiMatch = id.match(/^(items|parties|brokers|spots):(.+)$/)
  if (multiMatch) {
    const field = multiMatch[1] as keyof Pick<OrderFilterState, 'items' | 'parties' | 'brokers' | 'spots'>
    const value = multiMatch[2]
    return { ...filters, [field]: filters[field].filter(v => v !== value) }
  }

  return filters
}

export type DatePreset = 'last3days' | 'last1month'

export function dateRangeForPreset(preset: DatePreset): Pick<OrderFilterState, 'dateFrom' | 'dateTo'> {
  const today = new Date()
  const end = formatDateInput(today)

  if (preset === 'last3days') {
    const from = new Date(today)
    from.setDate(from.getDate() - 2)
    return { dateFrom: formatDateInput(from), dateTo: end }
  }

  const from = new Date(today)
  from.setMonth(from.getMonth() - 1)
  return { dateFrom: formatDateInput(from), dateTo: end }
}
