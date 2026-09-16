import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, AlertCircle, Clock, Link2, Package, Trash2, Truck, UserPlus } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { usePlatformSeatRequestInbox } from '../../hooks/usePlatformSeatRequestInbox'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { DropdownPanel } from './DropdownPanel'
import { buildActionInbox, type InboxAction } from '../../lib/actionInbox'
import { countUnread, getReadNotificationIds, markAllNotificationsRead, markNotificationRead } from '../../lib/notifications'
import { useTradeStore } from '../../store/TradeStore'
import { cn } from '../../lib/utils'

const kindIcon: Record<string, typeof Truck> = {
  po_lift: Truck,
  so_lift: Truck,
  unlinked_so: Link2,
  low_stock: Package,
  deletion: Trash2,
  delivery: Clock,
  seat_request: UserPlus,
}

const urgencyVariant: Record<InboxAction['urgency'], 'danger' | 'warning' | 'default'> = {
  high: 'danger',
  medium: 'warning',
  low: 'default',
}

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false)
  const [readTick, setReadTick] = useState(0)
  const { isPlatformAdmin } = useAuth()
  const store = useTradeStore()
  const { actions: platformSeatActions, refresh: refreshPlatformSeats } = usePlatformSeatRequestInbox(isPlatformAdmin)
  const tradeActions = useMemo(() => buildActionInbox(store), [store, readTick])
  const actions = useMemo(
    () => [...platformSeatActions, ...tradeActions],
    [platformSeatActions, tradeActions],
  )
  const readIds = useMemo(() => getReadNotificationIds(), [readTick])
  const unreadCount = useMemo(() => countUnread(actions.map(a => a.id)), [actions, readTick])

  const handleOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      setReadTick(t => t + 1)
      if (isPlatformAdmin) void refreshPlatformSeats()
    }
  }

  const handleItemClick = (id: string) => {
    markNotificationRead(id)
    setReadTick(t => t + 1)
    setOpen(false)
  }

  const handleMarkAllRead = () => {
    markAllNotificationsRead(actions.map(a => a.id))
    setReadTick(t => t + 1)
  }

  return (
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
          aria-label={unreadCount > 0
            ? `Notifications, ${unreadCount > 9 ? '9 or more' : unreadCount} unread`
            : 'Notifications'}
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
          <p className="text-sm font-semibold text-heading">Notifications</p>
          <p className="text-xs text-muted">
            {unreadCount === 0 ? 'All caught up' : `${unreadCount} unread`}
          </p>
        </div>
        {actions.length > 0 && unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-xs text-accent hover:underline cursor-pointer"
          >
            Mark all read
          </button>
        )}
      </div>

      {actions.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <Bell className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-sm text-muted">No pending alerts right now.</p>
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto py-1">
          {actions.slice(0, 10).map(action => {
            const Icon = kindIcon[action.kind] ?? AlertCircle
            const isUnread = !readIds.has(action.id)
            return (
              <Link
                key={action.id}
                to={action.href}
                onClick={() => handleItemClick(action.id)}
                className={cn(
                  'flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors',
                  isUnread && 'bg-accent/5 dark:bg-accent/10',
                )}
              >
                <div className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  action.urgency === 'high' && 'bg-red-50 text-danger dark:bg-red-950/30',
                  action.urgency === 'medium' && 'bg-amber-50 text-warning dark:bg-amber-950/30',
                  action.urgency === 'low' && 'bg-gray-100 text-gray-500 dark:bg-gray-700/50',
                )}>
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
      )}

      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2.5">
        <Link
          to={isPlatformAdmin && platformSeatActions.length > 0 ? '/platform-admin/seat-requests' : '/'}
          onClick={() => setOpen(false)}
          className="text-xs text-accent hover:underline"
        >
          {isPlatformAdmin && platformSeatActions.length > 0
            ? 'Open seat requests →'
            : 'View action inbox on dashboard →'}
        </Link>
      </div>
    </DropdownPanel>
  )
}
