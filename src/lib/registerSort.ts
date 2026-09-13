import { storageGet, storageSet } from './storage'

export type SortDirection = 'asc' | 'desc'

export interface SortState {
  key: string
  direction: SortDirection
}

export function loadRegisterSort(registerId: string, defaultKey: string): SortState {
  try {
    const raw = storageGet(`tradeos-sort-${registerId}`)
    if (!raw) return { key: defaultKey, direction: 'desc' }
    return JSON.parse(raw) as SortState
  } catch {
    return { key: defaultKey, direction: 'desc' }
  }
}

export function saveRegisterSort(registerId: string, sort: SortState) {
  try {
    storageSet(`tradeos-sort-${registerId}`, JSON.stringify(sort))
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

function compareSortValues(
  av: string | number,
  bv: string | number,
  key: string,
  dir: number,
) {
  if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir

  const as = String(av)
  const bs = String(bv)
  if (key === 'ref' || key === 'poRef' || key === 'lotNumber' || key === 'liftRef') {
    return compareRefLabels(as, bs) * dir
  }
  return as.localeCompare(bs) * dir
}

export function sortRows<T>(rows: T[], sort: SortState, getValue: (row: T, key: string) => string | number): T[] {
  const sorted = [...rows]
  const dir = sort.direction === 'asc' ? 1 : -1
  sorted.sort((a, b) => compareSortValues(getValue(a, sort.key), getValue(b, sort.key), sort.key, dir))
  return sorted
}
