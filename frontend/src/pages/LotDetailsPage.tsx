import { useParams, Link } from 'react-router-dom'
import { useMemo } from 'react'
import { ArrowLeftRight, Package, TrendingUp } from 'lucide-react'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb, EmptyState } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { Card, CardHeader, StatCard } from '../components/ui/Card'
import { StatusBadge } from '../components/ui/Badge'
import { DataTable } from '../components/ui/DataTable'
import { ProgressBar } from '../components/ui/CommandPalette'
import { formatCurrency, formatDate, formatMt, formatQty, cn, availableQtyClass } from '../lib/utils'
import { formatContractRate, formatRateCell, SALE_RATE_COLUMN_HEADER } from '../lib/orderRate'
import { formatLiftRef, formatPoRef, formatSoRef } from '../lib/tradeRefs'
import { useTradeStore } from '../store/TradeStore'
import { getLiftAllocations, liftTouchesRef } from '../lib/liftAllocations'

function poRefFromLot(lotNumber: string) {
  return lotNumber.replace(/^LOT-/, '')
}

export function LotDetailsPage() {
  const store = useTradeStore()
  const { lots, contracts, lifts } = store
  const { lotId } = useParams()
  const lot = lots.find(l => l.id === lotId)

  const poRef = lot ? poRefFromLot(lot.lotNumber) : ''

  const linkedSOs = useMemo(
    () => (poRef ? store.getSOsForPO(poRef) : []),
    [store, poRef],
  )

  const allocations = useMemo(
    () => linkedSOs.map(so => ({
      id: so.id,
      ref: so.ref,
      retailer: so.partyName,
      quantity: so.orderQty,
      liftedQty: so.liftedQty,
      rate: so.rate,
      rateBasis: so.rateBasis,
      ratePerBasis: so.ratePerBasis,
      status: so.status,
      date: so.date,
    })),
    [linkedSOs],
  )

  const movements = useMemo(() => {
    if (!lot) return []

    const poLifts = lifts
      .filter(l => liftTouchesRef(l, poRef))
      .sort((a, b) => a.date.localeCompare(b.date))

    let balance = lot.quantityPurchased
    const rows: {
      id: string
      type: string
      quantity: number
      balance: number
      date: string
      ref: string
    }[] = [{
      id: 'purchase',
      type: 'Purchase (PO)',
      quantity: lot.quantityPurchased,
      balance,
      date: lot.purchaseDate,
      ref: poRef,
    }]

    for (const lift of poLifts) {
      const qty = getLiftAllocations(lift)
        .filter(a => a.poRef === poRef)
        .reduce((s, a) => s + a.qtyMt, 0)
      if (qty <= 0) continue
      balance = Math.max(0, balance - qty)
      rows.push({
        id: lift.id,
        type: 'Lift / Dispatch',
        quantity: -qty,
        balance,
        date: lift.date,
        ref: formatLiftRef(lift.liftRef),
      })
    }

    return rows.reverse()
  }, [lot, lifts, poRef])

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
  const avgSaleRate = linkedSOs.length
    ? linkedSOs.reduce((s, o) => s + o.rate, 0) / linkedSOs.length
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
          <Button to={`/inventory/${lot.id}/sell`} size="sm">
            Sell from this lot
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Purchase Price" value={formatContractRate(lot.purchasePrice)} />
        <StatCard label="Remaining" value={formatQty(lot.remaining, lot.unit)} change={`of ${formatQty(lot.quantityPurchased, lot.unit)}`} changeType="neutral" />
        <StatCard label="Allocated" value={formatQty(lot.allocated, lot.unit)} change={`${formatQty(lot.available, lot.unit)} available`} changeType={lot.available < 0 ? 'down' : 'neutral'} />
        <StatCard label="Lot Value" value={formatCurrency(lotValue)} icon={<TrendingUp className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card padding={false}>
            <div className="px-5 pt-5">
              <CardHeader
                title="Allocations"
                subtitle="Sales orders linked to this lot"
              />
            </div>
            {allocations.length === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState
                  icon={<Package className="h-10 w-10" />}
                  title="No allocations yet"
                  description={`Stock from ${poRef} is not linked to any sales orders.`}
                  action={<Button to={`/sales-orders/new?poRef=${encodeURIComponent(poRef)}`} size="sm">Create SO against {formatPoRef(poRef)}</Button>}
                />
              </div>
            ) : (
              <DataTable
                paginate={false}
                qtyNote
                columns={[
                  { key: 'ref', header: 'SO Ref#', render: (r: typeof allocations[0]) => (
                    <Link to={`/sales-orders?ref=${encodeURIComponent(r.ref)}`} className="text-accent hover:underline text-sm">{formatSoRef(r.ref)}</Link>
                  )},
                  { key: 'retailer', header: 'Buyer' },
                  { key: 'poQty', header: 'PO Qty', render: () => <span className="tabular-nums">{formatMt(lot.quantityPurchased)}</span>, className: 'text-right' },
                  { key: 'quantity', header: 'SO Qty', render: (r) => <span className="tabular-nums">{formatMt(r.quantity)}</span>, className: 'text-right' },
                  { key: 'liftedQty', header: 'Lifted', render: (r) => <span className="tabular-nums">{formatMt(r.liftedQty)}</span>, className: 'text-right' },
                  { key: 'pending', header: 'Pending', render: (r) => <span className="tabular-nums">{formatMt(Math.max(0, r.quantity - r.liftedQty))}</span>, className: 'text-right' },
                  { key: 'rate', header: SALE_RATE_COLUMN_HEADER, render: (r) => formatRateCell(r.rate, r.rateBasis, r.ratePerBasis), className: 'text-right' },
                  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                  { key: 'date', header: 'Date', render: (r) => <span className="tabular-nums">{formatDate(r.date)}</span> },
                ]}
                data={allocations}
              />
            )}
          </Card>

          <Card padding={false}>
            <div className="px-5 pt-5">
              <CardHeader
                title="Stock movement"
                subtitle="Purchase and dispatch history"
                action={
                  movements.length <= 1 ? (
                    <Button to={`/lifts/new?poRef=${encodeURIComponent(poRef)}&stock=1`} size="sm" variant="outline">Record lift</Button>
                  ) : undefined
                }
              />
            </div>
            {movements.length <= 1 ? (
              <div className="px-5 pb-5">
                <EmptyState
                  icon={<ArrowLeftRight className="h-10 w-10" />}
                  title="No dispatches yet"
                  description="Lifts recorded against this PO will appear here."
                  action={<Button to={`/lifts/new?poRef=${encodeURIComponent(poRef)}&stock=1`} size="sm" variant="outline">Record Lift</Button>}
                />
              </div>
            ) : (
              <DataTable
                paginate={false}
                qtyNote
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
                  { key: 'ref', header: 'Reference', render: (r) => <span className="">{r.ref}</span> },
                ]}
                data={movements}
              />
            )}
          </Card>
        </div>

        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Card>
            <CardHeader title="Overview" subtitle="Stock level and lot details" />
            <div className="space-y-6">
              <ProgressBar value={lot.remaining} max={lot.quantityPurchased} label="Inventory level" />
              {lot.allocated > 0 && (
                <ProgressBar value={lot.allocated} max={lot.quantityPurchased} label="Allocated to sales orders" />
              )}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Seller', value: lot.producer },
                  { label: 'Broker', value: lot.broker },
                  { label: 'Purchase Date', value: formatDate(lot.purchaseDate) },
                  { label: 'PO Reference', value: poRef },
                  { label: 'PO Quantity', value: formatQty(lot.quantityPurchased, lot.unit) },
                  { label: 'Allocated', value: formatQty(lot.allocated, lot.unit) },
                  {
                    label: 'Available',
                    value: formatQty(lot.available, lot.unit),
                    valueClassName: availableQtyClass(lot.available),
                  },
                  { label: 'Expiry', value: lot.expiry ? formatDate(lot.expiry) : 'N/A', className: 'col-span-2' },
                ].map(item => (
                  <div key={item.label} className={item.className}>
                    <p className="text-xs text-muted">{item.label}</p>
                    <p className={cn('text-sm font-medium mt-0.5', item.valueClassName)}>{item.value}</p>
                  </div>
                ))}
              </div>
              {contract && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <p className="text-xs text-muted mb-1">Linked Contract</p>
                  <Link to={`/contracts/${contract.id}`} className="text-sm font-medium text-accent hover:underline">{contract.ref}</Link>
                  <p className="text-xs text-muted mt-1">{contract.buyer} ↔ {contract.seller} · {formatContractRate(contract.rate)}</p>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Pricing" subtitle="Purchase vs average sale rate" />
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Purchase Rate</span>
                <span className="font-medium">{formatContractRate(lot.purchasePrice)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Avg Sale Rate</span>
                <span className="font-medium">{avgSaleRate > 0 ? formatContractRate(avgSaleRate) : '—'}</span>
              </div>
              {linkedSOs.length > 0 && (
                <p className="text-xs text-muted pt-2 border-t border-gray-200 dark:border-gray-700">
                  Based on {linkedSOs.length} linked sales order{linkedSOs.length === 1 ? '' : 's'}
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
