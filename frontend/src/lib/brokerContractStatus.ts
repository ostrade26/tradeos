import type { BrokerContractShare } from '../api/organisationApi'
import { roundQtyMt } from './utils'

export type BrokerContractStatus = 'pending' | 'confirmed' | 'active' | 'completed' | 'deleted'

/** Delivered MT reported on the contract. Buyer and seller each record their own lifts for the same goods, so the larger side is the quantity that has actually moved. */
export function deliveredQtyMt(share: BrokerContractShare): number {
  let buyer = 0
  let seller = 0
  for (const event of share.lift_events ?? []) {
    if (event.status !== 'delivered') continue
    const qty = Number(event.qty_mt) || 0
    if (event.party_role === 'buyer') buyer += qty
    else seller += qty
  }
  return roundQtyMt(Math.max(buyer, seller))
}

export function contractFullyDelivered(share: BrokerContractShare): boolean {
  const contractQty = roundQtyMt(parseFloat(share.quantity) || 0)
  if (contractQty <= 0) return false
  return deliveredQtyMt(share) + 0.0005 >= contractQty
}

export type BrokerDeskTab = 'pending' | 'completed' | 'deleted'

export function brokerDeskTab(share: BrokerContractShare): BrokerDeskTab {
  if ((share.deleted_at || '').trim()) return 'deleted'
  if (brokerContractStatus(share) === 'completed') return 'completed'
  return 'pending'
}

export function brokerContractStatus(share: BrokerContractShare): BrokerContractStatus {
  if ((share.deleted_at || '').trim()) return 'deleted'
  if (contractFullyDelivered(share)) return 'completed'
  const moving = Boolean(share.buyer_order_ref || share.seller_order_ref || (share.lift_events?.length ?? 0) > 0)
  if (moving) return 'active'
  if (share.buyer_confirmed && share.seller_confirmed) return 'confirmed'
  return 'pending'
}
