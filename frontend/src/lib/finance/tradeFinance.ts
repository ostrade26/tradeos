import type { Lift, Payment, TradeOrder } from '../../data/mockData'
import type { TradeStoreValue } from '../../store/TradeStore'
import { partyMatches } from '../assistant/partyMatch'
import { filterOrdersByDate, formatDateInput } from '../orderFilters'
import { contractRateFromOrder, orderLineAmount } from '../orderRate'
import { getLiftAllocations } from '../liftAllocations'

export function orderAmount(order: TradeOrder, qtyMt: number): number {
  const rate = contractRateFromOrder(order.rate, order.rateBasis, order.ratePerBasis)
  return orderLineAmount(qtyMt, rate, order.rateBasis)
}

export function liftPurchaseCost(lift: Lift, po: TradeOrder): number {
  return orderAmount(po, lift.liftedQty)
}

export function liftSalesValue(lift: Lift, so: TradeOrder): number {
  return orderAmount(so, lift.liftedQty)
}

export function liftMargin(lift: Lift, po: TradeOrder, so: TradeOrder): number {
  return liftSalesValue(lift, so) - liftPurchaseCost(lift, po)
}

export function todayDateStr(): string {
  return formatDateInput(new Date())
}

export function dateRangeDaysBack(days: number): { from: string; to: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const from = new Date(today)
  from.setDate(from.getDate() - Math.max(0, days - 1))
  return { from: formatDateInput(from), to: formatDateInput(today) }
}

export function liftsInDateRange(lifts: Lift[], from: string, to: string): Lift[] {
  return filterOrdersByDate(lifts, from, to)
}

export interface EarningsSummary {
  liftCount: number
  sales: number
  purchase: number
  margin: number
  qtyMt: number
}

export function earningsFromLifts(store: TradeStoreValue, lifts: Lift[]): EarningsSummary {
  let sales = 0
  let purchase = 0
  let qtyMt = 0

  for (const lift of lifts) {
    for (const a of getLiftAllocations(lift)) {
      const po = store.getOrderByRef(a.poRef, 'purchase')
      if (!a.soRef) {
        if (!po) continue
        purchase += orderAmount(po, a.qtyMt)
        qtyMt += a.qtyMt
        continue
      }
      const so = store.getOrderByRef(a.soRef, 'sale')
      if (!po || !so) continue
      sales += orderAmount(so, a.qtyMt)
      purchase += orderAmount(po, a.qtyMt)
      qtyMt += a.qtyMt
    }
  }

  return {
    liftCount: lifts.length,
    sales,
    purchase,
    margin: sales - purchase,
    qtyMt,
  }
}

function paidPayments(payments: Payment[]): Payment[] {
  return payments.filter(p => p.paidDate && p.status !== 'outstanding')
}

function paymentsOutToParty(payments: Payment[], party: string): number {
  return paidPayments(payments)
    .filter(p => partyMatches(p.party, party) && p.contractRef.startsWith('PO-'))
    .reduce((sum, p) => sum + p.amount, 0)
}

function paymentsInFromParty(payments: Payment[], party: string): number {
  return paidPayments(payments)
    .filter(p => partyMatches(p.party, party) && p.contractRef.startsWith('SO-'))
    .reduce((sum, p) => sum + p.amount, 0)
}

export interface PartyBalance {
  party: string
  liftedPurchase: number
  liftedSales: number
  paidOut: number
  received: number
  payable: number
  receivable: number
  liftCountAsSeller: number
  liftCountAsBuyer: number
}

export function partyBalance(store: TradeStoreValue, party: string): PartyBalance {
  let liftedPurchase = 0
  let liftedSales = 0
  const sellerLifts = new Set<string>()
  const buyerLifts = new Set<string>()

  for (const lift of store.lifts) {
    for (const a of getLiftAllocations(lift)) {
      const po = store.getOrderByRef(a.poRef, 'purchase')
      if (!a.soRef) {
        if (!po) continue
        if (partyMatches(lift.sellerName, party) || partyMatches(po.partyName, party)) {
          liftedPurchase += orderAmount(po, a.qtyMt)
          sellerLifts.add(lift.id)
        }
        if (partyMatches(lift.buyerName, party)) {
          buyerLifts.add(lift.id)
        }
        continue
      }
      const so = store.getOrderByRef(a.soRef, 'sale')
      if (!po || !so) continue

      if (partyMatches(lift.sellerName, party) || partyMatches(po.partyName, party)) {
        liftedPurchase += orderAmount(po, a.qtyMt)
        sellerLifts.add(lift.id)
      }
      if (partyMatches(lift.buyerName, party) || partyMatches(so.partyName, party)) {
        liftedSales += orderAmount(so, a.qtyMt)
        buyerLifts.add(lift.id)
      }
    }
  }

  const paidOut = paymentsOutToParty(store.payments, party)
  const received = paymentsInFromParty(store.payments, party)

  return {
    party,
    liftedPurchase,
    liftedSales,
    paidOut,
    received,
    payable: Math.max(0, liftedPurchase - paidOut),
    receivable: Math.max(0, liftedSales - received),
    liftCountAsSeller: sellerLifts.size,
    liftCountAsBuyer: buyerLifts.size,
  }
}

export function salesTotalFromLifts(store: TradeStoreValue, lifts: Lift[]): number {
  return earningsFromLifts(store, lifts).sales
}
