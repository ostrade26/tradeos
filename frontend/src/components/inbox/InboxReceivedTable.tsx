import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Inbox, MessageSquare, PanelRight, PanelRightClose, Send, Trash2, XCircle } from 'lucide-react'
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
import {
  formatInboxDate,
  isFeatureEnhancementNotice,
  isFeatureInterestNotice,
  isProductUpdateNotice,
  notificationKindLabel,
} from '../../lib/notificationDisplay'
import { formatDateTime } from '../../lib/utils'
import type { UnifiedInboxItem } from '../../lib/unifiedInbox'
import { hasInboxWorkflowStatus } from '../../lib/unifiedInbox'
import {
  isOpenSeatRequest,
  isSeatRequestDecisionItem,
  seatRequestInboxMessageLine,
} from '../../lib/platformSeatRequestInbox'
import { InboxKindGlyph } from './InboxKindGlyph'
import { SeatRequestInboxMessage } from './SeatRequestInboxMessage'
import type { InboxStatusFilter } from './InboxFiltersBar'

function isDeletableNotice(item: UnifiedInboxItem): boolean {
  return item.id.startsWith('notice-')
}

function kindLabel(item: UnifiedInboxItem): string {
  if (item.kind === 'feature_interest') return 'Feature interest'
  return notificationKindLabel(item.kind)
}

function receivedInlineMessage(item: UnifiedInboxItem): string {
  if (item.seatRequest || item.notice?.kind === 'seat_request') {
    const line = seatRequestInboxMessageLine(item.seatRequest, item.notice)
    if (line) return line
  }
  return (item.notice?.body?.trim() || item.subtitle || '').trim()
}

function actionLabel(item: UnifiedInboxItem, platformConsole: boolean): string {
  if (item.productRequest && platformConsole) return 'Review request'
  if (item.seatRequest) {
    if (platformConsole && isOpenSeatRequest(item.seatRequest.status)) return 'Approve'
    return 'Review request'
  }
  if (isSeatRequestDecisionItem(item)) return 'Review request'
  if (item.kind === 'feature_interest' && platformConsole) return 'Review request'
  if (item.notice) {
    if (item.notice.kind === 'deploy_review') return 'Open release'
    if (item.notice.payload?.cta === 'review_interest') return 'Review request'
    if (isFeatureInterestNotice(item.notice)) return 'Express interest'
    if (
      isFeatureEnhancementNotice(item.notice) &&
      !item.notice.applied &&
      !item.notice.applied_at
    ) {
      return 'Choose enhancements'
    }
    if (isProductUpdateNotice(item.notice) && !item.notice.applied && !item.notice.applied_at) {
      return 'Apply update'
    }
    return 'View message'
  }
  if (item.href) return 'Open'
  return 'Open'
}

function statusBadge(item: UnifiedInboxItem): ReactNode {
  if (!hasInboxWorkflowStatus(item)) {
    return <span className="text-sm text-muted">—</span>
  }
  const sizeClass = 'text-sm px-2.5 py-1'
  if (item.productRequest) {
    const s = String(item.productRequest.status || '').toLowerCase()
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
  if (item.seatRequest) {
    const s = String(item.seatRequest.status || '').toLowerCase()
    if (s === 'rejected') {
      return (
        <Badge variant="danger" dot className={sizeClass}>
          Rejected
        </Badge>
      )
    }
    if (s === 'approved' || item.status === 'done') {
      return (
        <Badge variant="success" dot className={sizeClass}>
          Done
        </Badge>
      )
    }
    return (
      <Badge variant="warning" dot className={sizeClass}>
        Open
      </Badge>
    )
  }
  if (item.status === 'done') {
    return (
      <Badge variant="success" dot className={sizeClass}>
        Done
      </Badge>
    )
  }
  return (
    <Badge variant="warning" dot className={sizeClass}>
      Open
    </Badge>
  )
}

function buildReceivedMenuItems({
  item,
  platformConsole,
  onOpen,
  onRejectSeat,
  onDelete,
}: {
  item: UnifiedInboxItem
  platformConsole: boolean
  onOpen: (item: UnifiedInboxItem) => void
  onRejectSeat?: (item: UnifiedInboxItem) => void
  onDelete?: (item: UnifiedInboxItem) => void
}): DetailPanelMenuItem[] {
  const deletable = isDeletableNotice(item)
  const openSeat =
    platformConsole && item.seatRequest && isOpenSeatRequest(item.seatRequest.status) && onRejectSeat
  return groupMenuItems([
    {
      items: [
        {
          type: 'button' as const,
          label: actionLabel(item, platformConsole),
          icon: MessageSquare,
          onClick: () => onOpen(item),
        },
        ...(openSeat
          ? [
              {
                type: 'button' as const,
                label: 'Reject',
                icon: XCircle,
                tone: 'danger' as const,
                onClick: () => onRejectSeat(item),
              },
            ]
          : []),
      ],
    },
    {
      items:
        deletable && onDelete
          ? [
              {
                type: 'button' as const,
                label: 'Delete',
                icon: Trash2,
                tone: 'danger' as const,
                onClick: () => onDelete(item),
              },
            ]
          : [],
    },
  ])
}

function InboxRowActions({
  item,
  platformConsole,
  onOpen,
  onRejectSeat,
  onDelete,
}: {
  item: UnifiedInboxItem
  platformConsole: boolean
  onOpen: (item: UnifiedInboxItem) => void
  onRejectSeat?: (item: UnifiedInboxItem) => void
  onDelete: (item: UnifiedInboxItem) => void
}) {
  const { classes: density } = useTableDensity()
  const items = useMemo(
    () => buildReceivedMenuItems({ item, platformConsole, onOpen, onRejectSeat, onDelete }),
    [item, onDelete, onOpen, onRejectSeat, platformConsole],
  )

  return (
    <div className="flex justify-center" onClick={e => e.stopPropagation()}>
      <DetailPanelMenu items={items} tableTrigger={density.menuTrigger} />
    </div>
  )
}

function ReceivedDetailPanel({
  item,
  platformConsole,
  onOpen,
  onRejectSeat,
}: {
  item: UnifiedInboxItem
  platformConsole: boolean
  onOpen: (item: UnifiedInboxItem) => void
  onRejectSeat?: (item: UnifiedInboxItem) => void
}) {
  const isSeatMessage = Boolean(item.seatRequest || item.notice?.kind === 'seat_request')
  const replyBody = (item.notice?.body?.trim() || item.subtitle || '').trim()
  const originalMessage = (item.productRequest?.message || '').trim()
  const isReplyThread = Boolean(item.notice?.kind === 'product_request' && originalMessage)
  const when = item.dateIso ? formatDateTime(item.dateIso) : '—'
  const cta = actionLabel(item, platformConsole)
  const openSeat =
    platformConsole && item.seatRequest && isOpenSeatRequest(item.seatRequest.status) && onRejectSeat
  const showSummary =
    !isReplyThread &&
    Boolean(item.subtitle?.trim()) &&
    item.subtitle.trim() !== replyBody &&
    !item.notice?.body?.trim()

  return (
    <DetailPanelBody>
      <DetailMetricsSection>
        <DetailInlineStatRow>
          <DetailInlineStat label="Type" value={kindLabel(item)} />
          <DetailInlineStat label="When" value={when} />
        </DetailInlineStatRow>
      </DetailMetricsSection>

      {(item.from || showSummary) ? (
        <DetailGroup title="Details" icon={Inbox}>
          <div className="space-y-2.5">
            {item.from ? <DetailRow label="From" value={item.from} /> : null}
            {showSummary ? <DetailRow label="Summary" value={item.subtitle} /> : null}
          </div>
        </DetailGroup>
      ) : null}

      {isReplyThread ? (
        <>
          <DetailGroup title="Your message" icon={Send} surface="muted">
            <p className="text-sm text-heading whitespace-pre-wrap leading-relaxed">{originalMessage}</p>
          </DetailGroup>
          <DetailGroup title="Tradeal reply" icon={MessageSquare} surface="muted">
            {replyBody ? (
              <p className="text-sm text-heading whitespace-pre-wrap leading-relaxed">{replyBody}</p>
            ) : (
              <p className="text-sm text-muted">No reply text.</p>
            )}
          </DetailGroup>
        </>
      ) : isSeatMessage ? (
        <DetailGroup title="Message" icon={MessageSquare} surface="muted">
          <SeatRequestInboxMessage
            seatRequest={item.seatRequest}
            notice={item.notice}
            statusAudience={platformConsole ? 'platform' : 'org'}
          />
        </DetailGroup>
      ) : replyBody ? (
        <DetailGroup title="Message" icon={MessageSquare} surface="muted">
          <p className="text-sm text-heading whitespace-pre-wrap leading-relaxed">{replyBody}</p>
        </DetailGroup>
      ) : (
        <DetailGroup title="Message" icon={MessageSquare} surface="muted">
          <p className="text-sm text-muted">No message body.</p>
        </DetailGroup>
      )}

      <div className="flex flex-wrap gap-2 py-6">
        <Button size="sm" variant="secondary" className="w-full sm:w-auto" onClick={() => onOpen(item)}>
          {cta}
        </Button>
        {openSeat ? (
          <Button
            size="sm"
            variant="outlineDanger"
            className="w-full sm:w-auto"
            onClick={() => onRejectSeat(item)}
          >
            Reject
          </Button>
        ) : null}
      </div>
    </DetailPanelBody>
  )
}

function receivedHeaderBadges(item: UnifiedInboxItem): ReactNode {
  if (hasInboxWorkflowStatus(item)) return statusBadge(item)
  return <Badge variant="default">{kindLabel(item)}</Badge>
}

export function InboxReceivedTable({
  rows,
  statusFilter,
  emptyDescription,
  platformConsole,
  focusId,
  onOpen,
  onRejectSeat,
  onDeleteItems,
}: {
  rows: UnifiedInboxItem[]
  statusFilter: InboxStatusFilter
  emptyDescription: string
  platformConsole: boolean
  focusId?: string | null
  onOpen: (item: UnifiedInboxItem) => void
  onRejectSeat?: (item: UnifiedInboxItem) => void
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
    if (!focusId) return
    if (rows.some(r => r.id === focusId)) setSelectedId(focusId)
  }, [focusId, rows])

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

  const onRowClick = (row: UnifiedInboxItem) => {
    setSelectedId(row.id)
  }

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
    if (!isDeletableNotice(item)) return
    setDeleteError('')
    setDeleteIds([item.id])
  }, [])

  const openDeleteSelected = useCallback(() => {
    const ids = checkedIds.filter(id => id.startsWith('notice-'))
    if (ids.length === 0) return
    setDeleteError('')
    setDeleteIds(ids)
  }, [checkedIds])

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
    () => checkedIds.filter(id => id.startsWith('notice-')).length,
    [checkedIds],
  )

  const columns = useMemo(
    () => [
      {
        key: 'from',
        header: 'From',
        className: 'w-36 min-w-[9rem]',
        sortable: true,
        sortValue: (row: UnifiedInboxItem) => row.from,
        render: (row: UnifiedInboxItem) => (
          <span className="text-sm text-muted whitespace-nowrap">{row.from || '—'}</span>
        ),
      },
      {
        key: 'type',
        header: 'Type',
        className: 'w-32 min-w-[8rem]',
        sortable: true,
        sortValue: (row: UnifiedInboxItem) => kindLabel(row),
        render: (row: UnifiedInboxItem) => (
          <span className="inline-flex items-center gap-2 text-sm text-heading whitespace-nowrap min-w-0">
            <InboxKindGlyph item={row} size="sm" className="h-7 w-7" />
            <span className="truncate">{kindLabel(row)}</span>
          </span>
        ),
      },
      {
        key: 'title',
        header: 'Title',
        // Flexible column — absorbs leftover width when table is fullWidth.
        className: 'min-w-0 w-full max-w-0',
        sortable: true,
        sortValue: (row: UnifiedInboxItem) => row.title,
        render: (row: UnifiedInboxItem) => {
          const message = receivedInlineMessage(row)
          const showMessage = message && message !== (row.title || '').trim()
          return (
            <p className="min-w-0 truncate">
              <span
                className={
                  row.unread || row.actionable
                    ? 'font-semibold text-heading'
                    : 'font-medium text-heading'
                }
              >
                {row.title || '—'}
              </span>
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
        // Hug date/time content — don't stretch under fullWidth.
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
        // Hard min-width so sticky ⋯ cannot crush badges; allow grow for longer labels.
        className: 'min-w-[6.5rem] w-[6.5rem] text-center whitespace-nowrap',
        sortable: true,
        sortValue: (row: UnifiedInboxItem) => {
          if (!hasInboxWorkflowStatus(row)) return 3
          if (row.status === 'open' || row.unread) return 0
          return 2
        },
        render: (row: UnifiedInboxItem) => (
          <div className="flex justify-center">{statusBadge(row)}</div>
        ),
      },
      {
        key: 'actions',
        header: '',
        render: (row: UnifiedInboxItem) => (
          <InboxRowActions
            item={row}
            platformConsole={platformConsole}
            onOpen={onOpen}
            onRejectSeat={onRejectSeat}
            onDelete={openDeleteOne}
          />
        ),
      },
    ],
    [onOpen, onRejectSeat, openDeleteOne, platformConsole],
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

  const panelMenu = selected ? (
    <DetailPanelMenu
      items={buildReceivedMenuItems({
        item: selected,
        platformConsole,
        onOpen,
        onRejectSeat,
        onDelete: openDeleteOne,
      })}
    />
  ) : null

  const panelProps = selected
    ? {
        title: selected.title || 'Inbox item',
        headerBadges: receivedHeaderBadges(selected),
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
        fullWidth
        columns={columns}
        data={rows}
        getRowId={row => row.id}
        activeRowId={selectedId ?? undefined}
        selectedRows={checkedIds}
        onSelectRow={toggleChecked}
        onSelectAllVisible={handleSelectAllVisible}
        onRowClick={onRowClick}
        getRowTone={row =>
          row.unread || (row.category === 'work' && row.status === 'open')
            ? 'unread'
            : undefined
        }
        stickyLastColumn
        emptyMessage={statusFilter === 'open' ? 'Nothing unread' : 'Nothing received'}
        emptyState={
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-heading">
              {statusFilter === 'open' ? 'Nothing unread' : 'Nothing received'}
            </p>
            <p className="text-xs text-muted mt-1 max-w-sm mx-auto">{emptyDescription}</p>
          </div>
        }
      />

      {selected && panelProps && effectiveDocked ? (
        <DockedPanel {...panelProps}>
          <ReceivedDetailPanel
            item={selected}
            platformConsole={platformConsole}
            onOpen={onOpen}
            onRejectSeat={onRejectSeat}
          />
        </DockedPanel>
      ) : null}
      {selected && panelProps && !effectiveDocked ? (
        <Drawer open {...panelProps}>
          <ReceivedDetailPanel
            item={selected}
            platformConsole={platformConsole}
            onOpen={onOpen}
            onRejectSeat={onRejectSeat}
          />
        </Drawer>
      ) : null}

      <ConfirmDeleteModal
        open={deleteIds != null && deleteIds.length > 0}
        onClose={() => {
          setDeleteIds(null)
          setDeleteError('')
        }}
        onConfirm={handleConfirmDelete}
        title={deleteCount === 1 ? 'Delete message?' : `Delete ${deleteCount} messages?`}
        error={deleteError}
      >
        <p className="text-sm text-muted">
          {deleteCount === 1
            ? 'This removes the message from your inbox. This cannot be undone.'
            : `This removes ${deleteCount} messages from your inbox. This cannot be undone.`}
        </p>
      </ConfirmDeleteModal>
    </>
  )
}
