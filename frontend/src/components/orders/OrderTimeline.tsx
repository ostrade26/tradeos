import { Link } from 'react-router-dom'
import { FileText, Send, Truck } from 'lucide-react'
import { buildOrderTimeline, formatTimelineDate } from '../../lib/orderTimeline'
import type { TradeOrder } from '../../data/mockData'
import { formatOrderRef } from '../../lib/tradeRefs'
import { useTradeStore } from '../../store/TradeStore'
import { cn } from '../../lib/utils'

const typeStyles = {
  po_created: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  so_created: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  lift: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  deletion_scheduled: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  po_buy_back: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
}

export function OrderTimeline({ order }: { order: TradeOrder }) {
  const store = useTradeStore()
  const events = buildOrderTimeline(store, order)

  return (
    <div className="relative pl-4 border-l-2 border-gray-200 dark:border-gray-700 space-y-6">
      {events.map((event, i) => (
        <div key={event.id} className="relative">
          <span className={cn(
            'absolute -left-[calc(1rem+5px)] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-card',
            i === events.length - 1 ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-600',
          )} />
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={cn('text-xs font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded', typeStyles[event.type])}>
              {event.type.replace('_', ' ')}
            </span>
            <span className="text-xs text-muted">{formatTimelineDate(event.date)}</span>
          </div>
          {event.href ? (
            <Link to={event.href} className="text-sm font-medium text-heading hover:text-accent">
              {event.title}
            </Link>
          ) : (
            <p className="text-sm font-medium text-heading">{event.title}</p>
          )}
          <p className="text-xs text-muted mt-0.5">{event.subtitle}</p>
          {event.meta && <p className="text-xs text-gray-500 mt-0.5">{event.meta}</p>}
        </div>
      ))}
    </div>
  )
}

export function OrderTimelineSummary({ order }: { order: TradeOrder }) {
  const Icon = order.side === 'purchase' ? FileText : Send
  return (
    <div className="flex items-center gap-2 mb-6 p-3 rounded-lg bg-gray-100 dark:bg-gray-700/50">
      <Icon className="h-5 w-5 text-accent shrink-0" />
      <div>
        <p className="font-semibold text-heading">{formatOrderRef(order.ref, order.side)}</p>
        <p className="text-xs text-muted">{order.itemName} · {order.partyName}</p>
      </div>
      {order.side === 'purchase' && (
        <Truck className="h-4 w-4 text-muted ml-auto" />
      )}
    </div>
  )
}
