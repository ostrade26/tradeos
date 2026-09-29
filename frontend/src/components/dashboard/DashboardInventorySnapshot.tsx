import { Package } from 'lucide-react'
import { Card, CardHeader } from '../ui/Card'
import { Button } from '../ui/Button'
import { lotHasReceivedStock } from '../../lib/stockPo'
import { useTradeStore } from '../../store/TradeStore'
import { cn } from '../../lib/utils'
import { DashboardCardEmptyState } from './DashboardCardEmptyState'
import { DashboardMetricLink } from './DashboardMetricLink'

export function DashboardInventorySnapshot({ className }: { className?: string }) {
  const { lots } = useTradeStore()
  const godown = lots.filter(lotHasReceivedStock)
  const lowStock = godown.filter(l => l.remaining > 0 && l.available > 0 && l.available < 20)
  const zeroAvailable = godown.filter(l => l.remaining > 0 && l.available <= 0)
  const needsAttention = lowStock.length + zeroAvailable.length
  const allClear = needsAttention === 0

  return (
    <Card className={cn('h-full flex flex-col', className)}>
      <CardHeader
        title="Inventory snapshot"
        subtitle={godown.length === 0
          ? 'No stock received yet'
          : allClear
            ? 'Stock levels healthy'
            : `${needsAttention} lot${needsAttention === 1 ? '' : 's'} need attention`}
      />
      {godown.length === 0 ? (
        <DashboardCardEmptyState
          icon={Package}
          tone="emerald"
          title="Nothing in the godown"
          description="Deliver an own-stock lift on a purchase and the lot will show here."
        />
      ) : allClear ? (
        <DashboardCardEmptyState
          icon={Package}
          tone="emerald"
          title="Stock levels healthy"
          description="Low-stock and zero-available lots will surface here when detected."
        />
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <DashboardMetricLink to="/inventory" label="Low stock" value={lowStock.length} />
          <DashboardMetricLink to="/inventory" label="Zero available" value={zeroAvailable.length} />
          <DashboardMetricLink to="/inventory" label="Active lots" value={godown.length} />
        </div>
      )}
      <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-800">
        <Button to="/inventory" variant="ghost" size="sm" className="w-full">
          View inventory
        </Button>
      </div>
    </Card>
  )
}
