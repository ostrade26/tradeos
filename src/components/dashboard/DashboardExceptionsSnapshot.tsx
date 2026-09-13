import { ShieldCheck } from 'lucide-react'
import { Card, CardHeader } from '../ui/Card'
import { Button } from '../ui/Button'
import { useTradeStore } from '../../store/TradeStore'
import { detectExceptions } from '../../lib/reports/exceptions'
import { buildReport } from '../../lib/reports/builders'
import { cn } from '../../lib/utils'
import { DashboardCardEmptyState } from './DashboardCardEmptyState'
import { DashboardMetricLink } from './DashboardMetricLink'

export function DashboardExceptionsSnapshot({ className }: { className?: string }) {
  const store = useTradeStore()
  const exceptions = detectExceptions(store)
  const open = exceptions.filter(e => e.status === 'Open' || e.status === 'Under Review')
  const critical = open.filter(e => e.severity === 'Critical')
  const missingDocs = buildReport('document-completeness', store).rows
    .filter(r => r.status !== 'Complete').length

  const allClear = open.length === 0 && missingDocs === 0

  return (
    <Card className={cn('h-full flex flex-col', className)}>
      <CardHeader
        title="Compliance snapshot"
        subtitle={allClear ? 'No open issues flagged' : 'From live order and lift data'}
      />
      {allClear ? (
        <DashboardCardEmptyState
          icon={ShieldCheck}
          tone="emerald"
          title="All clear"
          description="Exceptions and missing documents will surface here when detected."
        />
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <DashboardMetricLink to="/reports/exceptions" label="Open exceptions" value={open.length} />
          <DashboardMetricLink to="/reports/exceptions" label="Critical" value={critical.length} />
          <DashboardMetricLink to="/reports/document-completeness" label="Missing docs" value={missingDocs} />
        </div>
      )}
      <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-800">
        <Button to="/reports" variant="ghost" size="sm" className="w-full">
          Open reports dashboard
        </Button>
      </div>
    </Card>
  )
}
