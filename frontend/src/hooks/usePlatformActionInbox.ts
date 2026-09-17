import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import { platformApi } from '../api/platformApi'
import type { InboxAction } from '../lib/actionInbox'
import { buildPlatformSeatRequestInbox } from '../lib/platformSeatRequestInbox'

const POLL_MS = 15_000
const CLOSED_STATUSES = new Set([
  'approved',
  'rejected',
  'cancelled',
  'canceled',
  'closed',
  'completed',
  'declined',
  'done',
])

type ProductRequestRow = {
  id: number
  organisation_id?: number
  organisation_name?: string
  status?: string
  title?: string
  product_name?: string
  requested_product?: string
}

function isOpenStatus(status: string | undefined): boolean {
  if (!status) return true
  return !CLOSED_STATUSES.has(status.toLowerCase())
}

function productRequestAction(row: ProductRequestRow): InboxAction {
  const org = (row.organisation_name || '').trim() || `Organisation #${row.organisation_id ?? row.id}`
  const product = row.product_name || row.requested_product || row.title || 'product'
  return {
    id: `product-request-${row.id}`,
    kind: 'product_request',
    title: `${org} requested ${product}`,
    subtitle: 'Review this product request',
    href: `/platform-admin/product-requests?highlight=${row.id}`,
    urgency: 'high',
  }
}

async function loadProductRequestActions(): Promise<InboxAction[]> {
  try {
    const payload = await apiFetch<{ requests?: ProductRequestRow[] } | ProductRequestRow[]>(
      '/platform/product-requests',
    )
    const rows = Array.isArray(payload) ? payload : (payload.requests ?? [])
    return rows.filter(row => isOpenStatus(row.status)).map(productRequestAction)
  } catch {
    return []
  }
}

async function loadSeatRequestActions(): Promise<InboxAction[]> {
  try {
    const summary = await platformApi.seatRequestsSummary()
    return buildPlatformSeatRequestInbox(summary.open_requests ?? [])
  } catch {
    return []
  }
}

async function loadInboxActions(): Promise<{ unread: number; actions: InboxAction[] }> {
  const [seatActions, productActions] = await Promise.all([
    loadSeatRequestActions(),
    loadProductRequestActions(),
  ])
  const actions = [...seatActions, ...productActions]
  return { unread: actions.length, actions }
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
      const summary = await loadInboxActions()
      setUnread(summary.unread)
      setActions(summary.actions)
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
