import { Link } from 'react-router-dom'
import { FileText, History } from 'lucide-react'
import { Card, CardHeader } from '../ui/Card'
import { Button } from '../ui/Button'
import { useTradeStore } from '../../store/TradeStore'
import { activityEntityHref } from '../../lib/activityHref'
import { activityTypeConfig } from '../../lib/activityDisplay'
import { formatDateTime, cn } from '../../lib/utils'
import { DashboardCardEmptyState } from './DashboardCardEmptyState'

export function DashboardRecentActivity({ className }: { className?: string }) {
  const { activities } = useTradeStore()
  const recent = [...activities]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 8)

  return (
    <Card className={cn('h-full flex flex-col', className)}>
      <CardHeader
        title="Recent activity"
        subtitle={recent.length === 0 ? 'No events yet' : 'Latest changes across your desk'}
      />
      {recent.length === 0 ? (
        <DashboardCardEmptyState
          icon={History}
          tone="blue"
          title="No events yet"
          description="POs, SOs, lifts, and settlements will show up here as you work."
        />
      ) : (
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {recent.map(activity => {
            const config = activityTypeConfig[activity.type]
            const Icon = config?.icon ?? FileText
            const href = activityEntityHref(activity.entityRef)

            const row = (
              <>
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config?.color ?? 'bg-gray-100 text-gray-500 dark:bg-gray-700/50'}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-heading text-pretty">{activity.title}</p>
                  <p className="text-xs text-caption mt-0.5 leading-relaxed line-clamp-1">{activity.description}</p>
                  <p className="text-xs text-muted mt-0.5">{formatDateTime(activity.timestamp)}</p>
                </div>
              </>
            )

            if (href) {
              return (
                <Link
                  key={activity.id}
                  to={href}
                  className="flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700/30 transition-colors"
                >
                  {row}
                </Link>
              )
            }

            return (
              <div key={activity.id} className="flex items-start gap-3 rounded-lg px-2 py-2.5">
                {row}
              </div>
            )
          })}
        </div>
      )}
      <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-800">
        <Button to="/activity" variant="ghost" size="sm" className="w-full">
          View full activity timeline
        </Button>
      </div>
    </Card>
  )
}
