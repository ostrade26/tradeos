import type { TradeOrder } from '../data/mockData'
import { CURRENT_TRADER } from '../data/mockData'
import { formatIndianAmount } from './indianAmount'
import { ratePer10KgFromMt } from './orderRate'

export type BrokerageInputType = 'percent' | 'perTon'

export function brokerageTypeFromOrder(order: Pick<TradeOrder, 'brokeragePct' | 'brokeragePerTon'>): BrokerageInputType {
  if (order.brokeragePerTon != null && order.brokeragePerTon > 0) return 'perTon'
  if (order.brokeragePct > 0) return 'percent'
  return 'perTon'
}

export function orderToFormValues(order: TradeOrder): Record<string, string> {
  return {
    ref: order.ref,
    poRef: order.poRef ?? '',
    brokerContractRef: order.brokerContractRef ?? '',
    date: order.date,
    partyName: order.partyName,
    partyCompanyId: order.partyCompanyId ?? '',
    sellerCompanyId: order.sellerCompanyId ?? '',
    buyerCompanyId: order.buyerCompanyId ?? '',
    extractedPartyName: order.extractedPartyName ?? '',
    extractedSellerName: order.extractedSellerName ?? '',
    extractedBuyerName: order.extractedBuyerName ?? '',
    sellerConfirmedBy: order.sellerConfirmedBy ?? '',
    buyerConfirmedBy: order.buyerConfirmedBy ?? '',
    sellerName: order.sellerName ?? (order.side === 'sale' ? CURRENT_TRADER : ''),
    buyerName: order.buyerName ?? (order.side === 'purchase' ? CURRENT_TRADER : ''),
    itemName: order.itemName,
    spot: order.spot,
    quantity: String(order.orderQty),
    rate: formatIndianAmount(ratePer10KgFromMt(order.rate)),
    contractRateDisplay: order.contractRateDisplay ?? '',
    ratePerBasis: formatIndianAmount(ratePer10KgFromMt(order.rate)),
    rateBasis: 'PER 10 KG',
    taxRate: String(order.taxRate),
    deliveryType: order.deliveryType,
    deliveryPeriodStart: order.deliveryPeriodStart,
    deliveryPeriodEnd: order.deliveryPeriodEnd,
    brokerName: order.brokerName,
    brokerageType: brokerageTypeFromOrder(order),
    brokeragePct: String(order.brokeragePct),
    brokeragePerTon: order.brokeragePerTon != null ? formatIndianAmount(order.brokeragePerTon) : '',
    paymentTerms: order.paymentTerms ?? '',
    remarks: order.remarks ?? '',
  }
}
