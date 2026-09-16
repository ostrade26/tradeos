import { useMemo, useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, FileText } from 'lucide-react'
import { PageHeader } from '../ui/CommandPalette'
import { Breadcrumb, Tabs, EmptyState } from '../ui/Tabs'
import { Button } from '../ui/Button'
import { DataTable } from '../ui/DataTable'
import { VerifiedPeriod } from '../ui/GroupedDataTable'
import { OrderFiltersBar } from './OrderFiltersBar'
import { CollapsibleRegisterStats } from './CollapsibleRegisterStats'
import { Badge, StatusBadge } from '../ui/Badge'
import { BuyBackTag } from '../orders/BuyBackTag'
import { CloseOrderModal } from '../orders/CloseOrderModal'
import { BuyBackModal } from '../orders/BuyBackModal'
import { canBuyBackPO, totalBuyBackQty } from '../../lib/buyBack'
import { BlockedDeleteModal, ConfirmDeleteModal } from '../ui/DeleteActions'
import { OrderRowActions } from './OrderRowActions'
import { OrderDetailDrawer, findOrderByRef } from './OrderDetailDrawer'
import { formatDate, cn, formatMt, formatQty, tableRefCellClass, availableQtyClass } from '../../lib/utils'
import { formatDeletionDate, ORDER_DELETE_GRACE_DAYS } from '../../lib/orderDeletion'
import { contractRateFromOrder, formatRateCell, RATE_COLUMN_HEADER, weightedAverageRatePer10Kg } from '../../lib/orderRate'
import { formatIndianAmount } from '../../lib/indianAmount'
import { formatOrderRef, formatPoRef } from '../../lib/tradeRefs'
import { exportToCSV } from '../../lib/export'
import {
  applyOrderFilters,
  emptyOrderFilters,
  uniqueSorted,
  type OrderFilterState,
} from '../../lib/orderFilters'
import {
  type TradeOrder,
  type OrderSide,
  toBeLifted,
  formatDeliveryPeriodLabel,
} from '../../data/mockData'
import { useTradeStore } from '../../store/TradeStore'
import { canCloseOrder, completionTypeLabel } from '../../lib/orderClosure'
import { loadOrderPanelDocked, saveOrderPanelDocked } from '../../lib/orderPanelDock'
import { loadRegisterDetailRef, saveRegisterDetailRef } from '../../lib/registerDetailRef'
import { loadRegisterSort, saveRegisterSort, sortRows, toggleSort } from '../../lib/registerSort'
import { useToast } from '../../hooks/useToast'
import { useLargeScreen } from '../../hooks/useMediaQuery'
import { useDetailPanelSlot } from '../layout/DetailPanelSlot'
import { REGISTER_TABLE_LAYER_Z } from '../ui/Drawer'

export type OrderListMode = 'pending' | 'completed'

function registerToBeLift(order: TradeOrder): number {
  return toBeLifted(order)
}

function availableOnPO(store: ReturnType<typeof useTradeStore>, poRef: string): number {
  return store.getRemainingSellQty(poRef)
}

interface OrderRegisterViewProps {
  side: OrderSide
  mode: OrderListMode
  onModeChange?: (mode: OrderListMode) => void
}

export function OrderRegisterView({ side, mode, onModeChange }: OrderRegisterViewProps) {
  const store = useTradeStore()
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const registerId = `${side}-${mode}`
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<OrderFilterState>(emptyOrderFilters)
  const [sort, setSort] = useState(() => loadRegisterSort(registerId, 'date'))
  const [deleteTarget, setDeleteTarget] = useState<TradeOrder | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [blockedDelete, setBlockedDelete] = useState<{ name: string; reason: string } | null>(null)
  const [cancelTarget, setCancelTarget] = useState<TradeOrder | null>(null)
  const [closeTarget, setCloseTarget] = useState<TradeOrder | null>(null)
  const [buyBackTarget, setBuyBackTarget] = useState<TradeOrder | null>(null)
  const [checkedOrderIds, setCheckedOrderIds] = useState<string[]>([])
  const [panelDocked, setPanelDocked] = useState(() => loadOrderPanelDocked())
  const isLargeScreen = useLargeScreen()
  const effectiveDocked = panelDocked && isLargeScreen
  const { setOpen: setDetailPanelOpen } = useDetailPanelSlot()

  const isPO = side === 'purchase'
  const label = isPO ? 'Purchase Order' : 'Sales Order'
  const shortLabel = isPO ? 'PO' : 'SO'
  const partyColumn = isPO ? 'Seller' : 'Buyer'
  const pathPrefix = isPO ? '/purchase-orders' : '/sales-orders'

  const handleDockChange = useCallback((docked: boolean) => {
    if (!docked) setDetailPanelOpen(false)
    setPanelDocked(docked)
    saveOrderPanelDocked(docked)
  }, [setDetailPanelOpen])

  const urlRef = searchParams.get('ref')
  /** Drives the open panel immediately; URL syncs in parallel (avoids close lag). */
  const [detailRef, setDetailRef] = useState<string | null>(urlRef)

  useEffect(() => {
    setDetailRef(searchParams.get('ref'))
  }, [searchParams])

  const closeOrderPanel = useCallback(() => {
    setDetailRef(null)
    setDetailPanelOpen(false)
    saveRegisterDetailRef(pathPrefix, null)
    const params = new URLSearchParams(searchParams)
    params.delete('ref')
    setSearchParams(params, { replace: true })
  }, [searchParams, setSearchParams, setDetailPanelOpen, pathPrefix])

  const syncOrderToUrl = useCallback((order: TradeOrder | null) => {
    const params = new URLSearchParams(searchParams)
    if (order) {
      params.set('ref', order.ref)
      const inCompleted = (isPO ? store.getPOCompleted() : store.getSOCompleted()).some(o => o.id === order.id)
      const inPending = (isPO ? store.getPOPending() : store.getSOPending()).some(o => o.id === order.id)
      if (inCompleted && !inPending) params.set('view', 'completed')
      else if (inPending) params.delete('view')
    } else {
      params.delete('ref')
    }
    setSearchParams(params, { replace: true })
  }, [searchParams, setSearchParams, isPO, store])

  const handleSelectOrder = useCallback((order: TradeOrder) => {
    if (detailRef === order.ref) {
      closeOrderPanel()
      return
    }
    setDetailRef(order.ref)
    saveRegisterDetailRef(pathPrefix, order.ref)
    if (effectiveDocked) setDetailPanelOpen(true)
    syncOrderToUrl(order)
  }, [syncOrderToUrl, detailRef, setDetailPanelOpen, effectiveDocked, closeOrderPanel, pathPrefix])

  const handleCloseOrder = closeOrderPanel

  const handleSortChange = useCallback((key: string) => {
    setSort(prev => {
      const next = toggleSort(prev, key)
      saveRegisterSort(registerId, next)
      return next
    })
  }, [registerId])

  const orderHref = (order: TradeOrder) => {
    const params = new URLSearchParams({ ref: order.ref })
    const inCompleted = (isPO ? store.getPOCompleted() : store.getSOCompleted()).some(o => o.id === order.id)
    const inPending = (isPO ? store.getPOPending() : store.getSOPending()).some(o => o.id === order.id)
    if (inCompleted && !inPending) params.set('view', 'completed')
    return `${pathPrefix}?${params.toString()}`
  }

  const urlQ = searchParams.get('q')
  const urlParty = searchParams.get('party')

  const selectedOrder = useMemo(() => {
    if (!detailRef) return null
    return findOrderByRef(store, detailRef, side) ?? null
  }, [detailRef, store.tradeOrders, side])

  const undockedDetailOpen = !effectiveDocked && detailRef != null && selectedOrder != null

  const restoredDetailRef = useRef(false)

  useLayoutEffect(() => {
    if (effectiveDocked && detailRef && selectedOrder) {
      setDetailPanelOpen(true, 'lg')
    } else if (effectiveDocked && !detailRef) {
      setDetailPanelOpen(false)
    }
  }, [effectiveDocked, detailRef, selectedOrder, setDetailPanelOpen])

  useLayoutEffect(() => {
    if (restoredDetailRef.current) return
    restoredDetailRef.current = true
    if (urlRef) return
    const persisted = loadRegisterDetailRef(pathPrefix)
    if (!persisted) return
    const order = findOrderByRef(store, persisted, side)
    if (!order) {
      saveRegisterDetailRef(pathPrefix, null)
      return
    }
    setDetailRef(persisted)
    if (effectiveDocked) setDetailPanelOpen(true, 'lg')
    setSearchParams(prev => {
      const params = new URLSearchParams(prev)
      params.set('ref', persisted)
      const inCompleted = (isPO ? store.getPOCompleted() : store.getSOCompleted()).some(o => o.id === order.id)
      const inPending = (isPO ? store.getPOPending() : store.getSOPending()).some(o => o.id === order.id)
      if (inCompleted && !inPending) params.set('view', 'completed')
      else if (inPending) params.delete('view')
      return params
    }, { replace: true })
  }, [
    urlRef,
    pathPrefix,
    side,
    store,
    isPO,
    effectiveDocked,
    setDetailPanelOpen,
    setSearchParams,
  ])

  useEffect(() => {
    if (urlRef && selectedOrder) saveRegisterDetailRef(pathPrefix, urlRef)
  }, [urlRef, selectedOrder, pathPrefix])

  useEffect(() => {
    if (!urlRef) return
    if (findOrderByRef(store, urlRef, side)) return
    setDetailRef(null)
    setDetailPanelOpen(false)
    setSearchParams(prev => {
      const params = new URLSearchParams(prev)
      params.delete('ref')
      return params
    }, { replace: true })
  }, [urlRef, side, store, setSearchParams, setDetailPanelOpen])

  useEffect(() => {
    if (urlQ) setSearch(urlQ)
  }, [urlQ])

  useEffect(() => {
    if (!urlParty) return
    setFilters(prev => ({ ...prev, party: urlParty }))
  }, [urlParty])

  useEffect(() => {
    if (!urlRef) return
    const inPending = (isPO ? store.getPOPending() : store.getSOPending()).some(o => o.ref === urlRef)
    const inCompleted = (isPO ? store.getPOCompleted() : store.getSOCompleted()).some(o => o.ref === urlRef)
    const target: OrderListMode | null = inCompleted && !inPending
      ? 'completed'
      : inPending && !inCompleted
        ? 'pending'
        : null
    if (!target) return
    setSearchParams(prev => {
      const current: OrderListMode = prev.get('view') === 'completed' || prev.get('view') === 'register'
        ? 'completed'
        : 'pending'
      if (current === target) return prev
      const params = new URLSearchParams(prev)
      if (target === 'completed') params.set('view', 'completed')
      else params.delete('view')
      return params
    }, { replace: true })
  }, [urlRef, isPO, setSearchParams, store])

  const baseData = useMemo(() => {
    if (mode === 'pending') {
      return isPO ? store.getPOPending() : store.getSOPending()
    }
    return isPO ? store.getPOCompleted() : store.getSOCompleted()
  }, [side, mode, isPO, store])

  const filtered = useMemo(
    () => applyOrderFilters(baseData, filters, search),
    [baseData, filters, search],
  )

  const sortedFiltered = useMemo(() => {
    const sorted = sortRows(filtered, sort, (row, key) => {
      switch (key) {
        case 'ref': return row.ref
        case 'date': return row.date
        case 'partyName': return row.partyName
        case 'itemName': return row.itemName
        case 'orderQty': return row.orderQty
        case 'liftedQty': return row.liftedQty
        case 'toBeLift': return registerToBeLift(row)
        case 'rate': return row.rate
        case 'available': return isPO ? availableOnPO(store, row.ref) : 0
        default: return ''
      }
    })
    return sorted
  }, [filtered, sort, isPO, store])

  const hasActiveFilters = search.trim() !== '' || JSON.stringify(filters) !== JSON.stringify(emptyOrderFilters)

  const items = useMemo(() => uniqueSorted(baseData.map(o => o.itemName)), [baseData])
  const parties = useMemo(() => uniqueSorted(baseData.map(o => o.partyName)), [baseData])
  const brokers = useMemo(() => uniqueSorted(baseData.map(o => o.brokerName)), [baseData])
  const spots = useMemo(() => uniqueSorted(baseData.map(o => o.spot)), [baseData])

  const totals = useMemo(() => {
    const orderQty = sortedFiltered.reduce((s, o) => s + o.orderQty, 0)
    return {
      orderQty,
      liftedQty: sortedFiltered.reduce((s, o) => s + o.liftedQty, 0),
      toBeLift: sortedFiltered.reduce((s, o) => s + registerToBeLift(o), 0),
      avgRatePer10Kg: weightedAverageRatePer10Kg(sortedFiltered),
    }
  }, [sortedFiltered])

  const checkedOrders = useMemo(
    () => sortedFiltered.filter(o => checkedOrderIds.includes(o.id)),
    [sortedFiltered, checkedOrderIds],
  )

  const selectionTotals = useMemo(() => {
    const orderQty = checkedOrders.reduce((s, o) => s + o.orderQty, 0)
    return {
      count: checkedOrders.length,
      orderQty,
      avgRatePer10Kg: weightedAverageRatePer10Kg(checkedOrders),
    }
  }, [checkedOrders])

  const toggleCheckedOrder = useCallback((id: string) => {
    setCheckedOrderIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }, [])

  const handleSelectAllVisible = useCallback((select: boolean, visibleIds: string[]) => {
    setCheckedOrderIds(prev => (
      select
        ? [...new Set([...prev, ...visibleIds])]
        : prev.filter(id => !visibleIds.includes(id))
    ))
  }, [])

  const tableSelectedRows = checkedOrderIds

  const displayAvgRatePer10Kg = checkedOrderIds.length > 0
    ? selectionTotals.avgRatePer10Kg
    : totals.avgRatePer10Kg

  const columns = [
    {
      key: 'ref',
      header: 'Ref#',
      sortable: true,
      sortValue: (r: TradeOrder) => r.ref,
      className: 'whitespace-nowrap',
      render: (r: TradeOrder) => (
        <div className="flex flex-nowrap items-center gap-2">
          <Link
            to={orderHref(r)}
            className={cn(tableRefCellClass, 'hover:underline')}
            onClick={e => {
              e.preventDefault()
              e.stopPropagation()
              handleSelectOrder(r)
            }}
          >
            {formatOrderRef(r.ref, r.side)}
          </Link>
          {isPO && <BuyBackTag order={r} />}
          {mode === 'completed' && completionTypeLabel(r.completionType) && (
            <Badge variant="default" className="text-[10px]">{completionTypeLabel(r.completionType)}</Badge>
          )}
          {r.deleteScheduledAt && (
            <Badge variant="warning" className="text-[10px]">
              Deletes {formatDeletionDate(r.deleteScheduledAt)}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      sortValue: (r: TradeOrder) => r.date,
      render: (r: TradeOrder) => <span className="tabular-nums">{formatDate(r.date)}</span>,
    },
    ...(!isPO ? [{
      key: 'poRef',
      header: 'PO Ref#',
      className: 'whitespace-nowrap',
      render: (r: TradeOrder) => {
        const poRef = r.poRef
        if (!poRef) return <span className="text-muted">Not linked</span>
        const poHref = `/purchase-orders?ref=${encodeURIComponent(poRef)}`
        return (
          <Link
            to={poHref}
            className={cn(tableRefCellClass, 'hover:underline')}
            onClick={e => {
              e.preventDefault()
              e.stopPropagation()
              navigate(poHref)
            }}
          >
            {formatPoRef(poRef)}
          </Link>
        )
      },
    }] : []),
    {
      key: 'partyName',
      header: `${partyColumn} Name`,
      sortable: true,
      sortValue: (r: TradeOrder) => r.partyName,
      render: (r: TradeOrder) => <span className="max-w-[180px] truncate block">{r.partyName}</span>,
    },
    {
      key: 'itemName',
      header: 'Item Name',
      sortable: true,
      sortValue: (r: TradeOrder) => r.itemName,
    },
    {
      key: 'deliveryPeriod',
      header: 'Delivery Period',
      render: (r: TradeOrder) => (
        <VerifiedPeriod
          start={r.deliveryPeriodStart}
          end={r.deliveryPeriodEnd}
          deliveryType={r.deliveryType}
          verified={r.deliveryPeriodVerified}
          display="label"
        />
      ),
    },
    {
      key: 'spot',
      header: 'Spot',
      className: 'hidden lg:table-cell',
    },
    {
      key: 'rate',
      header: RATE_COLUMN_HEADER,
      className: 'text-right',
      render: (r: TradeOrder) => (
        <span className="tabular-nums">{formatRateCell(r.rate, r.rateBasis, r.ratePerBasis)}</span>
      ),
    },
    {
      key: 'orderQty',
      header: `${shortLabel} Qty`,
      className: 'text-right',
      sortable: true,
      sortValue: (r: TradeOrder) => r.orderQty,
      render: (r: TradeOrder) => <span className="tabular-nums">{formatMt(r.orderQty)}</span>,
    },
    ...(isPO
      ? [{
          key: 'buyBackQty',
          header: 'Buy back',
          className: 'text-right',
          sortable: true,
          sortValue: (r: TradeOrder) => totalBuyBackQty(r),
          render: (r: TradeOrder) => {
            const bb = totalBuyBackQty(r)
            return (
              <span className={cn('tabular-nums', bb > 0 ? 'text-heading font-medium' : 'text-muted')}>
                {formatMt(bb)}
              </span>
            )
          },
        }]
      : []),
    {
      key: 'liftedQty',
      header: 'Lifted Qty',
      className: 'text-right',
      sortable: true,
      sortValue: (r: TradeOrder) => r.liftedQty,
      render: (r: TradeOrder) => <span className="tabular-nums">{formatMt(r.liftedQty)}</span>,
    },
    {
      key: 'toBeLift',
      header: 'To Be Lift',
      className: 'text-right',
      sortable: true,
      sortValue: (r: TradeOrder) => registerToBeLift(r),
      render: (r: TradeOrder) => {
        const remaining = registerToBeLift(r)
        return (
          <span className={cn('tabular-nums font-medium', remaining > 0 ? 'text-warning' : 'text-muted')}>
            {formatMt(remaining)}
          </span>
        )
      },
    },
    ...(isPO ? [{
      key: 'available',
      header: 'Avail. to Sell',
      className: 'text-right',
      sortable: true,
      sortValue: (r: TradeOrder) => availableOnPO(store, r.ref),
      render: (r: TradeOrder) => {
        const available = availableOnPO(store, r.ref)
        return (
          <span className={cn('tabular-nums', availableQtyClass(available))}>
            {formatMt(available)}
          </span>
        )
      },
    }] : []),
    {
      key: 'brokerName',
      header: 'Broker Name',
      className: 'hidden xl:table-cell',
      render: (r: TradeOrder) => <span className="max-w-[180px] truncate block">{r.brokerName}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (r: TradeOrder) => {
        const closable = canCloseOrder(r, store.lifts, store.balanceSettlements ?? [], store.tradeOrders).ok
        return (
        <OrderRowActions
          order={r}
          editHref={`${pathPrefix}/${encodeURIComponent(r.ref)}/edit`}
          canDelete={store.canDeleteOrder(r.id)}
          canClose={closable}
          canBuyBack={isPO && canBuyBackPO(r, store.lifts, store.getSOsForPO(r.ref)).ok}
          sellAvailableQty={isPO ? availableOnPO(store, r.ref) : undefined}
          onCloseOrder={() => setCloseTarget(r)}
          onBuyBack={() => setBuyBackTarget(r)}
          onScheduleDelete={() => {
            setDeleteError('')
            setDeleteTarget(r)
          }}
          onCancelDelete={() => setCancelTarget(r)}
          onBlockedDelete={reason => setBlockedDelete({ name: r.ref, reason })}
        />
        )
      },
    },
  ]

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await store.scheduleOrderDeletion(deleteTarget.id)
      toast.info(`${formatOrderRef(deleteTarget.ref, deleteTarget.side)} scheduled for deletion`, {
        description: `Removes in ${ORDER_DELETE_GRACE_DAYS} days unless cancelled`,
      })
      setDeleteTarget(null)
      setDeleteError('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not schedule deletion'
      setDeleteError(message)
      toast.error('Could not schedule deletion', { description: message })
    }
  }

  const handleConfirmCancelDeletion = async () => {
    if (!cancelTarget) return
    try {
      await store.cancelOrderDeletion(cancelTarget.id)
      toast.success(`${formatOrderRef(cancelTarget.ref, cancelTarget.side)} deletion cancelled`)
      setCancelTarget(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not cancel deletion'
      toast.error('Could not cancel deletion', { description: message })
      setBlockedDelete({
        name: cancelTarget.ref,
        reason: message,
      })
      setCancelTarget(null)
    }
  }

  const handleExport = () => {
    exportToCSV(
      filtered.map(o => ({
        ref: o.ref,
        date: o.date,
        party: o.partyName,
        item: o.itemName,
        deliveryPeriod: formatDeliveryPeriodLabel(o),
        spot: o.spot,
        rate: contractRateFromOrder(o.rate, o.rateBasis, o.ratePerBasis),
        orderQty: o.orderQty,
        ...(isPO ? { buyBackQty: totalBuyBackQty(o) } : {}),
        liftedQty: o.liftedQty,
        toBeLift: registerToBeLift(o),
        broker: o.brokerName,
      })),
      [
        { key: 'ref', header: 'Ref#' },
        { key: 'date', header: 'Date' },
        { key: 'party', header: `${partyColumn} Name` },
        { key: 'item', header: 'Item Name' },
        { key: 'deliveryPeriod', header: 'Delivery Period' },
        { key: 'spot', header: 'Spot' },
        { key: 'rate', header: RATE_COLUMN_HEADER },
        { key: 'orderQty', header: `${shortLabel} Qty` },
        ...(isPO ? [{ key: 'buyBackQty', header: 'Buy back' }] : []),
        { key: 'liftedQty', header: 'Lifted Qty' },
        { key: 'toBeLift', header: 'To Be Lift' },
        { key: 'broker', header: 'Broker Name' },
      ],
      `${shortLabel}-${mode}-${new Date().toISOString().slice(0, 10)}`
    )
    toast.success(`Exported ${filtered.length} ${shortLabel}${filtered.length === 1 ? '' : 's'}`)
  }

  const pendingCount = isPO ? store.getPOPending().length : store.getSOPending().length
  const completedCount = isPO ? store.getPOCompleted().length : store.getSOCompleted().length
  const pageTitle = isPO ? 'Purchase Orders' : 'Sales Orders'

  const emptyTitle = hasActiveFilters
    ? mode === 'pending'
      ? `No matching ${label.toLowerCase()}s`
      : `No matching completed ${label.toLowerCase()}s`
    : mode === 'pending'
      ? `No ${label.toLowerCase()}s yet`
      : `No completed ${label.toLowerCase()}s yet`

  const emptyDescription = hasActiveFilters
    ? 'Try adjusting your search or filters.'
    : mode === 'pending'
      ? completedCount > 0
        ? `${completedCount} completed ${label.toLowerCase()}${completedCount === 1 ? '' : 's'} in Register — switch to the Register tab to view imported history.`
        : `Create a ${shortLabel} to get started.`
      : pendingCount > 0
        ? `${pendingCount} pending ${label.toLowerCase()}${pendingCount === 1 ? '' : 's'} still in progress. Orders appear here once fully lifted.`
        : `Completed ${label.toLowerCase()}s appear here once order quantity is fully lifted.`

  const emptyAction = hasActiveFilters ? (
    <Button variant="outline" size="sm" onClick={() => { setSearch(''); setFilters(emptyOrderFilters) }}>
      Clear filters
    </Button>
  ) : mode === 'pending' ? (
    completedCount > 0 && onModeChange ? (
      <Button variant="outline" size="sm" onClick={() => onModeChange('completed')}>
        View register ({completedCount})
      </Button>
    ) : (
      <Button to={`${pathPrefix}/new`} size="sm"><Plus className="h-4 w-4" /> New {shortLabel}</Button>
    )
  ) : pendingCount > 0 && onModeChange ? (
    <Button variant="outline" size="sm" onClick={() => onModeChange('pending')}>
      View pending {label.toLowerCase()}s
    </Button>
  ) : undefined

  return (
    <>
    <div className="animate-fade-in min-w-0">
      <PageHeader
        title={pageTitle}
        subtitle={
          mode === 'pending'
            ? `${filtered.length} ongoing ${label.toLowerCase()}s · ${formatQty(totals.toBeLift)} to be lifted`
            : `${filtered.length} completed ${label.toLowerCase()}s · ${formatMt(totals.orderQty)} total`
        }
        breadcrumb={<Breadcrumb items={[
          { label: 'Tradeal', href: '/' },
          { label: pageTitle },
        ]} />}
        actions={
          <Button to={`${pathPrefix}/new`} size="sm"><Plus className="h-4 w-4" /> New {shortLabel}</Button>
        }
        hideActionsOnMobile
      />

      {onModeChange && (
        <Tabs
          className="mb-4"
          tabs={[
            { id: 'pending', label: 'Pending', count: pendingCount },
            { id: 'completed', label: 'Completed', count: completedCount },
          ]}
          active={mode}
          onChange={id => onModeChange(id as OrderListMode)}
        />
      )}

      <OrderFiltersBar
        shortLabel={shortLabel}
        partyLabel={partyColumn}
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

      <CollapsibleRegisterStats className="grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-md bg-card shadow-[var(--shadow-card)] px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-muted leading-snug">Total {shortLabel} qty (MT)</p>
          <p className="text-lg font-semibold tabular-nums">{formatMt(totals.orderQty)}</p>
        </div>
        <div className="rounded-md bg-card shadow-[var(--shadow-card)] px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-muted">Lifted</p>
          <p className="text-lg font-semibold tabular-nums text-success">{formatMt(totals.liftedQty)}</p>
        </div>
        <div className="rounded-md bg-card shadow-[var(--shadow-card)] px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-muted leading-snug">To be lifted (MT)</p>
          <p className="text-lg font-semibold tabular-nums text-warning">{formatMt(totals.toBeLift)}</p>
        </div>
        <div className="rounded-md bg-card shadow-[var(--shadow-card)] px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-muted leading-snug">
            {isPO ? 'Avg buying cost (₹/10 KG)' : 'Avg selling cost (₹/10 KG)'}
            {checkedOrderIds.length > 0 && (
              <span className="normal-case"> · {selectionTotals.count} selected</span>
            )}
          </p>
          <p className="text-lg font-semibold tabular-nums">
            {displayAvgRatePer10Kg != null ? formatIndianAmount(displayAvgRatePer10Kg) : '—'}
          </p>
        </div>
      </CollapsibleRegisterStats>

      <div
        className={cn('min-w-0', undockedDetailOpen && 'relative')}
        style={undockedDetailOpen ? { zIndex: REGISTER_TABLE_LAYER_Z } : undefined}
      >
      <DataTable<TradeOrder>
            data={sortedFiltered}
            columns={columns}
            qtyNote
            getRowId={o => o.id}
            selectedRows={tableSelectedRows}
            activeRowId={selectedOrder?.id}
            onSelectRow={toggleCheckedOrder}
            onSelectAllVisible={handleSelectAllVisible}
            sortKey={sort.key}
            sortDirection={sort.direction}
            onSortChange={handleSortChange}
            stickyFirstColumn
            onRowClick={handleSelectOrder}
            emptyState={
              <EmptyState
                icon={<FileText className="h-10 w-10" />}
                title={emptyTitle}
                description={emptyDescription}
                action={emptyAction}
              />
            }
            mobileRender={(r) => {
              const remaining = registerToBeLift(r)
              const available = isPO ? availableOnPO(store, r.ref) : null
              return (
                <div className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-nowrap items-center gap-2 min-w-0">
                      <span className={tableRefCellClass}>{formatOrderRef(r.ref, r.side)}</span>
                      {isPO && <BuyBackTag order={r} />}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <StatusBadge status={r.status} />
                      <div onClick={e => e.stopPropagation()}>
                        <OrderRowActions
                          order={r}
                          editHref={`${pathPrefix}/${encodeURIComponent(r.ref)}/edit`}
                          canDelete={store.canDeleteOrder(r.id)}
                          canClose={canCloseOrder(r, store.lifts, store.balanceSettlements ?? [], store.tradeOrders).ok}
                          canBuyBack={isPO && canBuyBackPO(r, store.lifts, store.getSOsForPO(r.ref)).ok}
          sellAvailableQty={isPO ? availableOnPO(store, r.ref) : undefined}
                          onCloseOrder={() => setCloseTarget(r)}
                          onBuyBack={() => setBuyBackTarget(r)}
                          onScheduleDelete={() => {
                            setDeleteError('')
                            setDeleteTarget(r)
                          }}
                          onCancelDelete={() => setCancelTarget(r)}
                          onBlockedDelete={reason => setBlockedDelete({ name: r.ref, reason })}
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-heading truncate">{r.partyName} · {r.itemName}</p>
                  <div className="flex items-center justify-between text-muted">
                    <span className="tabular-nums">{formatMt(remaining)} to lift</span>
                    <span className="tabular-nums">{formatDate(r.date)}</span>
                  </div>
                  {available != null && (
                    <p className={cn('text-sm tabular-nums', availableQtyClass(available))}>
                      Avail. to sell: {formatMt(available)}
                    </p>
                  )}
                </div>
              )
            }}
          />
      </div>
    </div>

    <OrderDetailDrawer
      order={selectedOrder}
      open={detailRef != null && selectedOrder != null}
      docked={effectiveDocked}
      onClose={handleCloseOrder}
      onDockChange={handleDockChange}
      onScheduleDelete={selectedOrder ? () => { setDeleteError(''); setDeleteTarget(selectedOrder) } : undefined}
      onCancelDelete={selectedOrder ? () => setCancelTarget(selectedOrder) : undefined}
      onBlockedDelete={reason => setBlockedDelete({ name: selectedOrder?.ref ?? '', reason })}
    />

    <ConfirmDeleteModal
        open={!!deleteTarget}
        onClose={() => { setDeleteTarget(null); setDeleteError('') }}
        onConfirm={handleConfirmDelete}
        title={`Delete ${deleteTarget?.ref ?? shortLabel}?`}
        confirmLabel="Schedule deletion"
        error={deleteError}
      >
        <p className="text-sm text-gray-600 dark:text-muted">
          This {shortLabel} will be scheduled for deletion in{' '}
          <span className="font-medium text-heading">{ORDER_DELETE_GRACE_DAYS} days</span>.
          {' '}It will remain visible and editable until then.
        </p>
        {deleteTarget && (
          <p className="text-sm text-gray-600 dark:text-muted mt-2">
            <span className="font-medium text-heading">{formatOrderRef(deleteTarget.ref, deleteTarget.side)}</span>
            {' '}({formatQty(deleteTarget.orderQty)} {deleteTarget.itemName})
          </p>
        )}
      </ConfirmDeleteModal>

      <ConfirmDeleteModal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancelDeletion}
        title={`Cancel deletion of ${cancelTarget ? formatOrderRef(cancelTarget.ref, cancelTarget.side) : shortLabel}?`}
        confirmLabel="Keep order"
      >
        <p className="text-sm text-gray-600 dark:text-muted">
          <span className="font-medium text-heading">{cancelTarget ? formatOrderRef(cancelTarget.ref, cancelTarget.side) : ''}</span>
          {' '}will no longer be scheduled for deletion.
        </p>
      </ConfirmDeleteModal>

      <BlockedDeleteModal
        open={!!blockedDelete}
        onClose={() => setBlockedDelete(null)}
        name={blockedDelete?.name ?? ''}
        reason={blockedDelete?.reason ?? ''}
      />

      <CloseOrderModal
        order={closeTarget}
        open={!!closeTarget}
        onClose={() => setCloseTarget(null)}
        onComplete={() => setCloseTarget(null)}
      />
      <BuyBackModal
        order={buyBackTarget}
        open={!!buyBackTarget}
        onClose={() => setBuyBackTarget(null)}
        onComplete={() => setBuyBackTarget(null)}
      />
    </>
  )
}
