import { useCallback, useEffect, useRef, useState } from 'react'
import { inboxApi, type InboxBox } from '../api/inboxApi'
import { apiInboxItemToUnified, type UnifiedInboxItem } from '../lib/unifiedInbox'

const POLL_MS = 20_000
export const INBOX_REFRESH_EVENT = 'tradeal-inbox-refresh'

export function useMeInbox(enabled: boolean, box: InboxBox = 'received') {
  const [items, setItems] = useState<UnifiedInboxItem[]>([])
  const [openCount, setOpenCount] = useState(0)
  const [bellCount, setBellCount] = useState(0)
  /** Box the current `items` were fetched for — used to hide stale rows before paint. */
  const [itemsBox, setItemsBox] = useState<InboxBox>(box)
  const refreshSeq = useRef(0)
  const boxRef = useRef(box)
  boxRef.current = box

  // Clear synchronously when the box changes so Sent never paints Received rows (and vice versa).
  // useEffect clearing is one frame too late and causes the flash.
  if (itemsBox !== box) {
    setItemsBox(box)
    setItems([])
    setOpenCount(0)
    refreshSeq.current += 1
  }

  const refresh = useCallback(async () => {
    if (!enabled) {
      setItems([])
      setOpenCount(0)
      setBellCount(0)
      return
    }
    const requestBox = boxRef.current
    const seq = ++refreshSeq.current
    try {
      const res = await inboxApi.list('all', 100, requestBox)
      if (seq !== refreshSeq.current || boxRef.current !== requestBox) return
      setItems(res.items.map(apiInboxItemToUnified))
      setItemsBox(requestBox)
      setOpenCount(res.open_count)
      setBellCount(res.bell_count ?? res.notice_unread ?? res.open_count)
    } catch {
      if (seq !== refreshSeq.current || boxRef.current !== requestBox) return
      setItems([])
      setItemsBox(requestBox)
      setOpenCount(0)
      setBellCount(0)
    }
  }, [enabled])

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
  }, [enabled, box, refresh])

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

  const removeItems = useCallback(async (ids: string[]) => {
    const deletable = ids.filter(
      id =>
        id.startsWith('notice-') ||
        id.startsWith('send-') ||
        id.startsWith('sent-product-request-'),
    )
    if (deletable.length === 0) return 0
    setItems(prev => prev.filter(item => !deletable.includes(item.id)))
    try {
      const res =
        deletable.length === 1
          ? await inboxApi.deleteItem(deletable[0])
          : await inboxApi.deleteItems(deletable)
      await refresh()
      return res.deleted
    } catch {
      await refresh()
      throw new Error('Could not delete messages')
    }
  }, [refresh])

  // Never expose rows that belong to the other box (belt-and-suspenders for any race).
  const safeItems = itemsBox === box ? items : []

  return { items: safeItems, openCount, bellCount, refresh, markRead, markAllRead, removeItems }
}
