import { toBeLifted, type TradeOrder } from '../data/mockData'
import type { TradeStoreValue } from '../store/TradeStore'
import { formatDeletionDate } from './orderDeletion'
import { formatQty } from './utils'
import { formatLiftOrderSummary } from './liftAllocations'
import { formatLiftRef } from './tradeRefs'

export type InboxUrgency = 'high' | 'medium' | 'low'

export interface InboxAction {
  id: string
  kind: string
  title: string
  subtitle: string
  href: string
  urgency: InboxUrgency
}

function soHref(ref: string) {
  return `/sales-orders?ref=${encodeURIComponent(ref)}`
}

export function buildActionInbox(store: TradeStoreValue): InboxAction[] {
  const actions: InboxAction[] = []

  for (const po of store.getPOPending()) {
    const pending = toBeLifted(po)
    if (pending <= 0) continue
    const linkedSos = store.getSOsForPO(po.ref)
    actions.push({
      id: `po-lift-${po.id}`,
      kind: 'po_lift',
      title: `Ready to lift ${po.ref}`,
      subtitle: `${formatQty(pending)} unlifted · ${po.itemName} · ${po.partyName}`,
      href: `/lifts/new?poRef=${encodeURIComponent(po.ref)}${linkedSos.length === 0 ? '&stock=1' : ''}`,
      urgency: po.status === 'partial' ? 'high' : 'medium',
    })
  }

  for (const so of store.getSOPending()) {
    const pending = toBeLifted(so)
    if (pending <= 0) continue
    actions.push({
      id: `so-lift-${so.id}`,
      kind: 'so_lift',
      title: `Ready to lift ${so.ref}`,
      subtitle: so.poRef
        ? `${so.itemName} · ${so.partyName} · against ${so.poRef}`
        : `${so.itemName} · ${so.partyName} · no PO linked`,
      href: so.poRef
        ? `/lifts/new?poRef=${encodeURIComponent(so.poRef)}&soRef=${encodeURIComponent(so.ref)}`
        : soHref(so.ref),
      urgency: so.poRef ? 'medium' : 'high',
    })
  }

  for (const so of store.getSORegister()) {
    if (so.poRef) continue
    if (so.status === 'completed' || so.status === 'cancelled') continue
    actions.push({
      id: `unlink-${so.id}`,
      kind: 'unlinked_so',
      title: `Link ${so.ref} to a PO`,
      subtitle: `${formatQty(so.orderQty)} ${so.itemName} · ${so.partyName}`,
      href: `/sales-orders/${encodeURIComponent(so.ref)}/edit`,
      urgency: 'medium',
    })
  }

  for (const lot of store.lots.filter(l => l.available < 20 && l.available >= 0)) {
    actions.push({
      id: `low-${lot.id}`,
      kind: 'low_stock',
      title: `Low stock — ${lot.lotNumber}`,
      subtitle: `${formatQty(lot.available)} available · ${lot.commodity}`,
      href: `/inventory/${lot.id}`,
      urgency: lot.available === 0 ? 'high' : 'low',
    })
  }

  for (const order of store.tradeOrders) {
    if (!order.deleteScheduledAt) continue
    actions.push({
      id: `del-${order.id}`,
      kind: 'deletion',
      title: `${order.ref} scheduled for deletion`,
      subtitle: `Deletes on ${formatDeletionDate(order.deleteScheduledAt)}`,
      href: order.side === 'purchase'
        ? `/purchase-orders/${encodeURIComponent(order.ref)}/edit`
        : `/sales-orders/${encodeURIComponent(order.ref)}/edit`,
      urgency: 'high',
    })
  }

  for (const lift of store.lifts.filter(l => l.status === 'pending')) {
    actions.push({
      id: `lift-${lift.id}`,
      kind: 'delivery',
      title: `${formatLiftRef(lift.liftRef)} in transit`,
      subtitle: `${formatLiftOrderSummary(lift)} · ${formatQty(lift.liftedQty)}`,
      href: `/lifts?ref=${encodeURIComponent(String(lift.liftRef))}`,
      urgency: 'medium',
    })
  }

  const urgencyOrder: Record<InboxUrgency, number> = { high: 0, medium: 1, low: 2 }
  return actions.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])
}

export function orderFlowHref(order: TradeOrder) {
  const base = order.side === 'purchase' ? '/purchase-orders' : '/sales-orders'
  return `${base}/${encodeURIComponent(order.ref)}/flow`
}

export function orderTimelineHref(order: TradeOrder) {
  const base = order.side === 'purchase' ? '/purchase-orders' : '/sales-orders'
  return `${base}/${encodeURIComponent(order.ref)}/timeline`
}
