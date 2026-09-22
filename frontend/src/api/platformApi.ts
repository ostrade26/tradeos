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
  /** Temporary QA/demo customer — listed under Test and deletable. */
  is_test?: number | boolean
  /** Current subscription / licence plan name for register display. */
  plan_name?: string | null
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
  plan_licence_type?: string
  plan_licence_price_cents?: number
  plan_included_admin_seats?: number
  plan_included_operator_seats?: number
  plan_additional_seat_licence_cents?: number
  plan_amc_price_cents?: number
  plan_additional_seat_amc_cents?: number
  plan_amc_duration_months?: number
  plan_amc_grace_days?: number
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
    username: string
    email?: string
    mobile?: string
    password?: string
  }
  /** Temporary QA/demo customer account */
  is_test?: boolean
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

export interface PlatformAdminAccount {
  id: number
  username: string
  email: string
  name: string
  status: string
  login_id: string
  created_at?: string
  temporary_password?: string
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
    email?: string
    name?: string
    login_id?: string
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

export type ProductRequestKind = 'issue' | 'improvement' | 'requirement'
export type ProductRequestStatus = 'received' | 'in_progress' | 'done'
export type ProductRequestPriority = 'p1' | 'p2' | 'p3'

export interface ProductRequestAttachment {
  name: string
  mime: string
  data: string
}

export interface ProductRequest {
  id: number
  organisation_id: number
  organisation_name?: string
  requested_by_user_id: number
  requested_by_name?: string
  requested_by_username?: string
  kind: ProductRequestKind | string
  priority: ProductRequestPriority | string
  message: string
  page_path: string
  attachments: ProductRequestAttachment[]
  status: ProductRequestStatus | string
  reply: string
  created_at: string
  updated_at: string
}

export type NotificationKind =
  | 'credentials'
  | 'payment_reminder'
  | 'product_update'
  | 'feature_launch'
  | 'release_notes'
  | 'maintenance'
  | 'announcement'
  | 'backup_reminder'
  | 'product_request'
  | 'seat_request'
  | 'deploy_review'
export type NotificationAudience = 'user' | 'org' | 'active_licences'
export type NotificationRecipientScope = 'org_admin' | 'all_users'

export type BackupReminderFrequency = 'daily' | 'twice_weekly' | 'weekly' | 'off'

export interface BackupReminderSettings {
  enabled: boolean
  frequency: BackupReminderFrequency
  send_hour: number
  send_minute: number
  timezone: string
  weekdays: number[]
  title: string
  body: string
  recipient_scope: NotificationRecipientScope
  exclude_expired_amc: boolean
  last_sent_at: string | null
  last_sent_local_date: string | null
  updated_at: string | null
}

export interface UserNotification {
  id: number
  organisation_id: number | null
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
  unread: boolean
  created_at: string
  /** Display name of the sender when known (not a hard-coded brand). */
  created_by_name?: string | null
  created_by_user_id?: number | null
}

export type ReleaseCategory =
  | 'bug_fix'
  | 'design_improvements'
  | 'ui_and_fixes'
  | 'feature_enhancement'
  | 'improvement'
  | 'cosmetic'
  | 'new_feature'
  | 'product_update'

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
  source?: 'manual' | 'deploy' | string
  deploy_commit_sha?: string
  deploy_environment?: string
  sent?: number
  skipped_expired_amc?: number
}

export interface FeatureInterest {
  id: number
  organisation_id: number
  organisation_name?: string
  requested_by_user_id: number
  requested_by_name?: string
  requested_by_username?: string
  feature_key: string
  feature_title: string
  feature_detail?: string
  card_tone?: string
  card_bg_hex?: string
  pricing_type?: string
  price_cents?: number
  status: string
  platform_note?: string
  created_at: string
  reviewed_at?: string | null
}

export interface PlatformFeatureOffer {
  id: number
  feature_key: string
  title: string
  description: string
  pricing_type: 'free' | 'paid' | 'contact'
  price_cents: number
  currency: string
  catalog_status: 'draft' | 'listed' | 'retired'
  sort_order: number
  card_tone?: string
  card_image_url?: string
  card_featured?: boolean
  card_bg_hex?: string
  created_at: string
  updated_at: string
  listed_at?: string | null
  listed_by_user_id?: number | null
  active_orgs?: number
  pending_requests?: number
}

export interface PlatformFeatureOfferOrgUsage {
  organisation_id: number
  organisation_name: string
  org_code: string
  applied_at: string
  version?: string
}

export interface PlatformFeatureOfferPendingRequest {
  interest_id: number
  organisation_id: number
  organisation_name: string
  org_code: string
  created_at: string
  status: string
  requested_by_name?: string
}

export interface PlatformFeatureOfferUsage {
  offer: PlatformFeatureOffer
  organisations: PlatformFeatureOfferOrgUsage[]
  pending_requests: PlatformFeatureOfferPendingRequest[]
}

export const platformApi = {
  listPlans: () => apiFetch<{ plans: SubscriptionPlan[] }>('/platform/plans'),

  upsertPlan: (body: Omit<SubscriptionPlan, 'id' | 'created_at' | 'updated_at'> & { slug: string }) =>
    apiFetch<{ plan: SubscriptionPlan }>('/platform/plans', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  deletePlan: (planId: number) =>
    apiFetch<{
      deleted: SubscriptionPlan
      moved_to: { id: number; name: string; slug: string } | null
      moved_count: number
    }>(`/platform/plans/${planId}`, {
      method: 'DELETE',
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

  updateOrganisation: (orgId: number, body: Partial<PlatformOrganisation> & { status?: string; is_test?: boolean }) =>
    apiFetch<OrganisationDetailResponse>(`/platform/organisations/${orgId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteOrganisation: (orgId: number) =>
    apiFetch<{ deleted: PlatformOrganisation }>(`/platform/organisations/${orgId}`, {
      method: 'DELETE',
    }),

  deleteUser: (userId: number) =>
    apiFetch<{ ok: boolean }>(`/platform/users/${userId}`, { method: 'DELETE' }),

  addSeats: (orgId: number, count = 1, seatType: 'operator' | 'view_only' = 'operator') =>
    apiFetch<{ organisation_id: number; seats: SeatSummary }>(`/platform/organisations/${orgId}/seats`, {
      method: 'POST',
      body: JSON.stringify({ count, seat_type: seatType }),
    }),

  listSeats: () => apiFetch<{ seats: OrganisationSeat[] }>('/platform/seats'),

  listUsers: () => apiFetch<{ users: PlatformUser[] }>('/platform/users'),

  listAdmins: () => apiFetch<{ admins: PlatformAdminAccount[] }>('/platform/admins'),

  createAdmin: (body: { username: string; name: string }) =>
    apiFetch<{ admin: PlatformAdminAccount }>('/platform/admins', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  resetAdminSignIn: (userId: number, body?: { username?: string }) =>
    apiFetch<SignInResetResult & PlatformAdminAccount>(`/platform/admins/${userId}/reset-sign-in`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),

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

  resetUserSignIn: (userId: number, body?: { username?: string }) =>
    apiFetch<SignInResetResult>(`/platform/users/${userId}/reset-sign-in`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),

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

  productRequestsSummary: () =>
    apiFetch<{ pending_count: number; open_requests: ProductRequest[] }>('/platform/product-requests/summary'),

  listProductRequests: (status?: ProductRequestStatus) => {
    const q = status ? `?status=${encodeURIComponent(status)}` : ''
    return apiFetch<{ requests: ProductRequest[] }>(`/platform/product-requests${q}`)
  },

  reviewProductRequest: (requestId: number, body: { status: ProductRequestStatus; reply?: string }) =>
    apiFetch<{ request: ProductRequest }>(`/platform/product-requests/${requestId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: body.status, reply: body.reply ?? '' }),
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
    apiFetch<{ sent: number; skipped_expired_amc: number; notification: UserNotification }>('/platform/notifications', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

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
      notify_organisations?: boolean
    },
  ) =>
    apiFetch<{ release: PlatformRelease }>(`/platform/releases/${releaseId}/publish`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listFeatureInterests: (status?: string) =>
    apiFetch<{ interests: FeatureInterest[] }>(
      `/platform/feature-interests${status ? `?status=${encodeURIComponent(status)}` : ''}`,
    ),

  approveFeatureInterest: (interestId: number, note = '') =>
    apiFetch<{ interest: FeatureInterest }>(`/platform/feature-interests/${interestId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),

  rejectFeatureInterest: (interestId: number, note = '') =>
    apiFetch<{ interest: FeatureInterest }>(`/platform/feature-interests/${interestId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),

  listFeatureOffers: () => apiFetch<{ offers: PlatformFeatureOffer[] }>('/platform/feature-offers'),

  getFeatureOfferUsage: (offerId: number) =>
    apiFetch<PlatformFeatureOfferUsage>(`/platform/feature-offers/${offerId}/usage`),

  createFeatureOffer: (body: {
    feature_key: string
    title: string
    description?: string
    pricing_type?: string
    price_cents?: number
    currency?: string
    sort_order?: number
    card_tone?: string
    card_image_url?: string
    card_featured?: boolean
    card_bg_hex?: string
  }) =>
    apiFetch<{ offer: PlatformFeatureOffer }>('/platform/feature-offers', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateFeatureOffer: (
    offerId: number,
    body: {
      feature_key: string
      title: string
      description?: string
      pricing_type?: string
      price_cents?: number
      currency?: string
      sort_order?: number
      card_tone?: string
      card_image_url?: string
      card_featured?: boolean
      card_bg_hex?: string
    },
  ) =>
    apiFetch<{ offer: PlatformFeatureOffer }>(`/platform/feature-offers/${offerId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  setFeatureOfferCatalogStatus: (offerId: number, catalog_status: string) =>
    apiFetch<{ offer: PlatformFeatureOffer }>(`/platform/feature-offers/${offerId}/catalog-status`, {
      method: 'POST',
      body: JSON.stringify({ catalog_status }),
    }),

  deleteFeatureOffer: (offerId: number) =>
    apiFetch<{ ok: boolean; offer: PlatformFeatureOffer }>(`/platform/feature-offers/${offerId}`, {
      method: 'DELETE',
    }),

  getBackupReminders: () =>
    apiFetch<{ settings: BackupReminderSettings }>('/platform/backup-reminders'),

  updateBackupReminders: (body: Partial<BackupReminderSettings>) =>
    apiFetch<{ settings: BackupReminderSettings }>('/platform/backup-reminders', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  runBackupReminders: () =>
    apiFetch<{ sent: number; skipped_expired_amc?: number }>('/platform/backup-reminders/run', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
}
