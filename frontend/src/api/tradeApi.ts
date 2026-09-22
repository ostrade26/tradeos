import { apiFetch } from './client'
import type {
  Activity,
  Broker,
  Company,
  Contract,
  Delivery,
  Lift,
  Lot,
  Payment,
  Producer,
  Retailer,
  TradeOrder,
  BalanceSettlement,
} from '../data/mockData'

export interface TradeCounters {
  po: number
  so: number
  lift: number
  invoice: number
}

export interface TradeData {
  tradeOrders: TradeOrder[]
  lifts: Lift[]
  contracts: Contract[]
  lots: Lot[]
  payments: Payment[]
  deliveries: Delivery[]
  brokers: Broker[]
  producers: Producer[]
  retailers: Retailer[]
  companies: Company[]
  activities: Activity[]
  balanceSettlements: BalanceSettlement[]
  spots: string[]
  items: string[]
  counters: TradeCounters
}

type MutationResponse<T> = { data: TradeData; result: T }

export const tradeApi = {
  health: () => apiFetch<{ status: string }>('/health'),

  getState: () => apiFetch<TradeData>('/state'),

  seed: () => apiFetch<MutationResponse<{ seeded: boolean }>>('/admin/seed', { method: 'POST' }),

  reset: () => apiFetch<MutationResponse<{ reset: boolean }>>('/admin/reset', { method: 'POST' }),

  importState: (payload: { version?: number; data: TradeData }) =>
    apiFetch<MutationResponse<{ imported: boolean }>>('/admin/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createContract: (input: Record<string, unknown>) =>
    apiFetch<MutationResponse<Contract>>('/contracts', { method: 'POST', body: JSON.stringify(input) }),

  createOrder: (input: Record<string, unknown>) =>
    apiFetch<MutationResponse<TradeOrder>>('/orders', { method: 'POST', body: JSON.stringify(input) }),

  updateOrder: (id: string, input: Record<string, unknown>) =>
    apiFetch<MutationResponse<TradeOrder>>(`/orders/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  scheduleOrderDeletion: (id: string) =>
    apiFetch<MutationResponse<{ scheduled: boolean }>>(`/orders/${encodeURIComponent(id)}/schedule-deletion`, {
      method: 'POST',
    }),

  cancelOrderDeletion: (id: string) =>
    apiFetch<MutationResponse<{ cancelled: boolean }>>(`/orders/${encodeURIComponent(id)}/schedule-deletion`, {
      method: 'DELETE',
    }),

  permanentlyDeleteOrder: (id: string) =>
    apiFetch<MutationResponse<{ deleted: boolean }>>(`/orders/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  buyBackPo: (id: string, input: Record<string, unknown>) =>
    apiFetch<MutationResponse<TradeOrder>>(`/orders/${encodeURIComponent(id)}/buy-back`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  closeOrder: (id: string, input: Record<string, unknown>) =>
    apiFetch<MutationResponse<TradeOrder>>(`/orders/${encodeURIComponent(id)}/close`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  canDeleteOrder: (id: string) =>
    apiFetch<{ ok: boolean; reason?: string }>(`/orders/${encodeURIComponent(id)}/can-delete`),

  createLift: (input: Record<string, unknown>) =>
    apiFetch<MutationResponse<Lift>>('/lifts', { method: 'POST', body: JSON.stringify(input) }),

  updateLift: (id: string, input: Record<string, unknown>) =>
    apiFetch<MutationResponse<Lift>>(`/lifts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  markLiftDelivered: (id: string, input: Record<string, unknown>) =>
    apiFetch<MutationResponse<Lift>>(`/lifts/${encodeURIComponent(id)}/deliver`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  deleteLift: (id: string) =>
    apiFetch<MutationResponse<{ deleted: boolean }>>(`/lifts/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  restoreLift: (id: string) =>
    apiFetch<MutationResponse<{ restored: boolean }>>(`/lifts/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
    }),

  permanentlyDeleteLift: (id: string) =>
    apiFetch<MutationResponse<{ deleted: boolean }>>(`/lifts/${encodeURIComponent(id)}/permanent`, {
      method: 'DELETE',
    }),

  canDeleteLift: (id: string) =>
    apiFetch<{ ok: boolean; reason?: string }>(`/lifts/${encodeURIComponent(id)}/can-delete`),

  createBroker: (input: Record<string, unknown>) =>
    apiFetch<MutationResponse<Broker>>('/brokers', { method: 'POST', body: JSON.stringify(input) }),

  updateBroker: (id: string, input: Record<string, unknown>) =>
    apiFetch<MutationResponse<Broker>>(`/brokers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  deleteBroker: (id: string) =>
    apiFetch<MutationResponse<{ deleted: boolean }>>(`/brokers/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  canDeleteBroker: (id: string) =>
    apiFetch<{ ok: boolean; reason?: string }>(`/brokers/${encodeURIComponent(id)}/can-delete`),

  createProducer: (input: Record<string, unknown>) =>
    apiFetch<MutationResponse<Producer>>('/producers', { method: 'POST', body: JSON.stringify(input) }),

  updateProducer: (id: string, input: Record<string, unknown>) =>
    apiFetch<MutationResponse<Producer>>(`/producers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  deleteProducer: (id: string) =>
    apiFetch<MutationResponse<{ deleted: boolean }>>(`/producers/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  canDeleteProducer: (id: string) =>
    apiFetch<{ ok: boolean; reason?: string }>(`/producers/${encodeURIComponent(id)}/can-delete`),

  createRetailer: (input: Record<string, unknown>) =>
    apiFetch<MutationResponse<Retailer>>('/retailers', { method: 'POST', body: JSON.stringify(input) }),

  updateRetailer: (id: string, input: Record<string, unknown>) =>
    apiFetch<MutationResponse<Retailer>>(`/retailers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  deleteRetailer: (id: string) =>
    apiFetch<MutationResponse<{ deleted: boolean }>>(`/retailers/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  canDeleteRetailer: (id: string) =>
    apiFetch<{ ok: boolean; reason?: string }>(`/retailers/${encodeURIComponent(id)}/can-delete`),

  createItem: (name: string) =>
    apiFetch<MutationResponse<string>>('/items', { method: 'POST', body: JSON.stringify({ name }) }),

  createSpot: (name: string) =>
    apiFetch<MutationResponse<string>>('/spots', { method: 'POST', body: JSON.stringify({ name }) }),

  confirmCompanyLink: (input: Record<string, unknown>) =>
    apiFetch<MutationResponse<Company>>('/companies/confirm-link', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  linkHighConfidenceCompany: (result: Record<string, unknown>, type: string) =>
    apiFetch<MutationResponse<Company>>('/companies/link-high-confidence', {
      method: 'POST',
      body: JSON.stringify({ result, type }),
    }),
}

export interface AuthMeResponse {
  token?: string
  userId?: number
  username: string
  email?: string
  name: string
  phone?: string
  location?: string
  preferences?: import('../lib/auth').UserPreferences
  role: string
  roleSlug?: string
  roleName?: string
  organisationId?: number | null
  organisationName?: string | null
  accountType?: 'wholesaler_retailer' | 'broker'
  permissions?: string[]
  isPlatformAdmin?: boolean
  organisationSandboxTools?: boolean
  appliedUpdates?: string[]
  appliedVersion?: string
  isFirstLogin?: boolean
}

export const authApi = {
  login: (username: string, password: string, options?: { keepSignedIn?: boolean }) =>
    apiFetch<AuthMeResponse & { token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username,
        password,
        remember: options?.keepSignedIn ?? true,
      }),
    }),

  logout: () => apiFetch<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  me: () => apiFetch<AuthMeResponse>('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch<{ ok: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    }),

  forgotPassword: (email: string) =>
    apiFetch<{ ok: boolean; message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    apiFetch<{ ok: boolean; message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        token,
        new_password: newPassword,
      }),
    }),

  updateProfile: (body: {
    name?: string
    phone?: string
    location?: string
    username?: string
    email?: string
  }) =>
    apiFetch<AuthMeResponse>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  updatePreferences: (body: import('../lib/auth').UserPreferences) =>
    apiFetch<AuthMeResponse>('/auth/preferences', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
}
