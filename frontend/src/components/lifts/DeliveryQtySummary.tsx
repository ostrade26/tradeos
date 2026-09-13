import { formatQty } from '../../lib/utils'

interface DeliveryQtySummaryProps {
  planned: number
  actual: number
  balance?: number
}

export function DeliveryQtySummary({ planned, actual, balance }: DeliveryQtySummaryProps) {
  const showBalance = balance != null && balance > 0 && actual > 0

  return (
    <div className="flex flex-wrap gap-6 rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/30">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Planned</p>
        <p className="mt-0.5 text-lg font-semibold tabular-nums text-heading">{formatQty(planned)}</p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Actual</p>
        <p className="mt-0.5 text-lg font-semibold tabular-nums text-heading">{formatQty(actual)}</p>
      </div>
      {showBalance && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Balance owed</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-amber-700 dark:text-amber-400">
            {formatQty(balance)}
          </p>
        </div>
      )}
    </div>
  )
}
