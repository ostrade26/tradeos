import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb, Tabs } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { SendToTradealModal } from '../components/feedback/SendToTradealModal'
import { InboxFeedList } from '../components/inbox/InboxFeedList'
import { useInboxItemActions } from '../hooks/useInboxItemActions'
import { useUnifiedInbox } from '../hooks/useUnifiedInbox'
import { APP_HOME, isPlatformAdminPath } from '../lib/appShellMode'
import { orgNoticesLabels, platformActionInboxLabels } from '../lib/inboxLabels'

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
    markRead,
    refresh,
    refreshPlatform,
  })

  const [filter, setFilter] = useState<InboxFilter>('open')
  const [sendOpen, setSendOpen] = useState(searchParams.get('compose') === '1')

  const visibleRows = useMemo(
    () => (filter === 'open' ? items.filter(row => row.status === 'open') : items),
    [filter, items],
  )

  const focusId = searchParams.get('focus')
  const handledFocusRef = useRef<string | null>(null)
  useEffect(() => {
    if (!focusId || items.length === 0 || handledFocusRef.current === focusId) return
    const row = items.find(item => item.id === focusId)
    if (!row) return
    handledFocusRef.current = focusId
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

  return (
    <div className="animate-fade-in min-w-0 space-y-4">
      <PageHeader
        title="Inbox"
        subtitle={attentionCount > 0 ? `${attentionCount} need attention` : 'All caught up'}
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

      <Tabs
        active={filter}
        onChange={id => setFilter(id as InboxFilter)}
        tabs={[
          { id: 'open', label: 'Open' },
          { id: 'all', label: 'All' },
        ]}
      />

      <div className="rounded-md bg-card shadow-[var(--shadow-card)] overflow-hidden min-h-[24rem]">
        <InboxFeedList
          rows={visibleRows}
          emptyTitle={filter === 'open' ? 'Nothing open' : 'Inbox is empty'}
          emptyDescription={labels.bellEmpty}
          onSelect={handleSelect}
        />
      </div>

      <SendToTradealModal open={sendOpen} onClose={closeCompose} onSent={() => void refresh()} />

      {modals}
    </div>
  )
}
