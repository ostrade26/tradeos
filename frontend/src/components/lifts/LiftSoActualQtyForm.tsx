import { QtyInput } from '../ui/QtyInput'
import { sanitizeQtyInput } from '../../lib/liftTankers'
import { formatQty, roundQtyMt } from '../../lib/utils'
import { formatPoRef, formatSoRef } from '../../lib/tradeRefs'
import { allocationTotal } from '../../lib/liftAllocations'
import { allocationActualKey, STOCK_LIFT_LABEL } from '../../lib/stockLift'
import type { LiftAllocation, TradeOrder } from '../../data/mockData'

export function actualQtyDraftFromAllocations(allocations: LiftAllocation[]): Record<string, string> {
  return Object.fromEntries(
    allocations.map(a => [allocationActualKey(a), a.qtyMt > 0 ? String(a.qtyMt) : '']),
  )
}

export function parsedActualQtyDraft(draft: Record<string, string>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(draft).map(([soRef, raw]) => [soRef, roundQtyMt(parseFloat(raw) || 0)]),
  )
}

export function totalActualFromDraft(draft: Record<string, string>): number {
  return roundQtyMt(
    Object.values(draft).reduce((sum, raw) => sum + (parseFloat(raw) || 0), 0),
  )
}

interface LiftSoActualQtyFormProps {
  allocations: LiftAllocation[]
  orders: TradeOrder[]
  values: Record<string, string>
  fieldErrors?: Record<string, string>
  onChange: (values: Record<string, string>) => void
  /** Hide footer totals — use when the parent modal already shows a summary strip. */
  hideTotals?: boolean
  /** Trim headings and helper copy for modal use. */
  compact?: boolean
}

export function LiftSoActualQtyForm({
  allocations,
  orders,
  values,
  fieldErrors,
  onChange,
  hideTotals = false,
  compact = false,
}: LiftSoActualQtyFormProps) {
  const plannedTotal = allocationTotal(allocations)
  const actualTotal = totalActualFromDraft(values)
  const balanceTotal = actualTotal > 0 ? roundQtyMt(Math.max(0, plannedTotal - actualTotal)) : 0

  const update = (soRef: string, actualQty: string) => {
    onChange({ ...values, [soRef]: actualQty })
  }

  return (
    <div className="space-y-3">
      {!compact && (
        <div>
          <p className="text-sm font-semibold text-heading">
            {allocations.length > 1 ? 'Actual quantity per SO' : 'Actual quantity'}
          </p>
          <p className="text-xs text-muted mt-0.5">
            {allocations.length > 1
              ? 'Weighed quantity for each sales order.'
              : 'Weighed quantity at destination.'}
          </p>
        </div>
      )}

      {allocations.map(a => {
        const key = allocationActualKey(a)
        const so = a.soRef ? orders.find(o => o.ref === a.soRef && o.side === 'sale') : undefined
        const actual = parseFloat(values[key] || '') || 0
        const shortfall = actual > 0 ? roundQtyMt(Math.max(0, a.qtyMt - actual)) : 0
        const label = a.soRef ? formatSoRef(a.soRef) : STOCK_LIFT_LABEL
        const showPlanned = !compact || allocations.length > 1
        const poLabel = formatPoRef(a.poRef)

        if (compact && allocations.length === 1) {
          return (
            <QtyInput
              key={key}
              label="Actual quantity (MT)"
              value={values[key] ?? ''}
              fillQty={a.qtyMt > 0 ? a.qtyMt : undefined}
              fillLabel="Use planned"
              error={fieldErrors?.[key]}
              onChange={e => update(key, sanitizeQtyInput(e.target.value))}
              className="text-base"
              placeholder="e.g. 12.480"
            />
          )
        }

        if (compact) {
          return (
            <div
              key={key}
              className="grid grid-cols-1 sm:grid-cols-[1fr_min(9rem,35%)] gap-3 sm:gap-4 sm:items-end pb-4 border-b border-gray-100 dark:border-gray-800 last:border-0 last:pb-0"
            >
              <div className="min-w-0 pb-1 sm:pb-0">
                <p className="font-mono text-sm font-medium text-heading">{label}</p>
                <p className="text-xs text-muted mt-0.5 truncate">
                  {so ? `${so.partyName} · ${poLabel}` : `Stock · ${poLabel}`}
                  {showPlanned ? ` · planned ${formatQty(a.qtyMt)}` : ''}
                </p>
                {shortfall > 0 && a.soRef && (
                  <p className="text-xs tabular-nums text-warning mt-1">
                    Balance {formatQty(shortfall)}
                  </p>
                )}
              </div>
              <QtyInput
                label="Actual (MT)"
                value={values[key] ?? ''}
                fillQty={a.qtyMt > 0 ? a.qtyMt : undefined}
                fillLabel="Planned"
                error={fieldErrors?.[key]}
                onChange={e => update(key, sanitizeQtyInput(e.target.value))}
                placeholder="0.000"
              />
            </div>
          )
        }

        return (
          <div
            key={key}
            className="rounded-lg border border-gray-200 bg-white p-3 space-y-3 dark:border-gray-700 dark:bg-gray-900/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-sm font-medium text-heading">{label}</p>
                <p className="text-xs text-muted mt-0.5">
                  {so ? `${so.partyName} · ${poLabel}` : `Stock · ${poLabel}`}
                </p>
              </div>
              {showPlanned && (
                <p className="text-xs text-muted tabular-nums shrink-0">
                  Planned {formatQty(a.qtyMt)}
                </p>
              )}
            </div>
            <QtyInput
              label="Actual quantity (MT)"
              value={values[key] ?? ''}
              fillQty={a.qtyMt > 0 ? a.qtyMt : undefined}
              fillLabel="Use planned"
              error={fieldErrors?.[key]}
              onChange={e => update(key, sanitizeQtyInput(e.target.value))}
              className="text-base"
              placeholder="e.g. 12.480"
            />
            {shortfall > 0 && a.soRef && (
              <p className="text-xs tabular-nums text-amber-700 dark:text-amber-400">
                Balance on {formatSoRef(a.soRef)}: {formatQty(shortfall)}
              </p>
            )}
          </div>
        )
      })}

      {!hideTotals && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <p>
            <span className="text-muted">Actual quantity:</span>{' '}
            <span className="font-semibold tabular-nums">{formatQty(actualTotal)}</span>
          </p>
          {actualTotal > 0 && balanceTotal > 0 && (
            <p className="text-amber-700 dark:text-amber-400">
              <span>Balance owed:</span>{' '}
              <span className="font-semibold tabular-nums">{formatQty(balanceTotal)}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
