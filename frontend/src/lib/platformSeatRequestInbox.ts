import type { SeatRequest, UserNotification } from '../api/platformApi'
import type { InboxAction } from './actionInbox'
import { formatInrCents, seatRequestStatusLabel, seatTypeLabel } from './platformLabels'

export function isOpenSeatRequest(status: string): boolean {
  return status === 'pending_payment' || status === 'paid'
}

export function seatRequestStatusBadgeVariant(
  status: string,
): 'default' | 'success' | 'warning' | 'info' | 'danger' {
  switch (status.trim().toLowerCase()) {
    case 'approved':
      return 'success'
    case 'rejected':
      return 'danger'
    case 'paid':
      return 'info'
    case 'pending_payment':
      return 'warning'
    default:
      return 'default'
  }
}

export function seatRequestDecisionStatus(
  seatRequest?: SeatRequest | null,
  notice?: UserNotification | null,
): string {
  const payload = notice?.payload ?? {}
  return String(seatRequest?.status ?? payload.decision ?? payload.status ?? '').toLowerCase()
}

function isSeatDecisionNotice(notice?: UserNotification | null): boolean {
  const decision = String(notice?.payload?.decision || notice?.payload?.status || '').toLowerCase()
  return notice?.kind === 'seat_request' && (decision === 'approved' || decision === 'rejected')
}

export function isSeatRequestDecisionItem(item: {
  notice?: UserNotification | null
  seatRequest?: SeatRequest | null
}): boolean {
  if (!isSeatDecisionNotice(item.notice)) return false
  return Boolean(item.seatRequest || item.notice?.payload?.seat_request_id)
}

/** Inline inbox message: `Operator · ₹1,000 · Seat Status: Approved` */
export function seatRequestInboxMessageLine(
  seatRequest?: SeatRequest | null,
  notice?: UserNotification | null,
): string {
  const payload = notice?.payload ?? {}
  const type = seatTypeLabel(String(seatRequest?.seat_type ?? payload.seat_type ?? 'operator'))
  const amountCents =
    seatRequest?.amount_cents ?? (Number(payload.amount_cents) > 0 ? Number(payload.amount_cents) : 0)
  const amount = amountCents > 0 ? formatInrCents(amountCents) : ''
  const statusRaw = String(
    seatRequest?.status ?? payload.decision ?? payload.status ?? '',
  ).toLowerCase()
  const parts = [type]
  if (amount) parts.push(amount)
  if (statusRaw === 'approved' || statusRaw === 'rejected') {
    parts.push(`Seat Status: ${seatRequestStatusLabel(statusRaw, 'org')}`)
  }
  return parts.join(' · ')
}

export function buildPlatformSeatRequestInbox(requests: SeatRequest[]): InboxAction[] {
  return requests.map(r => {
    const org = r.organisation_name?.trim() || `Organisation #${r.organisation_id}`
    const seats = r.requested_seats
    const open = isOpenSeatRequest(r.status)
    const statusBit = open ? '' : ` · ${seatRequestStatusLabel(r.status, 'platform')}`
    return {
      id: `seat-request-${r.id}`,
      kind: 'seat_request',
      title: `${org} · ${seats} ${seats === 1 ? 'seat' : 'seats'}${statusBit}`,
      subtitle: seatRequestInboxMessageLine(r),
      href: '',
      urgency: open ? 'high' : 'low',
      from: org,
      createdAt: r.created_at,
      actionable: open,
      seatRequest: r,
    }
  })
}
