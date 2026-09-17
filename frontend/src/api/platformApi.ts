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
  licence_type?: string
  licence_price_cents?: number
  included_admin_seats?: number
  included_operator_seats?: number
  additional_seat_licence_cents?: number
  amc_price_cents?: number
  additional_seat_amc_cents?: number
  amc_duration_months?: number
  amc_grace_days?: number
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
  licence?: OrganisationLicence | null
  amc?: OrganisationAmc | null
  billing?: {
    total_paid_cents: number
    pending_cents: number
    last_payment_date: string | null
    payment_status: string
  }
}

export type LicenceStatus = 'pending' | 'active' | 'suspended' | 'cancelled'
export type AmcStatus = 'active' | 'due_soon' | 'grace_period' | 'expired' | 'cancelled'
export type PaymentType = 'licence' | 'amc' | 'additional_seat' | 'other'
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

export interface OrganisationLicence {
  id: number
  organisation_id: number
  organisation_name?: string
  org_code?: string | null
  plan_id: number | null
  licence_number: string
  plan_name: string
  licence_type: string
  licence_price_cents: number
  purchase_date: string
  activation_date: string | null
  status: LicenceStatus | string
  included_seats: number
  included_admin_seats: number
  included_operator_seats: number
  purchased_additional_seats: number
  additional_seat_licence_cents: number
  additional_seat_amc_cents: number
  amc_price_cents: number
  amc_duration_months: number
  amc_grace_days: number
  amc?: OrganisationAmc | null
}

export interface OrganisationAmc {
  id: number
  organisation_id: number
  organisation_name?: string
  org_code?: string | null
  licence_id: number
  licence_number?: string
  plan_name?: string
  amc_price_cents: number
  included: number
  start_date: string
  end_date: string
  grace_until: string | null
  renewal_date: string | null
  status: AmcStatus | string
  payment_status: string
}

export interface OrganisationPayment {
  id: number
  organisation_id: number
  organisation_name?: string
  org_code?: string | null
  licence_id: number | null
  licence_number?: string | null
  amc_id: number | null
  payment_type: PaymentType | string
  amount_cents: number
  payment_date: string
  payment_reference: string
  status: PaymentStatus | string
  notes: string
}

export interface PlatformDashboard {
  organisations: { total: number; active_licences: number }
  amc: { active: number; due_soon: number; grace_period: number; expired: number; cancelled: number }
  seats: { purchased: number; assigned: number; available: number }
  revenue: { licence_cents: number; amc_cents: number; pending_cents: number }
}

export type NotificationKind = 'credentials' | 'payment_reminder' | 'product_update' | 'feature_launch' | 'release_notes'
export type NotificationAudience = 'user' | 'org' | 'active_licences'
export type NotificationRecipientScope = 'org_admin' | 'all_users'

export interface UserNotification {
  id: number
  organisation_id: number
  recipient_user_id: number
  kind: NotificationKind | string
  title: string
  body: string
  payload: Record<string, string>
  href: string
  read_at: string | null
  applied_at?: string | null
  applied?: boolean
  feature_key?: string
  campaign_id?: number | null
  unread: boolean
  created_at: string
}

export interface NotificationCampaign {
  id: number
  kind: NotificationKind | string
  title: string
  body: string
  payload: Record<string, string>
  audience: NotificationAudience | string
  status: 'pending' | 'processing' | 'complete' | 'failed' | string
  sent_count: number
  skipped_expired_amc: number
  queued?: boolean
  created_at: string
}

export interface SendNotificationResult {
  sent: number
  skipped_expired_amc: number
  queued?: boolean
  campaign_id?: number | null
  campaign_status?: string
  notification: UserNotification | null
}

export interface PlatformInboxItem {
  id: string
  kind: string
  title: string
  subtitle: string
  href: string
  urgency: 'high' | 'medium' | 'low'
  created_at?: string | null
  entity_id?: number
  amount_cents?: number
}

export type ReleaseCategory = 'bug_fix' | 'improvement' | 'cosmetic' | 'new_feature' | 'product_update'

export interface PlatformReleaseItem {
  id?: number
  category: ReleaseCategory | string
  title: string
  detail: string
  feature_key: string
  sort_order?: number
  gated?: boolean
}

export interface PlatformRelease {
  id: number
  version: string
  title: string
  summary: string
  status: 'draft' | 'published' | string
  items: PlatformReleaseItem[]
  gated: boolean
  created_at: string
  updated_at: string
  published_at: string | null
  sent?: number
    skipped_expired_amc?: number
    queued?: boolean
    campaign_id?: number | null
    campaign_status?: string
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

  dashboard: () => apiFetch<PlatformDashboard>('/platform/dashboard'),

  listLicenses: () => apiFetch<{ licenses: OrganisationLicence[] }>('/platform/licenses'),

  updateLicenceStatus: (licenceId: number, status: string) =>
    apiFetch<{ licence: OrganisationLicence }>(`/platform/licenses/${licenceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  listAmcs: () => apiFetch<{ amcs: OrganisationAmc[] }>('/platform/amcs'),

  renewAmc: (licenceId: number, paymentStatus = 'pending') =>
    apiFetch<{ amc: OrganisationAmc }>(`/platform/licenses/${licenceId}/renew-amc`, {
      method: 'POST',
      body: JSON.stringify({ payment_status: paymentStatus }),
    }),

  listPayments: () => apiFetch<{ payments: OrganisationPayment[] }>('/platform/payments'),

  recordPayment: (body: {
    organisation_id: number
    payment_type: PaymentType
    amount_cents: number
    payment_date?: string
    payment_reference?: string
    status?: PaymentStatus
    notes?: string
    licence_id?: number | null
    amc_id?: number | null
  }) =>
    apiFetch<{ payment: OrganisationPayment }>('/platform/payments', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updatePayment: (paymentId: number, body: Partial<Pick<OrganisationPayment, 'status' | 'notes' | 'payment_reference'>>) =>
    apiFetch<{ payment: OrganisationPayment }>(`/platform/payments/${paymentId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  sendNotification: (body: {
    audience?: NotificationAudience
    organisation_id?: number | null
    recipient_user_id?: number | null
    recipient_scope?: NotificationRecipientScope
    exclude_expired_amc?: boolean
    kind: NotificationKind
    title: string
    body?: string
    href?: string
    payload?: Record<string, string>
    feature_key?: string
  }) =>
    apiFetch<SendNotificationResult>('/platform/notifications', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  actionInbox: () =>
    apiFetch<{ unread: number; items: PlatformInboxItem[]; counts: Record<string, number> }>('/platform/inbox'),

  listNotificationCampaigns: () =>
    apiFetch<{ campaigns: NotificationCampaign[] }>('/platform/notification-campaigns'),

  getNotificationCampaign: (campaignId: number) =>
    apiFetch<{ campaign: NotificationCampaign }>(`/platform/notification-campaigns/${campaignId}`),

  listReleases: () =>
    apiFetch<{ releases: PlatformRelease[]; latest_version: string | null; next_version: string }>(
      '/platform/releases',
    ),

  createRelease: (body: {
    version: string
    title: string
    summary?: string
    items: Array<Pick<PlatformReleaseItem, 'category' | 'title' | 'detail' | 'feature_key'>>
  }) =>
    apiFetch<{ release: PlatformRelease }>('/platform/releases', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateRelease: (
    releaseId: number,
    body: {
      version: string
      title: string
      summary?: string
      items: Array<Pick<PlatformReleaseItem, 'category' | 'title' | 'detail' | 'feature_key'>>
    },
  ) =>
    apiFetch<{ release: PlatformRelease }>(`/platform/releases/${releaseId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  publishRelease: (
    releaseId: number,
    body: {
      audience?: NotificationAudience
      organisation_id?: number | null
      recipient_user_id?: number | null
      recipient_scope?: NotificationRecipientScope
      exclude_expired_amc?: boolean
    },
  ) =>
    apiFetch<{ release: PlatformRelease }>(`/platform/releases/${releaseId}/publish`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}
