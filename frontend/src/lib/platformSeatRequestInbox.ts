import type { SeatRequest } from '../api/platformApi'
import type { InboxAction } from './actionInbox'
import { formatInrCents } from './platformLabels'

export function buildPlatformSeatRequestInbox(requests: SeatRequest[]): InboxAction[] {
  return requests
    .filter(r => r.status === 'pending_payment' || r.status === 'paid')
    .map(r => {
      const org = r.organisation_name?.trim() || `Organisation #${r.organisation_id}`
      const seats = r.requested_seats
      const amount = formatInrCents(r.amount_cents)
      return {
        id: `seat-request-${r.id}`,
        kind: 'seat_request',
        title: `${org} requested ${seats} seat${seats === 1 ? '' : 's'}`,
        subtitle: `${amount} · Approve after payment received`,
        href: `/platform-admin/seat-requests?highlight=${r.id}`,
        urgency: 'high' as const,
      }
    })
}
