import { Link } from 'react-router-dom'
import { Clock, Truck } from 'lucide-react'
import { Card, CardHeader } from '../ui/Card'
import { Button } from '../ui/Button'
import { useTradeStore } from '../../store/TradeStore'
import { formatLiftOrderSummary } from '../../lib/liftAllocations'
import { formatQty, cn } from '../../lib/utils'
import { formatLiftRef } from '../../lib/tradeRefs'
import { DashboardCardEmptyState } from './DashboardCardEmptyState'

export function DashboardInTransitLifts({ className }: { className?: string }) {
  const store = useTradeStore()
  const inTransit = store.lifts
    .filter(l => l.status === 'pending')
    .sort((a, b) => b.date.localeCompare(a.date))

  return (
    <Card className={cn('h-full flex flex-col', className)}>
      <CardHeader
        title="In transit"
        subtitle={inTransit.length === 0 ? 'No tankers on the road' : `${inTransit.length} lift${inTransit.length === 1 ? '' : 's'} pending delivery`}
      />
      {inTransit.length === 0 ? (
        <DashboardCardEmptyState
          icon={Truck}
          tone="amber"
          title="No lifts in transit"
          description="Recorded lifts appear here until marked delivered."
        />
      ) : (
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {inTransit.slice(0, 8).map(lift => (
            <Link
              key={lift.id}
              to={`/lifts?ref=${encodeURIComponent(String(lift.liftRef))}`}
              className="flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700/30 transition-colors"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-warning dark:bg-amber-950/30">
                <Clock className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-heading">{formatLiftRef(lift.liftRef)}</p>
                <p className="text-xs text-caption mt-0.5 leading-relaxed">
                  {formatQty(lift.liftedQty)} · {formatLiftOrderSummary(lift)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
      <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-800">
        <Button to="/lifts" variant="ghost" size="sm" className="w-full">
          View all in-transit lifts
        </Button>
      </div>
    </Card>
  )
}
