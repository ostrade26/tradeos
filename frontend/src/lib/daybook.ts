import type { BrokerContractShare } from '../api/organisationApi'
import type { BalanceSettlement, Lift, TradeOrder } from '../data/mockData'
import { formatIndianAmount, parseIndianAmount } from './indianAmount'
import { formatRateCell, orderLineAmount } from './orderRate'
import { formatLiftRef, formatPoRef, formatSoRef } from './tradeRefs'
import { roundQtyMt } from './utils'

export type DaybookCategory = 'orders' | 'lifts' | 'money' | 'contracts' | 'other'

export type DaybookEntryKind =
  | 'po_booked'
  | 'so_booked'
  | 'lift_recorded'
  | 'lift_delivered'
  | 'order_closed'
  | 'buy_back'
  | 'cash_settled'
  | 'carry_settled'
  | 'broker_contract_sent'
  | 'broker_contract_confirmed'
  | 'broker_contract_edited'
  | 'broker_contract_deleted'
  | 'broker_lift_recorded'
  | 'broker_lift_delivered'

export interface DaybookEntry {
  id: string
  kind: DaybookEntryKind
  category: DaybookCategory
  at: string
  title: string
  detail: string
  qtyMt?: number
  amount?: number
  href?: string
  itemName?: string
  buyerName?: string
  sellerName?: string
  /** Counterparty on orders (org PO/SO). */
  partyName?: string
  brokerName?: string
  spot?: string
  rateLabel?: string
  orderSide?: 'purchase' | 'sale'
}

function spotFromDeliveryPeriod(period: string): string {
  const parts = period.split(' · ').map(part => part.trim()).filter(Boolean)
  if (parts.length === 0) return ''
  const [first, ...rest] = parts
  if (/^ready$/i.test(first)) return rest.join(' · ')
  if (rest.length) return rest.join(' · ')
  return first
}

function rateLabelFromShare(rate: string): string {
  const parsed = parseIndianAmount(rate)
  return parsed ? formatIndianAmount(parsed) : ''
}

function orderDimensions(order: TradeOrder) {
  const buyerName = order.side === 'sale' ? order.partyName : ''
  const sellerName = order.side === 'purchase' ? order.partyName : ''
  return {
    itemName: order.itemName,
    buyerName,
    sellerName,
    partyName: order.partyName,
    brokerName: order.brokerName,
    spot: order.spot,
    rateLabel: formatRateCell(order.rate, order.rateBasis, order.ratePerBasis),
  }
}

function liftDimensions(lift: Lift) {
  return {
    itemName: lift.itemName,
    buyerName: lift.buyerName,
    sellerName: lift.sellerName,
    brokerName: '',
    spot: spotFromDeliveryPeriod(lift.deliveryPeriod),
    rateLabel: lift.rate != null ? formatRateCell(lift.rate) : '',
  }
}

function shareDimensions(share: BrokerContractShare) {
  return {
    itemName: share.item_name,
    buyerName: share.buyer_name,
    sellerName: share.seller_name,
    brokerName: share.sender_name,
    spot: spotFromDeliveryPeriod(share.delivery_period),
    rateLabel: rateLabelFromShare(share.rate),
  }
}

export interface DaybookSummary {
  poCount: number
  poQtyMt: number
  poValue: number
  soCount: number
  soQtyMt: number
  soValue: number
  liftsRecorded: number
  liftQtyRecordedMt: number
  liftsDelivered: number
  liftQtyDeliveredMt: number
  contractsSent: number
  contractQtyMt: number
  cashSettledAmount: number
  entries: number
}

export function isOnDay(isoOrDate: string | undefined | null, day: string): boolean {
  if (!isoOrDate || !day) return false
  return isoOrDate.slice(0, 10) === day
}

export type DaybookRegisterTab = 'contracts' | 'lifts' | 'po' | 'so'

/** Which register tab an entry belongs on (broker vs org). */
export function daybookEntryRegisterTab(entry: DaybookEntry, broker: boolean): DaybookRegisterTab {
  if (broker) {
    if (entry.kind === 'broker_lift_recorded' || entry.kind === 'broker_lift_delivered') {
      return 'lifts'
    }
    return 'contracts'
  }
  switch (entry.kind) {
    case 'so_booked':
      return 'so'
    case 'lift_recorded':
    case 'lift_delivered':
      return 'lifts'
    case 'po_booked':
    case 'buy_back':
      return 'po'
    case 'order_closed':
    case 'cash_settled':
    case 'carry_settled':
      return entry.orderSide === 'sale' ? 'so' : 'po'
    default:
      return 'po'
  }
}

function sortEntries(entries: DaybookEntry[]): DaybookEntry[] {
  return [...entries].sort((a, b) => b.at.localeCompare(a.at) || a.title.localeCompare(b.title))
}

export function summarizeDaybook(entries: DaybookEntry[]): DaybookSummary {
  let poCount = 0
  let poQtyMt = 0
  let poValue = 0
  let soCount = 0
  let soQtyMt = 0
  let soValue = 0
  let liftsRecorded = 0
  let liftQtyRecordedMt = 0
  let liftsDelivered = 0
  let liftQtyDeliveredMt = 0
  let contractsSent = 0
  let contractQtyMt = 0
  let cashSettledAmount = 0

  for (const entry of entries) {
    switch (entry.kind) {
      case 'po_booked':
        poCount += 1
        poQtyMt += entry.qtyMt ?? 0
        poValue += entry.amount ?? 0
        break
      case 'so_booked':
        soCount += 1
        soQtyMt += entry.qtyMt ?? 0
        soValue += entry.amount ?? 0
        break
      case 'lift_recorded':
      case 'broker_lift_recorded':
        liftsRecorded += 1
        liftQtyRecordedMt += entry.qtyMt ?? 0
        break
      case 'lift_delivered':
      case 'broker_lift_delivered':
        liftsDelivered += 1
        liftQtyDeliveredMt += entry.qtyMt ?? 0
        break
      case 'broker_contract_sent':
        contractsSent += 1
        contractQtyMt += entry.qtyMt ?? 0
        break
      case 'cash_settled':
        cashSettledAmount += entry.amount ?? 0
        break
      default:
        break
    }
  }

  return {
    poCount,
    poQtyMt: roundQtyMt(poQtyMt),
    poValue: roundQtyMt(poValue),
    soCount,
    soQtyMt: roundQtyMt(soQtyMt),
    soValue: roundQtyMt(soValue),
    liftsRecorded,
    liftQtyRecordedMt: roundQtyMt(liftQtyRecordedMt),
    liftsDelivered,
    liftQtyDeliveredMt: roundQtyMt(liftQtyDeliveredMt),
    contractsSent,
    contractQtyMt: roundQtyMt(contractQtyMt),
    cashSettledAmount: roundQtyMt(cashSettledAmount),
    entries: entries.length,
  }
}

export interface OrgDaybookInput {
  day: string
  orders: TradeOrder[]
  lifts: Lift[]
  settlements: BalanceSettlement[]
  pathPrefix: (path: string) => string
}

export function buildOrgDaybook(input: OrgDaybookInput): DaybookEntry[] {
  const { day, orders, lifts, settlements, pathPrefix } = input
  const entries: DaybookEntry[] = []

  for (const order of orders) {
    if (isOnDay(order.date, day)) {
      const isPo = order.side === 'purchase'
      entries.push({
        id: `${isPo ? 'po' : 'so'}-${order.id}`,
        kind: isPo ? 'po_booked' : 'so_booked',
        category: 'orders',
        at: order.date.length > 10 ? order.date : `${order.date}T12:00:00.000Z`,
        title: isPo ? `Purchase ${formatPoRef(order.ref)}` : `Sale ${formatSoRef(order.ref)}`,
        detail: [order.partyName, order.itemName, order.spot].filter(Boolean).join(' · '),
        qtyMt: order.orderQty,
        amount: orderLineAmount(order.orderQty, order.rate),
        href: pathPrefix(isPo ? `/purchase-orders?ref=${encodeURIComponent(order.ref)}` : `/sales-orders?ref=${encodeURIComponent(order.ref)}`),
        ...orderDimensions(order),
        orderSide: order.side,
      })
    }

    if (isOnDay(order.closedAt, day)) {
      entries.push({
        id: `close-${order.id}`,
        kind: 'order_closed',
        category: 'money',
        at: order.closedAt!,
        title: `Closed ${order.side === 'purchase' ? formatPoRef(order.ref) : formatSoRef(order.ref)}`,
        detail: order.completionType
          ? `${order.completionType.replace(/_/g, ' ')}${order.closedNotes ? ` · ${order.closedNotes}` : ''}`
          : order.closedNotes || 'Order closed',
        href: pathPrefix(order.side === 'purchase'
          ? `/purchase-orders?ref=${encodeURIComponent(order.ref)}`
          : `/sales-orders?ref=${encodeURIComponent(order.ref)}`),
        ...orderDimensions(order),
        orderSide: order.side,
      })
    }

    for (const buyBack of order.buyBacks ?? []) {
      if (isOnDay(buyBack.date, day)) {
        entries.push({
          id: `bb-${order.id}-${buyBack.id}`,
          kind: 'buy_back',
          category: 'money',
          at: buyBack.date.length > 10 ? buyBack.date : `${buyBack.date}T12:00:00.000Z`,
          title: `Buy back on ${formatPoRef(order.ref)}`,
          detail: order.partyName || order.itemName,
          qtyMt: buyBack.qtyMt,
          amount: orderLineAmount(buyBack.qtyMt, buyBack.rate ?? order.rate),
          href: pathPrefix(`/purchase-orders?ref=${encodeURIComponent(order.ref)}`),
          ...orderDimensions(order),
          orderSide: order.side,
        })
      }
    }
  }

  for (const lift of lifts) {
    if (isOnDay(lift.date, day)) {
      entries.push({
        id: `lift-${lift.id}`,
        kind: 'lift_recorded',
        category: 'lifts',
        at: lift.date.length > 10 ? lift.date : `${lift.date}T12:00:00.000Z`,
        title: `Lift ${formatLiftRef(lift.liftRef)} recorded`,
        detail: [lift.sellerName, lift.buyerName, lift.itemName].filter(Boolean).join(' · '),
        qtyMt: lift.plannedQtyMt ?? lift.liftedQty,
        href: pathPrefix(`/lifts?ref=${encodeURIComponent(String(lift.liftRef))}`),
        ...liftDimensions(lift),
      })
    }
    if (lift.status === 'delivered' && isOnDay(lift.deliveredAt, day)) {
      entries.push({
        id: `lift-del-${lift.id}`,
        kind: 'lift_delivered',
        category: 'lifts',
        at: lift.deliveredAt!,
        title: `Lift ${formatLiftRef(lift.liftRef)} delivered`,
        detail: [lift.sellerName, lift.buyerName, lift.itemName].filter(Boolean).join(' · '),
        qtyMt: lift.liftedQty,
        href: pathPrefix(`/lifts?ref=${encodeURIComponent(String(lift.liftRef))}`),
        ...liftDimensions(lift),
      })
    }
  }

  for (const settlement of settlements) {
    if (!isOnDay(settlement.settledAt, day)) continue
    const isCash = settlement.method === 'cash'
    entries.push({
      id: `settle-${settlement.id}`,
      kind: isCash ? 'cash_settled' : 'carry_settled',
      category: 'money',
      at: settlement.settledAt.length > 10 ? settlement.settledAt : `${settlement.settledAt}T12:00:00.000Z`,
      title: isCash ? 'Cash settlement' : 'Carry to next delivery',
      detail: `${formatPoRef(settlement.poRef)} → ${formatSoRef(settlement.soRef)}${settlement.notes ? ` · ${settlement.notes}` : ''}`,
      qtyMt: settlement.qtyMt,
      amount: settlement.amount,
      href: pathPrefix(`/purchase-orders?ref=${encodeURIComponent(settlement.poRef)}`),
    })
  }

  return sortEntries(entries)
}

export interface BrokerDaybookInput {
  day: string
  shares: BrokerContractShare[]
  pathPrefix: (path: string) => string
}

export function buildBrokerDaybook(input: BrokerDaybookInput): DaybookEntry[] {
  const { day, shares, pathPrefix } = input
  const entries: DaybookEntry[] = []

  for (const share of shares) {
    const qty = parseFloat(share.quantity) || 0
    const shareHref = pathPrefix(`/contract-shares/${share.id}`)
    const dims = shareDimensions(share)

    if (isOnDay(share.created_at, day)) {
      entries.push({
        id: `contract-${share.id}`,
        kind: 'broker_contract_sent',
        category: 'contracts',
        at: share.created_at,
        title: `Contract ${share.contract_ref} sent`,
        detail: `${share.buyer_name} · ${share.seller_name} · ${share.item_name || 'Contract'}`,
        qtyMt: qty,
        href: shareHref,
        ...dims,
      })
    }

    if (share.edited && isOnDay(share.edited_at, day)) {
      entries.push({
        id: `contract-edit-${share.id}`,
        kind: 'broker_contract_edited',
        category: 'contracts',
        at: share.edited_at!,
        title: `Contract ${share.contract_ref} updated`,
        detail: `${share.buyer_name} · ${share.seller_name}`,
        href: shareHref,
        ...dims,
      })
    }

    if (isOnDay(share.deleted_at, day)) {
      entries.push({
        id: `contract-del-${share.id}`,
        kind: 'broker_contract_deleted',
        category: 'contracts',
        at: share.deleted_at!,
        title: `Contract ${share.contract_ref} deleted`,
        detail: `${share.buyer_name} · ${share.seller_name}`,
        href: shareHref,
        ...dims,
      })
    }

    if (isOnDay(share.buyer_confirmed_at, day)) {
      entries.push({
        id: `buyer-conf-${share.id}`,
        kind: 'broker_contract_confirmed',
        category: 'contracts',
        at: share.buyer_confirmed_at!,
        title: `${share.contract_ref} — buyer confirmed`,
        detail: share.buyer_name,
        href: shareHref,
        ...dims,
      })
    }

    if (isOnDay(share.seller_confirmed_at, day)) {
      entries.push({
        id: `seller-conf-${share.id}`,
        kind: 'broker_contract_confirmed',
        category: 'contracts',
        at: share.seller_confirmed_at!,
        title: `${share.contract_ref} — seller confirmed`,
        detail: share.seller_name,
        href: shareHref,
        ...dims,
      })
    }

    for (const event of share.lift_events ?? []) {
      const liftRef = event.broker_lift_ref || event.lift_ref
      const liftHref = pathPrefix(`/lifts?ref=${encodeURIComponent(String(liftRef))}`)
      const party = event.party_name || event.party_role
      const recordedAt = event.event_at || event.updated_at

      if (isOnDay(recordedAt, day)) {
        entries.push({
          id: `blift-${event.id}-rec`,
          kind: 'broker_lift_recorded',
          category: 'lifts',
          at: recordedAt,
          title: `Lift ${formatLiftRef(liftRef)} recorded`,
          detail: [party, share.contract_ref, event.order_ref].filter(Boolean).join(' · '),
          qtyMt: event.qty_mt,
          href: liftHref,
          ...dims,
        })
      }

      const deliveredAt = event.delivered_at || (event.status === 'delivered' ? event.updated_at : '')
      if (event.status === 'delivered' && isOnDay(deliveredAt, day)) {
        entries.push({
          id: `blift-${event.id}-del`,
          kind: 'broker_lift_delivered',
          category: 'lifts',
          at: deliveredAt,
          title: `Lift ${formatLiftRef(liftRef)} delivered`,
          detail: [party, share.contract_ref, event.order_ref].filter(Boolean).join(' · '),
          qtyMt: event.qty_mt,
          href: liftHref,
          ...dims,
        })
      }
    }
  }

  return sortEntries(entries)
}

export function daybookBuyerDisplay(entry: DaybookEntry): string {
  return entry.buyerName?.trim() || (entry.orderSide === 'sale' ? entry.partyName?.trim() : '') || ''
}

export function daybookSellerDisplay(entry: DaybookEntry): string {
  return entry.sellerName?.trim() || (entry.orderSide === 'purchase' ? entry.partyName?.trim() : '') || ''
}

/** Org PO/SO tab — one counterparty column (seller on PO, buyer on SO). */
export function daybookOrgCounterpartyDisplay(entry: DaybookEntry, tab: 'po' | 'so'): string {
  const named = tab === 'po' ? daybookSellerDisplay(entry) : daybookBuyerDisplay(entry)
  if (named) return named
  return entry.detail?.trim() || ''
}

export const DAYBOOK_KIND_LABEL: Record<DaybookEntryKind, string> = {
  po_booked: 'Purchase booked',
  so_booked: 'Sale booked',
  lift_recorded: 'Lift recorded',
  lift_delivered: 'Lift delivered',
  order_closed: 'Order closed',
  buy_back: 'Buy back',
  cash_settled: 'Cash settled',
  carry_settled: 'Carried forward',
  broker_contract_sent: 'Contract sent',
  broker_contract_confirmed: 'Confirmed',
  broker_contract_edited: 'Contract edited',
  broker_contract_deleted: 'Contract deleted',
  broker_lift_recorded: 'Lift recorded',
  broker_lift_delivered: 'Lift delivered',
}
