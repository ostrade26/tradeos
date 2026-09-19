import type { ApiInboxItem, NotificationSend } from '../api/inboxApi'
import type { UserNotification, ProductRequest, SeatRequest } from '../api/platformApi'
import type { InboxAction } from './actionInbox'
import { inboxSubject, notificationSubtitle } from './notificationDisplay'
import { isOpenProductRequest } from './platformProductRequestInbox'
import { isOpenSeatRequest, seatRequestInboxMessageLine } from './platformSeatRequestInbox'

export type InboxCategory = 'work' | 'notice' | 'sent'

/**
 * Notice kinds with a real workflow loop (Open / Done / …).
 * FYI kinds (product update, maintenance, backup, announcement, …) use
 * unread styling only — no Status badge.
 */
export const WORKFLOW_NOTICE_KINDS = new Set([
  'payment_reminder',
  'deploy_review',
  'product_request',
  'seat_request',
])

export type UnifiedInboxItem = {
  id: string
  kind: string
  category: InboxCategory
  /** Open = needs attention or unread; done = resolved or read */
  status: 'open' | 'done'
  unread: boolean
  title: string
  subtitle: string
  from: string
  dateIso: string
  href?: string
  notice?: UserNotification
  seatRequest?: SeatRequest
  productRequest?: ProductRequest
  send?: NotificationSend
  actionable: boolean
}

/** True when the Status column should show a badge (not FYI-only notices). */
export function hasInboxWorkflowStatus(item: UnifiedInboxItem): boolean {
  if (item.seatRequest || item.productRequest) return true
  if (item.category === 'work') return true
  if (item.category === 'sent') return Boolean(item.productRequest)
  return WORKFLOW_NOTICE_KINDS.has(item.kind)
}

function byNewest(a: UnifiedInboxItem, b: UnifiedInboxItem) {
  const aT = a.dateIso ? new Date(a.dateIso).getTime() : 0
  const bT = b.dateIso ? new Date(b.dateIso).getTime() : 0
  return bT - aT
}

export function platformActionToInboxItem(action: InboxAction): UnifiedInboxItem {
  const open = Boolean(action.actionable)
  return {
    id: action.id,
    kind: action.kind,
    category: 'work',
    status: open ? 'open' : 'done',
    unread: open,
    title: action.title,
    subtitle: action.subtitle,
    from: action.from || 'Organisation',
    dateIso: action.createdAt || '',
    href: action.href || undefined,
    seatRequest: action.seatRequest,
    productRequest: action.productRequest,
    actionable: open,
  }
}

export function apiInboxItemToUnified(row: ApiInboxItem): UnifiedInboxItem {
  const notice = row.notice ?? undefined
  const seatRequest = row.seat_request ?? undefined
  const seatLine =
    seatRequest || notice?.kind === 'seat_request'
      ? seatRequestInboxMessageLine(seatRequest ?? null, notice ?? null)
      : ''
  return {
    id: row.id,
    kind: row.kind,
    category: row.category,
    status: row.status,
    unread: row.unread,
    title: row.title,
    subtitle: seatLine || row.subtitle,
    from: row.from,
    dateIso: row.date_iso,
    href: row.href || undefined,
    notice,
    seatRequest,
    productRequest: row.product_request ?? undefined,
    send: row.send ?? undefined,
    actionable: row.actionable,
  }
}

export function noticeToInboxItem(item: UserNotification): UnifiedInboxItem {
  const from =
    (typeof item.created_by_name === 'string' && item.created_by_name.trim()) ||
    item.payload?.from_label?.trim() ||
    item.payload?.sender_name?.trim() ||
    item.payload?.sender_label?.trim() ||
    item.payload?.from?.trim() ||
    'System'
  const workflow = WORKFLOW_NOTICE_KINDS.has(item.kind)
  return {
    id: `notice-${item.id}`,
    kind: item.kind,
    category: 'notice',
    // FYI notices stay "done" for status; unread drives New / Unread filter.
    status: workflow && item.unread ? 'open' : 'done',
    unread: item.unread,
    title: inboxSubject(item),
    subtitle: notificationSubtitle(item).replace(/\s+/g, ' '),
    from,
    dateIso: item.created_at,
    href: item.href || undefined,
    notice: item,
    actionable: item.unread || Boolean(item.payload?.cta),
  }
}

export function sortInboxItems(items: UnifiedInboxItem[]): UnifiedInboxItem[] {
  return [...items].sort(byNewest)
}

export function isPlatformWorkOpen(item: UnifiedInboxItem): boolean {
  if (item.seatRequest) return isOpenSeatRequest(item.seatRequest.status)
  if (item.productRequest) return isOpenProductRequest(item.productRequest.status)
  return item.actionable && item.status === 'open'
}
