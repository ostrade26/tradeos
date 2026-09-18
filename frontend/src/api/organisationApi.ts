import { apiFetch } from './client'
import type {
  BillingCycle,
  OrgRoleSlug,
  OrganisationDetailResponse,
  OrganisationSubscription,
  ProductRequest,
  ProductRequestAttachment,
  ProductRequestKind,
  ProductRequestPriority,
  SeatRequest,
  UserNotification,
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

export interface OrgFeatureOffer {
  id: number
  feature_key: string
  title: string
  description: string
  pricing_type: 'free' | 'paid' | 'contact'
  price_cents: number
  currency: string
  catalog_status: string
  entitlement_status: 'available' | 'pending' | 'active'
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

  listProductRequests: () => apiFetch<{ requests: ProductRequest[] }>('/organisation/product-requests'),

  createProductRequest: (body: {
    kind: ProductRequestKind
    message: string
    page_path?: string
    priority?: ProductRequestPriority
    attachments?: ProductRequestAttachment[]
  }) =>
    apiFetch<{ request: ProductRequest }>('/organisation/product-requests', {
      method: 'POST',
      body: JSON.stringify(body),
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

  setMemberPassword: (userId: number, body: { password?: string; username?: string }) =>
    apiFetch<{ ok: boolean; username?: string; login_id?: string }>(`/organisation/members/${userId}/password`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  resetMemberSignIn: (userId: number, body?: { username?: string }) =>
    apiFetch<{
      user_id: number
      login_id: string
      temporary_password: string
      name: string
      username: string
      email: string
    }>(`/organisation/members/${userId}/reset-sign-in`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),

  listNotifications: (limit = 100) =>
    apiFetch<{ notifications: UserNotification[]; unread: number }>(
      `/me/notifications?limit=${encodeURIComponent(String(limit))}`,
    ),

  markNotificationRead: (notificationId: number) =>
    apiFetch<{ notification: UserNotification }>(`/me/notifications/${notificationId}/read`, {
      method: 'POST',
    }),

  markAllNotificationsRead: () =>
    apiFetch<{ ok: boolean; updated: number }>('/me/notifications/read-all', { method: 'POST' }),

  expressFeatureInterest: (notificationId: number, featureKeys: string[]) =>
    apiFetch<{ interests: unknown[]; submitted: number }>(
      `/me/notifications/${notificationId}/express-interest`,
      {
        method: 'POST',
        body: JSON.stringify({ feature_keys: featureKeys }),
      },
    ),

  applyNotificationUpdate: (notificationId: number, featureKeys?: string[]) =>
    apiFetch<{ notification: UserNotification; applied: boolean }>(
      `/me/notifications/${notificationId}/apply`,
      {
        method: 'POST',
        body: JSON.stringify(featureKeys?.length ? { feature_keys: featureKeys } : {}),
      },
    ),

  listAddOns: () => apiFetch<{ offers: OrgFeatureOffer[] }>('/organisation/add-ons'),

  enableAddOn: (featureKey: string) =>
    apiFetch<{ offer: OrgFeatureOffer }>(`/organisation/add-ons/${encodeURIComponent(featureKey)}/enable`, {
      method: 'POST',
    }),

  requestAddOn: (featureKey: string) =>
    apiFetch<{ offer: OrgFeatureOffer; interest_id: number }>(
      `/organisation/add-ons/${encodeURIComponent(featureKey)}/request`,
      { method: 'POST' },
    ),
}
