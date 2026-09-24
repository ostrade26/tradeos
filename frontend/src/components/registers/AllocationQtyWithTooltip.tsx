import { cn, formatMt } from '../../lib/utils'
import { formatSoRef } from '../../lib/tradeRefs'
import { DelayedHoverTooltip } from '../ui/DelayedHoverTooltip'

export type AllocationTooltipLine = {
  soRef: string
  qtyMt: number
}

/** Qty cell with delayed hover tooltip listing SO number + qty allocated. */
export function AllocationQtyWithTooltip({
  allocated,
  lines,
  className,
}: {
  allocated: number
  lines: AllocationTooltipLine[]
  className?: string
}) {
  const hasLines = lines.length > 0

  return (
    <DelayedHoverTooltip
      enabled={hasLines}
      className={cn('inline-block', className)}
      tipClassName="min-w-[10rem]"
      content={
        <>
          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Allocated to
          </p>
          <ul className="mt-1.5 space-y-1">
            {lines.map(line => (
              <li
                key={line.soRef}
                className="flex items-baseline justify-between gap-4 text-xs text-heading"
              >
                <span className="font-mono font-medium">{formatSoRef(line.soRef)}</span>
                <span className="tabular-nums text-muted">{formatMt(line.qtyMt)}</span>
              </li>
            ))}
          </ul>
        </>
      }
    >
      <span className="tabular-nums">{formatMt(allocated)}</span>
    </DelayedHoverTooltip>
  )
}
