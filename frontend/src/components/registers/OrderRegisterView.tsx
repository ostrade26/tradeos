import { useMemo, useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, FileText, Trash2, Undo2, X, CircleCheck } from 'lucide-react'
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
import { ORDER_DELETE_GRACE_DAYS } from '../../lib/orderDeletion'
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
  getAllocatedSellQty,
} from '../../data/mockData'
import { inTransitQtyOnOrder } from '../../lib/liftAllocations'
import { useTradeStore } from '../../store/TradeStore'
import { canCloseOrder, completionTypeLabel } from '../../lib/orderClosure'
import { loadOrderPanelDocked, saveOrderPanelDocked } from '../../lib/orderPanelDock'
import { loadRegisterDetailRef, saveRegisterDetailRef } from '../../lib/registerDetailRef'
import { loadRegisterSort, saveRegisterSort, sortRows, toggleSort } from '../../lib/registerSort'
import { useToast } from '../../hooks/useToast'
import { useLargeScreen } from '../../hooks/useMediaQuery'
import { usePermissions } from '../../hooks/useAuth'
import { useDetailPanelSlot } from '../layout/DetailPanelSlot'
import { REGISTER_TABLE_LAYER_Z } from '../ui/Drawer'
import { appPath } from '../../lib/appShellMode'
import { applyRowSelection, type RowSelectMeta } from '../../lib/tableSelection'

export type OrderListMode = 'pending' | 'completed' | 'deleted'

function parseModeFromView(view: string | null): OrderListMode {
  if (view === 'completed' || view === 'register') return 'completed'
  if (view === 'deleted') return 'deleted'
  return 'pending'
}

function registerToBeLift(order: TradeOrder): number {
  return toBeLifted(order)
}

function availableOnPO(store: ReturnType<typeof useTradeStore>, poRef: string): number {
  return store.getRemainingSellQty(poRef)
}

function allocationOnPO(store: ReturnType<typeof useTradeStore>, poRef: string): number {
  return getAllocatedSellQty(store.tradeOrders, poRef)
}

function inTransitOnOrder(store: ReturnType<typeof useTradeStore>, order: TradeOrder): number {
  return inTransitQtyOnOrder(store.lifts, order)
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
  const [deleteTargets, setDeleteTargets] = useState<TradeOrder[]>([])
  const [permanentDeleteTargets, setPermanentDeleteTargets] = useState<TradeOrder[]>([])
  const [deleteError, setDeleteError] = useState('')
  const [permanentDeleteError, setPermanentDeleteError] = useState('')
  const [blockedDelete, setBlockedDelete] = useState<{ name: string; reason: string } | null>(null)
  const [cancelTarget, setCancelTarget] = useState<TradeOrder | null>(null)
  const [closeTargets, setCloseTargets] = useState<TradeOrder[]>([])
  const [buyBackTarget, setBuyBackTarget] = useState<TradeOrder | null>(null)
  const [checkedOrderIds, setCheckedOrderIds] = useState<string[]>([])
  const selectionAnchorRef = useRef<string | null>(null)
  const [panelDocked, setPanelDocked] = useState(() => loadOrderPanelDocked())
  const isLargeScreen = useLargeScreen()
  const effectiveDocked = panelDocked && isLargeScreen
  const { setOpen: setDetailPanelOpen } = useDetailPanelSlot()
  const { canDeleteOrders } = usePermissions()

  const isPO = side === 'purchase'
  const label = isPO ? 'Purchase Order' : 'Sales Order'
  const shortLabel = isPO ? 'PO' : 'SO'
  const partyColumn = isPO ? 'Seller' : 'Buyer'
  const pathPrefix = isPO ? appPath('/purchase-orders') : appPath('/sales-orders')

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
    const inDeleted = (isPO ? store.getPODeleted() : store.getSODeleted()).some(o => o.ref === urlRef)
    const target: OrderListMode | null = inDeleted
      ? 'deleted'
      : inCompleted && !inPending
        ? 'completed'
        : inPending && !inCompleted
          ? 'pending'
          : null
    if (!target) return
    setSearchParams(prev => {
      const current = parseModeFromView(prev.get('view'))
      if (current === target) return prev
      const params = new URLSearchParams(prev)
      if (target === 'completed') params.set('view', 'completed')
      else if (target === 'deleted') params.set('view', 'deleted')
      else params.delete('view')
      return params
    }, { replace: true })
  }, [urlRef, isPO, setSearchParams, store])

  const baseData = useMemo(() => {
    if (mode === 'pending') {
      return isPO ? store.getPOPending() : store.getSOPending()
    }
    if (mode === 'deleted') {
      return isPO ? store.getPODeleted() : store.getSODeleted()
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
        case 'poRef': return row.poRef ?? ''
        case 'partyName': return row.partyName
        case 'itemName': return row.itemName
        case 'deliveryPeriod': return row.deliveryPeriodStart || row.deliveryPeriodEnd || ''
        case 'spot': return row.spot ?? ''
        case 'orderQty': return row.orderQty
        case 'buyBackQty': return totalBuyBackQty(row)
        case 'allocation': return isPO ? allocationOnPO(store, row.ref) : 0
        case 'available': return isPO ? availableOnPO(store, row.ref) : 0
        case 'liftedQty': return row.liftedQty
        case 'inTransit': return inTransitOnOrder(store, row)
        case 'toBeLift': return registerToBeLift(row)
        case 'rate': return row.rate
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
      allocation: isPO
        ? sortedFiltered.reduce((s, o) => s + allocationOnPO(store, o.ref), 0)
        : 0,
      liftedQty: sortedFiltered.reduce((s, o) => s + o.liftedQty, 0),
      inTransit: sortedFiltered.reduce((s, o) => s + inTransitOnOrder(store, o), 0),
      toBeLift: sortedFiltered.reduce((s, o) => s + registerToBeLift(o), 0),
      avgRatePer10Kg: weightedAverageRatePer10Kg(sortedFiltered),
    }
  }, [sortedFiltered, isPO, store])

  const checkedOrders = useMemo(
    () => sortedFiltered.filter(o => checkedOrderIds.includes(o.id)),
    [sortedFiltered, checkedOrderIds],
  )

  const closableCheckedOrders = useMemo(
    () =>
      mode !== 'deleted'
        ? checkedOrders.filter(
            o => canCloseOrder(o, store.lifts, store.balanceSettlements ?? [], store.tradeOrders).ok,
          )
        : [],
    [checkedOrders, mode, store.lifts, store.balanceSettlements, store.tradeOrders],
  )

  const selectionTotals = useMemo(() => {
    const orderQty = checkedOrders.reduce((s, o) => s + o.orderQty, 0)
    return {
      count: checkedOrders.length,
      orderQty,
      avgRatePer10Kg: weightedAverageRatePer10Kg(checkedOrders),
    }
  }, [checkedOrders])

  const toggleCheckedOrder = useCallback((id: string, meta?: RowSelectMeta) => {
    setCheckedOrderIds(prev => {
      const result = applyRowSelection(prev, id, meta, selectionAnchorRef.current)
      selectionAnchorRef.current = result.anchorId
      return result.selected
    })
  }, [])

  const handleSelectAllVisible = useCallback((select: boolean, visibleIds: string[]) => {
    setCheckedOrderIds(prev => (
      select
        ? [...new Set([...prev, ...visibleIds])]
        : prev.filter(id => !visibleIds.includes(id))
    ))
    if (select && visibleIds.length > 0) {
      selectionAnchorRef.current = visibleIds[visibleIds.length - 1] ?? null
    }
  }, [])

  const openDeleteForOrders = useCallback((orders: TradeOrder[]) => {
    const deletable: TradeOrder[] = []
    let blocked: { name: string; reason: string } | null = null
    for (const order of orders) {
      const check = store.canDeleteOrder(order.id)
      if (check.ok) deletable.push(order)
      else if (!blocked) blocked = { name: formatOrderRef(order.ref, order.side), reason: check.reason ?? 'Cannot delete' }
    }
    if (deletable.length === 0) {
      setBlockedDelete(blocked ?? { name: shortLabel, reason: 'None of the selected orders can be deleted.' })
      return
    }
    setDeleteError('')
    setDeleteTargets(deletable)
  }, [shortLabel, store])

  const openPermanentDeleteForOrders = useCallback((orders: TradeOrder[]) => {
    if (orders.length === 0) return
    setPermanentDeleteError('')
    setPermanentDeleteTargets(orders)
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
      sortable: true,
      sortValue: (r: TradeOrder) => r.poRef ?? '',
      render: (r: TradeOrder) => {
        const poRef = r.poRef
        if (!poRef) return <span className="text-muted">Not linked</span>
        const poHref = appPath(`/purchase-orders?ref=${encodeURIComponent(poRef)}`)
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
      sortable: true,
      sortValue: (r: TradeOrder) => r.deliveryPeriodStart || r.deliveryPeriodEnd || '',
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
      sortable: true,
      sortValue: (r: TradeOrder) => r.spot ?? '',
    },
    {
      key: 'rate',
      header: RATE_COLUMN_HEADER,
      className: 'text-right',
      sortable: true,
      sortValue: (r: TradeOrder) => r.rate,
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
        },
        {
          key: 'allocation',
          header: 'Allocation',
          className: 'text-right',
          sortable: true,
          sortValue: (r: TradeOrder) => allocationOnPO(store, r.ref),
          render: (r: TradeOrder) => {
            const allocated = allocationOnPO(store, r.ref)
            return (
              <span className={cn('tabular-nums', allocated > 0 ? 'text-heading font-medium' : 'text-muted')}>
                {formatMt(allocated)}
              </span>
            )
          },
        },
        {
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
        }]
      : []),
    {
      key: 'liftedQty',
      header: 'Delivered',
      className: 'text-right',
      sortable: true,
      sortValue: (r: TradeOrder) => r.liftedQty,
      render: (r: TradeOrder) => <span className="tabular-nums">{formatMt(r.liftedQty)}</span>,
    },
    {
      key: 'inTransit',
      header: 'In transit',
      className: 'text-right',
      sortable: true,
      sortValue: (r: TradeOrder) => inTransitOnOrder(store, r),
      render: (r: TradeOrder) => {
        const qty = inTransitOnOrder(store, r)
        return (
          <span className={cn('tabular-nums', qty > 0 ? 'text-heading font-medium' : 'text-muted')}>
            {formatMt(qty)}
          </span>
        )
      },
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
          deletedTab={mode === 'deleted'}
          onCloseOrder={() => setCloseTargets([r])}
          onBuyBack={() => setBuyBackTarget(r)}
          onScheduleDelete={() => {
            openDeleteForOrders([r])
          }}
          onCancelDelete={() => setCancelTarget(r)}
          onPermanentlyDelete={() => openPermanentDeleteForOrders([r])}
          onBlockedDelete={reason => setBlockedDelete({ name: formatOrderRef(r.ref, r.side), reason })}
        />
        )
      },
    },
  ]

  const handleConfirmDelete = async () => {
    if (deleteTargets.length === 0) return
    const targets = deleteTargets
    try {
      for (const order of targets) {
        await store.scheduleOrderDeletion(order.id)
      }
      const count = targets.length
      if (count === 1) {
        const order = targets[0]
        toast.info(`${formatOrderRef(order.ref, order.side)} moved to Deleted`, {
          description: `Permanently removes in ${ORDER_DELETE_GRACE_DAYS} days unless restored`,
        })
      } else {
        toast.info(`${count} ${shortLabel}s moved to Deleted`, {
          description: `Permanently remove in ${ORDER_DELETE_GRACE_DAYS} days unless restored`,
        })
      }
      setCheckedOrderIds(prev => prev.filter(id => !targets.some(o => o.id === id)))
      setDeleteTargets([])
      setDeleteError('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not move to Deleted'
      setDeleteError(message)
      toast.error('Could not move to Deleted', { description: message })
      throw err
    }
  }

  const handleConfirmPermanentDelete = async () => {
    if (permanentDeleteTargets.length === 0) return
    const targets = permanentDeleteTargets
    try {
      for (const order of targets) {
        await store.permanentlyDeleteOrder(order.id)
      }
      const count = targets.length
      if (count === 1) {
        toast.success(`${formatOrderRef(targets[0].ref, targets[0].side)} permanently deleted`)
      } else {
        toast.success(`${count} ${shortLabel}s permanently deleted`)
      }
      setCheckedOrderIds(prev => prev.filter(id => !targets.some(o => o.id === id)))
      setPermanentDeleteTargets([])
      setPermanentDeleteError('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not permanently delete'
      setPermanentDeleteError(message)
      toast.error('Could not permanently delete', { description: message })
      throw err
    }
  }

  const handleConfirmCancelDeletion = async () => {
    if (!cancelTarget) return
    try {
      await store.cancelOrderDeletion(cancelTarget.id)
      toast.success(`${formatOrderRef(cancelTarget.ref, cancelTarget.side)} restored`)
      setCancelTarget(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not restore'
      toast.error('Could not restore', { description: message })
      setBlockedDelete({
        name: cancelTarget.ref,
        reason: message,
      })
      setCancelTarget(null)
    }
  }

  const handleExport = () => {
    type OrderExportRow = {
      ref: string
      date: string
      party: string
      item: string
      deliveryPeriod: string
      spot: string
      rate: number
      orderQty: number
      buyBackQty?: number
      allocation?: number
      available?: number
      liftedQty: number
      inTransit: number
      toBeLift: number
      broker: string
    }
    const exportColumns: { key: keyof OrderExportRow; header: string }[] = [
      { key: 'ref', header: 'Ref#' },
      { key: 'date', header: 'Date' },
      { key: 'party', header: `${partyColumn} Name` },
      { key: 'item', header: 'Item Name' },
      { key: 'deliveryPeriod', header: 'Delivery Period' },
      { key: 'spot', header: 'Spot' },
      { key: 'rate', header: RATE_COLUMN_HEADER },
      { key: 'orderQty', header: `${shortLabel} Qty` },
      ...(isPO
        ? [
            { key: 'buyBackQty' as const, header: 'Buy back' },
            { key: 'allocation' as const, header: 'Allocation' },
            { key: 'available' as const, header: 'Avail. to Sell' },
          ]
        : []),
      { key: 'liftedQty', header: 'Delivered' },
      { key: 'inTransit', header: 'In transit' },
      { key: 'toBeLift', header: 'To Be Lift' },
      { key: 'broker', header: 'Broker Name' },
    ]
    exportToCSV(
      filtered.map((o): OrderExportRow => ({
        ref: o.ref,
        date: o.date,
        party: o.partyName,
        item: o.itemName,
        deliveryPeriod: formatDeliveryPeriodLabel(o),
        spot: o.spot,
        rate: contractRateFromOrder(o.rate, o.rateBasis, o.ratePerBasis),
        orderQty: o.orderQty,
        ...(isPO
          ? {
              buyBackQty: totalBuyBackQty(o),
              allocation: allocationOnPO(store, o.ref),
              available: availableOnPO(store, o.ref),
            }
          : {}),
        liftedQty: o.liftedQty,
        inTransit: inTransitOnOrder(store, o),
        toBeLift: registerToBeLift(o),
        broker: o.brokerName,
      })),
      exportColumns,
      `${shortLabel}-${mode}-${new Date().toISOString().slice(0, 10)}`
    )
    toast.success(`Exported ${filtered.length} ${shortLabel}${filtered.length === 1 ? '' : 's'}`)
  }

  const pendingCount = isPO ? store.getPOPending().length : store.getSOPending().length
  const completedCount = isPO ? store.getPOCompleted().length : store.getSOCompleted().length
  const deletedCount = isPO ? store.getPODeleted().length : store.getSODeleted().length
  const pageTitle = isPO ? 'Purchase Orders' : 'Sales Orders'

  const emptyTitle = hasActiveFilters
    ? mode === 'deleted'
      ? `No matching deleted ${label.toLowerCase()}s`
      : mode === 'pending'
        ? `No matching ${label.toLowerCase()}s`
        : `No matching completed ${label.toLowerCase()}s`
    : mode === 'deleted'
      ? `No deleted ${label.toLowerCase()}s`
      : mode === 'pending'
        ? `No ${label.toLowerCase()}s yet`
        : `No completed ${label.toLowerCase()}s yet`

  const emptyDescription = hasActiveFilters
    ? 'Try adjusting your search or filters.'
    : mode === 'deleted'
      ? `Deleted ${shortLabel}s appear here for ${ORDER_DELETE_GRACE_DAYS} days. Restore them or delete permanently.`
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
  ) : mode === 'completed' && pendingCount > 0 && onModeChange ? (
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
            : mode === 'deleted'
              ? `${filtered.length} deleted ${label.toLowerCase()}${filtered.length === 1 ? '' : 's'}`
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
            { id: 'deleted', label: 'Deleted', count: deletedCount },
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

      {mode !== 'deleted' && (
      <CollapsibleRegisterStats className="grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-md bg-card shadow-[var(--shadow-card)] px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-muted leading-snug">Total {shortLabel} qty (MT)</p>
          <p className="text-lg font-semibold tabular-nums">{formatMt(totals.orderQty)}</p>
        </div>
        <div className="rounded-md bg-card shadow-[var(--shadow-card)] px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-muted">Delivered</p>
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
      )}

      {mode === 'deleted' && (
        <p className="mb-4 text-sm text-muted">
          Records here are removed permanently after {ORDER_DELETE_GRACE_DAYS} days unless you restore them.
          Deleting from this tab cannot be undone.
        </p>
      )}

      {checkedOrderIds.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-accent/20 bg-accent/5 px-4 py-3">
          <span className="text-sm font-medium text-heading tabular-nums">
            {checkedOrderIds.length} selected
          </span>
          {canDeleteOrders && mode === 'deleted' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  for (const order of checkedOrders) {
                    try {
                      await store.cancelOrderDeletion(order.id)
                    } catch (err) {
                      const message = err instanceof Error ? err.message : 'Could not restore'
                      toast.error('Could not restore', { description: message })
                      return
                    }
                  }
                  toast.success(
                    checkedOrders.length === 1
                      ? `${formatOrderRef(checkedOrders[0].ref, checkedOrders[0].side)} restored`
                      : `${checkedOrders.length} ${shortLabel}s restored`,
                  )
                  setCheckedOrderIds([])
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
                onClick={() => openPermanentDeleteForOrders(checkedOrders)}
              >
                <Trash2 className="h-4 w-4" />
                Delete permanently
              </Button>
            </>
          )}
          {canDeleteOrders && mode !== 'deleted' && (
            <Button
              size="sm"
              variant="outline"
              className="text-danger border-danger/30 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={() => openDeleteForOrders(checkedOrders)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
          {mode !== 'deleted' && closableCheckedOrders.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCloseTargets(checkedOrders)}
            >
              <CircleCheck className="h-4 w-4" />
              Close
              {closableCheckedOrders.length !== checkedOrders.length
                ? ` (${closableCheckedOrders.length})`
                : ''}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCheckedOrderIds([])
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
              const allocated = isPO ? allocationOnPO(store, r.ref) : null
              const inTransit = inTransitOnOrder(store, r)
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
                          deletedTab={mode === 'deleted'}
                          onCloseOrder={() => setCloseTargets([r])}
                          onBuyBack={() => setBuyBackTarget(r)}
                          onScheduleDelete={() => {
                            openDeleteForOrders([r])
                          }}
                          onCancelDelete={() => setCancelTarget(r)}
                          onPermanentlyDelete={() => openPermanentDeleteForOrders([r])}
                          onBlockedDelete={reason => setBlockedDelete({ name: formatOrderRef(r.ref, r.side), reason })}
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-heading truncate">{r.partyName} · {r.itemName}</p>
                  <div className="flex items-center justify-between text-muted">
                    <span className="tabular-nums">
                      {formatMt(r.liftedQty)} delivered · {formatMt(inTransit)} in transit · {formatMt(remaining)} to lift
                    </span>
                    <span className="tabular-nums">{formatDate(r.date)}</span>
                  </div>
                  {allocated != null && (
                    <p className="text-sm tabular-nums text-muted">
                      Allocation: {formatMt(allocated)}
                    </p>
                  )}
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
      onScheduleDelete={selectedOrder ? () => openDeleteForOrders([selectedOrder]) : undefined}
      onCancelDelete={selectedOrder ? () => setCancelTarget(selectedOrder) : undefined}
      onBlockedDelete={reason => setBlockedDelete({ name: selectedOrder?.ref ?? '', reason })}
    />

    <ConfirmDeleteModal
        open={deleteTargets.length > 0}
        onClose={() => { setDeleteTargets([]); setDeleteError('') }}
        onConfirm={handleConfirmDelete}
        title={
          deleteTargets.length === 1
            ? `Move ${deleteTargets[0]?.ref ?? shortLabel} to Deleted?`
            : `Move ${deleteTargets.length} ${shortLabel}s to Deleted?`
        }
        confirmLabel="Move to Deleted"
        error={deleteError}
      >
        <p className="text-sm text-gray-600 dark:text-muted">
          {deleteTargets.length === 1 ? `This ${shortLabel}` : `These ${shortLabel}s`} will move to the Deleted tab for{' '}
          <span className="font-medium text-heading">{ORDER_DELETE_GRACE_DAYS} days</span>.
          {' '}You can restore them from there, or delete permanently.
        </p>
        {deleteTargets.length === 1 && deleteTargets[0] && (
          <p className="text-sm text-gray-600 dark:text-muted mt-2">
            <span className="font-medium text-heading">{formatOrderRef(deleteTargets[0].ref, deleteTargets[0].side)}</span>
            {' '}({formatQty(deleteTargets[0].orderQty)} {deleteTargets[0].itemName})
          </p>
        )}
        {deleteTargets.length > 1 && (
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm text-gray-600 dark:text-muted">
            {deleteTargets.map(order => (
              <li key={order.id}>
                <span className="font-medium text-heading">{formatOrderRef(order.ref, order.side)}</span>
                {' '}({formatQty(order.orderQty)} {order.itemName})
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
            ? `Permanently delete ${permanentDeleteTargets[0]?.ref ?? shortLabel}?`
            : `Permanently delete ${permanentDeleteTargets.length} ${shortLabel}s?`
        }
        confirmLabel="Delete forever"
        error={permanentDeleteError}
      >
        <p className="text-sm text-danger font-medium">
          This cannot be undone. The record will not be recoverable once deleted.
        </p>
        <p className="text-sm text-gray-600 dark:text-muted mt-2">
          {permanentDeleteTargets.length === 1 ? `This ${shortLabel}` : `These ${shortLabel}s`} will be removed permanently from Tradeal.
        </p>
        {permanentDeleteTargets.length === 1 && permanentDeleteTargets[0] && (
          <p className="text-sm text-gray-600 dark:text-muted mt-2">
            <span className="font-medium text-heading">{formatOrderRef(permanentDeleteTargets[0].ref, permanentDeleteTargets[0].side)}</span>
            {' '}({formatQty(permanentDeleteTargets[0].orderQty)} {permanentDeleteTargets[0].itemName})
          </p>
        )}
        {permanentDeleteTargets.length > 1 && (
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm text-gray-600 dark:text-muted">
            {permanentDeleteTargets.map(order => (
              <li key={order.id}>
                <span className="font-medium text-heading">{formatOrderRef(order.ref, order.side)}</span>
                {' '}({formatQty(order.orderQty)} {order.itemName})
              </li>
            ))}
          </ul>
        )}
      </ConfirmDeleteModal>

      <ConfirmDeleteModal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancelDeletion}
        title={`Restore ${cancelTarget ? formatOrderRef(cancelTarget.ref, cancelTarget.side) : shortLabel}?`}
        confirmLabel="Restore"
      >
        <p className="text-sm text-gray-600 dark:text-muted">
          <span className="font-medium text-heading">{cancelTarget ? formatOrderRef(cancelTarget.ref, cancelTarget.side) : ''}</span>
          {' '}will leave Deleted and return to the register.
        </p>
      </ConfirmDeleteModal>

      <BlockedDeleteModal
        open={!!blockedDelete}
        onClose={() => setBlockedDelete(null)}
        name={blockedDelete?.name ?? ''}
        reason={blockedDelete?.reason ?? ''}
      />

      <CloseOrderModal
        orders={closeTargets}
        open={closeTargets.length > 0}
        onClose={() => setCloseTargets([])}
        onComplete={() => {
          setCloseTargets([])
          setCheckedOrderIds([])
          selectionAnchorRef.current = null
        }}
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
