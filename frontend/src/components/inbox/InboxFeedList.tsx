import { Bell } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { formatInboxDate, inboxIconToneClass, inboxItemVisual } from '../../lib/notificationDisplay'
import { cn } from '../../lib/utils'
import type { UnifiedInboxItem } from '../../lib/unifiedInbox'

export function InboxFeedList({
  rows,
  emptyTitle,
  emptyDescription,
  selectedId,
  onSelect,
}: {
  rows: UnifiedInboxItem[]
  emptyTitle: string
  emptyDescription: string
  selectedId?: string | null
  onSelect: (item: UnifiedInboxItem) => void
}) {
  if (rows.length === 0) {
    return (
      <div className="flex h-full min-h-full flex-col items-center justify-center px-6 text-center">
        <Bell className="h-7 w-7 text-gray-300 dark:text-gray-600 mb-2.5" aria-hidden />
        <h3 className="text-sm font-semibold text-heading">{emptyTitle}</h3>
        <p className="text-xs text-muted mt-1 max-w-sm">{emptyDescription}</p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-800" role="list">
      {rows.map(row => {
        const { Icon, tone } = inboxItemVisual(row)
        const emphasize = row.status === 'open' && (row.unread || row.actionable)
        const selected = selectedId === row.id
        return (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => onSelect(row)}
              aria-current={selected ? 'true' : undefined}
              className={cn(
                'w-full px-3 sm:px-4 py-2.5 text-left cursor-pointer attex-focus transition-colors',
                'hover:bg-gray-50 dark:hover:bg-zinc-800/50',
                selected
                  ? 'bg-accent/10 dark:bg-accent/15'
                  : emphasize && 'bg-accent/[0.04] dark:bg-accent/10',
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    row.unread ? 'bg-accent' : 'bg-transparent',
                  )}
                  aria-hidden
                />
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                    selected && tone === 'muted'
                      ? 'bg-accent/10 text-accent dark:bg-accent/20'
                      : inboxIconToneClass(tone),
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span
                      className={cn(
                        'text-sm truncate min-w-0',
                        emphasize || selected ? 'font-semibold text-heading' : 'font-medium text-heading',
                      )}
                    >
                      {row.title}
                    </span>
                    {row.status === 'done' ? (
                      <Badge variant="default" className="shrink-0 text-[10px]">Done</Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted mt-0.5 truncate leading-snug">
                    {row.from} · {row.subtitle}
                  </p>
                </div>
                {row.dateIso ? (
                  <span className="shrink-0 self-start pt-0.5 tabular-nums text-[11px] text-muted">
                    {formatInboxDate(row.dateIso)}
                  </span>
                ) : null}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
