import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Download, FileText, Pencil, Plus, Scale, Trash2 } from 'lucide-react'
import { ApiError } from '../api/client'
import { organisationApi, type BrokerContractShare } from '../api/organisationApi'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb, EmptyState } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import { Badge, StatusBadge } from '../components/ui/Badge'
import { OngoingContractStatus } from '../components/contracts/OngoingContractStatus'
import { ContractReceiveModal } from '../components/contracts/ContractReceiveModal'
import { ConfirmDeleteModal } from '../components/ui/DeleteActions'
import { DataTable } from '../components/ui/DataTable'
import {
  bothPartiesConfirmed,
  orderFromContractHref,
} from '../components/contracts/ContractConfirmationPanel'
import { CollapsibleRegisterStats } from '../components/registers/CollapsibleRegisterStats'
import { useToast } from '../hooks/useToast'
import { formatCurrency, formatDateTime, formatMt, formatQty, roundQtyMt, cn } from '../lib/utils'
import { formatIndianAmount, parseIndianAmount } from '../lib/indianAmount'
import { tankerQtyLinesFromBrokerEvent } from '../lib/tankerQtyLines'
import { RATE_COLUMN_HEADER } from '../lib/orderRate'
import { orderLineAmount } from '../lib/orderRate'
import { appPath } from '../lib/appShellMode'
import { formatLiftRef } from '../lib/tradeRefs'
import { deliveredQtyMt } from '../lib/brokerContractStatus'
import { CONTRACT_SHARES_REFRESH_EVENT, dispatchContractSharesRefresh } from '../lib/contractSharesRefresh'
import { activityTypeConfig } from '../lib/activityDisplay'
import { ContractShareDeliveryPanel } from '../components/contracts/ContractDeliveryPanel'
import { BrokerRecordLiftModal } from '../components/contracts/BrokerRecordLiftModal'
import type { Activity } from '../data/mockData'

function placeOf(city: string, state: string): string {
  return [city, state].filter(Boolean).join(', ')
}

function splitDelivery(period: string): { delivery: string; location: string } {
  const parts = period.split(' · ').map(part => part.trim()).filter(Boolean)
  if (parts.length === 0) return { delivery: '', location: '' }
  const [first, ...rest] = parts
  if (/^ready$/i.test(first)) return { delivery: 'Ready', location: rest.join(' · ') }
  return { delivery: first, location: rest.join(' · ') }
}

function PartyCard({
  title,
  orderLabel,
  orderRef,
  bookingNote,
  delivered,
  inTransit,
  name,
  legalName,
  city,
  state,
  gstin,
  orgCode,
}: {
  title: string
  orderLabel: string
  orderRef: string
  bookingNote: string
  delivered: number
  inTransit: number
  name: string
  legalName: string
  city: string
  state: string
  gstin: string
  orgCode: string
}) {
  const fields = [
    { label: 'Legal name', value: legalName && legalName !== name ? legalName : '' },
    { label: 'Location', value: placeOf(city, state) },
    { label: 'GSTIN', value: gstin, mono: true },
    { label: 'Org code', value: orgCode, mono: true },
    { label: orderLabel, value: orderRef || bookingNote },
  ].filter(field => field.value)

  return (
    <Card>
      <CardHeader title={title} subtitle={name || 'Not set'} />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {fields.map(field => (
          <div key={field.label}>
            <dt className="text-xs text-muted">{field.label}</dt>
            <dd className={`text-sm font-medium text-heading mt-0.5 ${field.mono ? 'font-mono tabular-nums' : ''}`}>
              {field.value}
            </dd>
          </div>
        ))}
        <div>
          <dt className="text-xs text-muted">Delivered</dt>
          <dd className="text-sm font-semibold tabular-nums text-heading mt-0.5">{formatQty(delivered, 'MT')}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">In transit</dt>
          <dd className="text-sm font-semibold tabular-nums text-heading mt-0.5">{formatQty(inTransit, 'MT')}</dd>
        </div>
      </dl>
    </Card>
  )
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-md bg-card shadow-[var(--shadow-card)] px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-muted leading-snug">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-heading">{value}</p>
      {detail ? <p className="text-xs text-muted mt-1 leading-snug">{detail}</p> : null}
    </div>
  )
}

function sideMovement(events: BrokerContractShare['lift_events'], role: 'buyer' | 'seller') {
  let delivered = 0
  let transit = 0
  for (const event of events ?? []) {
    if (event.party_role !== role) continue
    const qty = Number(event.qty_mt) || 0
    if (event.status === 'delivered') delivered += qty
    else transit += qty
  }
  return {
    delivered: roundQtyMt(delivered),
    transit: roundQtyMt(transit),
    lifted: roundQtyMt(delivered + transit),
  }
}

export function ContractSharePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [share, setShare] = useState<BrokerContractShare | null>(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [recordLiftOpen, setRecordLiftOpen] = useState(false)

  const load = useCallback(() => {
    const shareId = Number(id)
    if (!Number.isFinite(shareId)) {
      setShare(null)
      setMissing(true)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    organisationApi.getBrokerShare(shareId)
      .then(res => {
        if (cancelled) return
        setShare(res.share)
        setMissing(false)
      })
      .catch(err => {
        if (cancelled) return
        const gone = err instanceof ApiError && err.status === 404
        if (gone) {
          toast.error('This contract is no longer available')
          navigate(appPath('/contracts'), { replace: true })
          return
        }
        setShare(null)
        setMissing(true)
        toast.error(err instanceof ApiError ? err.message : 'Could not open contract')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, navigate, toast])

  useEffect(() => {
    const stop = load()
    return () => stop?.()
  }, [load, reloadKey])

  useEffect(() => {
    const refresh = () => setReloadKey(key => key + 1)
    window.addEventListener(CONTRACT_SHARES_REFRESH_EVENT, refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener(CONTRACT_SHARES_REFRESH_EVENT, refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  const removeShare = async () => {
    if (!share) return
    setDeleteError('')
    try {
      await organisationApi.deleteBrokerShare(share.id)
      toast.success(`${share.contract_ref} deleted`, {
        description: 'The buyer and the seller have been notified.',
      })
      setDeleteOpen(false)
      dispatchContractSharesRefresh()
      navigate(appPath('/contracts?tab=deleted'))
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not delete contract'
      setDeleteError(message)
      throw err
    }
  }

  const download = async () => {
    if (!share) return
    setDownloading(true)
    try {
      const res = await organisationApi.getBrokerShare(share.id, true)
      const data = res.share.pdf_data || ''
      if (!data) {
        toast.error('This contract has no PDF')
        return
      }
      const anchor = document.createElement('a')
      anchor.href = data
      anchor.download = res.share.filename || `${share.contract_ref}.pdf`
      anchor.click()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not download PDF')
    } finally {
      setDownloading(false)
    }
  }

  if (loading && !share) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Contract"
          breadcrumb={<Breadcrumb items={[{ label: 'Tradeal', href: appPath('/') }, { label: 'Contracts', href: appPath('/contracts') }, { label: 'Loading' }]} />}
        />
        <p className="text-sm text-muted">Loading contract…</p>
      </div>
    )
  }

  if (!share || missing) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Contract not found"
          breadcrumb={<Breadcrumb items={[{ label: 'Tradeal', href: appPath('/') }, { label: 'Contracts', href: appPath('/contracts') }, { label: 'Not found' }]} />}
        />
        <EmptyState
          card
          icon={<FileText className="h-10 w-10" />}
          title="No contract found"
          description="This contract does not exist or has been removed."
          action={<Button to={appPath('/contracts')} variant="outline">Back to contracts</Button>}
        />
      </div>
    )
  }

  const quantity = parseFloat(share.quantity) || 0
  const rate = parseIndianAmount(share.rate)
  const value = orderLineAmount(quantity, rate)
  const delivered = deliveredQtyMt(share)
  const buyerMove = sideMovement(share.lift_events, 'buyer')
  const sellerMove = sideMovement(share.lift_events, 'seller')
  const inTransitQty = roundQtyMt(Math.max(buyerMove.transit, sellerMove.transit))
  const liftedQty = roundQtyMt(Math.max(buyerMove.lifted, sellerMove.lifted))
  const notYetLifted = Math.max(0, roundQtyMt(quantity - liftedQty))
  const brokeragePct = parseFloat(share.brokerage.replace('%', '')) || 0
  const brokerageEarned = orderLineAmount(delivered, rate) * brokeragePct / 100
  const brokerageOpen = orderLineAmount(Math.max(0, roundQtyMt(quantity - delivered)), rate) * brokeragePct / 100
  const ready = bothPartiesConfirmed(share)
  const href = ready ? orderFromContractHref(share) : ''
  const mineConfirmed = share.role === 'buyer' ? share.buyer_confirmed : share.role === 'seller' ? share.seller_confirmed : true
  const booked = share.role === 'buyer' ? share.buyer_order_ref : share.role === 'seller' ? share.seller_order_ref : ''
  const lifts = [...(share.lift_events ?? [])].sort((a, b) => (b.updated_at || b.event_at).localeCompare(a.updated_at || a.event_at))
  const deliveryParts = splitDelivery(share.delivery_period)
  const terms = [
    { label: 'Delivery', value: deliveryParts.delivery },
    { label: 'Location', value: deliveryParts.location },
    { label: 'Payment terms', value: share.payment_terms },
    { label: 'Brokerage', value: share.brokerage },
    { label: 'Received', value: formatDateTime(share.created_at) },
    { label: 'Note', value: share.note },
  ].filter(item => item.value)
  const timeline = [
    {
      title: 'Contract sent',
      description: share.sender_name ? `Sent by ${share.sender_name}` : share.contract_ref,
      time: formatDateTime(share.created_at),
      at: share.created_at,
      seq: 0,
      status: 'completed' as const,
      activity: 'contract_created' as const,
    },
    ...(share.buyer_confirmed_at ? [{
      title: 'Buyer confirmed',
      description: share.buyer_name || 'Buyer',
      time: formatDateTime(share.buyer_confirmed_at),
      at: share.buyer_confirmed_at,
      seq: 0,
      status: 'completed' as const,
      activity: 'delivery_completed' as const,
    }] : []),
    ...(share.seller_confirmed_at ? [{
      title: 'Seller confirmed',
      description: share.seller_name || 'Seller',
      time: formatDateTime(share.seller_confirmed_at),
      at: share.seller_confirmed_at,
      seq: 0,
      status: 'completed' as const,
      activity: 'delivery_completed' as const,
    }] : []),
    ...lifts.flatMap(event => {
      const label = formatLiftRef(share.role === 'broker' && event.broker_lift_ref ? event.broker_lift_ref : event.lift_ref) || 'Lift'
      const party = event.party_name || event.party_role
      const detail = [party, formatQty(event.qty_mt, 'MT'), event.order_ref].filter(Boolean).join(' · ')
      const createdAt = event.event_at || event.updated_at
      const deliveredAt = event.delivered_at || (event.status === 'delivered' ? event.updated_at || event.event_at : '')
      const steps: {
        title: string
        description: string
        time: string
        at: string
        seq: number
        status: 'completed' | 'current'
        activity: Activity['type']
      }[] = [
        {
          title: `${label} created`,
          description: detail,
          time: formatDateTime(createdAt),
          at: createdAt,
          seq: 0,
          status: 'completed',
          activity: 'lift_recorded',
        },
        {
          title: `${label} in transit`,
          description: detail,
          time: formatDateTime(createdAt),
          at: createdAt,
          seq: 1,
          status: event.status === 'delivered' ? 'completed' : 'current',
          activity: 'goods_dispatched',
        },
      ]
      if (event.status === 'delivered' && deliveredAt) {
        steps.push({
          title: `${label} delivered`,
          description: detail,
          time: formatDateTime(deliveredAt),
          at: deliveredAt,
          seq: 2,
          status: 'completed',
          activity: 'delivery_completed',
        })
      }
      return steps
    }),
  ].sort((a, b) => b.at.localeCompare(a.at) || b.seq - a.seq)
  const rateLabel = rate ? formatIndianAmount(rate) : ''
  const movementRows = lifts.flatMap(event => {
    const when = formatDateTime(event.status === 'delivered' ? (event.delivered_at || event.event_at || event.updated_at) : (event.event_at || event.updated_at))
    const tankers = event.tankers ?? []
    const qtyEvent = {
      qty_mt: event.qty_mt,
      short_qty_mt: event.short_qty_mt,
      status: event.status,
    }
    const lines = tankerQtyLinesFromBrokerEvent(tankers, qtyEvent)
    const liftLabel = formatLiftRef(share.role === 'broker' && event.broker_lift_ref ? event.broker_lift_ref : event.lift_ref)
    const party = event.party_name || event.party_role
    return lines.map((line, index) => {
      const tanker = tankers[index]
      return {
        id: `${event.id}-${index}`,
        when,
        party,
        lift: liftLabel,
        order: event.broker_recorded ? 'Broker record' : (event.order_ref || '—'),
        rate: rateLabel,
        planned: line.plannedMt,
        actual: line.actualMt,
        balance: line.balanceMt,
        truck: line.tankerNo || '—',
        truckChanged: Boolean(line.changed),
        truckPrevious: line.previous || '',
        transport: tanker?.transport_name || '—',
        driver: tanker?.driver_mobile || '—',
        lr: tanker?.lr_no || '—',
        invoice: tanker?.sales_invoice_no || tanker?.po_invoice_no || '—',
        status: event.status,
      }
    })
  })

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title={(
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>{share.contract_ref}</span>
            <OngoingContractStatus share={share} />
            {share.edited ? <Badge variant="warning">Edited</Badge> : null}
          </span>
        )}
        subtitle={`${share.item_name || 'Contract'} · ${share.buyer_name} · ${share.seller_name}`}
        breadcrumb={<Breadcrumb items={[
          { label: 'Tradeal', href: appPath('/') },
          { label: 'Contracts', href: appPath('/contracts') },
          { label: share.contract_ref },
        ]} />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {share.role === 'broker' && !share.deleted_at ? (
              <>
                <Button type="button" size="sm" onClick={() => setRecordLiftOpen(true)}>
                  <Scale className="h-4 w-4" /> Record lift
                </Button>
                <Button type="button" variant="outline" size="sm" to={appPath(`/contract-shares/${share.id}/edit`)}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
                <Button type="button" variant="outlineDanger" size="sm" onClick={() => { setDeleteError(''); setDeleteOpen(true) }}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </>
            ) : null}
            {share.filename ? (
              <Button type="button" variant="outline" size="sm" loading={downloading} onClick={() => void download()}>
                <Download className="h-4 w-4" /> PDF
              </Button>
            ) : null}
            {(share.role === 'buyer' || share.role === 'seller') && !mineConfirmed && !share.deleted_at ? (
              <Button type="button" size="sm" onClick={() => setConfirmOpen(true)}>
                Confirm contract
              </Button>
            ) : null}
            {!share.deleted_at && !booked && href ? (
              <Button to={href} size="sm">
                <Plus className="h-4 w-4" /> {share.role === 'buyer' ? 'Generate PO' : 'Generate SO'}
              </Button>
            ) : null}
            {booked ? (
              <Button
                to={share.role === 'buyer'
                  ? appPath(`/purchase-orders?ref=${encodeURIComponent(booked)}`)
                  : appPath(`/sales-orders?ref=${encodeURIComponent(booked)}`)}
                variant="outline"
                size="sm"
              >
                Open {booked}
              </Button>
            ) : null}
          </div>
        }
      />

      {share.role === 'broker' ? (
        <div className="rounded-md bg-card shadow-[var(--shadow-card)] p-6">
          <ContractShareDeliveryPanel share={share} />
        </div>
      ) : null}

      <CollapsibleRegisterStats className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat label="Quantity" value={formatQty(quantity, 'MT')} />
        <Stat label="Delivered" value={formatQty(delivered, 'MT')} />
        <Stat label="Still to deliver" value={formatQty(Math.max(0, roundQtyMt(quantity - delivered)), 'MT')} />
        <Stat label="Value" value={formatCurrency(value)} />
        <Stat label="Rate" value={rate ? `${formatCurrency(rate)}/10 KG` : '—'} />
      </CollapsibleRegisterStats>

      <Card padding={false} className="overflow-hidden">
        <div className="border-b border-gray-200 px-8 pt-8 dark:border-gray-700">
          <CardHeader
            title="Movement"
            subtitle={
              inTransitQty > 0
                ? `${formatQty(inTransitQty, 'MT')} in transit · ${formatQty(notYetLifted, 'MT')} not yet lifted`
                : notYetLifted > 0
                  ? `${formatQty(notYetLifted, 'MT')} not yet lifted`
                  : quantity > 0
                    ? 'Full quantity delivered'
                    : share.role === 'broker'
                      ? 'Record lifts here or sync from party books on Tradeal'
                      : 'Lifts from the buyer and seller books'
            }
          />
        </div>
        <DataTable
          paginate={false}
          embedded
          columns={[
            { key: 'when', header: 'When', render: (row: typeof movementRows[number]) => row.when },
            { key: 'party', header: 'Party', render: (row: typeof movementRows[number]) => row.party },
            { key: 'lift', header: 'Lift', render: (row: typeof movementRows[number]) => row.lift },
            { key: 'order', header: 'Order', render: (row: typeof movementRows[number]) => row.order },
            { key: 'truck', header: 'Truck no', render: (row: typeof movementRows[number]) => (
              <span
                title={row.truckChanged && row.truckPrevious ? `Was ${row.truckPrevious}` : undefined}
                className={row.truckChanged ? 'inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' : undefined}
              >
                {row.truck}
              </span>
            ) },
            { key: 'transport', header: 'Transport', render: (row: typeof movementRows[number]) => row.transport },
            { key: 'driver', header: 'Driver', render: (row: typeof movementRows[number]) => row.driver },
            { key: 'lr', header: 'LR no', render: (row: typeof movementRows[number]) => row.lr },
            { key: 'rate', header: RATE_COLUMN_HEADER, className: 'text-right whitespace-nowrap', render: (row: typeof movementRows[number]) => (
              <span className="tabular-nums">{row.rate || '—'}</span>
            ) },
            { key: 'planned', header: 'Planned Qty', className: 'text-right', render: (row: typeof movementRows[number]) => (
              <span className="tabular-nums font-medium">{row.planned == null || row.planned <= 0 ? '—' : formatMt(row.planned)}</span>
            ) },
            { key: 'actual', header: 'Actual Qty', className: 'text-right', render: (row: typeof movementRows[number]) => (
              <span className="tabular-nums font-medium">{row.actual == null || row.actual <= 0 ? '—' : formatMt(row.actual)}</span>
            ) },
            { key: 'balance', header: 'Balance', className: 'text-right', render: (row: typeof movementRows[number]) => (
              row.balance != null && row.balance > 0.0005
                ? <span className="tabular-nums font-medium text-amber-700 dark:text-amber-400">{formatMt(row.balance)}</span>
                : <span className="text-gray-300">—</span>
            ) },
            { key: 'invoice', header: 'Invoice', render: (row: typeof movementRows[number]) => row.invoice },
            { key: 'status', header: 'Status', render: (row: typeof movementRows[number]) => (
              <StatusBadge status={row.status === 'delivered' ? 'delivered' : 'pending'} context="lift" />
            ) },
          ]}
          data={movementRows}
          getRowId={row => row.id}
          emptyState={
            <EmptyState
              icon={<FileText className="h-8 w-8" />}
              title="No lifts yet"
              description={
                share.role === 'broker'
                  ? 'Record a lift for off-Tradeal movement, or wait for a party on Tradeal to book and lift against this contract.'
                  : 'When the buyer or seller records a lift against this contract, each truck shows up here.'
              }
            />
          }
        />
      </Card>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3 lg:items-stretch">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-2">
            <PartyCard
              title="Buyer"
              name={share.buyer_name}
              legalName={share.buyer_legal_name}
              city={share.buyer_city}
              state={share.buyer_state}
              gstin={share.buyer_gstin}
              orgCode={share.buyer_org_code}
              orderLabel="Purchase"
              orderRef={share.buyer_order_ref}
              bookingNote={share.buyer_confirmed ? 'No purchase order yet' : 'Not confirmed'}
              delivered={buyerMove.delivered}
              inTransit={buyerMove.transit}
            />
            <PartyCard
              title="Seller"
              name={share.seller_name}
              legalName={share.seller_legal_name}
              city={share.seller_city}
              state={share.seller_state}
              gstin={share.seller_gstin}
              orgCode={share.seller_org_code}
              orderLabel="Sale"
              orderRef={share.seller_order_ref}
              bookingNote={share.seller_confirmed ? 'No sales order yet' : 'Not confirmed'}
              delivered={sellerMove.delivered}
              inTransit={sellerMove.transit}
            />
          </div>
          <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader title="Terms" />
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                {terms.map(item => (
                  <div key={item.label}>
                    <dt className="text-xs text-muted">{item.label}</dt>
                    <dd className="text-sm font-medium text-heading mt-0.5">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
            <div className="self-stretch">
              <Card className="h-full">
                <CardHeader title="Brokerage" subtitle={share.brokerage || 'Not set'} />
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div>
                    <dt className="text-xs text-muted">Earned</dt>
                    <dd className="text-sm font-semibold tabular-nums text-heading mt-0.5">{formatCurrency(brokerageEarned)}</dd>
                    <p className="text-xs text-muted mt-0.5">On quantity already delivered</p>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Open</dt>
                    <dd className="text-sm font-semibold tabular-nums text-heading mt-0.5">{formatCurrency(brokerageOpen)}</dd>
                    <p className="text-xs text-muted mt-0.5">On quantity not yet delivered</p>
                  </div>
                </dl>
              </Card>
            </div>
          </div>
        </div>
        <div className="relative h-full min-h-0 self-stretch">
          <Card className="flex flex-col overflow-hidden lg:absolute lg:inset-0">
            <div className="shrink-0">
              <CardHeader title="Timeline" subtitle="Latest first" />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
            {timeline.map((item, index) => {
              const config = activityTypeConfig[item.activity]
              const Icon = config.icon
              const isLast = index === timeline.length - 1
              return (
                <div key={`${item.at}-${item.seq}-${item.title}`} className={cn('flex gap-4', !isLast && 'pb-3')}>
                  <div className="flex flex-col items-center w-10 shrink-0">
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-full shrink-0', config.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    {!isLast ? <div className="w-px flex-1 min-h-4 bg-zinc-200 dark:bg-zinc-800 mt-1" aria-hidden /> : null}
                  </div>
                  <div className="min-w-0 pt-1.5 pb-1">
                    <p className="text-sm font-medium text-heading">{item.title}</p>
                    {item.description ? <p className="text-sm text-muted mt-0.5">{item.description}</p> : null}
                    <p className="text-xs text-muted mt-1">{item.time}</p>
                  </div>
                </div>
              )
            })}
            </div>
          </Card>
        </div>
      </div>
      <ContractReceiveModal
        open={confirmOpen}
        share={share}
        onClose={() => setConfirmOpen(false)}
        onConfirmed={setShare}
      />
      <ConfirmDeleteModal
        open={deleteOpen}
        onClose={() => { setDeleteOpen(false); setDeleteError('') }}
        onConfirm={removeShare}
        title="Delete contract"
        error={deleteError}
      >
        <p className="text-sm text-gray-600 dark:text-gray-300">
          <span className="font-medium text-heading">{share.contract_ref}</span> will move to Deleted. The buyer and the seller will be notified.
        </p>
      </ConfirmDeleteModal>
      {share.role === 'broker' ? (
        <BrokerRecordLiftModal
          open={recordLiftOpen}
          share={share}
          onClose={() => setRecordLiftOpen(false)}
          onRecorded={next => {
            setShare(next)
            dispatchContractSharesRefresh()
          }}
        />
      ) : null}
    </div>
  )
}
