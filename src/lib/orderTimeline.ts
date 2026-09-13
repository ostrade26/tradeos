import type { Lift, TradeOrder } from '../data/mockData'
import type { TradeStoreValue } from '../store/TradeStore'
import { formatDate, formatQty } from './utils'
import { formatContractRate } from './orderRate'
import { formatLiftRef, formatOrderRef } from './tradeRefs'
import { formatLiftTankerSummary } from './liftTankers'
import { formatLiftOrderSummary, liftTouchesRef } from './liftAllocations'

export interface TimelineEvent {
  id: string
  type: 'po_created' | 'so_created' | 'lift' | 'deletion_scheduled' | 'po_buy_back'
  date: string
  title: string
  subtitle: string
  href?: string
  meta?: string
}

export function buildOrderTimeline(store: TradeStoreValue, order: TradeOrder): TimelineEvent[] {
  const events: TimelineEvent[] = []

  events.push({
    id: `order-${order.id}`,
    type: 'po_created',
    date: order.date,
    title: `${formatOrderRef(order.ref, order.side)} created`,
    subtitle: `${formatQty(order.orderQty)} ${order.itemName} @ ${formatContractRate(order.rate, order.rateBasis, order.ratePerBasis)}`,
    href: order.side === 'purchase'
      ? `/purchase-orders/${encodeURIComponent(order.ref)}/edit`
      : `/sales-orders/${encodeURIComponent(order.ref)}/edit`,
  })

  if (order.deleteScheduledAt) {
    events.push({
      id: `del-${order.id}`,
      type: 'deletion_scheduled',
      date: order.deleteScheduledAt,
      title: 'Deletion scheduled',
      subtitle: formatOrderRef(order.ref, order.side),
    })
  }

  if (order.side === 'purchase') {
    for (const bb of order.buyBacks ?? []) {
      events.push({
        id: `bb-${bb.id}`,
        type: 'po_buy_back',
        date: bb.date,
        title: `Buy back — ${formatQty(bb.qtyMt)}`,
        subtitle: `${order.partyName} repurchased @ ${formatContractRate(bb.rate, bb.rateBasis, bb.ratePerBasis)}`,
        meta: bb.remarks,
      })
    }

    const sos = store.getSOsForPO(order.ref)
    for (const so of sos) {
      events.push({
        id: `so-${so.id}`,
        type: 'so_created',
        date: so.date,
        title: `SO linked — ${formatOrderRef(so.ref, so.side)}`,
        subtitle: `${formatQty(so.orderQty)} to ${so.partyName} @ ${formatContractRate(so.rate, so.rateBasis, so.ratePerBasis)}`,
        href: `/sales-orders/${encodeURIComponent(so.ref)}/edit`,
      })
    }
    appendLifts(events, store.lifts.filter(l => liftTouchesRef(l, order.ref)))
  } else {
    if (order.poRef) {
      const po = store.getOrderByRef(order.poRef, 'purchase')
      if (po) {
        events.unshift({
          id: `po-${po.id}`,
          type: 'po_created',
          date: po.date,
          title: `Linked PO — ${formatOrderRef(po.ref, po.side)}`,
          subtitle: `${po.partyName} · ${po.itemName}`,
          href: `/purchase-orders/${encodeURIComponent(po.ref)}/edit`,
        })
      }
    }
    appendLifts(events, store.lifts.filter(l => liftTouchesRef(l, order.ref)))
  }

  return events.sort((a, b) => a.date.localeCompare(b.date))
}

function appendLifts(events: TimelineEvent[], lifts: Lift[]) {
  for (const lift of lifts) {
    events.push({
      id: `lift-${lift.id}`,
      type: 'lift',
      date: lift.date,
      title: `${formatLiftRef(lift.liftRef)} — ${formatQty(lift.liftedQty)}`,
      subtitle: `${formatLiftOrderSummary(lift)}${formatLiftTankerSummary(lift) !== '—' ? ` · ${formatLiftTankerSummary(lift)}` : ''}`,
      href: `/lifts?ref=${encodeURIComponent(String(lift.liftRef))}`,
      meta: lift.salesInvoiceNo ? `Invoice ${lift.salesInvoiceNo}` : undefined,
    })
  }
}

export function formatTimelineDate(date: string) {
  try {
    return formatDate(date)
  } catch {
    return date
  }
}
