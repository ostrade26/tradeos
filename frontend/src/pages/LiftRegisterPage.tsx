import { useMemo, useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, Plus, Scale, Trash2, Undo2, X } from 'lucide-react'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb, EmptyState, Tabs } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { DataTable } from '../components/ui/DataTable'
import { VerifiedPeriod } from '../components/ui/GroupedDataTable'
import { Badge } from '../components/ui/Badge'
import { BulkMarkLiftsDeliveredModal } from '../components/lifts/BulkMarkLiftsDeliveredModal'
import { BlockedDeleteModal, ConfirmDeleteModal } from '../components/ui/DeleteActions'
import { LiftDetailDrawer } from '../components/registers/LiftDetailDrawer'
import { LiftFiltersBar } from '../components/registers/LiftFiltersBar'
import { cn, formatDate, formatDeliveryPeriodRange, formatMt, formatQty, tableRefCellMutedClass } from '../lib/utils'
import { REGISTER_TABLE_LAYER_Z } from '../components/ui/Drawer'
import { contractRateFromOrder, formatRateCell, RATE_COLUMN_HEADER } from '../lib/orderRate'
import { formatLiftRef } from '../lib/tradeRefs'
import { exportToCSV } from '../lib/export'
import { type Lift } from '../data/mockData'
import { formatLiftPoRefs, formatLiftSoRefs, liftHasCrossPoAllocations } from '../lib/liftAllocations'
import { isStockLift, STOCK_LIFT_LABEL } from '../lib/stockLift'
import { LiftOrderRouteLinks } from '../components/registers/LiftOrderRouteLinks'
import { formatLiftTankerSummary, getLiftTankers } from '../lib/liftTankers'
import { getLiftBalanceQty } from '../lib/liftBalance'
import {
  applyLiftFilters,
  emptyLiftFilters,
  hasActiveLiftFilters,
  liftFilterOptions,
  type LiftFilterState,
} from '../lib/liftFilters'
import { applyRowSelection, type RowSelectMeta } from '../lib/tableSelection'
import { useTradeStore } from '../store/TradeStore'
import { useToast } from '../hooks/useToast'
import { usePermissions } from '../hooks/useAuth'
import { useLargeScreen } from '../hooks/useMediaQuery'
import { loadOrderPanelDocked, saveOrderPanelDocked } from '../lib/orderPanelDock'
import { loadRegisterDetailRef, saveRegisterDetailRef } from '../lib/registerDetailRef'
import { useDetailPanelSlot } from '../components/layout/DetailPanelSlot'
import { loadRegisterSort, saveRegisterSort, sortRows, toggleSort } from '../lib/registerSort'
import { LiftRowActions } from '../components/registers/LiftRowActions'

export type LiftListMode = 'pending' | 'completed' | 'deleted'

function parseMode(view: string | null): LiftListMode {
  if (view === 'completed' || view === 'register') return 'completed'
  if (view === 'deleted') return 'deleted'
  return 'pending'
}

function viewParam(mode: LiftListMode): string | null {
  if (mode === 'completed') return 'completed'
  if (mode === 'deleted') return 'deleted'
  return null
}

export function LiftRegisterPage() {
  const store = useTradeStore()
  const toast = useToast()
  const { canDeleteLifts } = usePermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const mode = parseMode(searchParams.get('view'))
  const registerId = `lift-${mode}`
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<LiftFilterState>(emptyLiftFilters)
  const [sort, setSort] = useState(() => loadRegisterSort(registerId, 'liftRef'))
  const [panelDocked, setPanelDocked] = useState(() => loadOrderPanelDocked())
  const isLargeScreen = useLargeScreen()
  const effectiveDocked = panelDocked && isLargeScreen
  const { setOpen: setDetailPanelOpen } = useDetailPanelSlot()
  const [checkedLiftIds, setCheckedLiftIds] = useState<string[]>([])
  const selectionAnchorRef = useRef<string | null>(null)
  const [bulkDeliverOpen, setBulkDeliverOpen] = useState(false)
  const [deleteTargets, setDeleteTargets] = useState<Lift[]>([])
  const [permanentDeleteTargets, setPermanentDeleteTargets] = useState<Lift[]>([])
  const [deleteError, setDeleteError] = useState('')
  const [permanentDeleteError, setPermanentDeleteError] = useState('')
  const [blockedDelete, setBlockedDelete] = useState<{ name: string; reason: string } | null>(null)

  const setMode = useCallback((next: LiftListMode) => {
    setCheckedLiftIds([])
    selectionAnchorRef.current = null
    setSearchParams(prev => {
      const current = parseMode(prev.get('view'))
      if (current === next) return prev
      const params = new URLSearchParams(prev)
      params.delete('ref')
      const view = viewParam(next)
      if (view) params.set('view', view)
      else params.delete('view')
      return params
    }, { replace: true })
  }, [setSearchParams])

  const handleDockChange = useCallback((docked: boolean) => {
    if (!docked) setDetailPanelOpen(false)
    setPanelDocked(docked)
    saveOrderPanelDocked(docked)
  }, [setDetailPanelOpen])

  const urlRef = searchParams.get('ref')
  const urlQ = searchParams.get('q')
  const urlParty = searchParams.get('party')

  const [detailRef, setDetailRef] = useState<string | null>(urlRef)

  useEffect(() => {
    setDetailRef(searchParams.get('ref'))
  }, [searchParams])

  const selected = useMemo(() => {
    if (!detailRef) return null
    return store.lifts.find(l => String(l.liftRef) === detailRef || l.id === detailRef) ?? null
  }, [detailRef, store.lifts])

  const undockedDetailOpen = !effectiveDocked && detailRef != null && selected != null

  const registerKey = '/lifts'
  const restoredDetailRef = useRef(false)

  useLayoutEffect(() => {
    if (effectiveDocked && detailRef && selected) {
      setDetailPanelOpen(true, 'lg')
    } else if (effectiveDocked && !detailRef) {
      setDetailPanelOpen(false)
    }
  }, [effectiveDocked, detailRef, selected, setDetailPanelOpen])

  useLayoutEffect(() => {
    if (restoredDetailRef.current) return
    restoredDetailRef.current = true
    if (urlRef) return
    const persisted = loadRegisterDetailRef(registerKey)
    if (!persisted) return
    const lift = store.lifts.find(l => String(l.liftRef) === persisted || l.id === persisted)
    if (!lift) {
      saveRegisterDetailRef(registerKey, null)
      return
    }
    const refKey = String(lift.liftRef)
    setDetailRef(refKey)
    if (effectiveDocked) setDetailPanelOpen(true, 'lg')
    setSearchParams(prev => {
      const params = new URLSearchParams(prev)
      params.set('ref', refKey)
      const inCompleted = store.getLiftsDelivered().some(l => l.id === lift.id)
      const inPending = store.getLiftsPending().some(l => l.id === lift.id)
      if (inCompleted && !inPending) params.set('view', 'completed')
      else if (inPending) params.delete('view')
      return params
    }, { replace: true })
  }, [urlRef, store, effectiveDocked, setDetailPanelOpen, setSearchParams])

  useEffect(() => {
    if (urlRef && selected) saveRegisterDetailRef(registerKey, String(selected.liftRef))
  }, [urlRef, selected])

  const closeLiftPanel = useCallback(() => {
    setDetailRef(null)
    setDetailPanelOpen(false)
    saveRegisterDetailRef(registerKey, null)
    const params = new URLSearchParams(searchParams)
    params.delete('ref')
    setSearchParams(params, { replace: true })
  }, [searchParams, setSearchParams, setDetailPanelOpen])

  const syncLiftToUrl = useCallback((lift: Lift | null) => {
    const params = new URLSearchParams(searchParams)
    if (lift) {
      params.set('ref', String(lift.liftRef))
      const inCompleted = store.getLiftsDelivered().some(l => l.id === lift.id)
      const inPending = store.getLiftsPending().some(l => l.id === lift.id)
      if (inCompleted && !inPending) params.set('view', 'completed')
      else if (inPending) params.delete('view')
    } else {
      params.delete('ref')
    }
    setSearchParams(params, { replace: true })
  }, [searchParams, setSearchParams, store])

  const handleSelectLift = useCallback((lift: Lift) => {
    const refKey = String(lift.liftRef)
    if (detailRef === refKey || detailRef === lift.id) {
      closeLiftPanel()
      return
    }
    setDetailRef(refKey)
    saveRegisterDetailRef(registerKey, refKey)
    if (effectiveDocked) setDetailPanelOpen(true)
    syncLiftToUrl(lift)
  }, [syncLiftToUrl, detailRef, setDetailPanelOpen, effectiveDocked, closeLiftPanel])

  const handleCloseLift = closeLiftPanel

  const handleSortChange = useCallback((key: string) => {
    setSort(prev => {
      const next = toggleSort(prev, key)
      saveRegisterSort(registerId, next)
      return next
    })
  }, [registerId])

  useEffect(() => {
    setSort(loadRegisterSort(registerId, 'liftRef'))
  }, [registerId])

  useEffect(() => {
    if (urlQ) setSearch(urlQ)
  }, [urlQ])

  useEffect(() => {
    if (!urlParty) return
    setFilters(prev => ({ ...prev, parties: [urlParty] }))
  }, [urlParty])

  useEffect(() => {
    if (!urlRef) return
    const inPending = store.getLiftsPending().some(l => String(l.liftRef) === urlRef || l.id === urlRef)
    const inCompleted = store.getLiftsDelivered().some(l => String(l.liftRef) === urlRef || l.id === urlRef)
    const target: LiftListMode | null = inCompleted && !inPending
      ? 'completed'
      : inPending && !inCompleted
        ? 'pending'
        : null
    if (!target) return
    setSearchParams(prev => {
      const current = parseMode(prev.get('view'))
      if (current === target) return prev
      const params = new URLSearchParams(prev)
      if (target === 'completed') params.set('view', 'completed')
      else params.delete('view')
      return params
    }, { replace: true })
  }, [urlRef, setSearchParams, store])

  const baseData = useMemo(() => {
    if (mode === 'pending') return store.getLiftsPending()
    if (mode === 'deleted') return store.getLiftsDeleted()
    return store.getLiftsDelivered()
  }, [mode, store])

  const { items, parties, brokers, spots } = useMemo(
    () => liftFilterOptions(baseData, store.tradeOrders),
    [baseData, store.tradeOrders],
  )

  const filtered = useMemo(() => {
    const rows = applyLiftFilters(baseData, filters, search, store.tradeOrders)
    const sorted = sortRows(rows, sort, (row, key) => {
      switch (key) {
        case 'liftRef': return row.liftRef
        case 'date': return row.date
        case 'itemName': return row.itemName
        case 'parties': return `${row.sellerName} → ${row.buyerName}`
        case 'buyerName': return row.buyerName
        case 'sellerName': return row.sellerName
        case 'deliveryPeriod': return row.deliveryPeriodStart || row.deliveryPeriodEnd || row.deliveryPeriod || ''
        case 'liftedQty': return row.liftedQty
        case 'rate': return row.rate
        case 'balanceQtyMt': return getLiftBalanceQty(row)
        default: return ''
      }
    })
    return sorted
  }, [baseData, filters, search, store.tradeOrders, sort])

  const hasActiveFilters = hasActiveLiftFilters(filters, search)
  const totalQty = filtered.reduce((s, l) => s + l.liftedQty, 0)
  const pendingCount = store.getLiftsPending().length
  const completedCount = store.getLiftsDelivered().length
  const deletedCount = store.getLiftsDeleted().length

  const handleExport = () => {
    exportToCSV(
      filtered.map(l => ({
        liftRef: l.liftRef,
        status: l.status,
        poRef: formatLiftPoRefs(l),
        soRef: formatLiftSoRefs(l),
        date: l.date,
        deliveredAt: l.deliveredAt ?? '',
        buyer: l.buyerName,
        seller: l.sellerName,
        item: l.itemName,
        deliveryPeriod: formatDeliveryPeriodRange(l.deliveryPeriodStart, l.deliveryPeriodEnd),
        rate: contractRateFromOrder(l.rate),
        qty: l.liftedQty,
        tankers: getLiftTankers(l).map(t => t.tankerNo).join('; '),
        ...(mode === 'completed' ? { salesInvoiceNo: l.salesInvoiceNo ?? '' } : {}),
      })),
      [
        { key: 'liftRef', header: 'Lift Ref#' },
        { key: 'status', header: 'Status' },
        { key: 'poRef', header: 'PO Ref#' },
        { key: 'soRef', header: 'SO Ref#' },
        { key: 'date', header: 'Created' },
        { key: 'deliveredAt', header: 'Delivered' },
        { key: 'buyer', header: 'Buyer Name' },
        { key: 'seller', header: 'Seller Name' },
        { key: 'item', header: 'Item Name' },
        { key: 'deliveryPeriod', header: 'Delivery Period' },
        { key: 'rate', header: RATE_COLUMN_HEADER },
        { key: 'qty', header: mode === 'pending' ? 'Planned Qty' : 'Actual Qty' },
        { key: 'tankers', header: 'Tanker No.' },
        ...(mode === 'completed' ? [{ key: 'salesInvoiceNo' as const, header: 'Sales Invoice No.' }] : []),
      ],
      `lift-register-${mode}-${new Date().toISOString().slice(0, 10)}`,
    )
    toast.success(`Exported ${filtered.length} lifts`)
  }

  const handleClearFilters = () => {
    setSearch('')
    setFilters(emptyLiftFilters)
  }

  const checkedLifts = useMemo(
    () => filtered.filter(l => checkedLiftIds.includes(l.id)),
    [filtered, checkedLiftIds],
  )

  const toggleCheckedLift = useCallback((id: string, meta?: RowSelectMeta) => {
    setCheckedLiftIds(prev => {
      const result = applyRowSelection(prev, id, meta, selectionAnchorRef.current)
      selectionAnchorRef.current = result.anchorId
      return result.selected
    })
  }, [])

  const handleSelectAllVisible = useCallback((select: boolean, visibleIds: string[]) => {
    setCheckedLiftIds(prev => (
      select
        ? [...new Set([...prev, ...visibleIds])]
        : prev.filter(id => !visibleIds.includes(id))
    ))
    if (select && visibleIds.length > 0) {
      selectionAnchorRef.current = visibleIds[visibleIds.length - 1] ?? null
    }
  }, [])

  const openDeleteForLifts = useCallback((lifts: Lift[]) => {
    const deletable: Lift[] = []
    let blocked: { name: string; reason: string } | null = null
    for (const lift of lifts) {
      const check = store.canDeleteLift(lift.id)
      if (check.ok) deletable.push(lift)
      else if (!blocked) blocked = { name: formatLiftRef(lift.liftRef), reason: check.reason ?? 'Cannot delete' }
    }
    if (deletable.length === 0) {
      setBlockedDelete(blocked ?? { name: 'Lift', reason: 'None of the selected lifts can be deleted.' })
      return
    }
    setDeleteError('')
    setDeleteTargets(deletable)
  }, [store])

  const openPermanentDeleteForLifts = useCallback((lifts: Lift[]) => {
    if (lifts.length === 0) return
    setPermanentDeleteError('')
    setPermanentDeleteTargets(lifts)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (deleteTargets.length === 0) return
    const targets = deleteTargets
    try {
      for (const lift of targets) {
        await store.deleteLift(lift.id)
      }
      const count = targets.length
      if (count === 1) {
        toast.info(`${formatLiftRef(targets[0].liftRef)} moved to Deleted`)
      } else {
        toast.info(`${count} lifts moved to Deleted`)
      }
      setCheckedLiftIds(prev => prev.filter(id => !targets.some(l => l.id === id)))
      setDeleteTargets([])
      setDeleteError('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not move to Deleted'
      setDeleteError(message)
      toast.error('Could not move to Deleted', { description: message })
      throw err
    }
  }, [deleteTargets, store, toast])

  const handleConfirmPermanentDelete = useCallback(async () => {
    if (permanentDeleteTargets.length === 0) return
    const targets = permanentDeleteTargets
    try {
      for (const lift of targets) {
        await store.permanentlyDeleteLift(lift.id)
      }
      const count = targets.length
      if (count === 1) {
        toast.success(`${formatLiftRef(targets[0].liftRef)} permanently deleted`)
      } else {
        toast.success(`${count} lifts permanently deleted`)
      }
      setCheckedLiftIds(prev => prev.filter(id => !targets.some(l => l.id === id)))
      setPermanentDeleteTargets([])
      setPermanentDeleteError('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not permanently delete'
      setPermanentDeleteError(message)
      toast.error('Could not permanently delete', { description: message })
      throw err
    }
  }, [permanentDeleteTargets, store, toast])

  const handleBulkDelivered = useCallback((delivered: Lift[]) => {
    setCheckedLiftIds(prev => prev.filter(id => !delivered.some(l => l.id === id)))
    if (store.getLiftsPending().length === 0) setMode('completed')
  }, [setMode, store])

  const tableSelectedRows = checkedLiftIds

  const tableColumns = useMemo(() => [
    {
      key: 'liftRef',
      header: 'Lift Ref#',
      sortable: true,
      sortValue: (r: Lift) => r.liftRef,
      className: 'whitespace-nowrap min-w-[10.5rem]',
      render: (r: Lift) => (
        <div className="flex flex-nowrap items-center gap-1.5">
          <span className={tableRefCellMutedClass}>{formatLiftRef(r.liftRef)}</span>
          {isStockLift(r) && <Badge variant="info">{STOCK_LIFT_LABEL}</Badge>}
          {r.isSelfLift && <Badge variant="info">Self Lift</Badge>}
          {liftHasCrossPoAllocations(r, store.tradeOrders) && <Badge variant="warning">Cross lot</Badge>}
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Created',
      sortable: true,
      sortValue: (r: Lift) => r.date,
      className: 'whitespace-nowrap min-w-[6.5rem]',
      render: (r: Lift) => <span className="tabular-nums">{formatDate(r.date)}</span>,
    },
    {
      key: 'route',
      header: 'PO → SO',
      className: 'whitespace-nowrap min-w-[8rem]',
      render: (r: Lift) => <LiftOrderRouteLinks lift={r} />,
    },
    {
      key: 'itemName',
      header: 'Item Name',
      sortable: true,
      sortValue: (r: Lift) => r.itemName,
      className: 'min-w-[8rem]',
      render: (r: Lift) => (
        <span className="max-w-[12rem] truncate block font-medium text-heading">{r.itemName}</span>
      ),
    },
    {
      key: 'parties',
      header: 'Seller → Buyer',
      className: 'hidden lg:table-cell min-w-[12rem]',
      sortable: true,
      sortValue: (r: Lift) => `${r.sellerName} → ${r.buyerName}`,
      render: (r: Lift) => (
        <span className="max-w-[14rem] truncate block text-muted">{r.sellerName} → {r.buyerName}</span>
      ),
    },
    {
      key: 'deliveryPeriod',
      header: 'Delivery Period',
      className: 'hidden xl:table-cell whitespace-nowrap min-w-[9rem]',
      sortable: true,
      sortValue: (r: Lift) => r.deliveryPeriodStart || r.deliveryPeriodEnd || r.deliveryPeriod || '',
      render: (r: Lift) => (
        <VerifiedPeriod
          period={r.deliveryPeriod}
          start={r.deliveryPeriodStart}
          end={r.deliveryPeriodEnd}
          verified={r.deliveryPeriodVerified}
          display="label"
        />
      ),
    },
    {
      key: 'rate',
      header: RATE_COLUMN_HEADER,
      sortable: true,
      sortValue: (r: Lift) => r.rate,
      className: 'text-right whitespace-nowrap min-w-[6.5rem]',
      render: (r: Lift) => <span className="tabular-nums">{formatRateCell(r.rate)}</span>,
    },
    {
      key: 'liftedQty',
      header: mode === 'pending' ? 'Planned Qty' : 'Actual Qty',
      sortable: true,
      sortValue: (r: Lift) => r.liftedQty,
      className: 'text-right whitespace-nowrap min-w-[6rem]',
      render: (r: Lift) => <span className="tabular-nums font-medium">{formatMt(r.liftedQty)}</span>,
    },
    ...(mode === 'completed' ? [{
      key: 'balanceQtyMt',
      header: 'Balance',
      sortable: true,
      sortValue: (r: Lift) => getLiftBalanceQty(r),
      className: 'text-right whitespace-nowrap min-w-[5.5rem]',
      render: (r: Lift) => {
        const balance = getLiftBalanceQty(r)
        return balance > 0
          ? <span className="tabular-nums font-medium text-amber-700 dark:text-amber-400">{formatMt(balance)}</span>
          : <span className="text-gray-300">—</span>
      },
    }] : []),
    {
      key: 'tankers',
      header: 'Tanker No.',
      className: 'hidden xl:table-cell whitespace-nowrap min-w-[7rem]',
      render: (r: Lift) => formatLiftTankerSummary(r),
    },
    ...(mode === 'completed' ? [{
      key: 'salesInvoiceNo',
      header: 'Sales Invoice No.',
      className: 'hidden xl:table-cell whitespace-nowrap min-w-[8rem]',
      render: (r: Lift) => <span className="font-mono">{r.salesInvoiceNo ?? '—'}</span>,
    }] : []),
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      render: (r: Lift) => (
        <LiftRowActions
          lift={r}
          canDelete={store.canDeleteLift(r.id)}
          deletedTab={mode === 'deleted'}
          onDelete={() => openDeleteForLifts([r])}
          onRestore={async () => {
            try {
              await store.restoreLift(r.id)
              toast.success(`${formatLiftRef(r.liftRef)} restored`)
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Could not restore'
              toast.error('Could not restore', { description: message })
            }
          }}
          onPermanentlyDelete={() => openPermanentDeleteForLifts([r])}
          onBlockedDelete={reason => setBlockedDelete({ name: formatLiftRef(r.liftRef), reason })}
        />
      ),
    },
  ], [mode, openDeleteForLifts, openPermanentDeleteForLifts, store, toast])

  return (
    <>
    <div className="animate-fade-in min-w-0">
      <PageHeader
        title="Lift Register"
        subtitle={
          mode === 'pending'
            ? `${filtered.length} in transit · ${formatMt(totalQty)} planned`
            : mode === 'deleted'
              ? `${filtered.length} deleted lift${filtered.length === 1 ? '' : 's'}`
              : `${filtered.length} delivered · ${formatMt(totalQty)} actual`
        }
        breadcrumb={<Breadcrumb items={[{ label: 'Tradeal', href: '/' }, { label: 'Lift Register' }]} />}
        actions={
          <Button to="/lifts/new" size="sm"><Plus className="h-4 w-4" /> Record Lift</Button>
        }
        hideActionsOnMobile
      />

      <Tabs
        className="mb-4"
        tabs={[
          { id: 'pending', label: 'In transit', count: pendingCount },
          { id: 'completed', label: 'Completed', count: completedCount },
          { id: 'deleted', label: 'Deleted', count: deletedCount },
        ]}
        active={mode}
        onChange={id => setMode(id as LiftListMode)}
      />

      <LiftFiltersBar
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFiltersChange={setFilters}
        items={items}
        parties={parties}
        brokers={brokers}
        spots={spots}
        onExport={handleExport}
      />

      {mode === 'deleted' && (
        <p className="mb-4 text-sm text-muted">
          Deleted lifts stay here until you restore them or delete permanently. Permanent delete cannot be undone.
        </p>
      )}

      {checkedLiftIds.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-accent/20 bg-accent/5 px-4 py-3">
          <span className="text-sm font-medium text-heading tabular-nums">
            {checkedLiftIds.length} selected
          </span>
          {mode === 'pending' && (
            <Button size="sm" onClick={() => setBulkDeliverOpen(true)}>
              <CheckCircle2 className="h-4 w-4" />
              Mark as delivered
            </Button>
          )}
          {canDeleteLifts && mode === 'deleted' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  for (const lift of checkedLifts) {
                    try {
                      await store.restoreLift(lift.id)
                    } catch (err) {
                      const message = err instanceof Error ? err.message : 'Could not restore'
                      toast.error('Could not restore', { description: message })
                      return
                    }
                  }
                  toast.success(
                    checkedLifts.length === 1
                      ? `${formatLiftRef(checkedLifts[0].liftRef)} restored`
                      : `${checkedLifts.length} lifts restored`,
                  )
                  setCheckedLiftIds([])
                  selectionAnchorRef.current = null
                }}
              >
                <Undo2 className="h-4 w-4" />
                Restore
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-danger border-danger/30 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={() => openPermanentDeleteForLifts(checkedLifts)}
              >
                <Trash2 className="h-4 w-4" />
                Delete permanently
              </Button>
            </>
          )}
          {canDeleteLifts && mode !== 'deleted' && (
            <Button
              size="sm"
              variant="outline"
              className="text-danger border-danger/30 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={() => openDeleteForLifts(checkedLifts)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCheckedLiftIds([])
              selectionAnchorRef.current = null
            }}
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        </div>
      )}

      <div
        className={cn('min-w-0', undockedDetailOpen && 'relative')}
        style={undockedDetailOpen ? { zIndex: REGISTER_TABLE_LAYER_Z } : undefined}
      >
      <DataTable
        columns={tableColumns}
        data={filtered}
        qtyNote
        selectedRows={tableSelectedRows}
        activeRowId={selected?.id}
        sortKey={sort.key}
        sortDirection={sort.direction}
        onSortChange={handleSortChange}
        onRowClick={handleSelectLift}
        onSelectRow={toggleCheckedLift}
        onSelectAllVisible={handleSelectAllVisible}
        getRowId={r => r.id}
        stickyFirstColumn
        emptyState={
          <EmptyState
            icon={<Scale className="h-10 w-10" />}
            title={
              mode === 'pending'
                ? 'No lifts in transit'
                : mode === 'deleted'
                  ? 'No deleted lifts'
                  : 'No delivered lifts'
            }
            description={
              hasActiveFilters
                ? 'Try adjusting your search or filters.'
                : mode === 'pending'
                  ? 'Record a lift when dispatched. Mark delivered once weight is confirmed.'
                  : mode === 'deleted'
                    ? 'Deleted lifts appear here. Restore them or delete permanently.'
                    : 'Delivered lifts appear after weight is confirmed.'
            }
            action={
              hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={handleClearFilters}>
                  Clear filters
                </Button>
              ) : mode === 'pending' ? (
                <Button to="/lifts/new" size="sm"><Plus className="h-4 w-4" /> Record Lift</Button>
              ) : undefined
            }
          />
        }
        mobileRender={(r: Lift) => (
          <div className="px-4 py-3 space-y-1">
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-medium">{formatLiftRef(r.liftRef)}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {liftHasCrossPoAllocations(r, store.tradeOrders) && <Badge variant="warning">Cross lot</Badge>}
                  {r.isSelfLift && <Badge variant="info">Self</Badge>}
                  <LiftRowActions
                    lift={r}
                    canDelete={store.canDeleteLift(r.id)}
                    deletedTab={mode === 'deleted'}
                    onDelete={() => openDeleteForLifts([r])}
                    onRestore={async () => {
                      try {
                        await store.restoreLift(r.id)
                        toast.success(`${formatLiftRef(r.liftRef)} restored`)
                      } catch (err) {
                        const message = err instanceof Error ? err.message : 'Could not restore'
                        toast.error('Could not restore', { description: message })
                      }
                    }}
                    onPermanentlyDelete={() => openPermanentDeleteForLifts([r])}
                    onBlockedDelete={reason => setBlockedDelete({ name: formatLiftRef(r.liftRef), reason })}
                  />
                </div>
              </div>
              <p className="text-heading truncate">{r.itemName} · {formatMt(r.liftedQty)}</p>
              <p className="truncate"><LiftOrderRouteLinks lift={r} /></p>
              <p className="text-muted truncate">{r.sellerName} → {r.buyerName}</p>
            </div>
          </div>
        )}
      />
      </div>
    </div>

    <LiftDetailDrawer
      lift={selected}
      open={detailRef != null && selected != null}
      docked={effectiveDocked}
      onClose={handleCloseLift}
      onDockChange={handleDockChange}
      onDelivered={() => setMode('completed')}
    />

    <BulkMarkLiftsDeliveredModal
      lifts={checkedLifts}
      open={bulkDeliverOpen}
      onClose={() => setBulkDeliverOpen(false)}
      onDelivered={handleBulkDelivered}
    />

    <ConfirmDeleteModal
      open={deleteTargets.length > 0}
      onClose={() => { setDeleteTargets([]); setDeleteError('') }}
      onConfirm={handleConfirmDelete}
      title={
        deleteTargets.length === 1
          ? `Move ${formatLiftRef(deleteTargets[0].liftRef)} to Deleted?`
          : `Move ${deleteTargets.length} lifts to Deleted?`
      }
      error={deleteError}
    >
      <p className="text-sm text-gray-600 dark:text-muted">
        {deleteTargets.length === 1 ? 'This lift' : 'These lifts'} will move to the Deleted tab.
        You can restore them from there, or delete permanently.
      </p>
      {deleteTargets.length === 1 && deleteTargets[0] && (
        <p className="text-sm text-gray-600 dark:text-muted mt-2">
          <span className="font-medium text-heading">{formatLiftRef(deleteTargets[0].liftRef)}</span>
          {' '}({formatQty(deleteTargets[0].liftedQty)} {deleteTargets[0].itemName})
        </p>
      )}
      {deleteTargets.length > 1 && (
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm text-gray-600 dark:text-muted">
          {deleteTargets.map(lift => (
            <li key={lift.id}>
              <span className="font-medium text-heading">{formatLiftRef(lift.liftRef)}</span>
              {' '}({formatQty(lift.liftedQty)} {lift.itemName})
            </li>
          ))}
        </ul>
      )}
    </ConfirmDeleteModal>

    <ConfirmDeleteModal
      open={permanentDeleteTargets.length > 0}
      onClose={() => { setPermanentDeleteTargets([]); setPermanentDeleteError('') }}
      onConfirm={handleConfirmPermanentDelete}
      title={
        permanentDeleteTargets.length === 1
          ? `Permanently delete ${formatLiftRef(permanentDeleteTargets[0].liftRef)}?`
          : `Permanently delete ${permanentDeleteTargets.length} lifts?`
      }
      error={permanentDeleteError}
    >
      <p className="text-sm text-danger font-medium">
        This cannot be undone. The record will not be recoverable once deleted.
      </p>
      <p className="text-sm text-gray-600 dark:text-muted mt-2">
        {permanentDeleteTargets.length === 1 ? 'This lift' : 'These lifts'} will be removed permanently from Tradeal.
      </p>
      {permanentDeleteTargets.length === 1 && permanentDeleteTargets[0] && (
        <p className="text-sm text-gray-600 dark:text-muted mt-2">
          <span className="font-medium text-heading">{formatLiftRef(permanentDeleteTargets[0].liftRef)}</span>
          {' '}({formatQty(permanentDeleteTargets[0].liftedQty)} {permanentDeleteTargets[0].itemName})
        </p>
      )}
      {permanentDeleteTargets.length > 1 && (
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm text-gray-600 dark:text-muted">
          {permanentDeleteTargets.map(lift => (
            <li key={lift.id}>
              <span className="font-medium text-heading">{formatLiftRef(lift.liftRef)}</span>
              {' '}({formatQty(lift.liftedQty)} {lift.itemName})
            </li>
          ))}
        </ul>
      )}
    </ConfirmDeleteModal>

    <BlockedDeleteModal
      open={!!blockedDelete}
      onClose={() => setBlockedDelete(null)}
      name={blockedDelete?.name ?? ''}
      reason={blockedDelete?.reason ?? ''}
    />
    </>
  )
}
