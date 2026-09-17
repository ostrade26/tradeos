import { apiFetch } from './client'
import type { ProductRequest, SeatRequest, UserNotification } from './platformApi'

export type InboxFilter = 'open' | 'all'

export type ApiInboxItem = {
  id: string
  kind: string
  category: 'work' | 'notice'
  status: 'open' | 'done'
  unread: boolean
  title: string
  subtitle: string
  from: string
  date_iso: string
  href?: string
  actionable: boolean
  notice?: UserNotification | null
  seat_request?: SeatRequest | null
  product_request?: ProductRequest | null
}

export type InboxListResponse = {
  items: ApiInboxItem[]
  /** All open work (notices + register items on org). */
  open_count: number
  /** Bell badge — unread notices; platform admins include seat/product work. */
  bell_count: number
  notice_unread: number
}

export const inboxApi = {
  list(filter: InboxFilter = 'all', limit = 100) {
    const q = new URLSearchParams({ filter, limit: String(limit) })
    return apiFetch<InboxListResponse>(`/me/inbox?${q}`)
  },

  summary() {
    return apiFetch<{ open_count: number; bell_count?: number; notice_unread?: number }>(
      '/me/inbox/summary',
    )
  },

  markItemRead(itemId: string) {
    return apiFetch<{ ok: boolean; notification?: UserNotification }>(
      `/me/inbox/items/${encodeURIComponent(itemId)}/read`,
      { method: 'POST' },
    )
  },

  markAllRead() {
    return apiFetch<{ ok: boolean; updated: number }>('/me/inbox/read-all', { method: 'POST' })
  },
}
