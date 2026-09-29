import { useParams, Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { ArrowLeftRight, Package } from 'lucide-react'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb, EmptyState, Tabs } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import { CollapsibleRegisterStats } from '../components/registers/CollapsibleRegisterStats'
import { DataTable } from '../components/ui/DataTable'
import { formatCurrency, formatDate, formatMt, formatQty, cn, availableQtyClass } from '../lib/utils'
import { formatContractRate } from '../lib/orderRate'
import { appPath } from '../lib/appShellMode'
import { formatLiftRef, formatPoRef, refsMatch } from '../lib/tradeRefs'
import { useTradeStore } from '../store/TradeStore'
import { getOrdersDrawingLot } from '../data/mockData'
import { LotSalesRegister } from '../components/registers/LotSalesRegister'
import { getLiftAllocations, liftTouchesRef, remainingOnOrder } from '../lib/liftAllocations'

function poRefFromLot(lotNumber: string) {
  return lotNumber.replace(/^LOT-/, '')
}

export function LotDetailsPage() {
  const [mode, setMode] = useState<'pending' | 'completed' | 'deleted'>('pending')
  const store = useTradeStore()
  const { lots, contracts, lifts } = store
  const { lotId } = useParams()
  const lot = lots.find(l => l.id === lotId)

  const poRef = lot ? poRefFromLot(lot.lotNumber) : ''

  const lotSales = useMemo(
    () => (poRef ? getOrdersDrawingLot(store.tradeOrders, poRef, store.lifts, { includeDeleted: true }) : []),
    [store.tradeOrders, store.lifts, poRef],
  )
  const pendingSales = useMemo(
    () => lotSales.filter(so => !so.deleteScheduledAt && so.status !== 'completed'),
    [lotSales],
  )
  const completedSales = useMemo(
    () => lotSales.filter(so => !so.deleteScheduledAt && so.status === 'completed'),
    [lotSales],
  )
  const deletedSales = useMemo(
    () => lotSales.filter(so => Boolean(so.deleteScheduledAt)),
    [lotSales],
  )
  const linkedSOs = mode === 'completed' ? completedSales : mode === 'deleted' ? deletedSales : pendingSales

  const openDispatch = useMemo(
    () => pendingSales.filter(so => remainingOnOrder(so, store.lifts) > 0),
    [pendingSales, store.lifts],
  )

  const movements = useMemo(() => {
    if (!lot) return []

    const poLifts = lifts
      .filter(l => !l.deletedAt && liftTouchesRef(l, poRef, 'purchase'))
      .sort((a, b) => a.date.localeCompare(b.date) || a.liftRef - b.liftRef)

    let onHand = 0
    const rows: {
      id: string
      type: string
      quantity: number
      balance: number
      date: string
      ref: string
    }[] = []

    for (const lift of poLifts) {
      const allocs = getLiftAllocations(lift).filter(a => refsMatch(a.poRef, poRef, 'purchase'))
      const stockInAllocs = allocs.filter(a => !a.soRef)
      const lotSaleAllocs = allocs.filter(a => {
        if (!a.soRef) return false
        const so = store.tradeOrders.find(o => o.side === 'sale' && refsMatch(o.ref, a.soRef, 'sale'))
        return Boolean(so?.stockPoRef && !so.poRef && refsMatch(so.stockPoRef, poRef, 'purchase'))
      })
      const stockInQty = stockInAllocs.reduce((s, a) => s + a.qtyMt, 0)
      const lotSaleQty = lotSaleAllocs.reduce((s, a) => s + a.qtyMt, 0)
      if (stockInQty <= 0 && lotSaleQty <= 0) continue

      const isStockIn = stockInQty > 0 && lotSaleQty <= 0
      const qty = isStockIn ? stockInQty : lotSaleQty

      if (isStockIn) {
        onHand += qty
        rows.push({
          id: lift.id,
          type: 'Stock in (own stock)',
          quantity: qty,
          balance: onHand,
          date: lift.date,
          ref: formatLiftRef(lift.liftRef),
        })
      } else {
        onHand = Math.max(0, onHand - qty)
        rows.push({
          id: lift.id,
          type: 'Dispatch',
          quantity: -qty,
          balance: onHand,
          date: lift.date,
          ref: formatLiftRef(lift.liftRef),
        })
      }
    }

    return rows.reverse()
  }, [lot, lifts, poRef, store.tradeOrders])

  if (!lot) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Lot not found"
          breadcrumb={<Breadcrumb items={[{ label: 'Tradeal', href: '/' }, { label: 'Inventory', href: '/inventory' }, { label: 'Not found' }]} />}
        />
        <EmptyState
          card
          icon={<Package className="h-10 w-10" />}
          title="No lot found"
          description="This inventory lot does not exist yet."
          action={<Button to="/inventory" variant="outline">Back to Inventory</Button>}
        />
      </div>
    )
  }

  const contract = contracts.find(c => c.id === lot.contractId)
  const lotValue = lot.remaining * lot.purchasePrice
  const salePool = pendingSales.concat(completedSales)
  const avgSaleRate = salePool.length
    ? salePool.reduce((s, o) => s + o.rate, 0) / salePool.length
    : 0

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title={lot.lotNumber}
        subtitle={`${lot.commodity} · Purchased from ${lot.producer}`}
        breadcrumb={<Breadcrumb items={[
          { label: 'Tradeal', href: '/' },
          { label: 'Inventory', href: '/inventory' },
          { label: lot.lotNumber },
        ]} />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              to={`/lifts/new?poRef=${encodeURIComponent(poRef)}&stock=1`}
              size="sm"
              variant="outline"
            >
              Receive stock
            </Button>
            {lot.remaining > 0 && openDispatch.length > 0 && (
              <Button
                to={openDispatch.length === 1
                  ? `/lifts/new?poRef=${encodeURIComponent(poRef)}&soRef=${encodeURIComponent(openDispatch[0]!.ref)}`
                  : `/lifts/new?poRef=${encodeURIComponent(poRef)}`}
                size="sm"
                variant="outline"
              >
                Dispatch
              </Button>
            )}
            {lot.available > 0 && (
              <Button to={`/inventory/${lot.id}/sell`} size="sm">
                Sell from this lot
              </Button>
            )}
          </div>
        }
      />

      <CollapsibleRegisterStats className="grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-md bg-card shadow-[var(--shadow-card)] px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-muted leading-snug">Purchase price</p>
          <p className="text-lg font-semibold tabular-nums">{formatContractRate(lot.purchasePrice)}</p>
        </div>
        <div className="rounded-md bg-card shadow-[var(--shadow-card)] px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-muted leading-snug">On hand</p>
          <p className="text-lg font-semibold tabular-nums">{formatQty(lot.remaining, lot.unit)}</p>
        </div>
        <div className="rounded-md bg-card shadow-[var(--shadow-card)] px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-muted leading-snug">Allocated</p>
          <p className="text-lg font-semibold tabular-nums">{formatQty(lot.allocated, lot.unit)}</p>
        </div>
        <div className="rounded-md bg-card shadow-[var(--shadow-card)] px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-muted leading-snug">Available to sell</p>
          <p className={cn('text-lg font-semibold tabular-nums', availableQtyClass(lot.available))}>
            {formatQty(lot.available, lot.unit)}
          </p>
        </div>
        <div className="rounded-md bg-card shadow-[var(--shadow-card)] px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-muted leading-snug">Lot value</p>
          <p className="text-lg font-semibold tabular-nums">{formatCurrency(lotValue)}</p>
        </div>
      </CollapsibleRegisterStats>

      <Tabs
        className="mb-4"
        tabs={[
          { id: 'pending', label: 'Pending', count: pendingSales.length },
          { id: 'completed', label: 'Completed', count: completedSales.length },
          { id: 'deleted', label: 'Deleted', count: deletedSales.length },
        ]}
        active={mode}
        onChange={id => setMode(id === 'completed' || id === 'deleted' ? id : 'pending')}
      />

      <LotSalesRegister
        orders={linkedSOs}
        lifts={lifts}
        lotId={lot.id}
        mode={mode}
        pendingCount={pendingSales.length}
        completedCount={completedSales.length}
        onModeChange={setMode}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6 items-start">
        <Card>
          <CardHeader title="Overview" subtitle="What is in the godown" />
          <div className="space-y-6">
            <div>
              <p className="text-xs text-muted">Seller</p>
              <p className="text-sm font-medium mt-0.5">{lot.producer}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: 'Broker', value: lot.broker || '—' },
                { label: 'Lot', value: lot.lotNumber },
                { label: 'Allocated', value: formatQty(lot.allocated, lot.unit) },
                {
                  label: 'Avail. to sell',
                  value: formatQty(lot.available, lot.unit),
                  valueClassName: availableQtyClass(lot.available),
                },
                { label: 'Avg sale rate', value: avgSaleRate > 0 ? formatContractRate(avgSaleRate) : '—' },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-xs text-muted">{item.label}</p>
                  <p className={cn('text-sm font-medium mt-0.5 tabular-nums', 'valueClassName' in item ? item.valueClassName : undefined)}>{item.value}</p>
                </div>
              ))}
            </div>
            {salePool.length > 0 && (
              <p className="text-xs text-muted">
                Average sale rate is from {salePool.length} sales order{salePool.length === 1 ? '' : 's'} on this lot.
              </p>
            )}
            <p className="text-sm">
              <span className="text-muted">From purchase </span>
              <Link
                to={appPath(`/purchase-orders?ref=${encodeURIComponent(poRef)}`)}
                className="font-medium text-accent hover:underline"
              >
                {formatPoRef(poRef)}
              </Link>
            </p>
            {contract && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-xs text-muted mb-1">Linked Contract</p>
                <Link to={`/contracts/${contract.id}`} className="text-sm font-medium text-accent hover:underline">{contract.ref}</Link>
                <p className="text-xs text-muted mt-1">{contract.buyer} ↔ {contract.seller} · {formatContractRate(contract.rate)}</p>
              </div>
            )}
          </div>
        </Card>

        <Card padding={false}>
          <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
            <h3 className="text-base font-semibold text-heading">Stock movement</h3>
            <p className="text-sm text-muted mt-0.5">Receipts into the godown and dispatches from this lot</p>
          </div>
          {movements.length === 0 ? (
            <div className="px-5 pb-5">
              <EmptyState
                icon={<ArrowLeftRight className="h-10 w-10" />}
                title="No godown movement yet"
                description="An own-stock delivery adds stock. Dispatching a sale from this lot removes it."
                action={<Button to={`/lifts/new?poRef=${encodeURIComponent(poRef)}&stock=1`} size="sm" variant="outline">Receive stock</Button>}
              />
            </div>
          ) : (
            <DataTable
              paginate={false}
              columns={[
                { key: 'date', header: 'Date', render: (r: typeof movements[0]) => <span className="tabular-nums">{formatDate(r.date)}</span> },
                { key: 'type', header: 'Type', render: (r) => (
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="h-3 w-3 text-muted" />
                    {r.type}
                  </div>
                )},
                { key: 'quantity', header: 'Change', render: (r) => (
                  <span className={cn('tabular-nums', r.quantity > 0 ? 'text-success' : 'text-danger')}>{r.quantity > 0 ? '+' : ''}{formatMt(r.quantity)}</span>
                ), className: 'text-right' },
                { key: 'balance', header: 'Balance', render: (r) => <span className="tabular-nums">{formatMt(r.balance)}</span>, className: 'text-right' },
                { key: 'ref', header: 'Reference', render: (r) => <span>{r.ref}</span> },
              ]}
              data={movements}
            />
          )}
        </Card>
      </div>
    </div>
  )
}
