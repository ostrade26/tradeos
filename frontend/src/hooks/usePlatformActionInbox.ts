import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import type { SeatRequest } from '../api/platformApi'
import type { InboxAction, InboxUrgency } from '../lib/actionInbox'

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

type InboxPayload = {
  unread?: number
  items?: Array<{
    id: string
    kind: string
    title: string
    subtitle: string
    href: string
    urgency: InboxUrgency
  }>
}

type ProductRequestRow = {
  id: number
  organisation_id?: number
  organisation_name?: string
  status?: string
  title?: string
  product_name?: string
  requested_product?: string
  created_at?: string
}

function formatInrCents(cents: number | null | undefined): string {
  if (cents == null || cents <= 0) return '—'
  return `₹${(cents / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

async function tryFetch<T>(path: string): Promise<T | null> {
  try {
    return await apiFetch<T>(path)
  } catch {
    return null
  }
}

function isOpenStatus(status: string | undefined): boolean {
  if (!status) return true
  return !CLOSED_STATUSES.has(status.toLowerCase())
}

function seatRequestAction(row: SeatRequest): InboxAction {
  const org = (row.organisation_name || '').trim() || `Organisation #${row.organisation_id}`
  const seats = row.requested_seats || 0
  const seatWord = seats === 1 ? 'seat' : 'seats'
  return {
    id: `seat-request-${row.id}`,
    kind: 'seat_request',
    title: `${org} requested ${seats} ${seatWord}`,
    subtitle: `${formatInrCents(row.amount_cents)} · Approve after payment received`,
    href: `/platform-admin/seat-requests?highlight=${row.id}`,
    urgency: 'high',
  }
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

function productRows(payload: { requests?: ProductRequestRow[] } | ProductRequestRow[] | null): ProductRequestRow[] {
  if (!payload) return []
  const rows = Array.isArray(payload) ? payload : (payload.requests ?? [])
  return rows.filter(row => isOpenStatus(row.status))
}

async function loadInboxActions(): Promise<{ unread: number; actions: InboxAction[] }> {
  const inbox = await tryFetch<InboxPayload>('/platform/inbox')
  if (inbox?.items) {
    return {
      unread: inbox.unread ?? inbox.items.length,
      actions: inbox.items.map(item => ({
        id: item.id,
        kind: item.kind,
        title: item.title,
        subtitle: item.subtitle,
        href: item.href,
        urgency: item.urgency,
      })),
    }
  }

  const [seatSummary, productPayload] = await Promise.all([
    tryFetch<{ pending_count: number; open_requests: SeatRequest[] }>('/platform/seat-requests/summary'),
    tryFetch<{ requests?: ProductRequestRow[] } | ProductRequestRow[]>('/platform/product-requests'),
  ])

  const seatActions = (seatSummary?.open_requests ?? []).map(seatRequestAction)
  const productActions = productRows(productPayload).map(productRequestAction)
  const actions = [...seatActions, ...productActions]
  const unread = seatSummary?.pending_count != null
    ? seatSummary.pending_count + productActions.length
    : actions.length
  return { unread, actions }
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
