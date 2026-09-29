import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { MessageSquare, PanelRight, PanelRightClose, Send, Trash2 } from 'lucide-react'
import { DataTable } from '../ui/DataTable'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { ConfirmDeleteModal } from '../ui/DeleteActions'
import { DetailPanelMenu, groupMenuItems, type DetailPanelMenuItem } from '../ui/DetailPanelMenu'
import { Drawer, DockedPanel } from '../ui/Drawer'
import {
  DetailGroup,
  DetailInlineStat,
  DetailInlineStatRow,
  DetailMetricsSection,
  DetailPanelBody,
  DetailRow,
} from '../registers/DetailPanelSections'
import { useDetailPanelSlot } from '../layout/DetailPanelSlot'
import { useLargeScreen } from '../../hooks/useMediaQuery'
import { useTableDensity } from '../../hooks/useTableDensity'
import { loadOrderPanelDocked, saveOrderPanelDocked } from '../../lib/orderPanelDock'
import { notificationKindLabel, formatInboxDate, noticeChangelog } from '../../lib/notificationDisplay'
import { NoticeMessage } from '../feedback/NoticeMessage'
import { formatDateTime } from '../../lib/utils'
import { requestRecipientLabel } from '../feedback/SendToTradealModal'
import type { UnifiedInboxItem } from '../../lib/unifiedInbox'
import { hasInboxWorkflowStatus } from '../../lib/unifiedInbox'
import { InboxKindGlyph } from './InboxKindGlyph'

function isSentToTradeal(item: UnifiedInboxItem): boolean {
  return item.category === 'sent' && Boolean(item.productRequest) && !item.send
}

function isDeletableSent(item: UnifiedInboxItem): boolean {
  if (item.id.startsWith('sent-product-request-')) return true
  if (item.id.startsWith('send-')) return item.send?.actor_user_id != null
  return false
}

function sentTypeLabel(item: UnifiedInboxItem): string {
  if (isSentToTradeal(item)) return 'Request'
  return notificationKindLabel(item.kind)
}

function sourceLabel(source: string | undefined): string {
  if (source === 'schedule') return 'Scheduled'
  if (source === 'release') return 'Release'
  if (source === 'credentials') return 'Credentials'
  if (source === 'manual') return 'Manual'
  return source ? source.replace(/_/g, ' ') : ''
}

function statusLabel(status: string | undefined): string {
  if (!status) return ''
  return status.replace(/_/g, ' ')
}

function sentStatusBadge(item: UnifiedInboxItem): ReactNode {
  if (!hasInboxWorkflowStatus(item)) {
    return <span className="text-sm text-muted">—</span>
  }
  const sizeClass = 'text-sm px-2.5 py-1'
  const request = item.productRequest
  if (request && (isSentToTradeal(item) || item.send)) {
    const s = String(request.status || '').toLowerCase()
    if (s === 'done') {
      return (
        <Badge variant="success" dot className={sizeClass}>
          Done
        </Badge>
      )
    }
    if (s === 'in_progress') {
      return (
        <Badge variant="warning" dot className={sizeClass}>
          In progress
        </Badge>
      )
    }
    return (
      <Badge variant="accent" dot className={sizeClass}>
        Received
      </Badge>
    )
  }
  return <span className="text-sm text-muted">—</span>
}

function sentToLabel(row: UnifiedInboxItem): string {
  if (isSentToTradeal(row)) return requestRecipientLabel('tradeal')
  if (row.send && row.kind === 'product_request' && row.productRequest?.organisation_name) {
    return row.productRequest.organisation_name
  }
  const n = row.send?.sent_count
  if (n == null) return '—'
  return `${n} ${n === 1 ? 'person' : 'people'}`
}

function buildSentMenuItems({
  item,
  onDelete,
}: {
  item: UnifiedInboxItem
  onDelete: (item: UnifiedInboxItem) => void
}): DetailPanelMenuItem[] {
  if (!isDeletableSent(item)) return []
  return groupMenuItems([
    {
      items: [
        {
          type: 'button' as const,
          label: 'Delete',
          icon: Trash2,
          tone: 'danger' as const,
          onClick: () => onDelete(item),
        },
      ],
    },
  ])
}

function SentRowActions({
  item,
  onDelete,
}: {
  item: UnifiedInboxItem
  onDelete: (item: UnifiedInboxItem) => void
}) {
  const { classes: density } = useTableDensity()
  const items = useMemo(() => buildSentMenuItems({ item, onDelete }), [item, onDelete])

  if (items.length === 0) {
    return <span className="block w-8" aria-hidden />
  }

  return (
    <div className="flex justify-center" onClick={e => e.stopPropagation()}>
      <DetailPanelMenu items={items} tableTrigger={density.menuTrigger} />
    </div>
  )
}

function SentDetailPanel({ item }: { item: UnifiedInboxItem }) {
  const toTradeal = isSentToTradeal(item)
  const source = sourceLabel(item.send?.source)
  const originalMessage = (item.productRequest?.message || '').trim()
  const replyBody = (item.send?.body || item.productRequest?.reply || '').trim()
  // Tradeal reply in Sent — same thread as org Received (request + reply).
  const isReplyThread = Boolean(item.send && item.kind === 'product_request' && originalMessage)
  const message = isReplyThread
    ? ''
    : (item.send?.body || item.productRequest?.message || '').trim()
  const recipientCount = item.send?.sent_count
  const when = item.dateIso ? formatDateTime(item.dateIso) : '—'
  const requestStatus = statusLabel(item.productRequest?.status)
  const orgName = (item.productRequest?.organisation_name || '').trim()
  const requestedBy = (item.productRequest?.requested_by_name || '').trim()

  return (
    <DetailPanelBody>
      <DetailMetricsSection>
        <DetailInlineStatRow>
          {toTradeal || isReplyThread ? (
            <DetailInlineStat
              label="Status"
              value={<span className="capitalize">{requestStatus || '—'}</span>}
            />
          ) : (
            <DetailInlineStat
              label="Recipients"
              value={
                recipientCount == null
                  ? '—'
                  : `${recipientCount} ${recipientCount === 1 ? 'person' : 'people'}`
              }
            />
          )}
          <DetailInlineStat label="When" value={when} />
        </DetailInlineStatRow>
      </DetailMetricsSection>

      {isReplyThread ? (
        <DetailGroup title="Details" icon={Send}>
          <div className="space-y-2.5">
            {orgName ? <DetailRow label="To" value={orgName} /> : null}
            {requestedBy ? <DetailRow label="Request from" value={requestedBy} /> : null}
            {source ? <DetailRow label="Source" value={source} /> : null}
          </div>
        </DetailGroup>
      ) : (!toTradeal && item.subtitle) || source || toTradeal ? (
        <DetailGroup title="Details" icon={Send}>
          <div className="space-y-2.5">
            {!toTradeal && item.subtitle ? (
              <DetailRow label="Audience" value={item.subtitle} />
            ) : null}
            {source ? <DetailRow label="Source" value={source} /> : null}
            {toTradeal ? <DetailRow label="To" value={requestRecipientLabel('tradeal')} /> : null}
          </div>
        </DetailGroup>
      ) : null}

      {isReplyThread ? (
        <>
          <DetailGroup title="Their message" icon={Send} surface="muted">
            <p className="text-sm text-heading whitespace-pre-wrap leading-relaxed">{originalMessage}</p>
          </DetailGroup>
          <DetailGroup title="Your reply" icon={MessageSquare} surface="muted">
            {replyBody ? (
              <p className="text-sm text-heading whitespace-pre-wrap leading-relaxed">{replyBody}</p>
            ) : (
              <p className="text-sm text-muted">No reply text.</p>
            )}
          </DetailGroup>
        </>
      ) : message || noticeChangelog(item.send?.payload).length > 0 ? (
        <DetailGroup title="Message" icon={MessageSquare} surface="muted">
          <NoticeMessage payload={item.send?.payload} fallback={message} />
        </DetailGroup>
      ) : (
        <DetailGroup title="Message" icon={MessageSquare} surface="muted">
          <p className="text-sm text-muted">No message body.</p>
        </DetailGroup>
      )}
    </DetailPanelBody>
  )
}

function sentHeaderBadges(item: UnifiedInboxItem): ReactNode {
  const type = sentTypeLabel(item)
  const source = sourceLabel(item.send?.source)
  return (
    <>
      <Badge variant={isSentToTradeal(item) ? 'info' : 'default'}>{type}</Badge>
      {source && source !== type ? <Badge variant="info">{source}</Badge> : null}
      {hasInboxWorkflowStatus(item) ? sentStatusBadge(item) : null}
    </>
  )
}

export function InboxSentTable({
  rows,
  emptyDescription,
  onDeleteItems,
}: {
  rows: UnifiedInboxItem[]
  emptyDescription: string
  onDeleteItems: (ids: string[]) => Promise<number>
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checkedIds, setCheckedIds] = useState<string[]>([])
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [panelDocked, setPanelDocked] = useState(() => loadOrderPanelDocked())
  const isLargeScreen = useLargeScreen()
  const effectiveDocked = panelDocked && isLargeScreen
  const { setOpen: setDetailPanelOpen } = useDetailPanelSlot()

  const selected = useMemo(
    () => rows.find(r => r.id === selectedId) ?? null,
    [rows, selectedId],
  )

  useEffect(() => {
    if (selectedId && !rows.some(r => r.id === selectedId)) {
      setSelectedId(null)
      setDetailPanelOpen(false)
    }
  }, [rows, selectedId, setDetailPanelOpen])

  useEffect(() => {
    const visible = new Set(rows.map(r => r.id))
    setCheckedIds(prev => prev.filter(id => visible.has(id)))
  }, [rows])

  const closePanel = useCallback(() => {
    setSelectedId(null)
    setDetailPanelOpen(false)
  }, [setDetailPanelOpen])

  const handleDockChange = useCallback(
    (docked: boolean) => {
      if (!docked) setDetailPanelOpen(false)
      setPanelDocked(docked)
      saveOrderPanelDocked(docked)
    },
    [setDetailPanelOpen],
  )

  const toggleChecked = useCallback((id: string) => {
    setCheckedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }, [])

  const handleSelectAllVisible = useCallback((select: boolean, visibleIds: string[]) => {
    setCheckedIds(prev => {
      if (select) {
        const next = new Set(prev)
        for (const id of visibleIds) next.add(id)
        return [...next]
      }
      const drop = new Set(visibleIds)
      return prev.filter(id => !drop.has(id))
    })
  }, [])

  const openDeleteOne = useCallback((item: UnifiedInboxItem) => {
    if (!isDeletableSent(item)) return
    setDeleteError('')
    setDeleteIds([item.id])
  }, [])

  const openDeleteSelected = useCallback(() => {
    const ids = checkedIds.filter(id => {
      const row = rows.find(r => r.id === id)
      return row ? isDeletableSent(row) : false
    })
    if (ids.length === 0) return
    setDeleteError('')
    setDeleteIds(ids)
  }, [checkedIds, rows])

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteIds?.length) return
    try {
      await onDeleteItems(deleteIds)
      setCheckedIds(prev => prev.filter(id => !deleteIds.includes(id)))
      if (selectedId && deleteIds.includes(selectedId)) closePanel()
      setDeleteIds(null)
      setDeleteError('')
    } catch {
      setDeleteError('Could not delete the selected messages. Try again.')
      throw new Error('delete failed')
    }
  }, [closePanel, deleteIds, onDeleteItems, selectedId])

  const deletableCheckedCount = useMemo(
    () => checkedIds.filter(id => {
      const row = rows.find(r => r.id === id)
      return row ? isDeletableSent(row) : false
    }).length,
    [checkedIds, rows],
  )

  const columns = useMemo(
    () => [
      {
        key: 'sent_to',
        header: 'Sent to',
        className: 'w-36 min-w-[9rem]',
        sortable: true,
        sortValue: (row: UnifiedInboxItem) => sentToLabel(row),
        render: (row: UnifiedInboxItem) => (
          <span className="text-sm text-muted whitespace-nowrap">{sentToLabel(row)}</span>
        ),
      },
      {
        key: 'type',
        header: 'Type',
        className: 'w-32 min-w-[8rem]',
        sortable: true,
        sortValue: (row: UnifiedInboxItem) => sentTypeLabel(row),
        render: (row: UnifiedInboxItem) => (
          <span className="inline-flex items-center gap-2 text-sm text-heading whitespace-nowrap min-w-0">
            <InboxKindGlyph item={row} size="sm" className="h-7 w-7" />
            <span className="truncate">{sentTypeLabel(row)}</span>
          </span>
        ),
      },
      {
        key: 'title',
        header: 'Title',
        className:
          effectiveDocked && selectedId
            ? 'min-w-0 max-w-[20rem]'
            : 'min-w-0',
        sortable: true,
        sortValue: (row: UnifiedInboxItem) => row.title,
        render: (row: UnifiedInboxItem) => {
          const message = (row.send?.body || row.productRequest?.message || row.subtitle || '').trim()
          const showMessage = message && message !== (row.title || '').trim()
          return (
            <p className="min-w-0 truncate">
              <span className="font-medium text-heading">{row.title || '—'}</span>
              {showMessage ? (
                <span className="text-sm text-muted">
                  {' '}
                  {message}
                </span>
              ) : null}
            </p>
          )
        },
      },
      {
        key: 'when',
        header: 'When',
        className: 'w-0 whitespace-nowrap',
        sortable: true,
        sortValue: (row: UnifiedInboxItem) => row.dateIso || '',
        render: (row: UnifiedInboxItem) => (
          <span className="inline-block text-sm text-muted whitespace-nowrap">
            {row.dateIso ? formatInboxDate(row.dateIso) : '—'}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        className: 'w-24 text-center',
        sortable: true,
        sortValue: (row: UnifiedInboxItem) =>
          isSentToTradeal(row)
            ? String(row.productRequest?.status || '')
            : 'sent',
        render: (row: UnifiedInboxItem) => (
          <div className="flex justify-center">{sentStatusBadge(row)}</div>
        ),
      },
      {
        key: 'actions',
        header: '',
        render: (row: UnifiedInboxItem) => (
          <SentRowActions item={row} onDelete={openDeleteOne} />
        ),
      },
    ],
    [effectiveDocked, openDeleteOne, selectedId],
  )

  const dockToggle = (
    <button
      type="button"
      onClick={() => handleDockChange(!panelDocked)}
      className="hidden lg:inline-flex rounded-lg p-1.5 text-muted hover:bg-gray-100 hover:text-heading dark:hover:bg-zinc-800 cursor-pointer attex-focus"
      aria-label={panelDocked ? 'Undock panel' : 'Dock panel to the right'}
      title={panelDocked ? 'Undock panel' : 'Dock to right'}
    >
      {panelDocked ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
    </button>
  )

  const panelMenu =
    selected && isDeletableSent(selected) ? (
      <DetailPanelMenu items={buildSentMenuItems({ item: selected, onDelete: openDeleteOne })} />
    ) : null

  const panelProps = selected
    ? {
        title: selected.title || 'Sent item',
        headerBadges: sentHeaderBadges(selected),
        onClose: closePanel,
        headerActions: (
          <>
            {dockToggle}
            {panelMenu}
          </>
        ),
        width: 'md' as const,
      }
    : null

  const deleteCount = deleteIds?.length ?? 0

  return (
    <>
      {checkedIds.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-gray-700 dark:bg-gray-800/40">
          <p className="text-sm text-heading">
            {checkedIds.length} selected
            {deletableCheckedCount < checkedIds.length
              ? ` · ${deletableCheckedCount} can be deleted`
              : null}
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={deletableCheckedCount === 0}
            onClick={openDeleteSelected}
            className="text-danger border-danger/30 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCheckedIds([])}>
            Clear
          </Button>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={rows}
        getRowId={row => row.id}
        activeRowId={selectedId ?? undefined}
        selectedRows={checkedIds}
        onSelectRow={toggleChecked}
        onSelectAllVisible={handleSelectAllVisible}
        onRowClick={row => setSelectedId(row.id)}
        stickyLastColumn
        emptyMessage="Nothing sent"
        emptyState={
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-heading">Nothing sent</p>
            <p className="text-xs text-muted mt-1 max-w-sm mx-auto">{emptyDescription}</p>
          </div>
        }
      />
      {selected && panelProps && effectiveDocked ? (
        <DockedPanel {...panelProps}>
          <SentDetailPanel item={selected} />
        </DockedPanel>
      ) : null}
      {selected && panelProps && !effectiveDocked ? (
        <Drawer open {...panelProps}>
          <SentDetailPanel item={selected} />
        </Drawer>
      ) : null}

      <ConfirmDeleteModal
        open={deleteIds != null && deleteIds.length > 0}
        onClose={() => {
          setDeleteIds(null)
          setDeleteError('')
        }}
        onConfirm={handleConfirmDelete}
        title={deleteCount === 1 ? 'Delete sent message?' : `Delete ${deleteCount} sent messages?`}
        error={deleteError}
      >
        <p className="text-sm text-muted">
          {deleteCount === 1
            ? 'This removes the item from your Sent list. This cannot be undone.'
            : `This removes ${deleteCount} items from your Sent list. This cannot be undone.`}
        </p>
      </ConfirmDeleteModal>
    </>
  )
}
