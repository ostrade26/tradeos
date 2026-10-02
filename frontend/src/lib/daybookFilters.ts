import { partyMatches } from './assistant/partyMatch'
import { uniqueSorted } from './orderFilters'
import type { DaybookEntry } from './daybook'

export interface DaybookFilterState {
  items: string[]
  /** Org daybook — matches buyer or seller. */
  parties: string[]
  /** Broker daybook. */
  buyers: string[]
  sellers: string[]
  brokers: string[]
  spots: string[]
  rates: string[]
}

export const emptyDaybookFilters: DaybookFilterState = {
  items: [],
  parties: [],
  buyers: [],
  sellers: [],
  brokers: [],
  spots: [],
  rates: [],
}

export function hasActiveDaybookFilters(filters: DaybookFilterState, search = '') {
  return Boolean(
    search.trim()
    || filters.items.length
    || filters.parties.length
    || filters.buyers.length
    || filters.sellers.length
    || filters.brokers.length
    || filters.spots.length
    || filters.rates.length,
  )
}

export function applyDaybookFilters(
  entries: DaybookEntry[],
  filters: DaybookFilterState,
  search: string,
  mode: 'org' | 'broker',
): DaybookEntry[] {
  let result = entries

  if (filters.items.length) {
    result = result.filter(e => e.itemName && filters.items.includes(e.itemName))
  }
  if (mode === 'org' && filters.parties.length) {
    result = result.filter(e =>
      filters.parties.some(p =>
        partyMatches(e.buyerName ?? '', p)
        || partyMatches(e.sellerName ?? '', p)
        || partyMatches(e.partyName ?? '', p),
      ),
    )
  }
  if (mode === 'broker' && filters.buyers.length) {
    result = result.filter(e =>
      filters.buyers.some(b => partyMatches(e.buyerName ?? '', b)),
    )
  }
  if (mode === 'broker' && filters.sellers.length) {
    result = result.filter(e =>
      filters.sellers.some(s => partyMatches(e.sellerName ?? '', s)),
    )
  }
  if (filters.brokers.length) {
    result = result.filter(e =>
      filters.brokers.some(b => partyMatches(e.brokerName ?? '', b)),
    )
  }
  if (filters.spots.length) {
    result = result.filter(e => e.spot && filters.spots.includes(e.spot))
  }
  if (filters.rates.length) {
    result = result.filter(e => e.rateLabel && filters.rates.includes(e.rateLabel))
  }

  const q = search.trim().toLowerCase()
  if (q) {
    result = result.filter(e =>
      e.title.toLowerCase().includes(q)
      || e.detail.toLowerCase().includes(q)
      || (e.itemName || '').toLowerCase().includes(q)
      || (e.buyerName || '').toLowerCase().includes(q)
      || (e.sellerName || '').toLowerCase().includes(q)
      || (e.brokerName || '').toLowerCase().includes(q)
      || (e.partyName || '').toLowerCase().includes(q)
      || (e.spot || '').toLowerCase().includes(q),
    )
  }

  return result
}

export function daybookFilterOptions(entries: DaybookEntry[], mode: 'org' | 'broker') {
  return {
    items: uniqueSorted(entries.map(e => e.itemName || '')),
    parties: uniqueSorted(entries.flatMap(e => [e.buyerName, e.sellerName, e.partyName].filter(Boolean) as string[])),
    buyers: uniqueSorted(entries.map(e => e.buyerName || '')),
    sellers: uniqueSorted(entries.map(e => e.sellerName || '')),
    brokers: uniqueSorted(entries.map(e => e.brokerName || '')),
    spots: uniqueSorted(entries.map(e => e.spot || '')),
    rates: uniqueSorted(entries.map(e => e.rateLabel || '')),
    mode,
  }
}

export function clearDaybookFilterField(filters: DaybookFilterState, chipId: string): DaybookFilterState {
  if (chipId === 'search') return filters
  const [field, value] = chipId.split(':')
  if (!value) return filters
  const key = field as keyof DaybookFilterState
  if (Array.isArray(filters[key])) {
    return { ...filters, [key]: (filters[key] as string[]).filter(v => v !== value) }
  }
  return filters
}

export function daybookFilterChips(filters: DaybookFilterState, partyLabel: string, search: string) {
  const chips: { id: string; prefix: string; value: string }[] = []
  for (const item of filters.items) chips.push({ id: `items:${item}`, prefix: 'Item', value: item })
  for (const party of filters.parties) chips.push({ id: `parties:${party}`, prefix: partyLabel, value: party })
  for (const buyer of filters.buyers) chips.push({ id: `buyers:${buyer}`, prefix: 'Buyer', value: buyer })
  for (const seller of filters.sellers) chips.push({ id: `sellers:${seller}`, prefix: 'Seller', value: seller })
  for (const broker of filters.brokers) chips.push({ id: `brokers:${broker}`, prefix: 'Broker', value: broker })
  for (const spot of filters.spots) chips.push({ id: `spots:${spot}`, prefix: 'Spot', value: spot })
  for (const rate of filters.rates) chips.push({ id: `rates:${rate}`, prefix: 'Rate', value: rate })
  if (search.trim()) chips.push({ id: 'search', prefix: 'Search', value: search.trim() })
  return chips
}
