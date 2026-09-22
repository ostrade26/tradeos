import type { AccountType, OrgRoleSlug } from '../api/platformApi'

export function accountTypeLabel(type: AccountType): string {
  if (type === 'broker') return 'Broker'
  return 'Wholesaler'
}

export function orgRoleLabel(slug: string): string {
  switch (slug) {
    case 'organisation_admin':
      return 'Admin'
    case 'operator':
      return 'Operator'
    case 'view_only':
      return 'Viewer'
    case 'platform_admin':
      return 'Tradeal Admin'
    default:
      return slug
  }
}

export function formatInrCents(cents: number | null | undefined): string {
  if (cents == null || cents <= 0) return '—'
  return `₹${(cents / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export function seatRequestStatusLabel(status: string, audience: 'org' | 'platform' = 'org'): string {
  const key = (status || '').trim().toLowerCase()
  if (key === 'pending_payment') {
    return audience === 'platform' ? 'Awaiting approval' : 'Submitted — awaiting Tradeal approval'
  }
  if (key === 'paid') {
    return 'Awaiting approval'
  }
  if (key === 'approved') return 'Approved'
  if (key === 'rejected') return 'Rejected'
  if (key === 'cancelled') return 'Cancelled'
  return key.replace(/_/g, ' ')
}

/** Org may cancel only before Tradeal has approved or closed the request. */
export function orgCanCancelSeatRequest(req: { status: string; approved_at?: string | null }): boolean {
  if (req.approved_at) return false
  const key = (req.status || '').trim().toLowerCase()
  return key === 'pending_payment'
}

export type OrgSeatType = 'operator' | 'view_only'

export const ORG_SEAT_TYPE_OPTIONS: { value: OrgSeatType; label: string }[] = [
  { value: 'operator', label: 'Operator' },
  { value: 'view_only', label: 'Viewer' },
]

export function productRequestKindLabel(kind: string): string {
  if (kind === 'issue') return 'Issue'
  if (kind === 'improvement') return 'Improvement'
  if (kind === 'requirement') return 'New need'
  return kind
}

export function productRequestStatusLabel(status: string): string {
  if (status === 'in_progress') return 'In progress'
  if (status === 'received') return 'Received'
  if (status === 'done') return 'Done'
  return status.replace(/_/g, ' ')
}

export function productRequestPriorityLabel(priority: string): string {
  if (priority === 'p1') return 'P1 · Critical'
  if (priority === 'p2') return 'P2 · High'
  if (priority === 'p3') return 'P3 · Normal'
  return priority
}

export function productRequestPriorityShort(priority: string): string {
  if (priority === 'p1') return 'P1'
  if (priority === 'p2') return 'P2'
  if (priority === 'p3') return 'P3'
  return ''
}

export function seatTypeLabel(seatType: string): string {
  switch (seatType) {
    case 'organisation_admin':
      return 'Admin'
    case 'operator':
      return 'Operator'
    case 'view_only':
      return 'Viewer'
    default:
      return seatType.replace(/_/g, ' ')
  }
}

export const ORG_ROLE_OPTIONS: { value: OrgRoleSlug; label: string }[] = [
  { value: 'organisation_admin', label: 'Admin' },
  { value: 'operator', label: 'Operator' },
  { value: 'view_only', label: 'Viewer' },
]
