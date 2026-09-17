import { Link } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Clock, Link2, Package, Trash2, Truck } from 'lucide-react'
import { Card, CardHeader } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { buildActionInbox, type InboxAction } from '../../lib/actionInbox'
import { useTradeStore } from '../../store/TradeStore'
import { cn } from '../../lib/utils'
import { DashboardCardEmptyState } from './DashboardCardEmptyState'

const kindIcon: Record<string, typeof Truck> = {
  po_lift: Truck,
  so_lift: Truck,
  unlinked_so: Link2,
  low_stock: Package,
  deletion: Trash2,
  delivery: Clock,
}

const urgencyVariant: Record<InboxAction['urgency'], 'danger' | 'warning' | 'default'> = {
  high: 'danger',
  medium: 'warning',
  low: 'default',
}

export function ActionInbox({ className }: { className?: string }) {
  const store = useTradeStore()
  const actions = buildActionInbox(store)

  return (
    <Card className={cn('h-full flex flex-col', className)}>
      <CardHeader
        title="Action inbox"
        subtitle={actions.length === 0 ? 'All caught up' : `${actions.length} item${actions.length === 1 ? '' : 's'} need attention — trade follow-ups, not notices from Tradeal`}
      />
      {actions.length === 0 ? (
        <DashboardCardEmptyState
          icon={CheckCircle2}
          tone="emerald"
          title="All caught up"
          description="No unlifted orders, in-transit lifts, or follow-ups right now."
        />
      ) : (
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {actions.slice(0, 12).map(action => {
            const Icon = kindIcon[action.kind] ?? AlertCircle
            return (
              <Link
                key={action.id}
                to={action.href}
                className="flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700/30 transition-colors"
              >
                <div className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  action.urgency === 'high' && 'bg-red-50 text-danger dark:bg-red-950/30',
                  action.urgency === 'medium' && 'bg-amber-50 text-warning dark:bg-amber-950/30',
                  action.urgency === 'low' && 'bg-gray-100 text-gray-500 dark:bg-gray-700/50',
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-heading text-pretty">{action.title}</p>
                  <p className="text-xs text-muted mt-0.5 leading-relaxed">{action.subtitle}</p>
                </div>
                <Badge variant={urgencyVariant[action.urgency]} className="shrink-0 text-[10px]">
                  {action.urgency}
                </Badge>
              </Link>
            )
          })}
        </div>
      )}
    </Card>
  )
}
