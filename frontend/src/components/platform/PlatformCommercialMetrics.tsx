import type { PlatformDashboard } from '../../api/platformApi'
import { formatInrCents } from '../../lib/platformLabels'

function MetricCard({
  label,
  value,
  detail,
  valueClassName,
}: {
  label: string
  value: string
  detail?: string
  valueClassName?: string
}) {
  return (
    <div className="rounded-md bg-card shadow-[var(--shadow-card)] overflow-hidden">
      <div className="p-8">
        <p className="text-xs font-medium text-muted">{label}</p>
        <p className={`text-lg font-semibold tabular-nums mt-1 ${valueClassName ?? 'text-heading'}`}>{value}</p>
        {detail ? <p className="text-xs text-muted mt-1.5 leading-relaxed">{detail}</p> : null}
      </div>
    </div>
  )
}

export function PlatformCommercialMetrics({ metrics }: { metrics: PlatformDashboard }) {
  const amcAtRisk = metrics.amc.due_soon + metrics.amc.grace_period + metrics.amc.expired
  const outstanding = metrics.revenue.pending_cents
  const amcDetail =
    amcAtRisk > 0
      ? [metrics.amc.due_soon && `${metrics.amc.due_soon} due soon`, metrics.amc.grace_period && `${metrics.amc.grace_period} grace`, metrics.amc.expired && `${metrics.amc.expired} expired`]
          .filter(Boolean)
          .join(' · ')
      : undefined

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard label="Active licences" value={String(metrics.organisations.active_licences)} />
      <MetricCard
        label="AMC at risk"
        value={String(amcAtRisk)}
        detail={amcDetail}
        valueClassName={amcAtRisk > 0 ? 'text-warning' : 'text-heading'}
      />
      <MetricCard label="Open seats" value={String(metrics.seats.available)} />
      <MetricCard
        label="Outstanding"
        value={outstanding > 0 ? formatInrCents(outstanding) : '₹0'}
        valueClassName={outstanding > 0 ? 'text-warning' : 'text-heading'}
      />
    </div>
  )
}
