import { Bell } from 'lucide-react'
import { EmptyState } from '../ui/Tabs'
import { Badge } from '../ui/Badge'
import { formatInboxDate } from '../../lib/notificationDisplay'
import { cn } from '../../lib/utils'
import type { UnifiedInboxItem } from '../../lib/unifiedInbox'

export function InboxFeedList({
  rows,
  emptyTitle,
  emptyDescription,
  onSelect,
}: {
  rows: UnifiedInboxItem[]
  emptyTitle: string
  emptyDescription: string
  onSelect: (item: UnifiedInboxItem) => void
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Bell className="h-10 w-10" />}
        title={emptyTitle}
        description={emptyDescription}
      />
    )
  }

  return (
    <ul className="divide-y divide-gray-200 dark:divide-gray-700" role="list">
      {rows.map(row => (
        <li key={row.id}>
          <button
            type="button"
            onClick={() => onSelect(row)}
            className="w-full px-4 sm:px-6 py-4 text-left cursor-pointer attex-focus hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'mt-2 h-2 w-2 shrink-0 rounded-full',
                  row.category === 'notice' && row.unread ? 'bg-accent' : 'bg-transparent',
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span
                    className={cn(
                      'text-sm truncate',
                      row.category === 'notice' && row.unread ? 'font-semibold text-heading' : 'font-medium text-heading',
                    )}
                  >
                    {row.title}
                  </span>
                  {row.status === 'done' ? (
                    <Badge variant="default" className="shrink-0 text-[10px]">Done</Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted mt-0.5 truncate">{row.from} · {row.subtitle}</p>
              </div>
              {row.dateIso ? (
                <span className="shrink-0 tabular-nums text-xs text-muted">{formatInboxDate(row.dateIso)}</span>
              ) : null}
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}
