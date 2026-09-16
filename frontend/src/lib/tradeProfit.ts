import type { Lift, TradeOrder } from '../data/mockData'
import { formatIndianAmount } from './indianAmount'
import { getLiftAllocations } from './liftAllocations'
import { roundQtyMt } from './utils'

export interface PoTradeProfit {
  orderQty: number
  purchaseRatePerMt: number
  purchaseValue: number
  brokerageTotal: number
  totalAdditionalCosts: number
  trueLandedCostPerMt: number
  soldQtyMt: number
  avgSaleRatePerMt: number | null
  saleRevenue: number
  grossProfit: number | null
  hasSales: boolean
}

export function orderBrokerageTotal(
  order: Pick<TradeOrder, 'orderQty' | 'rate' | 'brokeragePct' | 'brokeragePerTon'>,
): number {
  if (order.brokeragePerTon != null && order.brokeragePerTon > 0) {
    return order.orderQty * order.brokeragePerTon
  }
  return order.orderQty * order.rate * (order.brokeragePct / 100)
}

export function computePoTradeProfit(
  po: TradeOrder,
  orders: TradeOrder[],
  lifts: Lift[],
): PoTradeProfit {
  const orderQty = po.orderQty
  const purchaseRatePerMt = po.rate
  const purchaseValue = orderQty * purchaseRatePerMt

  const brokerageTotal = orderBrokerageTotal(po)

  const totalAdditionalCosts = brokerageTotal
  const trueLandedCostPerMt = orderQty > 0 ? (purchaseValue + totalAdditionalCosts) / orderQty : 0

  const soldBySo = new Map<string, number>()
  for (const lift of lifts) {
    if (lift.status !== 'delivered') continue
    for (const a of getLiftAllocations(lift)) {
      if (a.poRef !== po.ref || !a.soRef) continue
      soldBySo.set(a.soRef, roundQtyMt((soldBySo.get(a.soRef) ?? 0) + a.qtyMt))
    }
  }

  let soldQtyMt = 0
  let saleRevenue = 0
  for (const [soRef, qty] of soldBySo) {
    const so = orders.find(o => o.ref === soRef && o.side === 'sale')
    if (!so) continue
    soldQtyMt = roundQtyMt(soldQtyMt + qty)
    saleRevenue += qty * so.rate
  }

  const avgSaleRatePerMt = soldQtyMt > 0 ? saleRevenue / soldQtyMt : null
  const grossProfit = soldQtyMt > 0 ? saleRevenue - soldQtyMt * trueLandedCostPerMt : null

  return {
    orderQty,
    purchaseRatePerMt,
    purchaseValue,
    brokerageTotal,
    totalAdditionalCosts,
    trueLandedCostPerMt,
    soldQtyMt,
    avgSaleRatePerMt,
    saleRevenue,
    grossProfit,
    hasSales: soldQtyMt > 0,
  }
}

export function formatRatePerMt(rate: number): string {
  if (!Number.isFinite(rate) || rate === 0) return '—'
  return `₹${formatIndianAmount(rate)}/MT`
}
