import { cn } from '../../lib/utils'
import { inboxIconToneClass, inboxItemVisual } from '../../lib/notificationDisplay'
import type { UnifiedInboxItem } from '../../lib/unifiedInbox'

export function InboxKindGlyph({
  item,
  size = 'md',
  className,
}: {
  item: Pick<UnifiedInboxItem, 'kind' | 'notice' | 'seatRequest' | 'productRequest' | 'send'>
  size?: 'sm' | 'md'
  className?: string
}) {
  const { Icon, tone } = inboxItemVisual(item)
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md',
        size === 'sm' ? 'h-8 w-8' : 'h-9 w-9',
        inboxIconToneClass(tone),
        className,
      )}
      aria-hidden
    >
      <Icon className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
    </span>
  )
}
