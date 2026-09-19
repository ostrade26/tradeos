import { apiFetch } from './client'
import type { ProductRequest, SeatRequest, UserNotification } from './platformApi'

export type InboxFilter = 'open' | 'all'
export type InboxBox = 'received' | 'sent'

export type NotificationSend = {
  id: number
  actor_user_id: number | null
  kind: string
  title: string
  body: string
  audience: string
  recipient_scope: string
  organisation_id: number | null
  sent_count: number
  skipped_expired_amc: number
  source: string
  href: string
  payload: Record<string, unknown>
  created_at: string
}

export type ApiInboxItem = {
  id: string
  kind: string
  category: 'work' | 'notice' | 'sent'
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
  send?: NotificationSend | null
}

export type InboxListResponse = {
  items: ApiInboxItem[]
  box?: InboxBox
  /** All open work (notices + register items on org). */
  open_count: number
  /** Bell badge — unread notices; platform admins include seat/product work. */
  bell_count: number
  notice_unread: number
}

export const inboxApi = {
  list(filter: InboxFilter = 'all', limit = 100, box: InboxBox = 'received') {
    const q = new URLSearchParams({ filter, limit: String(limit), box })
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

  ackDeployReviews(cta: 'review_features' | 'review_release') {
    return apiFetch<{ ok: boolean; updated: number }>('/me/inbox/ack-deploy-reviews', {
      method: 'POST',
      body: JSON.stringify({ cta }),
    })
  },

  deleteItem(itemId: string) {
    return apiFetch<{ ok: boolean; deleted: number }>(
      `/me/inbox/items/${encodeURIComponent(itemId)}`,
      { method: 'DELETE' },
    )
  },

  deleteItems(ids: string[]) {
    return apiFetch<{ ok: boolean; deleted: number }>('/me/inbox/delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
  },
}
