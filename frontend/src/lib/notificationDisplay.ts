import {
  AlertCircle,
  BadgeCheck,
  ClipboardCheck,
  DatabaseBackup,
  KeyRound,
  Megaphone,
  MessageSquare,
  UserPlus,
  Wallet,
  Wrench,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { platformAccessIcon, platformFeaturesAccessNavIcon, platformReleaseIcon } from './platformProductIcons'
import { formatDateTime } from './utils'
import type { UserNotification } from '../api/platformApi'
import type { UnifiedInboxItem } from './unifiedInbox'

export type InboxIconTone = 'success' | 'danger' | 'warning' | 'accent' | 'violet' | 'orange' | 'teal' | 'muted'

export const notificationKindIcon: Record<string, LucideIcon> = {
  seat_request: UserPlus,
  credentials: KeyRound,
  payment_reminder: Wallet,
  product_update: Megaphone,
  feature_launch: platformFeaturesAccessNavIcon,
  release_notes: platformReleaseIcon,
  maintenance: Wrench,
  announcement: Megaphone,
  backup_reminder: DatabaseBackup,
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
  if (kind === 'release_notes') return 'Product update'
  if (kind === 'maintenance') return 'Maintenance'
  if (kind === 'announcement') return 'Announcement'
  if (kind === 'backup_reminder') return 'Backup'
  if (kind === 'deploy_review') return 'New feature'
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
  return (
    kind === 'release_notes' ||
    kind === 'product_update' ||
    kind === 'feature_launch' ||
    kind === 'maintenance' ||
    kind === 'announcement' ||
    kind === 'backup_reminder'
  )
}

export function isFeatureInterestNotice(item: UserNotification): boolean {
  return item.kind === 'feature_launch' && item.payload?.cta === 'interest'
}

export function isFeatureBrowseNotice(item: UserNotification): boolean {
  return item.kind === 'feature_launch' && item.payload?.cta === 'browse'
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
  if (cta === 'choose' || cta === 'acknowledge' || cta === 'interest' || cta === 'browse') return false
  return cta === 'update' || (!cta && (item.kind === 'product_update' || item.kind === 'feature_launch'))
}

export function notificationIcon(kind: string, payload?: UserNotification['payload']): LucideIcon {
  if (payload?.cta === 'review_interest') return platformAccessIcon
  if (kind === 'seat_request') {
    const decision = String(payload?.decision || payload?.status || '').toLowerCase()
    if (decision === 'approved') return BadgeCheck
    if (decision === 'rejected') return XCircle
    return UserPlus
  }
  if (kind === 'feature_launch' && payload?.decision === 'approved') return BadgeCheck
  if (kind === 'feature_launch' && payload?.decision === 'rejected') return XCircle
  return notificationKindIcon[kind] ?? AlertCircle
}

export function inboxKindIcon(kind: string, payload?: UserNotification['payload']): LucideIcon {
  return notificationIcon(kind, payload)
}

/** Icon + tone for any unified inbox row (notices and work items). */
export function inboxItemVisual(item: Pick<UnifiedInboxItem, 'kind' | 'notice' | 'seatRequest' | 'productRequest' | 'send'>): {
  Icon: LucideIcon
  tone: InboxIconTone
} {
  const payload = item.notice?.payload ?? (item.send?.payload as UserNotification['payload'] | undefined)
  const seatStatus = String(item.seatRequest?.status || payload?.decision || payload?.status || '').toLowerCase()

  if (item.kind === 'seat_request' || item.seatRequest) {
    if (seatStatus === 'approved') return { Icon: BadgeCheck, tone: 'success' }
    if (seatStatus === 'rejected') return { Icon: XCircle, tone: 'danger' }
    return { Icon: UserPlus, tone: 'warning' }
  }

  if (item.kind === 'product_request' || item.productRequest) {
    return { Icon: MessageSquare, tone: 'accent' }
  }

  if (item.kind === 'payment_reminder') return { Icon: Wallet, tone: 'warning' }
  if (item.kind === 'maintenance') return { Icon: Wrench, tone: 'warning' }
  if (item.kind === 'backup_reminder') return { Icon: DatabaseBackup, tone: 'muted' }
  if (item.kind === 'credentials') return { Icon: KeyRound, tone: 'accent' }
  if (item.kind === 'deploy_review') return { Icon: ClipboardCheck, tone: 'warning' }
  if (item.kind === 'feature_interest') return { Icon: platformAccessIcon, tone: 'accent' }
  if (item.kind === 'product_update' || item.kind === 'release_notes') {
    return { Icon: notificationIcon(item.kind, payload), tone: 'orange' }
  }
  if (item.kind === 'announcement') {
    return { Icon: Megaphone, tone: 'teal' }
  }

  if (payload?.decision === 'approved') {
    return { Icon: BadgeCheck, tone: 'success' }
  }
  if (payload?.decision === 'rejected') {
    return { Icon: XCircle, tone: 'danger' }
  }

  if (item.kind === 'feature_launch') {
    return { Icon: platformFeaturesAccessNavIcon, tone: 'violet' }
  }

  return { Icon: notificationIcon(item.kind, payload), tone: 'muted' }
}

export function inboxIconToneClass(tone: InboxIconTone): string {
  switch (tone) {
    case 'success':
      return 'bg-success-muted text-success'
    case 'danger':
      return 'bg-danger-muted text-danger'
    case 'warning':
      return 'bg-warning-muted text-warning'
    case 'accent':
      return 'bg-accent/10 text-accent dark:bg-accent/20'
    case 'violet':
      return 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300'
    case 'orange':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300'
    case 'teal':
      return 'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300'
    case 'muted':
    default:
      return 'bg-gray-100 text-muted dark:bg-zinc-800'
  }
}

function inboxDateParts(value: string): { date: string; time: string } | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  const now = new Date()
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(parsed)
  const date =
    parsed.getFullYear() === now.getFullYear()
      ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(parsed)
      : new Intl.DateTimeFormat('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }).format(parsed)
  return { date, time }
}

/** Inbox date: day + month (+ year if needed) and 12-hour time with am/pm. */
export function formatInboxDate(value: string): string {
  const parts = inboxDateParts(value)
  if (!parts) return ''
  return `${parts.date} ${parts.time}`
}
