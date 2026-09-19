import { useCallback, useEffect, useRef, useState } from 'react'
import { inboxApi, type InboxBox } from '../api/inboxApi'
import { apiInboxItemToUnified, type UnifiedInboxItem } from '../lib/unifiedInbox'

const POLL_MS = 20_000
export const INBOX_REFRESH_EVENT = 'tradeal-inbox-refresh'

export function useMeInbox(enabled: boolean, box: InboxBox = 'received') {
  const [items, setItems] = useState<UnifiedInboxItem[]>([])
  const [openCount, setOpenCount] = useState(0)
  const [bellCount, setBellCount] = useState(0)
  const refreshSeq = useRef(0)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setItems([])
      setOpenCount(0)
      setBellCount(0)
      return
    }
    const seq = ++refreshSeq.current
    try {
      const res = await inboxApi.list('all', 100, box)
      if (seq !== refreshSeq.current) return
      setItems(res.items.map(apiInboxItemToUnified))
      setOpenCount(res.open_count)
      setBellCount(res.bell_count ?? res.notice_unread ?? res.open_count)
    } catch {
      if (seq !== refreshSeq.current) return
      setItems([])
      setOpenCount(0)
      setBellCount(0)
    }
  }, [enabled, box])

  useEffect(() => {
    void refresh()
    if (!enabled) return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, POLL_MS)
    const onFocus = () => void refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    const onTradeRefresh = () => {
      queueMicrotask(() => void refresh())
    }
    window.addEventListener(INBOX_REFRESH_EVENT, onTradeRefresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener(INBOX_REFRESH_EVENT, onTradeRefresh)
    }
  }, [enabled, refresh])

  const markRead = useCallback(async (itemId: string) => {
    if (!itemId.startsWith('notice-')) return
    setItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? {
              ...item,
              unread: false,
              status: 'done' as const,
              actionable: false,
              notice: item.notice
                ? { ...item.notice, unread: false, read_at: item.notice.read_at || new Date().toISOString() }
                : undefined,
            }
          : item,
      ),
    )
    try {
      await inboxApi.markItemRead(itemId)
    } catch {
      /* refresh restores server state */
    }
    await refresh()
  }, [refresh])

  const markAllRead = useCallback(async () => {
    try {
      await inboxApi.markAllRead()
    } catch {
      /* refresh restores server state */
    }
    await refresh()
  }, [refresh])

  return { items, openCount, bellCount, refresh, markRead, markAllRead }
}
