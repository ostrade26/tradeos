import type { TradeOrder } from '../data/mockData'
import { formatContractRate } from './orderRate'
import { formatOrderRef, formatPoRef } from './tradeRefs'
import { formatDate, formatQty } from './utils'

export function orderDropdownOption(
  order: TradeOrder,
  availableMt: number,
  extras: string[] = [],
) {
  const refLabel = formatOrderRef(order.ref, order.side)
  const poLabel = order.poRef ? formatPoRef(order.poRef) : ''
  return {
    value: order.ref,
    label: `${refLabel} — ${order.itemName} · ${order.partyName}`,
    description: [
      `${formatQty(availableMt)} available`,
      formatContractRate(order.rate, order.rateBasis, order.ratePerBasis),
      formatDate(order.date),
      order.brokerName || undefined,
      ...extras.map(extra =>
        extra.replace(/\bLot\s+(\S+)/i, (_, ref: string) => `Lot ${formatPoRef(ref)}`),
      ),
    ].filter(Boolean).join(' · '),
    keywords: [
      refLabel,
      order.ref,
      order.itemName,
      order.partyName,
      order.brokerName,
      order.spot,
      poLabel,
      order.poRef,
      order.sellerName,
      order.buyerName,
    ].filter(Boolean).join(' '),
  }
}
