import type { TradeData } from '../api/tradeApi'
import type {
  Broker,
  Producer,
  Retailer,
  TradeOrder,
} from '../data/mockData'
import { normalizeCompanyName, prepareNameForMatching } from './companyResolution'
import { randomUUID } from './randomId'

const SKIP_BROKER = /^(direct|na|n\/a|-|—|none)$/i

/** Split "Company, City, State" → name + full location (all parts after the company). */
export function splitPartyLabel(raw: string): { name: string; location: string } {
  const parts = raw.split(',').map(p => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return {
      name: prepareNameForMatching(parts[0]!) || parts[0]!,
      location: parts.slice(1).join(', '),
    }
  }
  const prepared = prepareNameForMatching(raw)
  return { name: prepared || raw.trim(), location: '' }
}

function directoryKey(name: string): string {
  return normalizeCompanyName(name)
}

function preferDisplayName(a: string, b: string): string {
  const aComma = a.includes(',')
  const bComma = b.includes(',')
  if (aComma !== bComma) return aComma ? b : a
  return a.trim().length >= b.trim().length ? a.trim() : b.trim()
}

/** Prefer the fuller place string (city + state over state alone). */
function preferLocation(a?: string, b?: string): string {
  const left = (a ?? '').trim()
  const right = (b ?? '').trim()
  if (!left) return right
  if (!right) return left
  const l = left.toLowerCase()
  const r = right.toLowerCase()
  if (l.includes(r) && l !== r) return left
  if (r.includes(l) && r !== l) return right
  const leftParts = left.split(',').filter(Boolean).length
  const rightParts = right.split(',').filter(Boolean).length
  if (leftParts !== rightParts) return leftParts > rightParts ? left : right
  return left.length >= right.length ? left : right
}

function applyPartyLocation(
  party: { location?: string; city?: string },
  location?: string,
) {
  const next = preferLocation(party.city || party.location, location)
  if (!next) return
  party.location = next
  party.city = next
}

function upsertProducts(existing: string[] | undefined, itemName: string): string[] {
  const list = [...(existing ?? [])]
  const item = itemName.trim()
  if (!item) return list
  if (!list.some(p => p.toLowerCase() === item.toLowerCase())) list.push(item)
  return list
}

function mergeProducts(a: string[] | undefined, b: string[] | undefined): string[] {
  let list = [...(a ?? [])]
  for (const item of b ?? []) list = upsertProducts(list, item)
  return list
}

function pickNonEmpty(a?: string, b?: string): string {
  const left = (a ?? '').trim()
  if (left) return left
  return (b ?? '').trim()
}

function mergeBroker(a: Broker, b: Broker): Broker {
  return {
    ...a,
    name: preferDisplayName(a.name, b.name),
    email: pickNonEmpty(a.email, b.email),
    phone: pickNonEmpty(a.phone, b.phone),
    contracts: (a.contracts ?? 0) + (b.contracts ?? 0),
    commissionEarned: (a.commissionEarned ?? 0) + (b.commissionEarned ?? 0),
    successRate: Math.max(a.successRate ?? 0, b.successRate ?? 0),
    network: Math.max(a.network ?? 0, b.network ?? 0),
    purchaseBrokerage: a.purchaseBrokerage ?? b.purchaseBrokerage,
    saleBrokerage: a.saleBrokerage ?? b.saleBrokerage,
    itemBrokerages: a.itemBrokerages ?? b.itemBrokerages,
  }
}

function mergeProducer(a: Producer, b: Producer): Producer {
  const location = preferLocation(a.city || a.location, b.city || b.location)
  return {
    ...a,
    name: preferDisplayName(a.name, b.name),
    location,
    city: location || undefined,
    products: mergeProducts(a.products, b.products),
    contracts: (a.contracts ?? 0) + (b.contracts ?? 0),
    avgRate: a.avgRate || b.avgRate || 0,
    rating: Math.max(a.rating ?? 0, b.rating ?? 0),
    code: pickNonEmpty(a.code, b.code) || undefined,
    phone: pickNonEmpty(a.phone, b.phone) || undefined,
    email: pickNonEmpty(a.email, b.email) || undefined,
    gst: pickNonEmpty(a.gst, b.gst) || undefined,
  }
}

function mergeRetailer(a: Retailer, b: Retailer): Retailer {
  const location = preferLocation(a.city || a.location, b.city || b.location)
  return {
    ...a,
    name: preferDisplayName(a.name, b.name),
    location,
    city: location || undefined,
    products: mergeProducts(a.products, b.products),
    totalPurchases: (a.totalPurchases ?? 0) + (b.totalPurchases ?? 0),
    outstanding: (a.outstanding ?? 0) + (b.outstanding ?? 0),
    lastOrder: (a.lastOrder || '') >= (b.lastOrder || '') ? a.lastOrder : b.lastOrder,
    code: pickNonEmpty(a.code, b.code) || undefined,
    phone: pickNonEmpty(a.phone, b.phone) || undefined,
    email: pickNonEmpty(a.email, b.email) || undefined,
    gst: pickNonEmpty(a.gst, b.gst) || undefined,
  }
}

function dedupeByName<T extends { name: string }>(
  rows: T[],
  merge: (a: T, b: T) => T,
): T[] {
  const byKey = new Map<string, T>()
  for (const row of rows) {
    const key = directoryKey(row.name)
    if (!key) continue
    const existing = byKey.get(key)
    byKey.set(key, existing ? merge(existing, row) : row)
  }
  return [...byKey.values()]
}

/** Merge near-identical directory rows (case, punctuation, legal suffix, location tail). */
export function dedupeDirectory(data: TradeData): TradeData {
  return {
    ...data,
    brokers: dedupeByName(data.brokers ?? [], mergeBroker),
    producers: dedupeByName(data.producers ?? [], mergeProducer),
    retailers: dedupeByName(data.retailers ?? [], mergeRetailer),
  }
}

/**
 * Upgrade truncated party city/location from order labels
 * (e.g. "Maharashtra" → "Chipri, Maharashtra") without changing counts.
 */
export function refreshPartyLocationsFromOrders(data: TradeData): TradeData {
  const producers = (data.producers ?? []).map(p => ({ ...p }))
  const retailers = (data.retailers ?? []).map(r => ({ ...r }))
  const producerByName = new Map(producers.map(p => [directoryKey(p.name), p]))
  const retailerByName = new Map(retailers.map(r => [directoryKey(r.name), r]))

  for (const order of data.tradeOrders ?? []) {
    if (order.side === 'purchase') {
      const raw = (order.sellerName || order.partyName || '').trim()
      if (!raw) continue
      const { name, location } = splitPartyLabel(raw)
      const existing = producerByName.get(directoryKey(name))
      if (existing) applyPartyLocation(existing, location || order.spot)
    } else {
      const raw = (order.buyerName || order.partyName || '').trim()
      if (!raw) continue
      const { name, location } = splitPartyLabel(raw)
      const existing = retailerByName.get(directoryKey(name))
      if (existing) applyPartyLocation(existing, location || order.spot)
    }
  }

  return { ...data, producers, retailers }
}

/**
 * Create directory brokers / producers / retailers from imported orders
 * when the spreadsheet did not include directory sheets.
 */
export function ensureDirectoryFromOrders(data: TradeData): TradeData {
  const seeded = refreshPartyLocationsFromOrders(dedupeDirectory(data))
  const brokers = [...(seeded.brokers ?? [])]
  const producers = [...(seeded.producers ?? [])]
  const retailers = [...(seeded.retailers ?? [])]
  const items = new Set((seeded.items ?? []).map((i: string) => i.trim()).filter(Boolean))
  const spots = new Set((seeded.spots ?? []).map((s: string) => s.trim()).filter(Boolean))

  const brokerByName = new Map(brokers.map(b => [directoryKey(b.name), b]))
  const producerByName = new Map(producers.map(p => [directoryKey(p.name), p]))
  const retailerByName = new Map(retailers.map(r => [directoryKey(r.name), r]))

  const touchBroker = (raw: string) => {
    const label = raw.trim()
    if (!label || SKIP_BROKER.test(label)) return
    const { name } = splitPartyLabel(label)
    if (!name || SKIP_BROKER.test(name)) return
    const key = directoryKey(name)
    if (!key) return
    const existing = brokerByName.get(key)
    if (existing) {
      existing.contracts = (existing.contracts ?? 0) + 1
      existing.name = preferDisplayName(existing.name, name)
      return
    }
    const broker: Broker = {
      id: randomUUID(),
      name,
      email: '',
      phone: '',
      contracts: 1,
      commissionEarned: 0,
      successRate: 0,
      network: 0,
    }
    brokers.push(broker)
    brokerByName.set(key, broker)
  }

  const touchProducer = (order: TradeOrder) => {
    const raw = (order.sellerName || order.partyName || '').trim()
    if (!raw) return
    const { name, location } = splitPartyLabel(raw)
    if (!name) return
    const key = directoryKey(name)
    if (!key) return
    const existing = producerByName.get(key)
    if (existing) {
      existing.contracts = (existing.contracts ?? 0) + 1
      existing.products = upsertProducts(existing.products, order.itemName)
      existing.name = preferDisplayName(existing.name, name)
      applyPartyLocation(existing, location || order.spot)
      return
    }
    const loc = location || order.spot || ''
    const producer: Producer = {
      id: randomUUID(),
      name,
      location: loc,
      city: loc || undefined,
      products: order.itemName ? [order.itemName] : [],
      contracts: 1,
      avgRate: order.rate || 0,
      rating: 0,
    }
    producers.push(producer)
    producerByName.set(key, producer)
  }

  const touchRetailer = (order: TradeOrder) => {
    const raw = (order.buyerName || order.partyName || '').trim()
    if (!raw) return
    const { name, location } = splitPartyLabel(raw)
    if (!name) return
    const key = directoryKey(name)
    if (!key) return
    const existing = retailerByName.get(key)
    const purchase = order.orderQty * order.rate
    if (existing) {
      existing.totalPurchases = (existing.totalPurchases ?? 0) + purchase
      existing.products = upsertProducts(existing.products, order.itemName)
      existing.lastOrder = order.date || existing.lastOrder
      existing.name = preferDisplayName(existing.name, name)
      applyPartyLocation(existing, location || order.spot)
      return
    }
    const loc = location || order.spot || ''
    const retailer: Retailer = {
      id: randomUUID(),
      name,
      location: loc,
      city: loc || undefined,
      products: order.itemName ? [order.itemName] : [],
      totalPurchases: purchase,
      outstanding: 0,
      lastOrder: order.date || '',
    }
    retailers.push(retailer)
    retailerByName.set(key, retailer)
  }

  for (const order of seeded.tradeOrders ?? []) {
    if (order.itemName?.trim()) items.add(order.itemName.trim())
    if (order.spot?.trim()) spots.add(order.spot.trim())
    touchBroker(order.brokerName || '')
    if (order.side === 'purchase') touchProducer(order)
    else touchRetailer(order)
  }

  return dedupeDirectory({
    ...seeded,
    brokers,
    producers,
    retailers,
    items: [...items].sort((a, b) => a.localeCompare(b)),
    spots: [...spots].sort((a, b) => a.localeCompare(b)),
  })
}
