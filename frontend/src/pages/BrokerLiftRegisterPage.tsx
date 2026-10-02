import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Scale } from 'lucide-react'
import { ApiError } from '../api/client'
import { organisationApi } from '../api/organisationApi'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb, EmptyState, Tabs } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { DataTable } from '../components/ui/DataTable'
import { BrokerLiftDetailPanel } from '../components/registers/BrokerLiftDetailPanel'
import { LiftFiltersBar } from '../components/registers/LiftFiltersBar'
import { cn, formatDate, formatMt, tableRefCellMutedClass } from '../lib/utils'
import { REGISTER_TABLE_LAYER_Z } from '../components/ui/Drawer'
import { RATE_COLUMN_HEADER } from '../lib/orderRate'
import { formatLiftRef } from '../lib/tradeRefs'
import { exportToCSV } from '../lib/export'
import {
  applyBrokerLiftFilters,
  brokerLiftFilterOptions,
  brokerLiftIsComplete,
  brokerLiftRows,
  salesInvoiceLabel,
  type BrokerLiftRow,
} from '../lib/brokerLiftRegister'
import {
  TankerActualColumn,
  TankerBalanceColumn,
  TankerNumberColumn,
  TankerPlannedColumn,
  TankerRateColumn,
} from '../components/registers/TankerAlignedMetrics'
import { tankerQtyLinesFromBrokerEvent } from '../lib/tankerQtyLines'
import { emptyLiftFilters, hasActiveLiftFilters, type LiftFilterState } from '../lib/liftFilters'
import { useToast } from '../hooks/useToast'
import { TruncatedTextWithTooltip } from '../components/ui/DelayedHoverTooltip'
import { useLargeScreen } from '../hooks/useMediaQuery'
import { loadOrderPanelDocked, saveOrderPanelDocked } from '../lib/orderPanelDock'
import { useDetailPanelSlot } from '../components/layout/DetailPanelSlot'
import { loadRegisterSort, saveRegisterSort, sortRows, toggleSort } from '../lib/registerSort'
import { CONTRACT_SHARES_REFRESH_EVENT } from '../lib/contractSharesRefresh'
import { appPath } from '../lib/appShellMode'

type LiftListMode = 'pending' | 'completed'

function parseMode(view: string | null): LiftListMode {
  return view === 'completed' ? 'completed' : 'pending'
}

function brokerQtyEvent(row: BrokerLiftRow) {
  return { qty_mt: row.qty, short_qty_mt: row.balance, status: row.status }
}

export function BrokerLiftRegisterPage() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const mode = parseMode(searchParams.get('view'))
  const registerId = `broker-lift-${mode}`
  const [rows, setRows] = useState<BrokerLiftRow[]>([])
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<LiftFilterState>(emptyLiftFilters)
  const [sort, setSort] = useState(() => loadRegisterSort(registerId, 'liftRef'))
  const [panelDocked, setPanelDocked] = useState(() => loadOrderPanelDocked())
  const [reloadKey, setReloadKey] = useState(0)
  const isLargeScreen = useLargeScreen()
  const effectiveDocked = panelDocked && isLargeScreen
  const { setOpen: setDetailPanelOpen } = useDetailPanelSlot()
  const detailRef = searchParams.get('ref')

  useEffect(() => {
    let cancelled = false
    organisationApi.listBrokerShares()
      .then(res => {
        if (!cancelled) setRows(brokerLiftRows(res.shares ?? []))
      })
      .catch(err => {
        if (!cancelled) toast.error(err instanceof ApiError ? err.message : 'Could not load lifts')
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey, toast])

  useEffect(() => {
    const refresh = () => setReloadKey(key => key + 1)
    window.addEventListener('focus', refresh)
    window.addEventListener(CONTRACT_SHARES_REFRESH_EVENT, refresh)
    window.addEventListener('broker-shares-refresh', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener(CONTRACT_SHARES_REFRESH_EVENT, refresh)
      window.removeEventListener('broker-shares-refresh', refresh)
    }
  }, [])

  const selected = useMemo(
    () => rows.find(row => String(row.brokerLiftRef) === detailRef) ?? null,
    [detailRef, rows],
  )
  const undockedDetailOpen = !effectiveDocked && selected != null

  useEffect(() => {
    if (effectiveDocked && selected) setDetailPanelOpen(true, 'lg')
    else if (effectiveDocked && !detailRef) setDetailPanelOpen(false)
  }, [detailRef, effectiveDocked, selected, setDetailPanelOpen])

  const setMode = useCallback((next: LiftListMode) => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev)
      params.delete('ref')
      if (next === 'completed') params.set('view', 'completed')
      else params.delete('view')
      return params
    }, { replace: true })
  }, [setSearchParams])

  const openLift = useCallback((row: BrokerLiftRow) => {
    const refKey = String(row.brokerLiftRef)
    const alreadyOpen = detailRef === refKey
    setSearchParams(prev => {
      const params = new URLSearchParams(prev)
      if (alreadyOpen) params.delete('ref')
      else {
        params.set('ref', refKey)
        if (brokerLiftIsComplete(row)) params.set('view', 'completed')
        else params.delete('view')
      }
      return params
    }, { replace: true })
    if (effectiveDocked) setDetailPanelOpen(true, 'lg')
    if (!alreadyOpen && row.unread) {
      setRows(current => current.map(item => item.id === row.id ? { ...item, unread: false } : item))
      void organisationApi.markBrokerLiftRead(Number(row.id)).catch(() => {
        setRows(current => current.map(item => item.id === row.id ? { ...item, unread: true } : item))
      })
    }
  }, [detailRef, effectiveDocked, setDetailPanelOpen, setSearchParams])

  const markComplete = useCallback(async (row: BrokerLiftRow) => {
    try {
      await organisationApi.completeBrokerLift(Number(row.id))
      setRows(current => current.map(item => item.id === row.id ? { ...item, brokerCompleted: true, unread: false } : item))
      setSearchParams(prev => {
        const params = new URLSearchParams(prev)
        params.set('view', 'completed')
        params.set('ref', String(row.brokerLiftRef))
        return params
      }, { replace: true })
      toast.success(`${formatLiftRef(row.brokerLiftRef)} marked complete`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not mark the lift complete')
      throw err
    }
  }, [setSearchParams, toast])

  const closeLift = useCallback(() => {
    setDetailPanelOpen(false)
    setSearchParams(prev => {
      const params = new URLSearchParams(prev)
      params.delete('ref')
      return params
    }, { replace: true })
  }, [setDetailPanelOpen, setSearchParams])

  const base = useMemo(
    () => rows.filter(row => (mode === 'completed' ? brokerLiftIsComplete(row) : !brokerLiftIsComplete(row))),
    [mode, rows],
  )
  const options = useMemo(() => brokerLiftFilterOptions(base), [base])
  const filtered = useMemo(() => {
    const matched = applyBrokerLiftFilters(base, filters, search)
    return sortRows(matched, sort, (row, key) => {
      switch (key) {
        case 'liftRef': return row.brokerLiftRef
        case 'date': return row.date
        case 'itemName': return row.itemName
        case 'sellerName': return row.sellerName
        case 'buyerName': return row.buyerName
        case 'rate': return row.rateSort
        case 'qty': return row.qty
        case 'balance': return row.balance
        default: return ''
      }
    })
  }, [base, filters, search, sort])

  const pendingCount = rows.filter(row => !brokerLiftIsComplete(row)).length
  const completedCount = rows.filter(row => brokerLiftIsComplete(row)).length
  const totalQty = filtered.reduce((sum, row) => sum + row.qty, 0)
  const filtersOn = hasActiveLiftFilters(filters, search)

  const handleExport = () => {
    exportToCSV(
      filtered.map(row => ({
        liftRef: formatLiftRef(row.brokerLiftRef),
        status: row.status,
        date: row.date,
        deliveredAt: row.deliveredAt,
        buyer: row.buyerName,
        seller: row.sellerName,
        recordedBy: row.partyName,
        contract: row.contractRef,
        item: row.itemName,
        rate: row.rateSort,
        qty: row.qty,
        tankers: row.tankers.map(tanker => tanker.tanker_no).filter(Boolean).join('; '),
      })),
      [
        { key: 'liftRef', header: 'Lift Ref#' },
        { key: 'status', header: 'Status' },
        { key: 'date', header: 'Created' },
        { key: 'deliveredAt', header: 'Delivered' },
        { key: 'buyer', header: 'Buyer Name' },
        { key: 'seller', header: 'Seller Name' },
        { key: 'recordedBy', header: 'Recorded by' },
        { key: 'contract', header: 'Contract' },
        { key: 'item', header: 'Item Name' },
        { key: 'rate', header: RATE_COLUMN_HEADER },
        { key: 'qty', header: mode === 'pending' ? 'Planned Qty' : 'Actual Qty' },
        { key: 'tankers', header: 'Tanker No.' },
      ],
      `lift-register-${mode}-${new Date().toISOString().slice(0, 10)}`,
    )
    toast.success(`Exported ${filtered.length} lifts`)
  }

  const columns = [
    {
      key: 'liftRef',
      header: 'Lift Ref#',
      sortable: true,
      sortValue: (row: BrokerLiftRow) => row.brokerLiftRef,
      className: 'whitespace-nowrap min-w-[10.5rem]',
      render: (row: BrokerLiftRow) => (
        <div className="flex flex-nowrap items-center gap-1.5">
          {row.unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" /> : null}
          <span className={row.unread ? 'font-semibold text-heading' : tableRefCellMutedClass}>{formatLiftRef(row.brokerLiftRef)}</span>
          <Badge variant={row.partyRole === 'seller' ? 'info' : 'accent'}>
            {row.partyRole === 'seller' ? 'Seller' : 'Buyer'}
          </Badge>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Created',
      sortable: true,
      sortValue: (row: BrokerLiftRow) => row.date,
      className: 'whitespace-nowrap min-w-[6.5rem]',
      render: (row: BrokerLiftRow) => <span className="tabular-nums">{formatDate(row.date)}</span>,
    },
    {
      key: 'itemName',
      header: 'Item Name',
      sortable: true,
      sortValue: (row: BrokerLiftRow) => row.itemName,
      className: 'min-w-[8rem]',
      render: (row: BrokerLiftRow) => (
        <span className="max-w-[12rem] truncate block font-medium text-heading">{row.itemName || '—'}</span>
      ),
    },
    {
      key: 'sellerName',
      header: 'Seller',
      sortable: true,
      sortValue: (row: BrokerLiftRow) => row.sellerName,
      className: 'min-w-[9rem]',
      render: (row: BrokerLiftRow) => <TruncatedTextWithTooltip text={row.sellerName} className="max-w-[11rem]" />,
    },
    {
      key: 'buyerName',
      header: 'Buyer',
      sortable: true,
      sortValue: (row: BrokerLiftRow) => row.buyerName,
      className: 'min-w-[9rem]',
      render: (row: BrokerLiftRow) => <TruncatedTextWithTooltip text={row.buyerName} className="max-w-[11rem]" />,
    },
    {
      key: 'rate',
      header: RATE_COLUMN_HEADER,
      sortable: true,
      sortValue: (row: BrokerLiftRow) => row.rateSort,
      className: 'text-right whitespace-nowrap min-w-[6.5rem]',
      render: (row: BrokerLiftRow) => {
        const lines = tankerQtyLinesFromBrokerEvent(row.tankers, brokerQtyEvent(row))
        return <TankerRateColumn rateLabel={row.rateLabel} lineCount={lines.length} />
      },
    },
    ...(mode === 'completed' ? [{
      key: 'plannedQty',
      header: 'Planned Qty',
      sortable: true,
      sortValue: (row: BrokerLiftRow) => row.qty,
      className: 'text-right whitespace-nowrap min-w-[6rem]',
      render: (row: BrokerLiftRow) => {
        const lines = tankerQtyLinesFromBrokerEvent(row.tankers, brokerQtyEvent(row))
        return (
          <TankerPlannedColumn
            lines={lines}
            singleFallback={<span className="tabular-nums font-medium">{formatMt(row.qty)}</span>}
          />
        )
      },
    }] : [{
      key: 'qty',
      header: 'Planned Qty',
      sortable: true,
      sortValue: (row: BrokerLiftRow) => row.qty,
      className: 'text-right whitespace-nowrap min-w-[6rem]',
      render: (row: BrokerLiftRow) => {
        const lines = tankerQtyLinesFromBrokerEvent(row.tankers, brokerQtyEvent(row))
        return (
          <TankerPlannedColumn
            lines={lines}
            singleFallback={<span className="tabular-nums font-medium">{formatMt(row.qty)}</span>}
          />
        )
      },
    }]),
    ...(mode === 'completed' ? [{
      key: 'actualQty',
      header: 'Actual Qty',
      sortable: true,
      sortValue: (row: BrokerLiftRow) => row.qty,
      className: 'text-right whitespace-nowrap min-w-[6rem]',
      render: (row: BrokerLiftRow) => {
        const lines = tankerQtyLinesFromBrokerEvent(row.tankers, brokerQtyEvent(row))
        return (
          <TankerActualColumn
            lines={lines}
            singleFallback={<span className="tabular-nums font-medium">{formatMt(row.qty)}</span>}
          />
        )
      },
    }] : []),
    ...(mode === 'completed' ? [{
      key: 'balance',
      header: 'Balance',
      sortable: true,
      sortValue: (row: BrokerLiftRow) => row.balance,
      className: 'text-right whitespace-nowrap min-w-[5.5rem]',
      render: (row: BrokerLiftRow) => {
        const lines = tankerQtyLinesFromBrokerEvent(row.tankers, brokerQtyEvent(row))
        return (
          <TankerBalanceColumn
            lines={lines}
            singleFallback={
              row.balance > 0.0005
                ? <span className="tabular-nums font-medium text-amber-700 dark:text-amber-400">{formatMt(row.balance)}</span>
                : <span className="text-gray-300">—</span>
            }
          />
        )
      },
    }] : []),
    {
      key: 'tankers',
      header: 'Tanker No.',
      className: 'hidden xl:table-cell min-w-[8rem]',
      render: (row: BrokerLiftRow) => (
        <TankerNumberColumn lines={tankerQtyLinesFromBrokerEvent(row.tankers, brokerQtyEvent(row))} />
      ),
    },
    ...(mode === 'completed' ? [{
      key: 'salesInvoiceNo',
      header: 'Sales invoice no',
      className: 'hidden xl:table-cell whitespace-nowrap min-w-[8rem]',
      render: (row: BrokerLiftRow) => <span>{salesInvoiceLabel(row)}</span>,
    }] : []),
  ]

  return (
    <>
      <div className="animate-fade-in min-w-0">
        <PageHeader
          title="Lift Register"
          subtitle={
            mode === 'pending'
              ? `${filtered.length} open · ${formatMt(totalQty)} planned`
              : `${filtered.length} completed · ${formatMt(totalQty)} actual`
          }
          breadcrumb={<Breadcrumb items={[{ label: 'Tradeal', href: appPath('/') }, { label: 'Lift Register' }]} />}
        />

        <Tabs
          className="mb-4"
          tabs={[
            { id: 'pending', label: 'Open', count: pendingCount },
            { id: 'completed', label: 'Completed', count: completedCount },
          ]}
          active={mode}
          onChange={id => setMode(id as LiftListMode)}
        />

        <LiftFiltersBar
          audience="broker"
          search={search}
          onSearchChange={setSearch}
          filters={filters}
          onFiltersChange={setFilters}
          items={options.items}
          parties={options.parties}
          brokers={[]}
          spots={options.spots}
          rates={options.rates}
          contracts={options.contracts}
          onExport={handleExport}
        />

        <div
          className={cn('min-w-0', undockedDetailOpen && 'relative')}
          style={undockedDetailOpen ? { zIndex: REGISTER_TABLE_LAYER_Z } : undefined}
        >
          <DataTable
            columns={columns}
            data={filtered}
            qtyNote
            activeRowId={selected?.id}
            sortKey={sort.key}
            sortDirection={sort.direction}
            onSortChange={key => {
              setSort(prev => {
                const next = toggleSort(prev, key)
                saveRegisterSort(registerId, next)
                return next
              })
            }}
            onRowClick={openLift}
            getRowId={row => row.id}
            getRowTone={row => row.unread ? 'unread' : undefined}
            stickyFirstColumn
            emptyState={
              <EmptyState
                icon={<Scale className="h-10 w-10" />}
                title={mode === 'pending' ? 'No open lifts' : 'No completed lifts'}
                description={
                  filtersOn
                    ? 'Try adjusting your search or filters.'
                    : mode === 'pending'
                      ? 'Lifts from the buyer or seller stay here until you mark them complete.'
                      : 'Lifts you have marked complete appear here.'
                }
                action={filtersOn ? (
                  <Button variant="outline" size="sm" onClick={() => { setSearch(''); setFilters(emptyLiftFilters) }}>
                    Clear filters
                  </Button>
                ) : undefined}
              />
            }
            mobileRender={(row: BrokerLiftRow) => (
              <div className="px-4 py-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={row.unread ? 'font-semibold text-heading' : 'font-medium'}>{formatLiftRef(row.brokerLiftRef)}</span>
                  <Badge variant={row.partyRole === 'seller' ? 'info' : 'accent'}>
                    {row.partyRole === 'seller' ? 'Seller' : 'Buyer'}
                  </Badge>
                </div>
                <TankerNumberColumn lines={tankerQtyLinesFromBrokerEvent(row.tankers, brokerQtyEvent(row))} />
                <p className="text-heading truncate">{row.itemName || 'Contract'} · {formatMt(row.qty)}</p>
                <p className="text-muted truncate">{row.contractRef}</p>
                <p className="text-muted truncate">{row.sellerName}</p>
                <p className="text-muted truncate">{row.buyerName}</p>
              </div>
            )}
          />
        </div>
      </div>

      <BrokerLiftDetailPanel
        lift={selected}
        open={selected != null}
        docked={effectiveDocked}
        onClose={closeLift}
        onDockChange={docked => {
          if (!docked) setDetailPanelOpen(false)
          setPanelDocked(docked)
          saveOrderPanelDocked(docked)
        }}
        onComplete={markComplete}
      />
    </>
  )
}
