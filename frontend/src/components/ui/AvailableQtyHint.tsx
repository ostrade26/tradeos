import { cn, formatQty, availableQtyClass } from '../../lib/utils'

/** Remaining qty after an order — green when healthy, amber when low, red at zero or over-allocated. */
export function soRemainingQtyClass(value: number): string {
  if (value < 0) return 'text-danger font-bold'
  if (value === 0) return 'text-danger font-semibold'
  if (value < 20) return 'text-amber-700 dark:text-amber-400 font-semibold'
  return 'text-success font-semibold'
}

export function AvailableQtyHint({
  label,
  value,
  detail,
  valueClassName,
}: {
  label: string
  value: number
  detail?: string
  valueClassName?: string
}) {
  return (
    <div className="rounded-lg border border-accent/25 bg-accent/5 dark:bg-accent/10 px-3 py-2.5">
      <p className="text-sm font-semibold tabular-nums">
        <span className="text-heading">{label}: </span>
        <span className={cn(valueClassName ?? availableQtyClass(value), 'tabular-nums')}>{formatQty(value)}</span>
      </p>
      {detail && (
        <p className="text-xs text-muted mt-1 tabular-nums">{detail}</p>
      )}
    </div>
  )
}
