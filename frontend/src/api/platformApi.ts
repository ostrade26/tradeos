import { apiFetch } from './client'

export type AccountType = 'wholesaler_retailer' | 'broker'

export type OrgRoleSlug = 'organisation_admin' | 'operator' | 'view_only'

export type BillingCycle = 'monthly' | 'annual'

export interface SeatSummary {
  included_seats: number
  purchased_additional_seats: number
  total_entitled_seats: number
  active_assigned_seats: number
  available_seats: number
}

export interface PlatformOrganisation {
  id: number
  org_code: string | null
  name: string
  account_type: AccountType
  status: string
  legal_name?: string
  gstin?: string
  pan?: string
  business_address?: string
  city?: string
  state?: string
  country?: string
  pincode?: string
  primary_contact_name?: string
  primary_contact_email?: string
  primary_contact_mobile?: string
  sandbox_tools?: number
  created_at: string
  updated_at: string
  seats?: SeatSummary
}

export interface SubscriptionPlan {
  id: number
  slug: string
  name: string
  description: string
  monthly_price_cents: number
  annual_price_cents: number
  additional_seat_monthly_price_cents: number
  additional_seat_annual_price_cents: number
  included_seats: number
  status: string
  created_at: string
  updated_at: string
}

export type SeatRequestStatus = 'pending_payment' | 'paid' | 'approved' | 'rejected' | 'cancelled'

export interface SeatRequest {
  id: number
  organisation_id: number
  organisation_name?: string
  subscription_id: number
  requested_seats: number
  seat_type?: OrgSeatTypeSlug
  amount_cents: number
  status: SeatRequestStatus
  note?: string
  payment_reference?: string
  admin_note?: string
  requested_by_user_id?: number | null
  reviewed_by_user_id?: number | null
  paid_at?: string | null
  approved_at?: string | null
  created_at: string
  updated_at: string
}

export interface OrganisationSubscription {
  id: number
  organisation_id: number
  plan_id: number
  plan_slug: string
  plan_name: string
  plan_description: string
  billing_cycle: BillingCycle
  status: string
  start_date: string
  renewal_date: string
  included_seats: number
  purchased_additional_seats: number
  payment_status: string
}

export interface PlatformUser {
  id: number
  username: string
  email: string
  phone?: string
  name: string
  organisation_id: number | null
  account_type: AccountType
  status: string
  role_slug: string
  role_name: string
  organisation_name: string | null
  seat_id?: number | null
  membership_status?: string | null
}

export interface CreateOrganisationPayload {
  name: string
  account_type?: AccountType
  legal_name?: string
  gstin?: string
  pan?: string
  business_address: string
  city: string
  state: string
  country: string
  pincode: string
  plan_id?: number
  billing_cycle?: BillingCycle
  primary_admin?: {
    name: string
    email: string
    mobile?: string
    username?: string
    password?: string
  }
}

export type OrgSeatTypeSlug = 'organisation_admin' | 'operator' | 'view_only'

export interface OrganisationSeat {
  id: number
  organisation_id: number
  subscription_id: number
  source: 'included' | 'purchased'
  status: string
  seat_label: string
  seat_type: OrgSeatTypeSlug
  created_at: string
  updated_at: string
  organisation_name?: string
  org_code?: string | null
  assigned_user_id?: number | null
  assigned_user_name?: string | null
  assigned_user_email?: string | null
}

export interface SignInResetResult {
  user_id: number
  username: string
  email: string
  name: string
  login_id: string
  temporary_password: string
}

export interface PrimaryAdminUserSummary {
  user_id: number
  username: string
  email: string
  name: string
  login_id: string
}

export interface OrganisationDetailResponse {
  organisation: PlatformOrganisation
  subscription: OrganisationSubscription | null
  seats: SeatSummary
  seat_inventory?: OrganisationSeat[]
  primary_admin_user?: PrimaryAdminUserSummary | null
  primary_admin?: {
    user_id: number
    username: string
    temporary_password?: string | null
  }
}

export const platformApi = {
  listPlans: () => apiFetch<{ plans: SubscriptionPlan[] }>('/platform/plans'),

  upsertPlan: (body: Omit<SubscriptionPlan, 'id' | 'created_at' | 'updated_at'> & { slug: string }) =>
    apiFetch<{ plan: SubscriptionPlan }>('/platform/plans', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listOrganisations: () =>
    apiFetch<{ organisations: PlatformOrganisation[] }>('/platform/organisations'),

  getOrganisation: (orgId: number) =>
    apiFetch<OrganisationDetailResponse>(`/platform/organisations/${orgId}`),

  createOrganisation: (body: CreateOrganisationPayload) =>
    apiFetch<OrganisationDetailResponse>('/platform/organisations', {
      method: 'POST',
      body: JSON.stringify({ account_type: 'wholesaler_retailer', billing_cycle: 'annual', ...body }),
    }),

  updateOrganisation: (orgId: number, body: Partial<PlatformOrganisation> & { status?: string }) =>
    apiFetch<OrganisationDetailResponse>(`/platform/organisations/${orgId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteOrganisation: (orgId: number) =>
    apiFetch<{ ok: boolean }>(`/platform/organisations/${orgId}`, { method: 'DELETE' }),

  deleteUser: (userId: number) =>
    apiFetch<{ ok: boolean }>(`/platform/users/${userId}`, { method: 'DELETE' }),

  addSeats: (orgId: number, count = 1, seatType: 'operator' | 'view_only' = 'operator') =>
    apiFetch<{ organisation_id: number; seats: SeatSummary }>(`/platform/organisations/${orgId}/seats`, {
      method: 'POST',
      body: JSON.stringify({ count, seat_type: seatType }),
    }),

  listSeats: () => apiFetch<{ seats: OrganisationSeat[] }>('/platform/seats'),

  listUsers: () => apiFetch<{ users: PlatformUser[] }>('/platform/users'),

  createUser: (body: {
    username: string
    password: string
    name: string
    email?: string
    phone?: string
    organisation_id: number
    role_slug: OrgRoleSlug
    account_type?: AccountType
  }) =>
    apiFetch<{ id: number; username: string }>('/platform/users', {
      method: 'POST',
      body: JSON.stringify({ account_type: 'wholesaler_retailer', ...body }),
    }),

  updateUser: (
    userId: number,
    body: { role_slug?: OrgRoleSlug; status?: 'active' | 'disabled' },
  ) =>
    apiFetch<{ ok: boolean }>(`/platform/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  resetUserSignIn: (userId: number) =>
    apiFetch<SignInResetResult>(`/platform/users/${userId}/reset-sign-in`, { method: 'POST' }),

  listAuditLogs: (organisationId?: number) => {
    const q = organisationId ? `?organisation_id=${organisationId}` : ''
    return apiFetch<{ logs: Record<string, unknown>[] }>(`/platform/audit-logs${q}`)
  },

  listSeatRequests: (status?: SeatRequestStatus) => {
    const q = status ? `?status=${encodeURIComponent(status)}` : ''
    return apiFetch<{ requests: SeatRequest[] }>(`/platform/seat-requests${q}`)
  },

  markSeatRequestPaid: (requestId: number, paymentReference = '') =>
    apiFetch<{ request: SeatRequest }>(`/platform/seat-requests/${requestId}/mark-paid`, {
      method: 'POST',
      body: JSON.stringify({ payment_reference: paymentReference }),
    }),

  seatRequestsSummary: () =>
    apiFetch<{ pending_count: number; open_requests: SeatRequest[] }>('/platform/seat-requests/summary'),

  approveSeatRequest: (
    requestId: number,
    payload: { payment_reference?: string; admin_note?: string } = {},
  ) =>
    apiFetch<{ request: SeatRequest; seats: SeatSummary }>(`/platform/seat-requests/${requestId}/approve`, {
      method: 'POST',
      body: JSON.stringify({
        payment_reference: payload.payment_reference ?? '',
        admin_note: payload.admin_note ?? '',
      }),
    }),

  rejectSeatRequest: (requestId: number, adminNote = '') =>
    apiFetch<{ request: SeatRequest }>(`/platform/seat-requests/${requestId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ admin_note: adminNote }),
    }),
}
