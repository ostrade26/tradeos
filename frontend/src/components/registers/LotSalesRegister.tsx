import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Plus } from 'lucide-react'
import { DataTable } from '../ui/DataTable'
import { EmptyState } from '../ui/Tabs'
import { Button } from '../ui/Button'
import { VerifiedPeriod } from '../ui/GroupedDataTable'
import { TruncatedTextWithTooltip } from '../ui/DelayedHoverTooltip'
import { OrderFiltersBar } from './OrderFiltersBar'
import { StockPoLink } from './StockPoLink'
import { OrderRowActions } from './OrderRowActions'
import { OrderDetailDrawer } from './OrderDetailDrawer'
import { BuyBackTag } from '../orders/BuyBackTag'
import { BuyBackModal } from '../orders/BuyBackModal'
import { CloseOrderModal } from '../orders/CloseOrderModal'
import {
  applyOrderFilters,
  emptyOrderFilters,
  hasActiveOrderFilters,
  uniqueSorted,
  type OrderFilterState,
} from '../../lib/orderFilters'
import { loadRegisterSort, saveRegisterSort, sortRows, toggleSort } from '../../lib/registerSort'
import { inTransitQtyOnOrder, liftTouchKeys, orderHasPendingLift, pendingLiftKeys, remainingOnOrder } from '../../lib/liftAllocations'
import { canBuyBackOrder, totalBuyBackQty } from '../../lib/buyBack'
import { canCloseOrder } from '../../lib/orderClosure'
import { SALE_RATE_COLUMN_HEADER, formatRateCell } from '../../lib/orderRate'
import { applyRowSelection } from '../../lib/tableSelection'
import { cn, formatDate, formatMt, formatQty, tableRefCellClass } from '../../lib/utils'
import { appPath } from '../../lib/appShellMode'
import { formatDeletionDate } from '../../lib/orderDeletion'
import { formatOrderRef } from '../../lib/tradeRefs'
import { loadOrderPanelDocked, saveOrderPanelDocked } from '../../lib/orderPanelDock'
import { useLargeScreen } from '../../hooks/useMediaQuery'
import { useDetailPanelSlot } from '../layout/DetailPanelSlot'
import { useTradeStore } from '../../store/TradeStore'
import { useToast } from '../../hooks/useToast'
import type { Lift, TradeOrder } from '../../data/mockData'

export function LotSalesRegister({
  orders,
  lifts,
  lotId,
  mode = 'pending',
  pendingCount = 0,
  completedCount = 0,
  onModeChange,
}: {
  orders: TradeOrder[]
  lifts: Lift[]
  lotId: string
  mode?: 'pending' | 'completed' | 'deleted'
  pendingCount?: number
  completedCount?: number
  onModeChange?: (mode: 'pending' | 'completed' | 'deleted') => void
}) {
  const store = useTradeStore()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<OrderFilterState>(emptyOrderFilters)
  const [sort, setSort] = useState(() => loadRegisterSort(`lot-sales-${lotId}`, 'date'))
  const [checkedIds, setCheckedIds] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [closeTarget, setCloseTarget] = useState<TradeOrder | null>(null)
  const [buyBackTarget, setBuyBackTarget] = useState<TradeOrder | null>(null)
  const selectionAnchorRef = useRef<string | null>(null)
  const [panelDocked, setPanelDocked] = useState(() => loadOrderPanelDocked())
  const isLargeScreen = useLargeScreen()
  const effectiveDocked = panelDocked && isLargeScreen
  const { setOpen: setDetailPanelOpen } = useDetailPanelSlot()

  const handleDockChange = (docked: boolean) => {
    if (!docked) setDetailPanelOpen(false)
    setPanelDocked(docked)
    saveOrderPanelDocked(docked)
  }

  const pendingLifts = useMemo(() => pendingLiftKeys(lifts), [lifts])
  const liftTouches = useMemo(() => liftTouchKeys(lifts), [lifts])

  const filtered = useMemo(
    () => applyOrderFilters(orders, filters, search),
    [orders, filters, search],
  )
  const sorted = useMemo(
    () => sortRows(filtered, sort, (order, key) => {
      switch (key) {
        case 'ref': return order.ref
        case 'date': return order.date
        case 'poRef': return order.stockPoRef || ''
        case 'partyName': return order.partyName
        case 'itemName': return order.itemName
        case 'deliveryPeriod': return order.deliveryPeriodStart || order.deliveryPeriodEnd || ''
        case 'spot': return order.spot ?? ''
        case 'rate': return order.rate
        case 'orderQty': return order.orderQty
        case 'buyBackQty': return totalBuyBackQty(order)
        case 'inTransit': return inTransitQtyOnOrder(lifts, order)
        case 'liftedQty': return order.liftedQty
        case 'toBeLift': return remainingOnOrder(order, lifts)
        case 'brokerName': return order.brokerName
        default: return ''
      }
    }),
    [filtered, sort, lifts],
  )

  const columns = [
    {
      key: 'ref',
      header: 'Ref#',
      sortable: true,
      sortValue: (order: TradeOrder) => order.ref,
      className: 'whitespace-nowrap',
      render: (order: TradeOrder) => (
        <Link
          to={appPath(`/sales-orders?ref=${encodeURIComponent(order.ref)}`)}
          className={cn(tableRefCellClass, 'hover:underline')}
          onClick={e => {
            e.preventDefault()
            e.stopPropagation()
            setSelectedId(order.id)
          }}
        >
          <span className="inline-flex items-center gap-2">
            {formatOrderRef(order.ref, order.side)}
            <BuyBackTag order={order} />
          </span>
        </Link>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      sortValue: (order: TradeOrder) => order.date,
      render: (order: TradeOrder) => <span className="tabular-nums">{formatDate(order.date)}</span>,
    },
    {
      key: 'poRef',
      header: 'PO Ref#',
      sortable: true,
      sortValue: (order: TradeOrder) => order.stockPoRef || '',
      className: 'whitespace-nowrap',
      render: (order: TradeOrder) => order.stockPoRef
        ? <StockPoLink poRef={order.stockPoRef} />
        : <span className="text-muted">Not linked</span>,
    },
    {
      key: 'partyName',
      header: 'Buyer Name',
      sortable: true,
      sortValue: (order: TradeOrder) => order.partyName,
      render: (order: TradeOrder) => (
        <TruncatedTextWithTooltip text={order.partyName} className="max-w-[180px]" />
      ),
    },
    {
      key: 'itemName',
      header: 'Item Name',
      sortable: true,
      sortValue: (order: TradeOrder) => order.itemName,
    },
    {
      key: 'deliveryPeriod',
      header: 'Delivery Period',
      sortable: true,
      sortValue: (order: TradeOrder) => order.deliveryPeriodStart || order.deliveryPeriodEnd || '',
      render: (order: TradeOrder) => (
        <VerifiedPeriod
          start={order.deliveryPeriodStart}
          end={order.deliveryPeriodEnd}
          deliveryType={order.deliveryType}
          verified={order.deliveryPeriodVerified}
          display="label"
        />
      ),
    },
    {
      key: 'spot',
      header: 'Spot',
      className: 'hidden lg:table-cell',
      sortable: true,
      sortValue: (order: TradeOrder) => order.spot ?? '',
    },
    {
      key: 'rate',
      header: SALE_RATE_COLUMN_HEADER,
      className: 'text-right',
      sortable: true,
      sortValue: (order: TradeOrder) => order.rate,
      render: (order: TradeOrder) => (
        <span className="tabular-nums">{formatRateCell(order.rate, order.rateBasis, order.ratePerBasis)}</span>
      ),
    },
    {
      key: 'orderQty',
      header: 'SO Qty',
      className: 'text-right',
      sortable: true,
      sortValue: (order: TradeOrder) => order.orderQty,
      render: (order: TradeOrder) => <span className="tabular-nums">{formatMt(order.orderQty)}</span>,
    },
    {
      key: 'buyBackQty',
      header: 'Buy back',
      className: 'text-right',
      sortable: true,
      sortValue: (order: TradeOrder) => totalBuyBackQty(order),
      render: (order: TradeOrder) => {
        const qty = totalBuyBackQty(order)
        return <span className={cn('tabular-nums', qty > 0 ? 'text-heading font-medium' : 'text-muted')}>{formatMt(qty)}</span>
      },
    },
    {
      key: 'inTransit',
      header: 'In transit',
      className: 'text-right',
      sortable: true,
      sortValue: (order: TradeOrder) => inTransitQtyOnOrder(lifts, order),
      render: (order: TradeOrder) => {
        const qty = inTransitQtyOnOrder(lifts, order)
        return <span className={cn('tabular-nums', qty > 0 ? 'text-heading font-medium' : 'text-muted')}>{formatMt(qty)}</span>
      },
    },
    {
      key: 'liftedQty',
      header: 'Delivered',
      className: 'text-right',
      sortable: true,
      sortValue: (order: TradeOrder) => order.liftedQty,
      render: (order: TradeOrder) => <span className="tabular-nums">{formatMt(order.liftedQty)}</span>,
    },
    {
      key: 'toBeLift',
      header: 'To Be Lift',
      className: 'text-right',
      sortable: true,
      sortValue: (order: TradeOrder) => remainingOnOrder(order, lifts),
      render: (order: TradeOrder) => {
        const remaining = remainingOnOrder(order, lifts)
        return (
          <span className={cn(
            'tabular-nums font-medium',
            remaining < 0 ? 'text-danger' : remaining === 0 ? 'text-muted' : 'text-heading',
          )}>
            {formatMt(remaining)}
          </span>
        )
      },
    },
    {
      key: 'brokerName',
      header: 'Broker Name',
      className: 'hidden xl:table-cell',
      render: (order: TradeOrder) => (
        <TruncatedTextWithTooltip text={order.brokerName} className="max-w-[180px]" />
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (order: TradeOrder) => {
        const closeOk = canCloseOrder(order, lifts, store.balanceSettlements ?? [], store.tradeOrders).ok
        let deleteReason: string | undefined
        if (order.deleteScheduledAt) {
          deleteReason = `Already in Deleted — restores until ${formatDeletionDate(order.deleteScheduledAt)}.`
        } else if (order.liftedQty > 0) {
          deleteReason = `This order has ${formatQty(order.liftedQty)} lifted. Remove lift records first.`
        } else if (orderHasPendingLift(liftTouches, order)) {
          deleteReason = 'This order has lift records linked to it. Delete those lifts first.'
        }
        return (
          <OrderRowActions
            order={order}
            editHref={appPath(`/sales-orders/${encodeURIComponent(order.ref)}/edit`)}
            canDelete={deleteReason ? { ok: false, reason: deleteReason } : { ok: true }}
            canClose={closeOk && !orderHasPendingLift(pendingLifts, order)}
            canBuyBack={canBuyBackOrder(order, lifts, [], orderHasPendingLift(pendingLifts, order)).ok}
            onCloseOrder={() => setCloseTarget(order)}
            onBuyBack={() => setBuyBackTarget(order)}
            onScheduleDelete={() => {
              void store.scheduleOrderDeletion(order.id).then(() => {
                toast.info(`${formatOrderRef(order.ref, order.side)} moved to Deleted`)
                setCheckedIds(prev => prev.filter(id => id !== order.id))
                if (selectedId === order.id) setSelectedId(null)
              }).catch(err => {
                toast.error(err instanceof Error ? err.message : 'Could not move to Deleted')
              })
            }}
            onCancelDelete={() => {
              void store.cancelOrderDeletion(order.id).catch(err => {
                toast.error(err instanceof Error ? err.message : 'Could not restore order')
              })
            }}
            onBlockedDelete={reason => toast.error(reason)}
            deletedTab={mode === 'deleted'}
            onPermanentlyDelete={() => {
              void store.permanentlyDeleteOrder(order.id).then(() => {
                toast.success(`${formatOrderRef(order.ref, order.side)} permanently deleted`)
                if (selectedId === order.id) setSelectedId(null)
              }).catch(err => {
                toast.error(err instanceof Error ? err.message : 'Could not delete order')
              })
            }}
          />
        )
      },
    },
  ]

  const selectedOrder = orders.find(order => order.id === selectedId) ?? null

  useLayoutEffect(() => {
    if (effectiveDocked && selectedOrder) {
      setDetailPanelOpen(true, 'lg')
    } else if (effectiveDocked && !selectedOrder) {
      setDetailPanelOpen(false)
    }
  }, [effectiveDocked, selectedOrder, setDetailPanelOpen])

  useLayoutEffect(() => () => setDetailPanelOpen(false), [setDetailPanelOpen])

  const filtering = hasActiveOrderFilters(filters, search)

  return (
    <div className="space-y-4">
      <OrderFiltersBar
        shortLabel="SO"
        partyLabel="Buyer"
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFiltersChange={setFilters}
        items={uniqueSorted(orders.map(order => order.itemName))}
        parties={uniqueSorted(orders.map(order => order.partyName))}
        brokers={uniqueSorted(orders.map(order => order.brokerName))}
        spots={uniqueSorted(orders.map(order => order.spot))}
        rates={uniqueSorted(orders.map(order => formatRateCell(order.rate, order.rateBasis, order.ratePerBasis)))}
      />
      <DataTable
        qtyNote
        stickyFirstColumn
        data={sorted}
        columns={columns}
        getRowId={order => order.id}
        selectedRows={checkedIds}
        activeRowId={selectedOrder?.id}
        onSelectRow={(id, meta) => {
          setCheckedIds(prev => {
            const result = applyRowSelection(prev, id, meta, selectionAnchorRef.current)
            selectionAnchorRef.current = result.anchorId
            return result.selected
          })
        }}
        onSelectAllVisible={(select, ids) => {
          setCheckedIds(prev => select
            ? [...new Set([...prev, ...ids])]
            : prev.filter(id => !ids.includes(id)))
        }}
        onRowClick={order => setSelectedId(order.id)}
        sortKey={sort.key}
        sortDirection={sort.direction}
        onSortChange={key => {
          setSort(prev => {
            const next = toggleSort(prev, key)
            saveRegisterSort(`lot-sales-${lotId}`, next)
            return next
          })
        }}
        emptyState={(
          <EmptyState
            icon={<FileText className="h-10 w-10" />}
            title={filtering
              ? 'No matching sales orders'
              : mode === 'deleted'
                ? 'No deleted sales orders'
                : mode === 'completed'
                  ? 'No completed sales orders yet'
                  : 'No sales orders yet'}
            description={filtering
              ? 'Try adjusting your search or filters.'
              : mode === 'deleted'
                ? 'Deleted SOs appear here until they are permanently deleted.'
                : mode === 'pending'
                  ? completedCount > 0
                    ? `${completedCount} completed sales order${completedCount === 1 ? '' : 's'} — switch to the Completed tab.`
                    : 'Create a SO to get started.'
                  : pendingCount > 0
                    ? `${pendingCount} pending sales order${pendingCount === 1 ? '' : 's'} still in progress.`
                    : 'Completed sales orders appear here once the quantity is fully lifted.'}
            action={filtering ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setFilters(emptyOrderFilters)
                }}
              >
                Clear filters
              </Button>
            ) : mode === 'pending' ? (
              completedCount > 0 && onModeChange ? (
                <Button variant="outline" size="sm" onClick={() => onModeChange('completed')}>
                  View completed ({completedCount})
                </Button>
              ) : (
                <Button to={appPath(`/inventory/${lotId}/sell`)} size="sm">
                  <Plus className="h-4 w-4" /> New SO
                </Button>
              )
            ) : mode === 'completed' && pendingCount > 0 && onModeChange ? (
              <Button variant="outline" size="sm" onClick={() => onModeChange('pending')}>
                View pending sales orders
              </Button>
            ) : undefined}
          />
        )}
      />
      <OrderDetailDrawer
        order={selectedOrder}
        open={selectedOrder != null}
        docked={effectiveDocked}
        onDockChange={handleDockChange}
        onClose={() => {
          setSelectedId(null)
          if (effectiveDocked) setDetailPanelOpen(false)
        }}
      />
      <CloseOrderModal
        orders={closeTarget ? [closeTarget] : []}
        open={closeTarget != null}
        onClose={() => setCloseTarget(null)}
        onComplete={() => setCloseTarget(null)}
      />
      <BuyBackModal
        order={buyBackTarget}
        open={buyBackTarget != null}
        onClose={() => setBuyBackTarget(null)}
        onComplete={() => setBuyBackTarget(null)}
      />
    </div>
  )
}
