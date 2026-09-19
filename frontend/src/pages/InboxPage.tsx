import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb, Tabs } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { SendToTradealModal } from '../components/feedback/SendToTradealModal'
import { PlatformNotifyModal } from '../components/platform/PlatformNotifyModal'
import { InboxFiltersBar, type InboxStatusFilter } from '../components/inbox/InboxFiltersBar'
import { InboxReceivedTable } from '../components/inbox/InboxReceivedTable'
import { InboxSentTable } from '../components/inbox/InboxSentTable'
import { useInboxItemActions } from '../hooks/useInboxItemActions'
import { useUnifiedInbox } from '../hooks/useUnifiedInbox'
import { useDetailPanelSlot } from '../components/layout/DetailPanelSlot'
import { useToast } from '../hooks/useToast'
import type { InboxBox } from '../api/inboxApi'
import { ApiError } from '../api/client'
import {
  platformApi,
  type NotificationAudience,
  type NotificationKind,
  type NotificationRecipientScope,
  type PlatformOrganisation,
  type PlatformUser,
} from '../api/platformApi'
import { APP_HOME, isPlatformAdminPath } from '../lib/appShellMode'
import { orgNoticesLabels, platformActionInboxLabels } from '../lib/inboxLabels'
import { notificationKindLabel } from '../lib/notificationDisplay'
import type { UnifiedInboxItem } from '../lib/unifiedInbox'

function matchesSearch(row: UnifiedInboxItem, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const kind =
    row.kind === 'feature_interest' ? 'feature interest' : notificationKindLabel(row.kind).toLowerCase()
  return (
    row.title.toLowerCase().includes(q) ||
    row.subtitle.toLowerCase().includes(q) ||
    row.from.toLowerCase().includes(q) ||
    kind.includes(q)
  )
}

export function InboxPage() {
  const location = useLocation()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const platformConsole = isPlatformAdminPath(location.pathname)
  const mode = platformConsole ? 'platform' : 'org'
  const labels = platformConsole ? platformActionInboxLabels : orgNoticesLabels
  const home = platformConsole ? '/platform-admin/organisations' : APP_HOME

  const boxParam = searchParams.get('box')
  const [box, setBox] = useState<InboxBox>(boxParam === 'sent' ? 'sent' : 'received')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<InboxStatusFilter>('all')
  const [composeOpen, setComposeOpen] = useState(searchParams.get('compose') === '1')
  const [focusSelectId, setFocusSelectId] = useState<string | null>(null)

  const [organisations, setOrganisations] = useState<PlatformOrganisation[]>([])
  const [orgUsers, setOrgUsers] = useState<PlatformUser[]>([])
  const [savingNotice, setSavingNotice] = useState(false)

  const { setOpen: setDetailPanelOpen } = useDetailPanelSlot()

  const {
    items,
    attentionCount,
    badgeCount,
    refresh,
    markRead,
    markAllRead,
    removeItems,
    refreshPlatform,
  } = useUnifiedInbox(mode, box)

  const { handleSelect, openSeatDecision, modals } = useInboxItemActions({
    platformConsole,
    inboxItems: items,
    markRead,
    refresh,
    refreshPlatform,
  })

  const handleRejectSeat = (row: UnifiedInboxItem) => {
    if (row.seatRequest) openSeatDecision('reject', row.seatRequest)
  }

  const openCount = useMemo(
    () =>
      items.filter(row =>
        row.category === 'notice' ? row.unread : row.status === 'open',
      ).length,
    [items],
  )

  const receivedNewLabel = useMemo(() => {
    if (badgeCount <= 0) return undefined
    const n = Math.min(badgeCount, 99)
    return `New ${String(n).padStart(2, '0')}`
  }, [badgeCount])

  const visibleRows = useMemo(() => {
    const byStatus =
      box === 'sent' || statusFilter === 'all'
        ? items
        : items.filter(row =>
            row.category === 'notice' ? row.unread : row.status === 'open',
          )
    return byStatus.filter(row => matchesSearch(row, search))
  }, [box, items, search, statusFilter])

  const focusId = searchParams.get('focus')
  const handledFocusRef = useRef<string | null>(null)
  useEffect(() => {
    if (!focusId || items.length === 0 || handledFocusRef.current === focusId) return
    const row = items.find(item => item.id === focusId)
    if (!row) return
    handledFocusRef.current = focusId
    setBox('received')
    setStatusFilter(row.status === 'open' ? 'open' : 'all')
    setSearch('')
    setFocusSelectId(row.id)
    handleSelect(row)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('focus')
      return next
    }, { replace: true })
  }, [focusId, items, handleSelect, setSearchParams])

  useEffect(() => {
    if (!platformConsole || !composeOpen) return
    let cancelled = false
    void (async () => {
      try {
        const [orgsRes, usersRes] = await Promise.all([
          platformApi.listOrganisations(),
          platformApi.listUsers(),
        ])
        if (cancelled) return
        setOrganisations(orgsRes.organisations)
        setOrgUsers(usersRes.users)
      } catch {
        if (cancelled) return
        setOrganisations([])
        setOrgUsers([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [platformConsole, composeOpen])

  const closeCompose = () => {
    setComposeOpen(false)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('compose')
      return next
    }, { replace: true })
  }

  const submitNotice = async (payload: {
    audience: NotificationAudience
    organisation_id: number | null
    recipient_user_id: number | null
    recipient_scope: NotificationRecipientScope
    exclude_expired_amc: boolean
    kind: NotificationKind
    title: string
    body: string
    feature_key?: string
    items?: string
  }) => {
    setSavingNotice(true)
    try {
      const res = await platformApi.sendNotification({
        ...payload,
        payload: payload.items ? { items: payload.items } : undefined,
      })
      const skipped = res.skipped_expired_amc
        ? ` · ${res.skipped_expired_amc} skipped (expired AMC)`
        : ''
      toast.success(`Sent to ${res.sent} ${res.sent === 1 ? 'person' : 'people'}${skipped}`)
      closeCompose()
      await refresh()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not send update')
    } finally {
      setSavingNotice(false)
    }
  }

  const switchBox = (next: InboxBox) => {
    // Never carry a Received detail panel into Sent (or vice versa).
    setDetailPanelOpen(false)
    setBox(next)
    setSearch('')
    setFocusSelectId(null)
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      if (next === 'sent') p.set('box', 'sent')
      else p.delete('box')
      return p
    }, { replace: true })
  }

  return (
    <div className="animate-fade-in min-w-0">
      <PageHeader
        title="Inbox"
        subtitle={
          box === 'sent'
            ? 'Messages you have sent'
            : attentionCount > 0
              ? `${attentionCount} need attention`
              : 'Messages addressed to you'
        }
        breadcrumb={
          <Breadcrumb
            items={[
              { label: platformConsole ? 'Tradeal Admin' : 'Tradeal', href: home },
              { label: 'Inbox' },
            ]}
          />
        }
        actionsAlign="end"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setComposeOpen(true)}>
              <MessageSquare className="h-4 w-4" />
              {labels.composeCta}
            </Button>
            {box === 'received' && attentionCount > 0 ? (
              <Button variant="outline" size="sm" onClick={() => void markAllRead()}>
                Mark all read
              </Button>
            ) : null}
          </div>
        }
      />

      <Tabs
        className="mb-4"
        active={box}
        onChange={id => switchBox(id as InboxBox)}
        tabs={[
          {
            id: 'received',
            label: labels.receivedTab,
            countLabel: receivedNewLabel,
          },
          {
            id: 'sent',
            label: labels.sentTab,
            count: box === 'sent' ? items.length : undefined,
          },
        ]}
      />

      <InboxFiltersBar
        box={box}
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        openCount={openCount}
        openFilterLabel="Unread"
      />

      {box === 'sent' ? (
        <InboxSentTable
          key="sent"
          rows={visibleRows}
          emptyDescription={labels.sentEmpty}
          onDeleteItems={removeItems}
        />
      ) : (
        <InboxReceivedTable
          key="received"
          rows={visibleRows}
          statusFilter={statusFilter}
          emptyDescription={labels.receivedEmpty}
          platformConsole={platformConsole}
          focusId={focusSelectId}
          onOpen={handleSelect}
          onMarkRead={id => void markRead(id)}
          onRejectSeat={platformConsole ? handleRejectSeat : undefined}
          onDeleteItems={removeItems}
        />
      )}

      {platformConsole ? (
        <PlatformNotifyModal
          open={composeOpen}
          onClose={() => !savingNotice && closeCompose()}
          organisations={organisations}
          users={orgUsers}
          defaultAudience="active_licences"
          loading={savingNotice}
          onSubmit={payload => void submitNotice(payload)}
        />
      ) : (
        <SendToTradealModal open={composeOpen} onClose={closeCompose} onSent={() => void refresh()} />
      )}

      {modals}
    </div>
  )
}
