import { Check, Copy } from 'lucide-react'
import type { OrganisationSeat } from '../../api/platformApi'
import { seatTypeLabel } from '../../lib/platformLabels'
import { cn } from '../../lib/utils'

export function LicensedSeatTag({
  seat,
  copied,
  onCopy,
  showTypeLabel = true,
  tone = 'default',
}: {
  seat: OrganisationSeat
  copied: boolean
  onCopy: () => void
  showTypeLabel?: boolean
  tone?: 'default' | 'onBlue'
}) {
  const onBlue = tone === 'onBlue'
  const showType =
    showTypeLabel && seat.seat_type !== 'organisation_admin'

  return (
    <li
      className={cn(
        'inline-flex items-stretch overflow-hidden rounded-md border text-xs',
        onBlue
          ? 'border-white/25 bg-white/12'
          : 'border-gray-200/90 bg-gray-50/90 dark:border-gray-600 dark:bg-gray-800/40',
      )}
    >
      <span className="inline-flex items-center gap-2 px-2.5 py-1.5">
        <span
          className={cn('font-mono tabular-nums', onBlue ? 'text-white/85' : 'text-muted')}
        >
          {seat.seat_label}
        </span>
        {showType && (
          <span className={cn('font-medium', onBlue ? 'text-white' : 'text-heading')}>
            {seatTypeLabel(seat.seat_type)}
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={onCopy}
        className={cn(
          'inline-flex items-center border-l px-2 transition-colors',
          onBlue
            ? 'border-white/25 text-white/80 hover:bg-white/10 hover:text-white'
            : 'border-gray-200/90 text-muted hover:bg-gray-100 hover:text-heading dark:border-gray-600 dark:hover:bg-gray-700/60',
        )}
        aria-label={`Copy ${seat.seat_label}`}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-success" aria-hidden />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden />
        )}
      </button>
    </li>
  )
}
