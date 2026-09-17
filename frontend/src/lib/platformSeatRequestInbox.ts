import type { SeatRequest } from '../api/platformApi'
import type { InboxAction } from './actionInbox'
import { formatInrCents, seatRequestStatusLabel, seatTypeLabel } from './platformLabels'

export function isOpenSeatRequest(status: string): boolean {
  return status === 'pending_payment' || status === 'paid'
}

export function buildPlatformSeatRequestInbox(requests: SeatRequest[]): InboxAction[] {
  return requests.map(r => {
    const org = r.organisation_name?.trim() || `Organisation #${r.organisation_id}`
    const seats = r.requested_seats
    const amount = formatInrCents(r.amount_cents)
    const open = isOpenSeatRequest(r.status)
    const type = seatTypeLabel(r.seat_type ?? 'operator')
    const statusBit = open ? '' : ` · ${seatRequestStatusLabel(r.status, 'platform')}`
    return {
      id: `seat-request-${r.id}`,
      kind: 'seat_request',
      title: `${org} · ${seats} ${seats === 1 ? 'seat' : 'seats'}${statusBit}`,
      subtitle: `${type} · ${amount}`,
      href: '',
      urgency: open ? 'high' : 'low',
      from: org,
      createdAt: r.created_at,
      actionable: open,
      seatRequest: r,
    }
  })
}
