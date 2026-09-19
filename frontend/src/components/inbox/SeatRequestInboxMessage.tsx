import type { SeatRequest, UserNotification } from '../../api/platformApi'
import { Badge } from '../ui/Badge'
import { formatInrCents, seatRequestStatusLabel, seatTypeLabel } from '../../lib/platformLabels'
import {
  seatRequestDecisionStatus,
  seatRequestStatusBadgeVariant,
} from '../../lib/platformSeatRequestInbox'
import { cn } from '../../lib/utils'

export function SeatRequestInboxMessage({
  seatRequest,
  notice,
  className,
  statusAudience = 'org',
}: {
  seatRequest?: SeatRequest | null
  notice?: UserNotification | null
  className?: string
  statusAudience?: 'org' | 'platform'
}) {
  const payload = notice?.payload ?? {}
  const type = seatTypeLabel(String(seatRequest?.seat_type ?? payload.seat_type ?? 'operator'))
  const amountCents =
    seatRequest?.amount_cents ?? (Number(payload.amount_cents) > 0 ? Number(payload.amount_cents) : 0)
  const amount = amountCents > 0 ? formatInrCents(amountCents) : ''
  const statusRaw = seatRequestDecisionStatus(seatRequest, notice)
  const showDecisionStatus = statusRaw === 'approved' || statusRaw === 'rejected'

  return (
    <p
      className={cn(
        'text-sm text-heading leading-relaxed flex flex-wrap items-center gap-x-1.5 gap-y-1.5',
        className,
      )}
    >
      <span>{type}</span>
      {amount ? (
        <>
          <span className="text-muted" aria-hidden>
            ·
          </span>
          <span className="tabular-nums">{amount}</span>
        </>
      ) : null}
      {showDecisionStatus ? (
        <>
          <span className="text-muted" aria-hidden>
            ·
          </span>
          <span className="text-muted">Seat Status:</span>
          <Badge variant={seatRequestStatusBadgeVariant(statusRaw)} dot className="capitalize">
            {seatRequestStatusLabel(statusRaw, statusAudience)}
          </Badge>
        </>
      ) : null}
    </p>
  )
}
