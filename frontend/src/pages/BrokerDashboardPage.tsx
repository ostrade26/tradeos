import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BadgeCheck, FileText, History, IndianRupee, Plus, Scale, Truck } from 'lucide-react'
import { ApiError } from '../api/client'
import { organisationApi, type BrokerContractLiftEvent, type BrokerContractShare } from '../api/organisationApi'
import { DashboardCardEmptyState } from '../components/dashboard/DashboardCardEmptyState'
import { Button } from '../components/ui/Button'
import { OngoingContractStatus } from '../components/contracts/OngoingContractStatus'
import { Card, CardHeader, StatCard } from '../components/ui/Card'
import { useToast } from '../hooks/useToast'
import { appPath } from '../lib/appShellMode'
import { parseIndianAmount } from '../lib/indianAmount'
import { orderLineAmount } from '../lib/orderRate'
import { formatCurrency, formatDateHeading, formatDateTime, formatMt, formatQty } from '../lib/utils'
import { formatLiftRef } from '../lib/tradeRefs'
import { CONTRACT_SHARES_REFRESH_EVENT } from '../lib/contractSharesRefresh'
import { brokerContractStatus } from '../lib/brokerContractStatus'

function isLive(share: BrokerContractShare): boolean {
  return brokerContractStatus(share) !== 'completed'
}

function bothSidesBooked(share: BrokerContractShare): boolean {
  return Boolean(share.buyer_order_ref && share.seller_order_ref)
}

function shareQty(share: BrokerContractShare): number {
  return parseFloat(share.quantity) || 0
}

function shareBrokerage(share: BrokerContractShare): number {
  const value = orderLineAmount(shareQty(share), parseIndianAmount(share.rate))
  const percent = parseFloat(share.brokerage.replace('%', '')) || 0
  return value * percent / 100
}

type DeskEvent = {
  id: string
  at: string
  title: string
  detail: string
}

type TransitRow = BrokerContractLiftEvent & { contract_ref: string; share_id: number }

function inTransitRows(shares: BrokerContractShare[]): TransitRow[] {
  const rows: TransitRow[] = []
  for (const share of shares) {
    for (const event of share.lift_events ?? []) {
      if (event.broker_completed) continue
      rows.push({ ...event, contract_ref: share.contract_ref, share_id: share.id })
    }
  }
  return rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 6)
}

function happenedEvents(shares: BrokerContractShare[]): DeskEvent[] {
  const events: DeskEvent[] = []
  for (const share of shares) {
    const parties = [share.buyer_name, share.seller_name].filter(Boolean).join(' · ')
    if (share.created_at) {
      events.push({
        id: `sent-${share.id}`,
        at: share.created_at,
        title: `Sent ${share.contract_ref}`,
        detail: parties,
      })
    }
    if (share.buyer_confirmed_at) {
      events.push({
        id: `buyer-${share.id}`,
        at: share.buyer_confirmed_at,
        title: `${share.buyer_name || 'Buyer'} confirmed`,
        detail: share.contract_ref,
      })
    }
    if (share.seller_confirmed_at) {
      events.push({
        id: `seller-${share.id}`,
        at: share.seller_confirmed_at,
        title: `${share.seller_name || 'Seller'} confirmed`,
        detail: share.contract_ref,
      })
    }
    for (const lift of share.lift_events ?? []) {
      events.push({
        id: `lift-${share.id}-${lift.id}`,
        at: lift.updated_at || lift.event_at,
        title: `${formatLiftRef(lift.broker_lift_ref || lift.lift_ref)} ${lift.status === 'delivered' ? 'delivered' : 'in transit'}`,
        detail: `${share.contract_ref} · ${lift.party_name || lift.party_role} · ${formatQty(lift.qty_mt, 'MT')}`,
      })
    }
  }
  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8)
}

export function BrokerDashboardPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [shares, setShares] = useState<BrokerContractShare[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const refresh = () => setReloadKey(key => key + 1)
    window.addEventListener(CONTRACT_SHARES_REFRESH_EVENT, refresh)
    window.addEventListener('broker-shares-refresh', refresh)
    return () => {
      window.removeEventListener(CONTRACT_SHARES_REFRESH_EVENT, refresh)
      window.removeEventListener('broker-shares-refresh', refresh)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    organisationApi.listBrokerShares()
      .then(res => {
        if (!cancelled) setShares(res.shares ?? [])
      })
      .catch(err => {
        if (!cancelled) toast.error(err instanceof ApiError ? err.message : 'Could not load contracts')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [toast, reloadKey])

  const openShares = shares.filter(share => !(share.deleted_at || '').trim())
  const live = openShares.filter(isLive)
  const booked = openShares.filter(bothSidesBooked)
  const awaiting = openShares.filter(share => !share.buyer_confirmed || !share.seller_confirmed)
  const brokerageBooked = booked.reduce((sum, share) => sum + shareBrokerage(share), 0)
  const brokerageOpen = live.reduce((sum, share) => sum + shareBrokerage(share), 0)
  const qtyAll = openShares.reduce((sum, share) => sum + shareQty(share), 0)
  const qtyBooked = booked.reduce((sum, share) => sum + shareQty(share), 0)
  const events = happenedEvents(openShares)
  const transit = inTransitRows(openShares)
  const openContracts = () => navigate(appPath('/contracts'))
  const openShare = (shareId: number) => navigate(appPath(`/contract-shares/${shareId}`))
  const contractsPath = appPath('/contracts')

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-heading tracking-tight">Today</h1>
          <p className="text-sm text-muted mt-0.5">
            {formatDateHeading()}
            {' · '}
            {loading
              ? 'Loading contracts'
              : live.length === 0
                ? 'Nothing in motion'
                : `${live.length} contract${live.length === 1 ? '' : 's'} in motion`}
          </p>
        </div>
        <Button size="sm" to={appPath('/contracts/new')}>
          <Plus className="h-4 w-4" /> New Contract
        </Button>
      </div>

      <div className="grid grid-cols-1 min-[520px]:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          to={contractsPath}
          label="Contracts"
          value={loading ? '—' : String(openShares.length)}
          change={loading ? undefined : live.length ? `${live.length} still open` : 'None still open'}
          changeType="neutral"
          icon={<FileText className="h-4 w-4" />}
        />
        <StatCard
          to={contractsPath}
          label="Brokerage"
          value={loading ? '—' : formatCurrency(brokerageBooked)}
          change={loading ? undefined : 'Booked by both sides'}
          changeType="neutral"
          details={loading ? undefined : [brokerageOpen ? `${formatCurrency(brokerageOpen)} on open contracts` : 'Nothing left on open contracts']}
          icon={<IndianRupee className="h-4 w-4" />}
        />
        <StatCard
          to={contractsPath}
          label="Volume"
          value={loading ? '—' : formatQty(qtyAll)}
          change={loading ? undefined : `${formatQty(qtyBooked)} booked`}
          changeType="neutral"
          icon={<Scale className="h-4 w-4" />}
        />
        <StatCard
          to={contractsPath}
          label="Awaiting confirmation"
          value={loading ? '—' : String(awaiting.length)}
          change={loading ? undefined : awaiting.length ? 'A party has not confirmed yet' : 'Both sides have confirmed'}
          changeType="neutral"
          icon={<BadgeCheck className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <Card className="h-full flex flex-col">
          <CardHeader
            title="Going on"
            subtitle={live.length === 0 ? 'No open contracts' : 'Contracts still with the parties'}
          />
          {live.length === 0 ? (
            <DashboardCardEmptyState
              icon={FileText}
              tone="blue"
              title={loading ? 'Loading contracts' : 'Nothing in motion'}
              description={loading ? 'Checking the contracts you have sent.' : 'A contract stays here until the full quantity is delivered.'}
            />
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[28rem] overflow-y-auto">
              {live.map(share => (
                <button
                  key={share.id}
                  type="button"
                  onClick={() => openShare(share.id)}
                  className="flex w-full items-start justify-between gap-3 py-3 text-left first:pt-0 hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-heading">{share.contract_ref}</p>
                    <p className="text-xs text-muted mt-0.5 truncate">{share.buyer_name} · {share.seller_name}</p>
                    <p className="text-xs text-caption mt-0.5">
                      {share.item_name || 'Contract'}
                      {share.quantity ? ` · ${formatMt(parseFloat(share.quantity) || 0)}` : ''}
                    </p>
                  </div>
                  <OngoingContractStatus share={share} />
                </button>
              ))}
            </div>
          )}
          <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-800">
            <Button variant="ghost" size="sm" className="w-full" onClick={openContracts}>
              View contracts
            </Button>
          </div>
        </Card>

        <Card className="h-full flex flex-col">
          <CardHeader
            title="Recent activity"
            subtitle={events.length === 0 ? 'No events yet' : 'Latest changes across your desk'}
          />
          {events.length === 0 ? (
            <DashboardCardEmptyState
              icon={History}
              tone="blue"
              title="No events yet"
              description="Contracts you send, and each confirmation, will show up here."
            />
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {events.map(event => {
                const confirmed = event.title.includes('confirmed')
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={openContracts}
                    className="flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700/30 cursor-pointer"
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${confirmed ? 'bg-emerald-50 text-success dark:bg-emerald-950/30' : 'bg-blue-50 text-blue-600 dark:bg-blue-950'}`}>
                      {confirmed ? <BadgeCheck className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-heading text-pretty">{event.title}</p>
                      <p className="text-xs text-caption mt-0.5 leading-relaxed line-clamp-1">{event.detail}</p>
                      <p className="text-xs text-muted mt-0.5">{formatDateTime(event.at)}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
          <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-800">
            <Button variant="ghost" size="sm" className="w-full" onClick={openContracts}>
              View contracts
            </Button>
          </div>
        </Card>

        <Card className="h-full flex flex-col">
          <CardHeader
            title="Open lifts"
            subtitle={transit.length === 0 ? 'Nothing awaiting your review' : `${transit.length} lift${transit.length === 1 ? '' : 's'} to review`}
          />
          {transit.length === 0 ? (
            <DashboardCardEmptyState
              icon={Truck}
              tone="amber"
              title="No open lifts"
              description="Lifts from buyer and seller books stay here until you mark them complete."
            />
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {transit.map(row => (
                <button
                  key={`${row.share_id}-${row.id}`}
                  type="button"
                  onClick={() => navigate(appPath(row.broker_lift_ref ? `/lifts?ref=${row.broker_lift_ref}` : `/contract-shares/${row.share_id}`))}
                  className="flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700/30 cursor-pointer"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/30">
                    <Truck className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-heading text-pretty">
                      {formatLiftRef(row.broker_lift_ref || row.lift_ref)} · {row.contract_ref}
                    </p>
                    <p className="text-xs text-caption mt-0.5 leading-relaxed line-clamp-1">
                      {row.party_name || row.party_role} · {formatQty(row.qty_mt, 'MT')} · {row.order_ref}
                    </p>
                    <p className="text-xs text-muted mt-0.5">{formatDateTime(row.event_at || row.updated_at)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-800">
            <Button variant="ghost" size="sm" className="w-full" onClick={openContracts}>
              View contracts
            </Button>
          </div>
        </Card>

      </div>
    </div>
  )
}
