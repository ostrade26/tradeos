import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useInboxItemActions } from '../../hooks/useInboxItemActions'
import { useUnifiedInbox } from '../../hooks/useUnifiedInbox'
import { Button } from '../ui/Button'
import { DropdownPanel } from './DropdownPanel'
import { orgNoticesLabels, platformActionInboxLabels } from '../../lib/inboxLabels'
import { formatInboxDate } from '../../lib/notificationDisplay'
import { cn } from '../../lib/utils'
import { appPath } from '../../lib/appShellMode'
import { InboxKindGlyph } from '../inbox/InboxKindGlyph'

export function NotificationsDropdown({
  triggerClassName,
}: {
  triggerClassName?: string
} = {}) {
  const [open, setOpen] = useState(false)
  const { isPlatformAdmin } = useAuth()
  const mode = isPlatformAdmin ? 'platform' : 'org'
  const platformConsole = isPlatformAdmin
  const { items, openItems, badgeCount, refresh, markAllRead, markRead, refreshPlatform } = useUnifiedInbox(mode)
  const labels = isPlatformAdmin ? platformActionInboxLabels : orgNoticesLabels
  const inboxPath = isPlatformAdmin ? '/platform-admin/notifications' : appPath('/notifications')

  const { handleSelect, modals } = useInboxItemActions({
    platformConsole,
    inboxItems: items,
    markRead,
    refresh,
    refreshPlatform,
  })

  const preview = useMemo(() => {
    if (platformConsole) {
      // Platform: open work + unread notices (deploy drafts, etc.)
      const unreadNotices = items.filter(row => row.category === 'notice' && row.unread)
      const seen = new Set(openItems.map(r => r.id))
      const merged = [...openItems]
      for (const row of unreadNotices) {
        if (!seen.has(row.id)) merged.push(row)
      }
      return merged.slice(0, 8)
    }
    // Org FYI notices stay status=done while unread — match inbox Open filter.
    return items
      .filter(row => row.category === 'notice' && row.unread)
      .slice(0, 8)
  }, [items, openItems, platformConsole])

  const handleOpen = (next: boolean) => {
    setOpen(next)
    if (next) void refresh()
  }

  const onPreviewClick = (row: (typeof preview)[number]) => {
    setOpen(false)
    handleSelect(row)
  }

  const badgeLabel = badgeCount > 0
    ? `${labels.bellTitle}, ${badgeCount > 9 ? '9 or more' : badgeCount} need attention`
    : labels.bellTitle

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
            className={cn('h-10 w-10 sm:h-11 sm:w-11 relative', triggerClassName)}
            onClick={onClick}
            aria-label={badgeLabel}
            aria-expanded={expanded}
            data-tour="header-notifications"
          >
            <Bell className="h-5 w-5" />
            {badgeCount > 0 && (
              <span className="absolute top-2 right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white ring-2 ring-white dark:ring-card">
                {badgeCount > 9 ? '9+' : badgeCount}
              </span>
            )}
          </Button>
        )}
      >
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-heading">{labels.bellTitle}</p>
            <p className="text-xs text-muted">
              {badgeCount === 0 ? 'All caught up' : `${badgeCount} need attention`}
            </p>
          </div>
          {badgeCount > 0 ? (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="text-xs text-accent hover:underline cursor-pointer"
            >
              Mark all read
            </button>
          ) : null}
        </div>

      {preview.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <Bell className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-sm text-muted">
            {badgeCount === 0 ? labels.bellEmpty : 'Open inbox for conversations.'}
          </p>
        </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {preview.map((row, index) => (
              <button
                key={row.id}
                type="button"
                onClick={() => onPreviewClick(row)}
                className={cn(
                  'flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors cursor-pointer',
                  row.unread && 'bg-accent/5 dark:bg-accent/10',
                  index < preview.length - 1 && 'border-b border-gray-200 dark:border-gray-700',
                )}
              >
                <InboxKindGlyph item={row} size="sm" className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-heading text-pretty truncate">{row.title}</p>
                  <p className="text-xs text-muted mt-0.5 leading-snug truncate">
                    {row.from} · {row.subtitle}
                  </p>
                  {row.dateIso ? (
                    <p className="text-[11px] tabular-nums mt-1 text-gray-400 dark:text-gray-500">
                      {formatInboxDate(row.dateIso)}
                    </p>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2.5">
          <Link
            to={inboxPath}
            onClick={() => setOpen(false)}
            className="text-xs text-accent hover:underline"
          >
            Open inbox →
          </Link>
        </div>
      </DropdownPanel>

      {modals}
    </>
  )
}
