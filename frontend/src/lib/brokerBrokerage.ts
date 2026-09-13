import type { Broker, BrokerageTerms, BrokerItemBrokerage, OrderSide } from '../data/mockData'
import { formatIndianAmount, parseIndianAmount } from './indianAmount'
import type { BrokerageInputType } from './orderForm'
import { randomUUID } from './randomId'

export function resolveBrokerageTerms(
  broker: Pick<Broker, 'purchaseBrokerage' | 'saleBrokerage' | 'itemBrokerages'>,
  side: OrderSide,
  itemName?: string,
): BrokerageTerms | undefined {
  const sideKey = side === 'purchase' ? 'purchase' : 'sale'
  const normalizedItem = itemName?.trim().toLowerCase()

  if (normalizedItem && broker.itemBrokerages?.length) {
    const itemMatch = broker.itemBrokerages.find(
      entry => entry.itemName.trim().toLowerCase() === normalizedItem,
    )
    const itemTerms = itemMatch?.[sideKey]
    if (itemTerms && itemTerms.value > 0) return itemTerms
  }

  const defaultTerms = sideKey === 'purchase' ? broker.purchaseBrokerage : broker.saleBrokerage
  if (defaultTerms && defaultTerms.value > 0) return defaultTerms
  return undefined
}

export function brokerageTermsToFormPatch(terms: BrokerageTerms): {
  brokerageType: BrokerageInputType
  brokeragePct: string
  brokeragePerTon: string
} {
  if (terms.mode === 'percent') {
    return {
      brokerageType: 'percent',
      brokeragePct: String(terms.value),
      brokeragePerTon: '',
    }
  }
  return {
    brokerageType: 'perTon',
    brokeragePct: '0',
    brokeragePerTon: formatIndianAmount(terms.value),
  }
}

export function formValueToBrokerageTerms(
  mode: BrokerageInputType,
  value: string,
): BrokerageTerms | undefined {
  const parsed = mode === 'perTon' ? parseIndianAmount(value) : parseFloat(value)
  if (!parsed || parsed <= 0) return undefined
  return { mode, value: parsed }
}

export function formatBrokerageTerms(terms?: BrokerageTerms): string {
  if (!terms || terms.value <= 0) return '—'
  if (terms.mode === 'percent') return `${terms.value}%`
  return `₹${formatIndianAmount(terms.value)}/MT`
}

export function brokerBrokerageSummary(broker: Broker): string {
  const parts = [
    broker.purchaseBrokerage ? `PO ${formatBrokerageTerms(broker.purchaseBrokerage)}` : '',
    broker.saleBrokerage ? `SO ${formatBrokerageTerms(broker.saleBrokerage)}` : '',
  ].filter(Boolean)
  const itemCount = broker.itemBrokerages?.length ?? 0
  if (parts.length === 0 && itemCount === 0) return '—'
  if (itemCount > 0) parts.push(`${itemCount} item${itemCount === 1 ? '' : 's'}`)
  return parts.join(' · ')
}

export interface BrokerItemBrokerageFormRow {
  key: string
  itemName: string
  purchaseMode: BrokerageInputType
  purchaseValue: string
  saleMode: BrokerageInputType
  saleValue: string
}

export function brokerToFormRows(broker: Broker): BrokerItemBrokerageFormRow[] {
  return (broker.itemBrokerages ?? []).map(entry => ({
    key: randomUUID(),
    itemName: entry.itemName,
    purchaseMode: entry.purchase?.mode ?? 'perTon',
    purchaseValue: entry.purchase
      ? entry.purchase.mode === 'percent'
        ? String(entry.purchase.value)
        : formatIndianAmount(entry.purchase.value)
      : '',
    saleMode: entry.sale?.mode ?? 'perTon',
    saleValue: entry.sale
      ? entry.sale.mode === 'percent'
        ? String(entry.sale.value)
        : formatIndianAmount(entry.sale.value)
      : '',
  }))
}

export function formRowsToItemBrokerages(rows: BrokerItemBrokerageFormRow[]): BrokerItemBrokerage[] {
  return rows
    .map(row => {
      const itemName = row.itemName.trim()
      if (!itemName) return null
      const purchase = formValueToBrokerageTerms(row.purchaseMode, row.purchaseValue)
      const sale = formValueToBrokerageTerms(row.saleMode, row.saleValue)
      if (!purchase && !sale) return null
      return { itemName, ...(purchase ? { purchase } : {}), ...(sale ? { sale } : {}) }
    })
    .filter((row): row is BrokerItemBrokerage => row != null)
}
