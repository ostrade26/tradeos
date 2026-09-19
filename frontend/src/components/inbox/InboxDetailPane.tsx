import { ArrowLeft, Bell } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import {
  formatInboxDate,
  inboxIconToneClass,
  inboxItemVisual,
  isFeatureEnhancementNotice,
  isFeatureInterestNotice,
  isProductUpdateNotice,
  notificationKindLabel,
} from '../../lib/notificationDisplay'
import { cn } from '../../lib/utils'
import type { UnifiedInboxItem } from '../../lib/unifiedInbox'
import { isOpenSeatRequest, isSeatRequestDecisionItem } from '../../lib/platformSeatRequestInbox'
import { SeatRequestInboxMessage } from './SeatRequestInboxMessage'

function actionLabel(item: UnifiedInboxItem, platformConsole: boolean): string {
  if (item.productRequest && platformConsole) return 'Review request'
  if (item.seatRequest) {
    if (platformConsole && isOpenSeatRequest(item.seatRequest.status)) return 'Approve'
    return 'Review request'
  }
  if (isSeatRequestDecisionItem(item)) return 'Review request'
  if (item.kind === 'feature_interest' && platformConsole) return 'Review request'
  if (item.notice) {
    if (item.notice.kind === 'deploy_review') return 'Open release'
    if (item.notice.payload?.cta === 'review_interest') return 'Review request'
    if (isFeatureInterestNotice(item.notice)) return 'Express interest'
    if (
      isFeatureEnhancementNotice(item.notice) &&
      !item.notice.applied &&
      !item.notice.applied_at
    ) {
      return 'Choose enhancements'
    }
    if (isProductUpdateNotice(item.notice) && !item.notice.applied && !item.notice.applied_at) {
      return 'Apply update'
    }
    return 'View message'
  }
  if (item.href) return 'Open'
  return 'Open'
}

function kindLabel(item: UnifiedInboxItem): string {
  if (item.kind === 'feature_interest') return 'Feature interest'
  return notificationKindLabel(item.kind)
}

export function InboxDetailPane({
  item,
  platformConsole,
  onBack,
  onOpen,
  className,
}: {
  item: UnifiedInboxItem | null
  platformConsole: boolean
  onBack?: () => void
  onOpen: (item: UnifiedInboxItem) => void
  className?: string
}) {
  if (!item) {
    return (
      <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center h-full', className)}>
        <Bell className="h-7 w-7 text-gray-300 dark:text-gray-600 mb-2.5" aria-hidden />
        <p className="text-sm font-semibold text-heading">Select an item</p>
        <p className="text-xs text-muted mt-1 max-w-xs">
          Choose a conversation from the list to preview it here.
        </p>
      </div>
    )
  }

  const { Icon, tone } = inboxItemVisual(item)
  const isSeatMessage = Boolean(item.seatRequest || item.notice?.kind === 'seat_request')
  const body = item.notice?.body?.trim() || item.subtitle
  const emphasize = item.status === 'open' && (item.unread || item.actionable)
  const cta = actionLabel(item, platformConsole)

  return (
    <div className={cn('flex flex-col h-full min-h-0', className)}>
      <div className="flex items-start gap-3 px-4 sm:px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="lg:hidden mt-0.5 -ml-1 p-1.5 rounded-md text-muted hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer attex-focus"
            aria-label="Back to list"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : null}
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
            emphasize && tone === 'muted'
              ? 'bg-accent/10 text-accent dark:bg-accent/20'
              : inboxIconToneClass(tone),
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-heading text-pretty">{item.title}</h2>
            {item.status === 'done' ? (
              <Badge variant="default" className="text-[10px]">Done</Badge>
            ) : item.unread ? (
              <Badge variant="accent" className="text-[10px]">Unread</Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted mt-1">
            {kindLabel(item)} · {item.from}
            {item.dateIso ? ` · ${formatInboxDate(item.dateIso)}` : ''}
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4">
        {isSeatMessage ? (
          <SeatRequestInboxMessage
            seatRequest={item.seatRequest}
            notice={item.notice}
            statusAudience={platformConsole ? 'platform' : 'org'}
          />
        ) : (
          <p className="text-sm text-heading whitespace-pre-wrap leading-relaxed">{body}</p>
        )}
        <div className="mt-4">
          <Button size="sm" variant="secondary" className="w-full sm:w-auto" onClick={() => onOpen(item)}>
            {cta}
          </Button>
        </div>
      </div>
    </div>
  )
}
