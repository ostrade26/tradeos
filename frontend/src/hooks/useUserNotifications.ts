import { useCallback, useEffect, useState } from 'react'
import { organisationApi } from '../api/organisationApi'
import type { UserNotification } from '../api/platformApi'

const POLL_MS = 20_000

export function useUserNotifications(enabled: boolean) {
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [unread, setUnread] = useState(0)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setNotifications([])
      setUnread(0)
      return
    }
    try {
      const res = await organisationApi.listNotifications(100)
      setNotifications(res.notifications)
      setUnread(res.unread)
    } catch {
      setNotifications([])
      setUnread(0)
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

  const markRead = useCallback(async (id: number) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, unread: false, read_at: n.read_at || new Date().toISOString() } : n)),
    )
    setUnread(prev => Math.max(0, prev - 1))
    try {
      await organisationApi.markNotificationRead(id)
    } catch {
      void refresh()
    }
  }, [refresh])

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false, read_at: n.read_at || new Date().toISOString() })))
    setUnread(0)
    try {
      await organisationApi.markAllNotificationsRead()
    } catch {
      void refresh()
    }
  }, [refresh])

  return { notifications, unread, refresh, markRead, markAllRead }
}
