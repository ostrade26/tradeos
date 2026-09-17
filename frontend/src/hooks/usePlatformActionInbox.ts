import { useCallback, useEffect, useState } from 'react'
import { platformApi, type PlatformInboxItem } from '../api/platformApi'
import type { InboxAction } from '../lib/actionInbox'

const POLL_MS = 15_000

function toAction(item: PlatformInboxItem): InboxAction {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    subtitle: item.subtitle,
    href: item.href,
    urgency: item.urgency,
  }
}

export function usePlatformActionInbox(enabled: boolean) {
  const [actions, setActions] = useState<InboxAction[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setActions([])
      setUnread(0)
      return
    }
    setLoading(true)
    try {
      const summary = await platformApi.actionInbox()
      setUnread(summary.unread)
      setActions(summary.items.map(toAction))
    } catch {
      setActions([])
      setUnread(0)
    } finally {
      setLoading(false)
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
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, refresh])

  return { actions, unread, loading, refresh }
}
