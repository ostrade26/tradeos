import {
  AlertCircle, KeyRound, Megaphone, MessageSquare, Sparkles, UserPlus, Wallet, type LucideIcon,
} from 'lucide-react'
import { formatDateTime } from './utils'
import type { UserNotification } from '../api/platformApi'

export const notificationKindIcon: Record<string, LucideIcon> = {
  seat_request: UserPlus,
  credentials: KeyRound,
  payment_reminder: Wallet,
  product_update: Megaphone,
  feature_launch: Sparkles,
  release_notes: Megaphone,
  product_request: MessageSquare,
}

export function notificationKindLabel(kind: string): string {
  if (kind === 'credentials') return 'Sign-in'
  if (kind === 'payment_reminder') return 'Payment'
  if (kind === 'product_update') return 'Product update'
  if (kind === 'feature_launch') return 'New feature'
  if (kind === 'release_notes') return 'Release'
  if (kind === 'product_request') return 'Tradeal reply'
  if (kind === 'sent_request') return 'Your request'
  if (kind === 'seat_request') return 'Seat request'
  return kind.replace(/_/g, ' ')
}

export function inboxSubject(item: UserNotification): string {
  if (item.kind === 'product_request') {
    const status = item.payload?.status?.replace(/_/g, ' ')
    return status ? `Tradeal replied · ${status}` : 'Tradeal replied'
  }
  return item.title.replace(/^Tradeal\s+/i, '')
}

export function notificationSubtitle(item: UserNotification): string {
  if (item.kind === 'credentials') {
    const email = item.payload.login_id || item.body
    const password = item.payload.temporary_password
    if (email && password) return `${email} · ${password}`
    return item.body || email
  }
  if (item.kind === 'product_request') {
    return item.body || 'Tradeal updated your request'
  }
  return item.body || formatDateTime(item.created_at)
}

export function isProductUpdateNotice(item: UserNotification): boolean {
  const cta = item.payload?.cta
  return cta === 'update' || (!cta && (item.kind === 'product_update' || item.kind === 'feature_launch'))
}

export function notificationIcon(kind: string): LucideIcon {
  return notificationKindIcon[kind] ?? AlertCircle
}

/** Gmail-style inbox date: time today, day+month this year, else with year. */
export function formatInboxDate(value: string): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  const now = new Date()
  if (parsed.toDateString() === now.toDateString()) {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(parsed)
  }
  if (parsed.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(parsed)
  }
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed)
}
