import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb, Tabs } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { SendToTradealModal } from '../components/feedback/SendToTradealModal'
import { InboxDetailPane } from '../components/inbox/InboxDetailPane'
import { InboxFeedList } from '../components/inbox/InboxFeedList'
import { InboxSentTable } from '../components/inbox/InboxSentTable'
import { useInboxItemActions } from '../hooks/useInboxItemActions'
import { useUnifiedInbox } from '../hooks/useUnifiedInbox'
import type { InboxBox } from '../api/inboxApi'
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

  const boxParam = searchParams.get('box')
  const [box, setBox] = useState<InboxBox>(boxParam === 'sent' ? 'sent' : 'received')

  const {
    items,
    attentionCount,
    refresh,
    markRead,
    markAllRead,
    refreshPlatform,
  } = useUnifiedInbox(mode, box)

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
    () => (box === 'sent' ? items : filter === 'open' ? items.filter(row => row.status === 'open') : items),
    [filter, items, box],
  )

  useEffect(() => {
    if (box === 'sent') return
    if (visibleRows.length === 0) {
      setSelectedId(null)
      setMobileShowDetail(false)
      return
    }
    if (!selectedId || !visibleRows.some(row => row.id === selectedId)) {
      setSelectedId(visibleRows[0]!.id)
    }
  }, [visibleRows, selectedId, box])

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
    setBox('received')
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

  const switchBox = (next: InboxBox) => {
    setBox(next)
    setMobileShowDetail(false)
    setSelectedId(null)
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
            ? platformConsole
              ? 'Updates and reminders you have sent'
              : 'Requests you have sent to Tradeal'
            : attentionCount > 0
              ? `${attentionCount} need attention`
              : platformConsole
                ? 'Work and notices addressed to you'
                : 'Messages from Tradeal'
        }
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
            {mode === 'org' && box === 'received' && attentionCount > 0 ? (
              <Button variant="outline" size="sm" onClick={() => void markAllRead()}>
                Mark all read
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="rounded-md bg-card shadow-[var(--shadow-card)] overflow-hidden flex flex-col min-h-[22rem]">
        <div className="px-2 sm:px-3 shrink-0 border-b border-gray-100 dark:border-gray-800">
          <Tabs
            active={box}
            onChange={id => switchBox(id as InboxBox)}
            buttonClassName="px-4 py-3.5"
            tabs={[
              {
                id: 'received',
                label: labels.receivedTab,
                count: box === 'received' ? openCount : undefined,
              },
              {
                id: 'sent',
                label: labels.sentTab,
                count: box === 'sent' ? items.length : undefined,
              },
            ]}
          />
        </div>

        {box === 'sent' ? (
          <div className="p-4 sm:p-5">
            <InboxSentTable rows={visibleRows} emptyDescription={labels.sentEmpty} />
          </div>
        ) : (
          <div className="grid flex-1 min-h-[22rem] h-[min(32rem,calc(100dvh-14rem))] lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
            <div
              className={cn(
                'min-h-0 h-full flex flex-col lg:border-r lg:border-gray-100 dark:lg:border-gray-800',
                mobileShowDetail && 'hidden lg:flex',
              )}
            >
              <div className="shrink-0 flex items-center px-3 py-2.5 border-b border-gray-100 dark:border-gray-800">
                <SegmentedControl
                  size="sm"
                  ariaLabel="Filter received items"
                  value={filter}
                  onChange={id => {
                    setFilter(id)
                    setMobileShowDetail(false)
                  }}
                  options={[
                    { id: 'open', label: openCount > 0 ? `Open (${openCount})` : 'Open' },
                    { id: 'all', label: 'All' },
                  ]}
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <InboxFeedList
                  rows={visibleRows}
                  selectedId={selectedId}
                  emptyTitle={filter === 'open' ? 'Nothing open' : 'Nothing received'}
                  emptyDescription={labels.receivedEmpty}
                  onSelect={onRowSelect}
                />
              </div>
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
          </div>
        )}
      </div>

      <SendToTradealModal open={sendOpen} onClose={closeCompose} onSent={() => void refresh()} />

      {modals}
    </div>
  )
}
