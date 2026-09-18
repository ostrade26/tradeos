import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb, Tabs } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { SendToTradealModal } from '../components/feedback/SendToTradealModal'
import { InboxDetailPane } from '../components/inbox/InboxDetailPane'
import { InboxFeedList } from '../components/inbox/InboxFeedList'
import { useInboxItemActions } from '../hooks/useInboxItemActions'
import { useUnifiedInbox } from '../hooks/useUnifiedInbox'
import { APP_HOME, isPlatformAdminPath } from '../lib/appShellMode'
import { orgNoticesLabels, platformActionInboxLabels } from '../lib/inboxLabels'
import { cn } from '../lib/utils'
import type { UnifiedInboxItem } from '../lib/unifiedInbox'

type InboxFilter = 'open' | 'all'

export function InboxPage() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const platformConsole = isPlatformAdminPath(location.pathname)
  const mode = platformConsole ? 'platform' : 'org'
  const labels = platformConsole ? platformActionInboxLabels : orgNoticesLabels
  const home = platformConsole ? '/platform-admin/organisations' : APP_HOME

  const {
    items,
    attentionCount,
    refresh,
    markRead,
    markAllRead,
    refreshPlatform,
  } = useUnifiedInbox(mode)

  const { handleSelect, modals } = useInboxItemActions({
    platformConsole,
    inboxItems: items,
    markRead,
    refresh,
    refreshPlatform,
  })

  const [filter, setFilter] = useState<InboxFilter>('open')
  const [sendOpen, setSendOpen] = useState(searchParams.get('compose') === '1')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileShowDetail, setMobileShowDetail] = useState(false)

  const openCount = useMemo(
    () => items.filter(row => row.status === 'open').length,
    [items],
  )

  const visibleRows = useMemo(
    () => (filter === 'open' ? items.filter(row => row.status === 'open') : items),
    [filter, items],
  )

  useEffect(() => {
    if (visibleRows.length === 0) {
      setSelectedId(null)
      setMobileShowDetail(false)
      return
    }
    if (!selectedId || !visibleRows.some(row => row.id === selectedId)) {
      setSelectedId(visibleRows[0]!.id)
    }
  }, [visibleRows, selectedId])

  const selected: UnifiedInboxItem | null = useMemo(
    () => visibleRows.find(row => row.id === selectedId) ?? null,
    [visibleRows, selectedId],
  )

  const focusId = searchParams.get('focus')
  const handledFocusRef = useRef<string | null>(null)
  useEffect(() => {
    if (!focusId || items.length === 0 || handledFocusRef.current === focusId) return
    const row = items.find(item => item.id === focusId)
    if (!row) return
    handledFocusRef.current = focusId
    setFilter(row.status === 'open' ? 'open' : 'all')
    setSelectedId(row.id)
    setMobileShowDetail(true)
    handleSelect(row)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('focus')
      return next
    }, { replace: true })
  }, [focusId, items, handleSelect, setSearchParams])

  const closeCompose = () => {
    setSendOpen(false)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('compose')
      return next
    }, { replace: true })
  }

  const onRowSelect = (row: UnifiedInboxItem) => {
    setSelectedId(row.id)
    setMobileShowDetail(true)
    if (row.category === 'notice' && row.unread) void markRead(row.id)
  }

  return (
    <div className="animate-fade-in min-w-0">
      <PageHeader
        title="Inbox"
        subtitle={attentionCount > 0 ? `${attentionCount} need attention` : 'Conversations with Tradeal and other accounts'}
        breadcrumb={
          <Breadcrumb
            items={[
              { label: platformConsole ? 'Platform Admin' : 'Tradeal', href: home },
              { label: 'Inbox' },
            ]}
          />
        }
        actionsAlign="end"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!platformConsole ? (
              <Button size="sm" onClick={() => setSendOpen(true)}>
                <MessageSquare className="h-4 w-4" />
                Send to Tradeal
              </Button>
            ) : null}
            {mode === 'org' && attentionCount > 0 ? (
              <Button variant="outline" size="sm" onClick={() => void markAllRead()}>
                Mark all read
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="rounded-md bg-card shadow-[var(--shadow-card)] overflow-hidden flex flex-col h-[min(36rem,calc(100dvh-11rem))] min-h-[22rem]">
        <div className="px-2 sm:px-3 shrink-0">
          <Tabs
            active={filter}
            onChange={id => {
              setFilter(id as InboxFilter)
              setMobileShowDetail(false)
            }}
            buttonClassName="px-4 py-3.5"
            tabs={[
              { id: 'open', label: 'Open', count: openCount },
              { id: 'all', label: 'All', count: items.length },
            ]}
          />
        </div>

        <div className="grid flex-1 min-h-0 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
          {visibleRows.length === 0 ? (
            <div className="col-span-full h-full min-h-0">
              <InboxFeedList
                rows={visibleRows}
                selectedId={selectedId}
                emptyTitle={filter === 'open' ? 'Nothing open' : 'Inbox is empty'}
                emptyDescription={labels.bellEmpty}
                onSelect={onRowSelect}
              />
            </div>
          ) : (
            <>
              <div
                className={cn(
                  'min-h-0 h-full overflow-y-auto lg:border-r lg:border-gray-100 dark:lg:border-gray-800',
                  mobileShowDetail && 'hidden lg:block',
                )}
              >
                <InboxFeedList
                  rows={visibleRows}
                  selectedId={selectedId}
                  emptyTitle={filter === 'open' ? 'Nothing open' : 'Inbox is empty'}
                  emptyDescription={labels.bellEmpty}
                  onSelect={onRowSelect}
                />
              </div>

              <div
                className={cn(
                  'min-h-0 overflow-hidden',
                  !mobileShowDetail && 'hidden lg:block',
                )}
              >
                <InboxDetailPane
                  item={selected}
                  platformConsole={platformConsole}
                  onBack={() => setMobileShowDetail(false)}
                  onOpen={handleSelect}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <SendToTradealModal open={sendOpen} onClose={closeCompose} onSent={() => void refresh()} />

      {modals}
    </div>
  )
}
