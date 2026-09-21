import { storageGet, storageSet } from './storage'
import { compareSemver } from './releaseVersion'
import { normalizeDateToIso } from './utils'

export type SortDirection = 'asc' | 'desc'

export interface SortState {
  key: string
  direction: SortDirection
}

export function loadRegisterSort(registerId: string, defaultKey: string): SortState {
  try {
    const raw = storageGet(`tradeal-sort-${registerId}`)
    if (!raw) return { key: defaultKey, direction: 'desc' }
    return JSON.parse(raw) as SortState
  } catch {
    return { key: defaultKey, direction: 'desc' }
  }
}

export function saveRegisterSort(registerId: string, sort: SortState) {
  try {
    storageSet(`tradeal-sort-${registerId}`, JSON.stringify(sort))
  } catch {
    // ignore
  }
}

export function toggleSort(current: SortState, key: string): SortState {
  if (current.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
  }
  return { key, direction: 'desc' }
}

function parseRefSortValue(value: string) {
  const match = value.match(/^(.*?)(\d+)$/)
  if (!match) return { prefix: value, num: 0 }
  return { prefix: match[1], num: parseInt(match[2], 10) }
}

function compareRefLabels(a: string, b: string) {
  const left = parseRefSortValue(a)
  const right = parseRefSortValue(b)
  if (left.prefix === right.prefix) return left.num - right.num
  return left.prefix.localeCompare(right.prefix)
}

const DATE_SORT_KEYS = /^(date|purchaseDate|deliveredAt|created_at|updated_at|published_at|purchase_date|payment_date|end_date|lastOrder|deliveryPeriod|deliveryPeriodStart|deliveryPeriodEnd)$/i

function isDateSortKey(key: string): boolean {
  return DATE_SORT_KEYS.test(key) || /(?:^|_)(date|at)$/i.test(key)
}

function dateSortToken(value: string | number): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return normalizeDateToIso(value) || String(value)
  }
  const text = String(value ?? '').trim()
  if (!text) return ''
  return normalizeDateToIso(text) || text.slice(0, 10)
}

function compareDateValues(av: string | number, bv: string | number, dir: number) {
  const as = dateSortToken(av)
  const bs = dateSortToken(bv)
  if (!as && !bs) return 0
  // Empty dates always last, regardless of direction
  if (!as) return 1
  if (!bs) return -1
  return as.localeCompare(bs) * dir
}

function compareSortValues(
  av: string | number,
  bv: string | number,
  key: string,
  dir: number,
) {
  if (typeof av === 'number' && typeof bv === 'number') {
    if (Number.isNaN(av) && Number.isNaN(bv)) return 0
    if (Number.isNaN(av)) return 1
    if (Number.isNaN(bv)) return -1
    return (av - bv) * dir
  }

  const as = String(av ?? '')
  const bs = String(bv ?? '')

  if (isDateSortKey(key)) {
    return compareDateValues(av, bv, dir)
  }

  if (key === 'ref' || key === 'poRef' || key === 'lotNumber' || key === 'liftRef') {
    return compareRefLabels(as, bs) * dir
  }
  if (key === 'version') {
    return compareSemver(as, bs) * dir
  }

  // Prefer numeric compare when both sides are plain numbers (e.g. qty stored as string)
  const an = Number(as.replace(/,/g, ''))
  const bn = Number(bs.replace(/,/g, ''))
  if (
    as.trim() !== ''
    && bs.trim() !== ''
    && Number.isFinite(an)
    && Number.isFinite(bn)
    && /^-?\d+(\.\d+)?$/.test(as.trim())
    && /^-?\d+(\.\d+)?$/.test(bs.trim())
  ) {
    return (an - bn) * dir
  }

  return as.localeCompare(bs, undefined, { sensitivity: 'base', numeric: true }) * dir
}

export function sortRows<T>(rows: T[], sort: SortState, getValue: (row: T, key: string) => string | number): T[] {
  const sorted = [...rows]
  const dir = sort.direction === 'asc' ? 1 : -1
  sorted.sort((a, b) => compareSortValues(getValue(a, sort.key), getValue(b, sort.key), sort.key, dir))
  return sorted
}
