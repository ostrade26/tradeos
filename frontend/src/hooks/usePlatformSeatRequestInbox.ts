import { useCallback, useEffect, useState } from 'react'
import { platformApi } from '../api/platformApi'
import { buildPlatformSeatRequestInbox, isOpenSeatRequest } from '../lib/platformSeatRequestInbox'
import { buildPlatformProductRequestInbox, isOpenProductRequest } from '../lib/platformProductRequestInbox'
import type { InboxAction } from '../lib/actionInbox'

const POLL_MS = 15_000

function sortInbox(actions: InboxAction[]): InboxAction[] {
  return [...actions].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return bTime - aTime
  })
}

export function usePlatformSeatRequestInbox(enabled: boolean) {
  const [actions, setActions] = useState<InboxAction[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [openProductRequests, setOpenProductRequests] = useState(0)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setActions([])
      setPendingCount(0)
      setOpenProductRequests(0)
      return
    }
    setLoading(true)
    try {
      const [seats, products] = await Promise.allSettled([
        platformApi.listSeatRequests(),
        platformApi.listProductRequests(),
      ])
      const seatRows = seats.status === 'fulfilled' ? seats.value.requests : []
      const productRows = products.status === 'fulfilled' ? products.value.requests : []
      setPendingCount(seatRows.filter(r => isOpenSeatRequest(r.status)).length)
      setOpenProductRequests(productRows.filter(r => isOpenProductRequest(r.status)).length)
      setActions(sortInbox([
        ...buildPlatformProductRequestInbox(productRows),
        ...buildPlatformSeatRequestInbox(seatRows),
      ]))
    } catch {
      setActions([])
      setPendingCount(0)
      setOpenProductRequests(0)
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

  const actionOpenCount = pendingCount + openProductRequests

  return { actions, pendingCount, openProductRequests, actionOpenCount, loading, refresh }
}
