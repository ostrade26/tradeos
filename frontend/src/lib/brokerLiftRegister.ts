import type { BrokerContractLiftTanker, BrokerContractShare } from '../api/organisationApi'
import { partyMatches } from './assistant/partyMatch'
import { formatIndianAmount, parseIndianAmount } from './indianAmount'
import { filterOrdersByDate, uniqueSorted } from './orderFilters'
import { liftRefSearchText, orderRefSearchText } from './tradeRefs'
import type { LiftFilterState } from './liftFilters'

export interface BrokerLiftRow {
  id: string
  brokerLiftRef: number
  partyLiftRef: number
  status: 'pending' | 'delivered'
  date: string
  deliveredAt: string
  itemName: string
  buyerName: string
  sellerName: string
  partyRole: string
  partyName: string
  rateLabel: string
  rateSort: number
  qty: number
  balance: number
  contractRef: string
  shareId: number
  orderRef: string
  spot: string
  delivery: string
  tankers: BrokerContractLiftTanker[]
  unread: boolean
  brokerCompleted: boolean
}

export function brokerLiftRows(shares: BrokerContractShare[]): BrokerLiftRow[] {
  const rows: BrokerLiftRow[] = []
  for (const share of shares) {
    if ((share.deleted_at || '').trim()) continue
    const { delivery, spot } = splitDelivery(share.delivery_period)
    const rateSort = parseIndianAmount(share.rate)
    const rateLabel = rateSort ? formatIndianAmount(rateSort) : ''
    for (const event of share.lift_events ?? []) {
      const brokerLiftRef = Number(event.broker_lift_ref) || 0
      if (!brokerLiftRef) continue
      rows.push({
        id: String(event.id),
        brokerLiftRef,
        partyLiftRef: Number(event.lift_ref) || 0,
        status: event.status === 'delivered' ? 'delivered' : 'pending',
        date: (event.event_at || event.updated_at || '').slice(0, 10),
        deliveredAt: (event.delivered_at || '').slice(0, 10),
        itemName: share.item_name || '',
        buyerName: share.buyer_name,
        sellerName: share.seller_name,
        partyRole: event.party_role,
        partyName: event.party_name,
        rateLabel,
        rateSort,
        qty: Number(event.qty_mt) || 0,
        balance: Number(event.short_qty_mt) || 0,
        contractRef: share.contract_ref,
        shareId: share.id,
        orderRef: event.order_ref,
        spot,
        delivery,
        tankers: event.tankers ?? [],
        unread: event.unread !== false && !(event.broker_read_at || '').trim(),
        brokerCompleted: Boolean(event.broker_completed || (event.broker_completed_at || '').trim()),
      })
    }
  }
  return rows
}

function splitDelivery(period: string): { delivery: string; spot: string } {
  const parts = period.split(' · ').map(part => part.trim()).filter(Boolean)
  if (parts.length === 0) return { delivery: '', spot: '' }
  const [first, ...rest] = parts
  if (/^ready$/i.test(first)) return { delivery: 'Ready', spot: rest.join(' · ') }
  return { delivery: first, spot: rest.join(' · ') }
}

export function brokerLiftFilterOptions(rows: BrokerLiftRow[]) {
  return {
    items: uniqueSorted(rows.map(row => row.itemName).filter(Boolean)),
    parties: uniqueSorted(rows.flatMap(row => [row.buyerName, row.sellerName]).filter(Boolean)),
    spots: uniqueSorted(rows.map(row => row.spot).filter(Boolean)),
    rates: uniqueSorted(rows.map(row => row.rateLabel).filter(Boolean)),
    contracts: uniqueSorted(rows.map(row => row.contractRef).filter(Boolean)),
  }
}

export function applyBrokerLiftFilters(rows: BrokerLiftRow[], filters: LiftFilterState, search: string): BrokerLiftRow[] {
  let result = filterOrdersByDate(rows, filters.dateFrom, filters.dateTo)
  if (filters.items.length) result = result.filter(row => filters.items.includes(row.itemName))
  if (filters.parties.length) {
    result = result.filter(row =>
      filters.parties.some(party => partyMatches(row.buyerName, party) || partyMatches(row.sellerName, party)),
    )
  }
  if (filters.spots.length) result = result.filter(row => filters.spots.includes(row.spot))
  if (filters.rates.length) result = result.filter(row => filters.rates.includes(row.rateLabel))
  if (filters.contracts.length) result = result.filter(row => filters.contracts.includes(row.contractRef))
  const query = search.trim().toLowerCase()
  if (!query) return result
  return result.filter(row => {
    const tankers = row.tankers.some(tanker =>
      tanker.tanker_no.toLowerCase().includes(query)
      || tanker.lr_no.toLowerCase().includes(query)
      || tanker.transport_name.toLowerCase().includes(query)
      || tanker.driver_mobile.includes(query)
      || tanker.sales_invoice_no.toLowerCase().includes(query)
      || tanker.po_invoice_no.toLowerCase().includes(query),
    )
    return (
      liftRefSearchText(row.brokerLiftRef).includes(query)
      || row.contractRef.toLowerCase().includes(query)
      || row.buyerName.toLowerCase().includes(query)
      || row.sellerName.toLowerCase().includes(query)
      || row.itemName.toLowerCase().includes(query)
      || row.partyName.toLowerCase().includes(query)
      || orderRefSearchText(row.orderRef, row.partyRole === 'buyer' ? 'purchase' : 'sale').includes(query)
      || tankers
    )
  })
}

/** Broker "Completed" tab — only after the broker marks the lift, not when the party delivers. */
export function brokerLiftIsComplete(row: Pick<BrokerLiftRow, 'brokerCompleted'>): boolean {
  return row.brokerCompleted
}

export function salesInvoiceLabel(row: Pick<BrokerLiftRow, 'tankers'>): string {
  const invoices = row.tankers.map(tanker => tanker.sales_invoice_no.trim()).filter(Boolean)
  return invoices.length ? invoices.join(', ') : '—'
}
