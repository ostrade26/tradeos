import type {
  Broker,
  Producer,
  Retailer,
  TradeData,
  TradeOrder,
} from '../data/mockData'
import { randomUUID } from './randomId'

const SKIP_BROKER = /^(direct|na|n\/a|-|—|none)$/i

function splitPartyLabel(raw: string): { name: string; location: string } {
  const parts = raw.split(',').map(p => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return { name: parts[0]!, location: parts[parts.length - 1]! }
  }
  return { name: raw.trim(), location: '' }
}

function nameKey(name: string): string {
  return name.trim().toLowerCase()
}

function upsertProducts(existing: string[] | undefined, itemName: string): string[] {
  const list = [...(existing ?? [])]
  const item = itemName.trim()
  if (!item) return list
  if (!list.some(p => p.toLowerCase() === item.toLowerCase())) list.push(item)
  return list
}

/**
 * Create directory brokers / producers / retailers from imported orders
 * when the spreadsheet did not include directory sheets.
 */
export function ensureDirectoryFromOrders(data: TradeData): TradeData {
  const brokers = [...(data.brokers ?? [])]
  const producers = [...(data.producers ?? [])]
  const retailers = [...(data.retailers ?? [])]
  const items = new Set((data.items ?? []).map(i => i.trim()).filter(Boolean))
  const spots = new Set((data.spots ?? []).map(s => s.trim()).filter(Boolean))

  const brokerByName = new Map(brokers.map(b => [nameKey(b.name), b]))
  const producerByName = new Map(producers.map(p => [nameKey(p.name), p]))
  const retailerByName = new Map(retailers.map(r => [nameKey(r.name), r]))

  const touchBroker = (raw: string) => {
    const label = raw.trim()
    if (!label || SKIP_BROKER.test(label)) return
    const { name } = splitPartyLabel(label)
    if (!name || SKIP_BROKER.test(name)) return
    const key = nameKey(name)
    const existing = brokerByName.get(key)
    if (existing) {
      existing.contracts = (existing.contracts ?? 0) + 1
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
    const key = nameKey(name)
    const existing = producerByName.get(key)
    if (existing) {
      existing.contracts = (existing.contracts ?? 0) + 1
      existing.products = upsertProducts(existing.products, order.itemName)
      if (!existing.location && (location || order.spot)) {
        existing.location = location || order.spot
      }
      return
    }
    const producer: Producer = {
      id: randomUUID(),
      name,
      location: location || order.spot || '',
      city: location || undefined,
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
    const key = nameKey(name)
    const existing = retailerByName.get(key)
    const purchase = order.orderQty * order.rate
    if (existing) {
      existing.totalPurchases = (existing.totalPurchases ?? 0) + purchase
      existing.products = upsertProducts(existing.products, order.itemName)
      existing.lastOrder = order.date || existing.lastOrder
      if (!existing.location && (location || order.spot)) {
        existing.location = location || order.spot
      }
      return
    }
    const retailer: Retailer = {
      id: randomUUID(),
      name,
      location: location || order.spot || '',
      city: location || undefined,
      products: order.itemName ? [order.itemName] : [],
      totalPurchases: purchase,
      outstanding: 0,
      lastOrder: order.date || '',
    }
    retailers.push(retailer)
    retailerByName.set(key, retailer)
  }

  for (const order of data.tradeOrders ?? []) {
    if (order.itemName?.trim()) items.add(order.itemName.trim())
    if (order.spot?.trim()) spots.add(order.spot.trim())
    touchBroker(order.brokerName || '')
    if (order.side === 'purchase') touchProducer(order)
    else touchRetailer(order)
  }

  return {
    ...data,
    brokers,
    producers,
    retailers,
    items: [...items].sort((a, b) => a.localeCompare(b)),
    spots: [...spots].sort((a, b) => a.localeCompare(b)),
  }
}
