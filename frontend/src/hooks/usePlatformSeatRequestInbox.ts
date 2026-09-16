import { useCallback, useEffect, useState } from 'react'
import { platformApi } from '../api/platformApi'
import { buildPlatformSeatRequestInbox } from '../lib/platformSeatRequestInbox'
import type { InboxAction } from '../lib/actionInbox'

const POLL_MS = 15_000

export function usePlatformSeatRequestInbox(enabled: boolean) {
  const [actions, setActions] = useState<InboxAction[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setActions([])
      setPendingCount(0)
      return
    }
    setLoading(true)
    try {
      const summary = await platformApi.seatRequestsSummary()
      setPendingCount(summary.pending_count)
      setActions(buildPlatformSeatRequestInbox(summary.open_requests))
    } catch {
      setActions([])
      setPendingCount(0)
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

  return { actions, pendingCount, loading, refresh }
}
