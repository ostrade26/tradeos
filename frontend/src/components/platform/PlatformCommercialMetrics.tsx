import type { PlatformDashboard } from '../../api/platformApi'
import { formatInrCents } from '../../lib/platformLabels'

function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-md bg-card shadow-[var(--shadow-card)] overflow-hidden">
      <div className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        <p className="text-lg font-semibold tabular-nums text-heading mt-1">{value}</p>
        {detail ? <p className="text-xs text-muted mt-1.5 leading-relaxed">{detail}</p> : null}
      </div>
    </div>
  )
}

export function PlatformCommercialMetrics({ metrics }: { metrics: PlatformDashboard }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard
        label="Organisations"
        value={String(metrics.organisations.total)}
        detail={`${metrics.organisations.active_licences} active licences`}
      />
      <MetricCard
        label="AMC"
        value={String(metrics.amc.active)}
        detail={`${metrics.amc.due_soon} due soon · ${metrics.amc.grace_period} grace · ${metrics.amc.expired} expired`}
      />
      <MetricCard
        label="Seats"
        value={`${metrics.seats.assigned}/${metrics.seats.purchased}`}
        detail={`${metrics.seats.available} available`}
      />
      <MetricCard
        label="Revenue (paid)"
        value={formatInrCents(metrics.revenue.licence_cents + metrics.revenue.amc_cents)}
        detail={`Licence ${formatInrCents(metrics.revenue.licence_cents)} · AMC ${formatInrCents(metrics.revenue.amc_cents)} · Pending ${formatInrCents(metrics.revenue.pending_cents)}`}
      />
    </div>
  )
}
