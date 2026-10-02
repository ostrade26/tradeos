import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { DaybookFiltersBar } from '../components/registers/DaybookFiltersBar'
import {
  applyDaybookFilters,
  daybookFilterOptions,
  emptyDaybookFilters,
  hasActiveDaybookFilters,
  type DaybookFilterState,
} from '../lib/daybookFilters'
import { ApiError } from '../api/client'
import { organisationApi } from '../api/organisationApi'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb, EmptyState, Tabs } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { DataTable } from '../components/ui/DataTable'
import { Badge } from '../components/ui/Badge'
import { CollapsibleRegisterStats } from '../components/registers/CollapsibleRegisterStats'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { useTradeStore } from '../store/TradeStore'
import { isBrokerAccount } from '../lib/auth'
import { appPath } from '../lib/appShellMode'
import {
  buildBrokerDaybook,
  buildOrgDaybook,
  DAYBOOK_KIND_LABEL,
  daybookBuyerDisplay,
  daybookOrgCounterpartyDisplay,
  daybookSellerDisplay,
  summarizeDaybook,
  daybookEntryRegisterTab,
  type DaybookEntry,
  type DaybookRegisterTab,
} from '../lib/daybook'
import { exportToCSV } from '../lib/export'
import { todayIso } from '../lib/reports/fy'
import {
  cn,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatMt,
  formatQty,
} from '../lib/utils'

function parseDaybookTab(raw: string | null, broker: boolean): DaybookRegisterTab {
  if (broker) {
    return raw === 'lifts' ? 'lifts' : 'contracts'
  }
  if (raw === 'so' || raw === 'lifts') return raw
  return 'po'
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-md bg-card shadow-[var(--shadow-card)] px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-heading mt-1">{value}</p>
      {detail ? <p className="text-xs text-muted mt-1">{detail}</p> : null}
    </div>
  )
}

function DaybookPartyCell({ value, mutedFallback }: { value: string; mutedFallback?: boolean }) {
  if (!value) return <span className="text-gray-300">—</span>
  return (
    <span
      className={cn(
        'block max-w-[14rem] truncate text-sm',
        mutedFallback ? 'text-muted' : 'text-heading',
      )}
    >
      {value}
    </span>
  )
}

function shiftDay(day: string, delta: number): string {
  const date = new Date(`${day}T12:00:00`)
  date.setDate(date.getDate() + delta)
  return date.toISOString().slice(0, 10)
}

function parseDay(raw: string | null): string {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return todayIso()
}

export function DaybookPage() {
  const toast = useToast()
  const { session } = useAuth()
  const broker = isBrokerAccount(session)
  const store = useTradeStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const day = parseDay(searchParams.get('date'))
  const tab = parseDaybookTab(searchParams.get('view'), broker)
  const [search, setSearch] = useState('')
  const [dimensionFilters, setDimensionFilters] = useState<DaybookFilterState>(emptyDaybookFilters)
  const [brokerShares, setBrokerShares] = useState<Awaited<ReturnType<typeof organisationApi.listBrokerShares>>['shares']>([])
  const [loadingBroker, setLoadingBroker] = useState(broker)

  useEffect(() => {
    if (!broker) return
    let cancelled = false
    setLoadingBroker(true)
    organisationApi.listBrokerShares()
      .then(res => {
        if (!cancelled) setBrokerShares(res.shares ?? [])
      })
      .catch(err => {
        if (!cancelled) toast.error(err instanceof ApiError ? err.message : 'Could not load daybook')
      })
      .finally(() => {
        if (!cancelled) setLoadingBroker(false)
      })
    return () => {
      cancelled = true
    }
  }, [broker, toast])

  const setDay = useCallback((next: string) => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev)
      if (next === todayIso()) params.delete('date')
      else params.set('date', next)
      return params
    }, { replace: true })
  }, [setSearchParams])

  const setTab = useCallback((next: DaybookRegisterTab) => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev)
      const defaultTab = broker ? 'contracts' : 'po'
      if (next === defaultTab) params.delete('view')
      else params.set('view', next)
      return params
    }, { replace: true })
  }, [setSearchParams, broker])

  const entries = useMemo(() => {
    const pathPrefix = (path: string) => appPath(path)
    if (broker) {
      return buildBrokerDaybook({ day, shares: brokerShares ?? [], pathPrefix })
    }
    return buildOrgDaybook({
      day,
      orders: store.tradeOrders,
      lifts: store.lifts,
      settlements: store.balanceSettlements ?? [],
      pathPrefix,
    })
  }, [broker, brokerShares, day, store.balanceSettlements, store.lifts, store.tradeOrders])

  const summary = useMemo(() => summarizeDaybook(entries), [entries])

  const filterOptions = useMemo(
    () => daybookFilterOptions(entries, broker ? 'broker' : 'org'),
    [entries, broker],
  )

  const tabCounts = useMemo(() => {
    const counts = { contracts: 0, lifts: 0, po: 0, so: 0 }
    for (const entry of entries) {
      const key = daybookEntryRegisterTab(entry, broker)
      counts[key] += 1
    }
    return counts
  }, [entries, broker])

  const filtered = useMemo(() => {
    const rows = entries.filter(entry => daybookEntryRegisterTab(entry, broker) === tab)
    return applyDaybookFilters(rows, dimensionFilters, search, broker ? 'broker' : 'org')
  }, [entries, tab, dimensionFilters, search, broker])

  const isToday = day === todayIso()

  const handleExport = () => {
    const orgSingleParty = !broker && (tab === 'po' || tab === 'so')
    const rows = filtered.map(entry => {
      const base = {
        time: entry.at,
        type: DAYBOOK_KIND_LABEL[entry.kind],
        title: entry.title,
        item: entry.itemName ?? '',
        spot: entry.spot ?? '',
        qtyMt: entry.qtyMt ?? '',
      }
      if (orgSingleParty) {
        return {
          ...base,
          counterparty: daybookOrgCounterpartyDisplay(entry, tab as 'po' | 'so'),
        }
      }
      return {
        ...base,
        buyer: daybookBuyerDisplay(entry),
        seller: daybookSellerDisplay(entry),
      }
    })
    const headers = orgSingleParty
      ? [
        { key: 'time', header: 'Time' },
        { key: 'type', header: 'Type' },
        { key: 'title', header: 'Title' },
        { key: 'counterparty', header: tab === 'po' ? 'Seller' : 'Buyer' },
        { key: 'item', header: 'Item' },
        { key: 'spot', header: 'Spot' },
        { key: 'qtyMt', header: 'Qty (MT)' },
      ]
      : [
        { key: 'time', header: 'Time' },
        { key: 'type', header: 'Type' },
        { key: 'title', header: 'Title' },
        { key: 'buyer', header: 'Buyer' },
        { key: 'seller', header: 'Seller' },
        { key: 'item', header: 'Item' },
        { key: 'spot', header: 'Spot' },
        { key: 'qtyMt', header: 'Qty (MT)' },
      ]
    exportToCSV(
      rows as Record<string, unknown>[],
      headers as { key: keyof Record<string, unknown>; header: string }[],
      `daybook-${day}`,
    )
    toast.success(`Exported ${filtered.length} entries`)
  }

  const columns = useMemo(() => {
    const base = [
      {
        key: 'time',
        header: 'Time',
        className: 'whitespace-nowrap min-w-[8rem]',
        render: (row: DaybookEntry) => (
          <span className="tabular-nums text-muted">{formatDateTime(row.at)}</span>
        ),
      },
      {
        key: 'type',
        header: 'Type',
        className: 'whitespace-nowrap min-w-[9rem]',
        render: (row: DaybookEntry) => (
          <Badge>{DAYBOOK_KIND_LABEL[row.kind]}</Badge>
        ),
      },
      {
        key: 'title',
        header: 'Entry',
        className: 'min-w-[12rem]',
        render: (row: DaybookEntry) => (
          row.href
            ? (
              <Link to={row.href} className="font-medium text-accent hover:underline">
                {row.title}
              </Link>
            )
            : <span className="font-medium text-heading">{row.title}</span>
        ),
      },
    ]

    const partyColumns = broker || tab === 'lifts'
      ? [
        {
          key: 'buyer',
          header: 'Buyer',
          className: 'min-w-[8rem]',
          render: (row: DaybookEntry) => (
            <DaybookPartyCell value={daybookBuyerDisplay(row)} />
          ),
        },
        {
          key: 'seller',
          header: 'Seller',
          className: 'min-w-[8rem]',
          render: (row: DaybookEntry) => (
            <DaybookPartyCell value={daybookSellerDisplay(row)} />
          ),
        },
      ]
      : [
        {
          key: tab === 'po' ? 'seller' : 'buyer',
          header: tab === 'po' ? 'Seller' : 'Buyer',
          className: 'min-w-[8rem]',
          render: (row: DaybookEntry) => (
            <DaybookPartyCell
              value={daybookOrgCounterpartyDisplay(row, tab as 'po' | 'so')}
              mutedFallback={!daybookBuyerDisplay(row) && !daybookSellerDisplay(row)}
            />
          ),
        },
      ]

    return [
      ...base,
      ...partyColumns,
      {
        key: 'item',
        header: 'Item',
        className: 'min-w-[8rem]',
        render: (row: DaybookEntry) => (
          row.itemName
            ? <span className="block max-w-[14rem] truncate text-sm text-heading">{row.itemName}</span>
            : <span className="text-gray-300">—</span>
        ),
      },
      {
        key: 'spot',
        header: 'Spot',
        className: 'min-w-[8rem]',
        render: (row: DaybookEntry) => (
          row.spot
            ? <span className="block max-w-[14rem] truncate text-sm text-muted">{row.spot}</span>
            : <span className="text-gray-300">—</span>
        ),
      },
      {
        key: 'qty',
        header: 'Qty',
        className: 'text-right whitespace-nowrap',
        render: (row: DaybookEntry) => (
          row.qtyMt != null && row.qtyMt > 0
            ? <span className="tabular-nums font-medium">{formatMt(row.qtyMt)}</span>
            : <span className="text-gray-300">—</span>
        ),
      },
    ]
  }, [broker, tab])

  return (
    <div className="animate-fade-in min-w-0">
      <PageHeader
        title="Daybook"
        subtitle={
          isToday
            ? 'Everything recorded today — bookings, lifts, and settlements in one place.'
            : `Entries for ${formatDate(day)}`
        }
        breadcrumb={<Breadcrumb items={[{ label: 'Tradeal', href: appPath('/') }, { label: 'Daybook' }]} />}
      />

      <Tabs
        className="mb-4"
        tabs={broker
          ? [
            { id: 'contracts', label: 'Contracts', count: tabCounts.contracts },
            { id: 'lifts', label: 'Lifts', count: tabCounts.lifts },
          ]
          : [
            { id: 'po', label: 'Purchase orders', count: tabCounts.po },
            { id: 'so', label: 'Sales orders', count: tabCounts.so },
            { id: 'lifts', label: 'Lifts', count: tabCounts.lifts },
          ]}
        active={tab}
        onChange={id => setTab(id as DaybookRegisterTab)}
      />

      <DaybookFiltersBar
        broker={broker}
        day={day}
        isToday={isToday}
        onDayChange={value => setDay(value || todayIso())}
        onPreviousDay={() => setDay(shiftDay(day, -1))}
        onNextDay={() => setDay(shiftDay(day, 1))}
        onJumpToday={() => setDay(todayIso())}
        search={search}
        onSearchChange={setSearch}
        filters={dimensionFilters}
        onFiltersChange={setDimensionFilters}
        items={filterOptions.items}
        parties={filterOptions.parties}
        buyers={filterOptions.buyers}
        sellers={filterOptions.sellers}
        brokers={filterOptions.brokers}
        spots={filterOptions.spots}
        rates={filterOptions.rates}
        onExport={handleExport}
        exportDisabled={filtered.length === 0}
      />

      <CollapsibleRegisterStats className={cn('grid gap-4', broker ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-6')}>
        {broker ? (
          <>
            <Stat label="Contracts sent" value={String(summary.contractsSent)} detail={summary.contractQtyMt > 0 ? `${formatQty(summary.contractQtyMt)} MT total` : undefined} />
            <Stat label="Lifts recorded" value={String(summary.liftsRecorded)} detail={summary.liftQtyRecordedMt > 0 ? `${formatQty(summary.liftQtyRecordedMt)} MT` : undefined} />
            <Stat label="Delivered" value={String(summary.liftsDelivered)} detail={summary.liftQtyDeliveredMt > 0 ? `${formatQty(summary.liftQtyDeliveredMt)} MT` : undefined} />
            <Stat label="Entries" value={String(summary.entries)} detail={isToday ? 'Today' : formatDate(day)} />
          </>
        ) : (
          <>
            <Stat label="Purchase orders" value={String(summary.poCount)} detail={summary.poQtyMt > 0 ? `${formatQty(summary.poQtyMt)} MT · ${formatCurrency(summary.poValue)}` : undefined} />
            <Stat label="Sales orders" value={String(summary.soCount)} detail={summary.soQtyMt > 0 ? `${formatQty(summary.soQtyMt)} MT · ${formatCurrency(summary.soValue)}` : undefined} />
            <Stat label="Lifts recorded" value={String(summary.liftsRecorded)} detail={summary.liftQtyRecordedMt > 0 ? `${formatQty(summary.liftQtyRecordedMt)} MT` : undefined} />
            <Stat label="Delivered" value={String(summary.liftsDelivered)} detail={summary.liftQtyDeliveredMt > 0 ? `${formatQty(summary.liftQtyDeliveredMt)} MT` : undefined} />
            <Stat label="Cash settled" value={formatCurrency(summary.cashSettledAmount)} detail="Balance written off or paid in cash" />
            <Stat label="Entries" value={String(summary.entries)} detail={isToday ? 'Today' : formatDate(day)} />
          </>
        )}
      </CollapsibleRegisterStats>

      <DataTable
        columns={columns}
        data={filtered}
        getRowId={row => row.id}
        stickyFirstColumn
        emptyState={
          loadingBroker ? (
            <EmptyState
              card
              icon={<BookOpen className="h-10 w-10" />}
              title="Loading daybook…"
              description="Pulling contracts and lifts for this day."
            />
          ) : (
            <EmptyState
              card
              icon={<BookOpen className="h-10 w-10" />}
              title={
                hasActiveDaybookFilters(dimensionFilters, search)
                  ? 'No entries match your filters'
                  : 'Nothing on this tab for this day'
              }
              description={
                hasActiveDaybookFilters(dimensionFilters, search)
                  ? 'Try clearing filters or choosing another date.'
                  : broker
                    ? tab === 'contracts'
                      ? 'Contract sends, confirmations, and edits for this date will show here.'
                      : 'Lift recordings and deliveries for this date will show here.'
                    : tab === 'po'
                      ? 'Purchase bookings and PO-related activity for this date will show here.'
                      : tab === 'so'
                        ? 'Sales bookings and SO-related activity for this date will show here.'
                        : 'Lift recordings and deliveries for this date will show here.'
              }
              action={hasActiveDaybookFilters(dimensionFilters, search) ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch('')
                    setDimensionFilters(emptyDaybookFilters)
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined}
            />
          )
        }
      />
    </div>
  )
}
