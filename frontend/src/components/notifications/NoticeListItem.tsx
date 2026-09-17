import { Link } from 'react-router-dom'
import { AlertCircle, KeyRound, Megaphone, Sparkles, Wallet } from 'lucide-react'
import { Button } from '../ui/Button'
import { cn, formatDateTime } from '../../lib/utils'
import type { UserNotification } from '../../api/platformApi'

const kindIcon: Record<string, typeof Megaphone> = {
  credentials: KeyRound,
  payment_reminder: Wallet,
  product_update: Megaphone,
  feature_launch: Sparkles,
  release_notes: Megaphone,
}

function noticeSubtitle(item: UserNotification): string {
  if (item.kind === 'credentials') {
    const email = item.payload.login_id || item.body
    const password = item.payload.temporary_password
    if (email && password) return `${email} · ${password}`
    return item.body || email
  }
  return item.body || formatDateTime(item.created_at)
}

function noticeShowsUpdateCta(item: UserNotification): boolean {
  const cta = item.payload?.cta
  return cta === 'update' || (!cta && (item.kind === 'product_update' || item.kind === 'feature_launch'))
}

export function NoticeListItem({
  item,
  onOpen,
  onMarkRead,
  onApply,
}: {
  item: UserNotification
  onOpen?: () => void
  onMarkRead: (id: number) => void
  onApply: (item: UserNotification) => void
}) {
  const Icon = kindIcon[item.kind] ?? AlertCircle
  const showUpdateCta = noticeShowsUpdateCta(item)
  const content = (
    <>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-700/50">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-heading text-pretty">{item.title}</p>
        <p className={cn(
          'text-xs text-muted mt-0.5 leading-snug',
          item.kind === 'credentials' && 'font-mono tabular-nums break-all',
        )}>
          {noticeSubtitle(item)}
        </p>
        <p className="text-[11px] text-muted mt-1 tabular-nums">{formatDateTime(item.created_at)}</p>
        {showUpdateCta ? (
          item.applied || item.applied_at ? (
            <p className="text-xs font-medium text-muted mt-2">Updated</p>
          ) : (
            <Button
              type="button"
              size="sm"
              className="mt-2"
              onClick={event => {
                event.preventDefault()
                event.stopPropagation()
                onApply(item)
              }}
            >
              Update
            </Button>
          )
        ) : null}
      </div>
    </>
  )
  const className = cn(
    'flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors w-full text-left',
    item.unread && 'bg-accent/5 dark:bg-accent/10',
  )
  if (showUpdateCta) {
    return <div className={className}>{content}</div>
  }
  if (item.href) {
    return (
      <Link
        to={item.href}
        onClick={() => {
          void onMarkRead(item.id)
          onOpen?.()
        }}
        className={className}
      >
        {content}
      </Link>
    )
  }
  return (
    <button
      type="button"
      onClick={() => void onMarkRead(item.id)}
      className={className}
    >
      {content}
    </button>
  )
}
