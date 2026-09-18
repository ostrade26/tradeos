import { Link, useSearchParams } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { BookUser, FileDown } from 'lucide-react'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb, Tabs, EmptyState } from '../components/ui/Tabs'
import { Card } from '../components/ui/Card'
import { Badge, StatusBadge } from '../components/ui/Badge'
import { DataTable } from '../components/ui/DataTable'
import { Button } from '../components/ui/Button'
import { formatCurrency, formatDate, formatMt, formatQty } from '../lib/utils'
import { formatContractRate, formatRateCell, RATE_COLUMN_HEADER } from '../lib/orderRate'
import { formatLiftRef, formatOrderRef } from '../lib/tradeRefs'
import { partyMatches } from '../lib/assistant/partyMatch'
import { toBeLifted, type Lift, type TradeOrder } from '../data/mockData'
import { getLiftAllocations, formatLiftPoRefs, formatLiftSoRefs } from '../lib/liftAllocations'
import { useTradeStore } from '../store/TradeStore'
import { brokerBrokerageSummary } from '../lib/brokerBrokerage'
import { downloadPartyReportPdf } from '../lib/partyReportPdf'
import { CaptionCard } from '../components/ui/CaptionCard'

export function PartyPage() {
  const store = useTradeStore()
  const [searchParams] = useSearchParams()
  const partyName = searchParams.get('name') ?? ''
  const [tab, setTab] = useState('overview')

  const producer = useMemo(
    () => store.producers.find(p => partyMatches(p.name, partyName)),
    [store.producers, partyName],
  )
  const retailer = useMemo(
    () => store.retailers.find(r => partyMatches(r.name, partyName)),
    [store.retailers, partyName],
  )
  const broker = useMemo(
    () => store.brokers.find(b => partyMatches(b.name, partyName)),
    [store.brokers, partyName],
  )
  const sellerBalance = useMemo(
    () => (producer ? store.getSellerOutstandingBalance(partyName) : { total: 0, lines: [] }),
    [producer, store, partyName],
  )

  const pos = useMemo(
    () => store.getPORegister().filter(o => partyMatches(o.partyName, partyName) || partyMatches(o.sellerName ?? '', partyName)),
    [store.tradeOrders, partyName],
  )
  const sos = useMemo(
    () => store.getSORegister().filter(o => partyMatches(o.partyName, partyName) || partyMatches(o.buyerName ?? '', partyName)),
    [store.tradeOrders, partyName],
  )
  const lifts = useMemo(
    () => store.lifts.filter(l => {
      if (partyMatches(l.buyerName, partyName) || partyMatches(l.sellerName, partyName)) return true
      return getLiftAllocations(l).some(a => {
        if (!a.soRef) return partyMatches(l.buyerName, partyName)
        const so = store.getOrderByRef(a.soRef, 'sale')
        const po = store.getOrderByRef(a.poRef, 'purchase')
        return partyMatches(so?.partyName ?? '', partyName) || partyMatches(po?.partyName ?? '', partyName)
      })
    }),
    [store, partyName],
  )
  const lots = useMemo(
    () => store.lots.filter(l => partyMatches(l.producer, partyName)),
    [store.lots, partyName],
  )

  const pendingPoQty = pos.filter(o => o.status !== 'completed').reduce((s, o) => s + toBeLifted(o), 0)
  const pendingSoQty = sos.filter(o => o.status !== 'completed').reduce((s, o) => s + toBeLifted(o), 0)
  const totalBusiness = pos.reduce((s, o) => s + o.orderQty * o.rate, 0)
    + sos.reduce((s, o) => s + o.orderQty * o.rate, 0)

  if (!partyName) {
    return (
      <EmptyState
        card
        icon={<BookUser className="h-10 w-10" />}
        title="Select a party"
        description="Open a company from Directory or search via ⌘K."
        action={<Button to="/directory">Go to Directory</Button>}
      />
    )
  }

  const tabEmptyState = (title: string, description: string) => (
    <EmptyState title={title} description={description} />
  )

  const partyKind = producer ? 'Producer' : retailer ? 'Buyer' : broker ? 'Broker' : 'Party'

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={partyName}
        subtitle={`${partyKind} · ${pos.length} POs · ${sos.length} SOs · ${lifts.length} lifts`}
        breadcrumb={<Breadcrumb items={[
          { label: 'Tradeal', href: '/' },
          { label: 'Directory', href: '/directory' },
          { label: partyName },
        ]} />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadPartyReportPdf({ partyName, partyKind, pos, sos, lifts })}
            >
              <FileDown className="h-4 w-4" /> Export report
            </Button>
            {producer ? (
              <Button to={`/purchase-orders/new`} variant="outline" size="sm">
                New PO
              </Button>
            ) : (
              <Button to={`/purchase-orders?party=${encodeURIComponent(partyName)}`} variant="outline" size="sm">
                View PO list
              </Button>
            )}
          </div>
        }
      />

      {(producer || retailer || broker) && (
        <CaptionCard
          className="mb-6"
          caption={producer && sellerBalance.total > 0 ? {
            label: 'Remaining balance',
            value: formatQty(sellerBalance.total),
            detail: [
              'MT owed from prior short deliveries',
              sellerBalance.lines.length === 1
                ? `${sellerBalance.lines[0].poRef} → ${sellerBalance.lines[0].soRef}`
                : sellerBalance.lines.map(line => `${line.poRef} → ${line.soRef}: ${formatQty(line.qtyMt)}`).join(' · '),
            ].join(' · '),
          } : undefined}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{partyKind} details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
              {(producer || retailer) && (() => {
                const party = producer ?? retailer
                if (!party) return null
                const fields: { label: string; value: string }[] = [
                  { label: 'Code No', value: party.code || '—' },
                  { label: 'City', value: party.city || party.location || '—' },
                  { label: 'Address', value: party.address || '—' },
                  { label: 'Contact person', value: party.contactPerson || '—' },
                  { label: 'Phone', value: party.phone || '—' },
                  { label: 'WhatsApp', value: party.whatsapp || '—' },
                  { label: 'Email', value: party.email || '—' },
                  { label: 'GST No', value: party.gst || '—' },
                  { label: 'TAN No', value: party.tan || party.tin || '—' },
                  { label: 'PAN', value: party.pan || '—' },
                  { label: 'Aadhaar', value: party.aadhar || '—' },
                  { label: 'FSSAI No', value: party.fssai || '—' },
                  { label: 'Bank name', value: party.bankName || '—' },
                  { label: 'Bank A/C', value: party.bankAccount || '—' },
                  { label: 'IFSC / RTGS', value: party.ifsc || '—' },
                ]
                return fields.map(field => (
                  <div key={field.label}>
                    <p className="text-xs text-muted">{field.label}</p>
                    <p className="font-medium mt-0.5 break-words">{field.value}</p>
                  </div>
                ))
              })()}
              {producer && (
                <>
                  <div>
                    <p className="text-xs text-muted">Products</p>
                    <p className="font-medium mt-0.5">{producer.products.length ? producer.products.join(', ') : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Purchase orders</p>
                    <p className="font-medium tabular-nums mt-0.5">{pos.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Avg purchase rate</p>
                    <p className="font-medium tabular-nums mt-0.5">
                      {producer.avgRate > 0 ? formatContractRate(producer.avgRate) : '—'}
                    </p>
                  </div>
                </>
              )}
              {retailer && (
                <>
                  <div>
                    <p className="text-xs text-muted">Products</p>
                    <p className="font-medium mt-0.5">{retailer.products.length ? retailer.products.join(', ') : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Sales orders</p>
                    <p className="font-medium tabular-nums mt-0.5">{sos.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Total purchases</p>
                    <p className="font-medium tabular-nums mt-0.5">{formatCurrency(retailer.totalPurchases)}</p>
                  </div>
                </>
              )}
              {broker && (
                <>
                  <div>
                    <p className="text-xs text-muted">Email</p>
                    <p className="font-medium mt-0.5">{broker.email || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Phone</p>
                    <p className="font-medium mt-0.5">{broker.phone || '—'}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted">Brokerage</p>
                    <p className="font-medium mt-0.5">{brokerBrokerageSummary(broker)}</p>
                  </div>
                </>
              )}
            </div>
        </CaptionCard>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted">Purchase orders</p>
          <p className="text-xl font-semibold mt-1">{pos.length}</p>
          {pendingPoQty > 0 && <p className="text-xs text-warning mt-0.5">{formatQty(pendingPoQty)} to lift</p>}
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted">Sales orders</p>
          <p className="text-xl font-semibold mt-1">{sos.length}</p>
          {pendingSoQty > 0 && <p className="text-xs text-warning mt-0.5">{formatQty(pendingSoQty)} to lift</p>}
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted">Lifts</p>
          <p className="text-xl font-semibold mt-1">{lifts.length}</p>
          <p className="text-xs text-muted mt-0.5">{formatQty(lifts.reduce((s, l) => s + l.liftedQty, 0))} lifted</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted">Total volume</p>
          <p className="text-lg font-semibold mt-1">{formatCurrency(totalBusiness)}</p>
        </Card>
      </div>

      <Card padding={false}>
        <Tabs
          className="px-5"
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'pos', label: 'POs', count: pos.length },
            { id: 'sos', label: 'SOs', count: sos.length },
            { id: 'lifts', label: 'Lifts', count: lifts.length },
          ]}
          active={tab}
          onChange={setTab}
        />
        <div className="p-5">
          {tab === 'overview' && (
            <div className="space-y-4">
              {lots.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted uppercase mb-2">Inventory lots</p>
                  <div className="space-y-2">
                    {lots.map(lot => (
                      <Link key={lot.id} to={`/inventory/${lot.id}`} className="flex justify-between rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <span className="font-mono text-sm">{lot.lotNumber}</span>
                        <Badge variant="info">{formatQty(lot.available)} available</Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {lots.length === 0 && pos.length + sos.length === 0 && (
                <EmptyState
                  title="No activity with this party yet"
                  description="Orders, lifts, and inventory linked to this party will appear here."
                />
              )}
            </div>
          )}

          {tab === 'pos' && (
            <DataTable<TradeOrder>
              paginate={false}
              qtyNote
              data={pos}
              emptyState={tabEmptyState('No purchase orders', 'POs with this party will appear here.')}
              columns={[
                { key: 'ref', header: 'Ref', render: r => (
                  <Link to={`/purchase-orders?ref=${encodeURIComponent(r.ref)}`} className="font-mono text-accent hover:underline">{formatOrderRef(r.ref, r.side)}</Link>
                )},
                { key: 'date', header: 'Date', render: r => <span className="tabular-nums">{formatDate(r.date)}</span> },
                { key: 'item', header: 'Item', render: r => r.itemName },
                { key: 'qty', header: 'Qty', render: r => <span className="tabular-nums">{formatMt(r.orderQty)}</span>, className: 'text-right' },
                { key: 'rate', header: RATE_COLUMN_HEADER, render: r => formatRateCell(r.rate, r.rateBasis, r.ratePerBasis), className: 'text-right' },
                { key: 'status', header: 'Status', render: r => <StatusBadge status={r.status} /> },
              ]}
              getRowId={r => r.id}
            />
          )}

          {tab === 'sos' && (
            <DataTable<TradeOrder>
              paginate={false}
              qtyNote
              data={sos}
              emptyState={tabEmptyState('No sales orders', 'SOs with this party will appear here.')}
              columns={[
                { key: 'ref', header: 'Ref', render: r => (
                  <Link to={`/sales-orders?ref=${encodeURIComponent(r.ref)}`} className="font-mono text-accent hover:underline">{formatOrderRef(r.ref, r.side)}</Link>
                )},
                { key: 'poRef', header: 'PO', render: r => r.poRef ?? '—' },
                { key: 'item', header: 'Item', render: r => r.itemName },
                { key: 'qty', header: 'Qty', render: r => <span className="tabular-nums">{formatMt(r.orderQty)}</span>, className: 'text-right' },
                { key: 'status', header: 'Status', render: r => <StatusBadge status={r.status} /> },
              ]}
              getRowId={r => r.id}
            />
          )}

          {tab === 'lifts' && (
            <DataTable<Lift>
              paginate={false}
              qtyNote
              data={lifts}
              emptyState={tabEmptyState('No lifts', 'Lifts involving this party will appear here.')}
              columns={[
                { key: 'liftRef', header: 'Lift ref', render: r => formatLiftRef(r.liftRef) },
                { key: 'date', header: 'Date', render: r => <span className="tabular-nums">{formatDate(r.date)}</span> },
                { key: 'poRef', header: 'PO', render: r => formatLiftPoRefs(r) },
                { key: 'soRef', header: 'SO', render: r => formatLiftSoRefs(r) },
                { key: 'qty', header: 'Qty', render: r => <span className="tabular-nums">{formatMt(r.liftedQty)}</span>, className: 'text-right' },
              ]}
              getRowId={r => r.id}
            />
          )}
        </div>
      </Card>
    </div>
  )
}
