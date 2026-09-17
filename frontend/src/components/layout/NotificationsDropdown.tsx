import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle, Bell, KeyRound, Megaphone, Package, Sparkles, UserPlus, Wallet,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { usePlatformActionInbox } from '../../hooks/usePlatformActionInbox'
import { useUserNotifications } from '../../hooks/useUserNotifications'
import { organisationApi } from '../../api/organisationApi'
import { authApi } from '../../api/tradeApi'
import { sessionFromApi } from '../../lib/authSession'
import { saveAuthSession } from '../../lib/auth'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { DropdownPanel } from './DropdownPanel'
import { SystemUpdateModal } from './SystemUpdateModal'
import type { InboxAction } from '../../lib/actionInbox'
import { cn, formatDateTime } from '../../lib/utils'
import type { UserNotification } from '../../api/platformApi'

const kindIcon: Record<string, typeof UserPlus> = {
  seat_request: UserPlus,
  product_request: Package,
  credentials: KeyRound,
  payment_reminder: Wallet,
  product_update: Megaphone,
  feature_launch: Sparkles,
  release_notes: Megaphone,
}

const urgencyVariant: Record<InboxAction['urgency'], 'danger' | 'warning' | 'default'> = {
  high: 'danger',
  medium: 'warning',
  low: 'default',
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

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false)
  const [updating, setUpdating] = useState<UserNotification | null>(null)
  const { isPlatformAdmin, isAuthenticated, session } = useAuth()
  const {
    actions: platformActions,
    unread: platformUnread,
    refresh: refreshPlatformInbox,
  } = usePlatformActionInbox(isPlatformAdmin)
  const {
    notifications,
    unread: noticeUnread,
    refresh: refreshStored,
    markRead,
    markAllRead: markStoredAllRead,
  } = useUserNotifications(isAuthenticated && !isPlatformAdmin)

  const unreadCount = isPlatformAdmin ? platformUnread : noticeUnread
  const title = isPlatformAdmin ? 'Needs attention' : 'From Tradeal'
  const ariaLabel = isPlatformAdmin
    ? (unreadCount > 0
      ? `Needs attention, ${unreadCount > 9 ? '9 or more' : unreadCount} open`
      : 'Needs attention')
    : (unreadCount > 0
      ? `From Tradeal, ${unreadCount > 9 ? '9 or more' : unreadCount} unread`
      : 'From Tradeal')

  const handleOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      if (isPlatformAdmin) void refreshPlatformInbox()
      else void refreshStored()
    }
  }

  const applyNotice = useCallback(async (notificationId: number) => {
    await organisationApi.applyNotificationUpdate(notificationId)
    if (session?.token) {
      const me = await authApi.me()
      saveAuthSession(sessionFromApi(me, session.token))
    }
  }, [session?.token])

  const hasItems = isPlatformAdmin ? platformActions.length > 0 : notifications.length > 0

  return (
    <>
    <DropdownPanel
      open={open}
      onOpenChange={handleOpen}
      width={360}
      placement="aboveDetailPanel"
      zIndex={1100}
      trigger={({ ref, onClick, 'aria-expanded': expanded }) => (
        <Button
          ref={ref}
          variant="ghost"
          size="icon"
          className="h-10 w-10 sm:h-11 sm:w-11 relative"
          onClick={onClick}
          aria-label={ariaLabel}
          aria-expanded={expanded}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white ring-2 ring-white dark:ring-card">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      )}
    >
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-heading">{title}</p>
          <p className="text-xs text-muted">
            {isPlatformAdmin
              ? (unreadCount === 0 ? 'All caught up' : `${unreadCount} open request${unreadCount === 1 ? '' : 's'}`)
              : (unreadCount === 0 ? 'All caught up' : `${unreadCount} unread`)}
          </p>
        </div>
        {!isPlatformAdmin && hasItems && unreadCount > 0 && (
          <button
            type="button"
            onClick={() => void markStoredAllRead()}
            className="text-xs text-accent hover:underline cursor-pointer"
          >
            Mark all read
          </button>
        )}
      </div>

      {!hasItems ? (
        <div className="px-4 py-10 text-center">
          <Bell className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-sm text-muted">
            {isPlatformAdmin ? 'No open requests need attention.' : 'No notices from Tradeal right now.'}
          </p>
        </div>
      ) : isPlatformAdmin ? (
        <div className="max-h-80 overflow-y-auto py-1">
          {platformActions.slice(0, 10).map(action => {
            const Icon = kindIcon[action.kind] ?? AlertCircle
            return (
              <Link
                key={action.id}
                to={action.href}
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors bg-accent/5 dark:bg-accent/10"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-danger dark:bg-red-950/30">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-heading text-pretty">{action.title}</p>
                  <p className="text-xs text-muted mt-0.5 leading-snug">{action.subtitle}</p>
                </div>
                <Badge variant={urgencyVariant[action.urgency]} className="shrink-0 text-[10px]">
                  {action.urgency}
                </Badge>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto py-1">
          {notifications.map(item => {
            const Icon = kindIcon[item.kind] ?? AlertCircle
            const cta = item.payload?.cta
            const showUpdateCta =
              cta === 'update'
              || (!cta && (item.kind === 'product_update' || item.kind === 'feature_launch'))
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
                          setOpen(false)
                          setUpdating(item)
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
              return (
                <div key={item.id} className={className}>
                  {content}
                </div>
              )
            }
            if (item.href) {
              return (
                <Link
                  key={item.id}
                  to={item.href}
                  onClick={() => {
                    void markRead(item.id)
                    setOpen(false)
                  }}
                  className={className}
                >
                  {content}
                </Link>
              )
            }
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => void markRead(item.id)}
                className={className}
              >
                {content}
              </button>
            )
          })}
        </div>
      )}

      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2.5">
        <Link
          to={isPlatformAdmin ? '/platform-admin/seat-requests' : '/app/notifications'}
          onClick={() => setOpen(false)}
          className="text-xs text-accent hover:underline"
        >
          {isPlatformAdmin ? 'Open seat requests →' : 'View all notices →'}
        </Link>
      </div>
    </DropdownPanel>
    <SystemUpdateModal
      open={!!updating}
      notification={updating}
      onClose={() => setUpdating(null)}
      onApply={applyNotice}
    />
    </>
  )
}
