import { useMemo } from 'react'
import { useAuth } from './useAuth'
import { useMeInbox } from './useMeInbox'
import type { InboxBox } from '../api/inboxApi'
import { sortInboxItems, type UnifiedInboxItem } from '../lib/unifiedInbox'

export function useUnifiedInbox(mode: 'platform' | 'org', box: InboxBox = 'received') {
  const { isAuthenticated, isPlatformAdmin } = useAuth()
  const enabled = isAuthenticated && (mode === 'platform' ? isPlatformAdmin : !isPlatformAdmin)

  const { items: serverItems, openCount, bellCount, refresh, markRead, markAllRead } = useMeInbox(
    enabled,
    box,
  )

  const items = useMemo((): UnifiedInboxItem[] => {
    if (!enabled) return []
    return sortInboxItems(serverItems)
  }, [enabled, serverItems])

  const openItems = useMemo(
    () => items.filter(item => item.status === 'open'),
    [items],
  )

  const badgeCount = useMemo(() => {
    if (!enabled) return 0
    return bellCount
  }, [enabled, bellCount])

  const attentionCount = useMemo(() => {
    if (!enabled) return 0
    return openCount
  }, [enabled, openCount])

  /** @deprecated use refresh — kept for InboxPage platform modals */
  const refreshPlatform = refresh

  return {
    enabled,
    items,
    openItems,
    badgeCount,
    attentionCount,
    refresh,
    markRead,
    markAllRead,
    refreshPlatform,
  }
}
