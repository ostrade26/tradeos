import type { ApiInboxItem, NotificationSend } from '../api/inboxApi'
import type { UserNotification, ProductRequest, SeatRequest } from '../api/platformApi'
import type { InboxAction } from './actionInbox'
import { inboxSubject, notificationSubtitle } from './notificationDisplay'
import { isOpenProductRequest } from './platformProductRequestInbox'
import { isOpenSeatRequest } from './platformSeatRequestInbox'

export type InboxCategory = 'work' | 'notice' | 'sent'

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
  return {
    id: row.id,
    kind: row.kind,
    category: row.category,
    status: row.status,
    unread: row.unread,
    title: row.title,
    subtitle: row.subtitle,
    from: row.from,
    dateIso: row.date_iso,
    href: row.href || undefined,
    notice: row.notice ?? undefined,
    seatRequest: row.seat_request ?? undefined,
    productRequest: row.product_request ?? undefined,
    send: row.send ?? undefined,
    actionable: row.actionable,
  }
}

export function noticeToInboxItem(item: UserNotification): UnifiedInboxItem {
  return {
    id: `notice-${item.id}`,
    kind: item.kind,
    category: 'notice',
    status: item.unread ? 'open' : 'done',
    unread: item.unread,
    title: inboxSubject(item),
    subtitle: notificationSubtitle(item).replace(/\s+/g, ' '),
    from: 'Tradeal',
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
