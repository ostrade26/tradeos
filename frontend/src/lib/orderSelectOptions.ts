import type { TradeOrder } from '../data/mockData'
import { formatContractRate } from './orderRate'
import { formatDate, formatQty } from './utils'

export function orderDropdownOption(
  order: TradeOrder,
  availableMt: number,
  extras: string[] = [],
) {
  return {
    value: order.ref,
    label: `${order.ref} — ${order.itemName} · ${order.partyName}`,
    description: [
      `${formatQty(availableMt)} available`,
      formatContractRate(order.rate, order.rateBasis, order.ratePerBasis),
      formatDate(order.date),
      order.brokerName || undefined,
      ...extras,
    ].filter(Boolean).join(' · '),
    keywords: [
      order.ref,
      order.itemName,
      order.partyName,
      order.brokerName,
      order.spot,
      order.poRef,
      order.sellerName,
      order.buyerName,
    ].filter(Boolean).join(' '),
  }
}
