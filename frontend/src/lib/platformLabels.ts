import type { AccountType, OrgRoleSlug } from '../api/platformApi'

export function accountTypeLabel(type: AccountType): string {
  if (type === 'broker') return 'Broker'
  return 'Wholesaler / Retailer'
}

export function orgRoleLabel(slug: string): string {
  switch (slug) {
    case 'organisation_admin':
      return 'Organisation Admin'
    case 'operator':
      return 'Organisation Operator'
    case 'view_only':
      return 'Organisation Viewer'
    case 'platform_admin':
      return 'Platform Admin'
    default:
      return slug
  }
}

export function formatInrCents(cents: number | null | undefined): string {
  if (cents == null || cents <= 0) return '—'
  return `₹${(cents / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export function seatRequestStatusLabel(status: string, audience: 'org' | 'platform' = 'org'): string {
  if (status === 'pending_payment') {
    return audience === 'platform' ? 'Awaiting approval' : 'Submitted — awaiting Tradeal approval'
  }
  if (status === 'paid') {
    return 'Awaiting approval'
  }
  return status.replace(/_/g, ' ')
}

export type OrgSeatType = 'operator' | 'view_only'

export const ORG_SEAT_TYPE_OPTIONS: { value: OrgSeatType; label: string }[] = [
  { value: 'operator', label: 'Operator' },
  { value: 'view_only', label: 'Viewer' },
]

export function seatTypeLabel(seatType: string): string {
  switch (seatType) {
    case 'organisation_admin':
      return 'Organisation Admin'
    case 'operator':
      return 'Operator'
    case 'view_only':
      return 'Viewer'
    default:
      return seatType.replace(/_/g, ' ')
  }
}

export const ORG_ROLE_OPTIONS: { value: OrgRoleSlug; label: string }[] = [
  { value: 'organisation_admin', label: 'Organisation Admin' },
  { value: 'operator', label: 'Organisation Operator' },
  { value: 'view_only', label: 'Organisation Viewer' },
]
