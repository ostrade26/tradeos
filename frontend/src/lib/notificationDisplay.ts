import {
  AlertCircle, ClipboardCheck, KeyRound, Megaphone, MessageSquare, UserPlus, Wallet, type LucideIcon,
} from 'lucide-react'
import { platformAccessIcon, platformFeatureIcon, platformReleaseIcon } from './platformProductIcons'
import { formatDateTime } from './utils'
import type { UserNotification } from '../api/platformApi'

export const notificationKindIcon: Record<string, LucideIcon> = {
  seat_request: UserPlus,
  credentials: KeyRound,
  payment_reminder: Wallet,
  product_update: Megaphone,
  feature_launch: platformFeatureIcon,
  release_notes: platformReleaseIcon,
  product_request: MessageSquare,
  deploy_review: ClipboardCheck,
  feature_interest: platformAccessIcon,
  sent_request: MessageSquare,
}

export function notificationKindLabel(kind: string): string {
  if (kind === 'credentials') return 'Sign-in'
  if (kind === 'payment_reminder') return 'Payment'
  if (kind === 'product_update') return 'Product update'
  if (kind === 'feature_launch') return 'New feature'
  if (kind === 'release_notes') return 'Release'
  if (kind === 'deploy_review') return 'Deploy review'
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

export function isReleaseStyleNoticeKind(kind: string): boolean {
  return kind === 'release_notes' || kind === 'product_update' || kind === 'feature_launch'
}

export function isFeatureInterestNotice(item: UserNotification): boolean {
  return item.kind === 'feature_launch' && item.payload?.cta === 'interest'
}

export function isFeatureDecisionNotice(item: UserNotification): boolean {
  return item.payload?.cta === 'decision'
}

export function isFeatureEnhancementNotice(item: UserNotification): boolean {
  const cta = item.payload?.cta
  return cta === 'choose'
}

export function isProductUpdateNotice(item: UserNotification): boolean {
  const cta = item.payload?.cta
  if (cta === 'choose' || cta === 'acknowledge') return false
  return cta === 'update' || (!cta && (item.kind === 'product_update' || item.kind === 'feature_launch'))
}

export function notificationIcon(kind: string, payload?: UserNotification['payload']): LucideIcon {
  if (payload?.cta === 'review_interest') return platformAccessIcon
  return notificationKindIcon[kind] ?? AlertCircle
}

export function inboxKindIcon(kind: string, payload?: UserNotification['payload']): LucideIcon {
  return notificationIcon(kind, payload)
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
