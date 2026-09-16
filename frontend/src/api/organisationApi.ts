import { apiFetch } from './client'
import type {
  BillingCycle,
  OrgRoleSlug,
  OrganisationDetailResponse,
  OrganisationSubscription,
  SeatRequest,
} from './platformApi'

export interface OrganisationMember {
  id: number
  username: string
  email: string
  name: string
  user_status: string
  role_slug: OrgRoleSlug
  role_name: string
  membership_status: string | null
  seat_id: number | null
  seat_label: string | null
  seat_type: string | null
  last_login_at: string | null
  last_activity_at: string | null
  signed_in: boolean
}

export interface OrganisationSeatRequestContext {
  subscription: OrganisationSubscription | null
  addon_seat_unit_price_cents: number
  billing_cycle: BillingCycle | null
  plan_name?: string
  requests: SeatRequest[]
}

export const organisationApi = {
  billing: () => apiFetch<OrganisationDetailResponse>('/organisation/billing'),

  seatRequests: () => apiFetch<OrganisationSeatRequestContext>('/organisation/seat-requests'),

  createSeatRequest: (body: { requested_seats?: number; seat_type?: 'operator' | 'view_only'; note?: string }) =>
    apiFetch<{ request: SeatRequest }>('/organisation/seat-requests', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  cancelSeatRequest: (requestId: number) =>
    apiFetch<{ request: SeatRequest }>(`/organisation/seat-requests/${requestId}/cancel`, {
      method: 'POST',
    }),

  listMembers: () => apiFetch<{ members: OrganisationMember[] }>('/organisation/members'),

  createMember: (body: {
    email: string
    name?: string
    password: string
    role_slug: OrgRoleSlug
    phone?: string
    account_type?: 'wholesaler_retailer' | 'broker'
  }) =>
    apiFetch<{ id: number }>('/organisation/members', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateMemberStatus: (userId: number, status: 'active' | 'inactive') =>
    apiFetch<{ ok: boolean }>(`/organisation/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  setMemberPassword: (userId: number, password: string) =>
    apiFetch<{ ok: boolean }>(`/organisation/members/${userId}/password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  resetMemberSignIn: (userId: number) =>
    apiFetch<{
      user_id: number
      login_id: string
      temporary_password: string
      name: string
      username: string
      email: string
    }>(`/organisation/members/${userId}/reset-sign-in`, { method: 'POST' }),
}
