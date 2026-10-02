import { apiFetch, API_BASE, ApiError } from './client'
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
  card_tone?: string
  card_image_url?: string
  card_featured?: boolean
  card_bg_hex?: string
  card_tag?: string
  listed_at?: string | null
  entitlement_status: 'available' | 'pending' | 'active'
  /** Orgs with this entitlement (marketplace ranking). */
  active_orgs?: number
  pending_requests?: number
  interest_count?: number
  /** Popularity score for Most requested. */
  request_count?: number
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
    password?: string
    role_slug: OrgRoleSlug
    phone?: string
    account_type?: 'wholesaler_retailer' | 'broker'
  }) =>
    apiFetch<{ id: number; welcome_email_sent?: boolean }>('/organisation/members', {
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

  listBrokerShares: () =>
    apiFetch<{ shares: BrokerContractShare[] }>('/organisation/broker/shares'),

  listReceivedShares: () =>
    apiFetch<{ shares: BrokerContractShare[] }>('/organisation/contract-shares'),

  lookupBrokerOrganisation: (code: string) =>
    apiFetch<{ organisation: BrokerOrganisationMatch }>(
      `/organisation/broker/organisations?code=${encodeURIComponent(code)}`,
    ),

  sendBrokerShare: (body: {
    buyer_org_code: string
    seller_org_code: string
    buyer_external_name?: string
    buyer_external_email?: string
    buyer_external_phone?: string
    seller_external_name?: string
    seller_external_email?: string
    seller_external_phone?: string
    contract_ref: string
    note: string
    filename: string
    pdf_data: string
    item_name: string
    quantity: string
    rate: string
    brokerage: string
    delivery_period: string
    payment_terms: string
  }) =>
    apiFetch<{ share: BrokerContractShare; delivery: BrokerContractDelivery }>(
      '/organisation/broker/shares',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    ),

  getPublicContractInvite: (token: string) =>
    fetch(`${API_BASE}/public/contract-invites/${encodeURIComponent(token)}`).then(async res => {
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new ApiError(typeof data.detail === 'string' ? data.detail : 'Contract link not found', res.status)
      }
      return data as { invite: PublicContractInvite }
    }),

  updateBrokerShare: (shareId: number, body: {
    buyer_org_code: string
    seller_org_code: string
    note: string
    item_name: string
    quantity: string
    rate: string
    brokerage: string
    delivery_period: string
    payment_terms: string
  }) =>
    apiFetch<{ share: BrokerContractShare }>(`/organisation/broker/shares/${shareId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteBrokerShare: (shareId: number) =>
    apiFetch<{ share: BrokerContractShare }>(`/organisation/broker/shares/${shareId}`, {
      method: 'DELETE',
    }),

  markBrokerLiftRead: (eventId: number) =>
    apiFetch<{ id: number; unread: boolean }>(`/organisation/broker/lift-events/${eventId}/read`, {
      method: 'POST',
    }),

  completeBrokerLift: (eventId: number) =>
    apiFetch<{ id: number; broker_completed: boolean; unread: boolean }>(
      `/organisation/broker/lift-events/${eventId}/complete`,
      { method: 'POST' },
    ),

  getBrokerShare: (shareId: number, withFile = false) =>
    apiFetch<{ share: BrokerContractShare }>(
      `/organisation/broker/shares/${shareId}${withFile ? '?file=true' : ''}`,
    ),

  confirmBrokerShare: (shareId: number) =>
    apiFetch<{ share: BrokerContractShare }>(`/organisation/broker/shares/${shareId}/confirm`, {
      method: 'POST',
    }),

  bookBrokerShare: (shareId: number, orderRef: string) =>
    apiFetch<{ share: BrokerContractShare }>(`/organisation/broker/shares/${shareId}/book`, {
      method: 'POST',
      body: JSON.stringify({ order_ref: orderRef }),
    }),

  createBrokerRecordedLift: (
    shareId: number,
    body: {
      party_role: 'buyer' | 'seller'
      qty_mt: number
      status: 'pending' | 'delivered'
      event_at: string
      tanker_no?: string
      transport_name?: string
      driver_mobile?: string
      lr_no?: string
    },
  ) =>
    apiFetch<{ share: BrokerContractShare }>(`/organisation/broker/shares/${shareId}/lifts`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  reportBrokerShareLift: (body: {
    lift_id: string
    lift_ref: number
    order_ref: string
    qty_mt: number
    status: 'pending' | 'delivered' | string
    event_at: string
    tankers?: {
      tanker_no: string
      transport_name: string
      driver_mobile: string
      lr_no: string
      qty_mt: number
      sales_invoice_no: string
      po_invoice_no: string
    }[]
  }) =>
    apiFetch<{ linked: boolean; share_id?: number }>('/organisation/contract-shares/report-lift', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}

export interface BrokerContractLiftTanker {
  tanker_no: string
  transport_name: string
  driver_mobile: string
  lr_no: string
  qty_mt: number
  planned_qty_mt?: number
  actual_qty_mt?: number
  sales_invoice_no: string
  po_invoice_no: string
  previous_tanker_no?: string
  tanker_changed?: boolean
}

export interface BrokerContractLiftEvent {
  id: number
  party_role: 'buyer' | 'seller' | string
  party_name: string
  lift_ref: number
  /** This broker's own lift number. Party lift numbers stay on the buyer's and seller's books. */
  broker_lift_ref?: number
  order_ref: string
  qty_mt: number
  status: 'pending' | 'delivered' | string
  event_at: string
  delivered_at: string
  updated_at: string
  tankers?: BrokerContractLiftTanker[]
  short_qty_mt?: number
  broker_read_at?: string
  unread?: boolean
  broker_completed_at?: string
  broker_completed?: boolean
  /** Lift recorded by the broker (not mirrored from a party's books). */
  broker_recorded?: boolean
}

export interface BrokerOrganisationMatch {
  name: string
  legal_name: string
  org_code: string
  gstin: string
  city: string
  state: string
}

export interface BrokerContractParty {
  channel: 'tradeal' | 'external' | string
  name?: string
  org_code?: string
  email?: string
  phone?: string
  email_sent?: boolean
  invite_url?: string
}

export interface BrokerContractDeliverySide {
  channel: 'tradeal' | 'external' | string
  email_sent?: boolean
  invite_url?: string
  whatsapp_text?: string
  phone?: string
}

export interface BrokerContractDelivery {
  buyer: BrokerContractDeliverySide
  seller: BrokerContractDeliverySide
}

export interface PublicContractInvite {
  contract_ref: string
  party_role: string
  broker_name: string
  counterparty_name: string
  item_name: string
  quantity: string
  rate: string
  delivery_period: string
  payment_terms: string
  note: string
  filename: string
  pdf_data: string
}

export interface BrokerContractShare {
  id: number
  contract_ref: string
  note: string
  filename: string
  created_at: string
  buyer_name: string
  seller_name: string
  buyer_party?: BrokerContractParty
  seller_party?: BrokerContractParty
  buyer_org_code: string
  seller_org_code: string
  buyer_legal_name: string
  seller_legal_name: string
  buyer_city: string
  buyer_state: string
  seller_city: string
  seller_state: string
  buyer_gstin: string
  seller_gstin: string
  sender_name: string
  role: 'broker' | 'buyer' | 'seller' | string
  pdf_data?: string
  item_name: string
  quantity: string
  rate: string
  brokerage: string
  delivery_period: string
  payment_terms: string
  buyer_order_ref: string
  seller_order_ref: string
  buyer_confirmed: boolean
  seller_confirmed: boolean
  buyer_confirmed_at: string
  seller_confirmed_at: string
  edited: boolean
  edited_at: string
  deleted_at: string
  lift_events?: BrokerContractLiftEvent[]
}
