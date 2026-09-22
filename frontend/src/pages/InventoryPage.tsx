import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Plus, Filter, AlertTriangle, LayoutGrid, Table2, Package } from 'lucide-react'
import { PageHeader, FilterBar } from '../components/ui/CommandPalette'
import { Breadcrumb, EmptyState } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { ProgressBar } from '../components/ui/CommandPalette'
import { StatGrid } from '../components/layout/PageGrid'
import { DataTable } from '../components/ui/DataTable'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { AppliedFilterChips } from '../components/registers/DateFilterPicker'
import { cn, formatDate, formatMt, formatQty, roundQtyMt, availableQtyClass, tableRefCellClass } from '../lib/utils'
import { loadRegisterSort, saveRegisterSort, sortRows, toggleSort } from '../lib/registerSort'
import { formatContractRate, formatRateCell, PURCHASE_RATE_COLUMN_HEADER } from '../lib/orderRate'
import { useTradeStore } from '../store/TradeStore'
import { useLargeScreen } from '../hooks/useMediaQuery'
import type { Lot } from '../data/mockData'
import { DetailInlineStat, DetailInlineStatRow } from '../components/registers/DetailPanelSections'
import { useTableDensity } from '../hooks/useTableDensity'

type InventoryView = 'cards' | 'table'

function ViewToggle({ view, onChange }: { view: InventoryView; onChange: (view: InventoryView) => void }) {
  return (
    <SegmentedControl
      ariaLabel="Inventory view"
      size="sm"
      className="ml-auto shrink-0"
      options={[
        { id: 'cards', label: 'Cards', icon: LayoutGrid },
        { id: 'table', label: 'Table', icon: Table2 },
      ]}
      value={view}
      onChange={onChange}
    />
  )
}

function InventoryItemStat({
  commodity,
  remaining,
  available,
  allocated,
  unit,
  selected,
  onClick,
}: {
  commodity: string
  remaining: number
  available: number
  allocated: number
  unit: string
  selected: boolean
  onClick: () => void
}) {
  const overAllocated = available < 0
  const { classes: density, density: mode } = useTableDensity()
  const compact = mode === 'compact'

  return (
    <Card
      hover
      onClick={onClick}
      padding={false}
      className={cn(
        'h-full cursor-pointer overflow-hidden',
        selected && 'ring-2 ring-accent ring-offset-2 dark:ring-offset-[var(--color-card)]',
      )}
    >
      <div className={compact ? 'p-4' : 'p-8'}>
        <h5 className={cn('font-medium text-caption truncate', density.text)}>{commodity}</h5>
        <p className={cn('font-semibold text-heading mt-0.5 tabular-nums', compact ? 'text-base' : 'text-lg')}>
          {formatQty(remaining, unit)}
        </p>
        <p className={cn('text-muted mt-0.5', compact ? 'text-[11px]' : 'text-xs')}>On hand</p>
      </div>
      <div className={cn(
        'border-t border-gray-200 bg-gray-100/90 dark:border-gray-700 dark:bg-gray-800/50',
        compact ? 'px-3 py-2' : 'px-8 py-4',
      )}>
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <p className="text-xs text-caption">Available</p>
            <p className={cn('font-semibold tabular-nums mt-0.5', density.text, availableQtyClass(available))}>
              {formatQty(available, unit)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-caption">Allocated</p>
            <p className={cn('font-semibold tabular-nums text-heading mt-0.5', density.text)}>
              {formatQty(allocated, unit)}
            </p>
          </div>
        </div>
        {overAllocated && (
          <p className="text-xs text-danger mt-2">
            Over-allocated by {formatQty(Math.abs(available), unit)}
          </p>
        )}
      </div>
    </Card>
  )
}

function InventoryCards({ lots }: { lots: Lot[] }) {
  if (lots.length === 0) {
    return (
      <EmptyState
        card
        icon={<Package className="h-10 w-10" />}
        title="No lots match your filters"
        description="Try clearing filters or record a lift to add stock."
      />
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {lots.map(lot => {
        const isLow = lot.available >= 0 && lot.available < 20
        const overAllocated = lot.available < 0

        return (
          <Link key={lot.id} to={`/inventory/${lot.id}`} className="block h-full">
            <Card hover padding={false} className="h-full overflow-hidden">
              <div className="p-8 pb-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-muted">{lot.lotNumber}</p>
                    <h3 className="text-base font-semibold text-heading mt-0.5 truncate">{lot.commodity}</h3>
                  </div>
                  {overAllocated ? (
                    <Badge variant="danger" className="shrink-0">Over-allocated</Badge>
                  ) : isLow ? (
                    <Badge variant="warning" className="shrink-0"><AlertTriangle className="h-3 w-3" /> Low</Badge>
                  ) : null}
                </div>

                <div className="mt-4">
                  <DetailInlineStatRow>
                    <DetailInlineStat label="Remaining" value={formatQty(lot.remaining, lot.unit)} />
                    <DetailInlineStat
                      label="Available"
                      value={formatQty(lot.available, lot.unit)}
                      valueClassName={availableQtyClass(lot.available)}
                    />
                    <DetailInlineStat label="Allocated" value={formatQty(lot.allocated, lot.unit)} />
                  </DetailInlineStatRow>
                </div>

                <div className="mt-4">
                  <ProgressBar value={lot.remaining} max={lot.quantityPurchased} label="On hand vs PO qty" />
                </div>

                {overAllocated && (
                  <p className="text-xs text-danger mt-2">
                    Short by {formatQty(Math.abs(lot.available), lot.unit)} vs sales orders
                  </p>
                )}
              </div>

              <div className="border-t border-gray-200 bg-gray-100/90 px-8 py-4 dark:border-gray-700 dark:bg-gray-800/50">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <p className="text-sm font-semibold tabular-nums text-heading">
                    {formatContractRate(lot.purchasePrice)}
                  </p>
                  <p className="text-xs text-caption tabular-nums">
                    {formatQty(lot.quantityPurchased, lot.unit)} PO qty
                  </p>
                </div>
                <p className="text-xs text-muted mt-1 truncate">
                  {lot.producer} · {lot.broker} · {formatDate(lot.purchaseDate)}
                </p>
              </div>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}

function inventorySortValue(lot: Lot, key: string): string | number {
  switch (key) {
    case 'lotNumber': return lot.lotNumber
    case 'commodity': return lot.commodity
    case 'producer': return lot.producer
    case 'broker': return lot.broker
    case 'purchasePrice': return lot.purchasePrice
    case 'poQty': return lot.quantityPurchased
    case 'remaining': return lot.remaining
    case 'allocated': return lot.allocated
    case 'available': return lot.available
    case 'purchaseDate': return lot.purchaseDate
    default: return ''
  }
}

function InventoryTable({ lots }: { lots: Lot[] }) {
  const navigate = useNavigate()
  const [sort, setSort] = useState(() => loadRegisterSort('inventory', 'lotNumber'))

  const handleSortChange = useCallback((key: string) => {
    setSort(prev => {
      const next = toggleSort(prev, key)
      saveRegisterSort('inventory', next)
      return next
    })
  }, [])

  const sortedLots = useMemo(
    () => sortRows(lots, sort, inventorySortValue),
    [lots, sort],
  )

  const columns = useMemo(() => [
    {
      key: 'lotNumber',
      header: 'Lot #',
      sortable: true,
      sortValue: (lot: Lot) => lot.lotNumber,
      className: 'whitespace-nowrap min-w-[10.5rem]',
      render: (lot: Lot) => (
        <Link
          to={`/inventory/${lot.id}`}
          className={cn(tableRefCellClass, 'hover:underline')}
          onClick={e => e.stopPropagation()}
        >
          {lot.lotNumber}
        </Link>
      ),
    },
    {
      key: 'commodity',
      header: 'Item Name',
      sortable: true,
      sortValue: (lot: Lot) => lot.commodity,
      render: (lot: Lot) => (
        <span className="max-w-[12rem] truncate block font-medium text-heading">{lot.commodity}</span>
      ),
    },
    {
      key: 'producer',
      header: 'Seller',
      sortable: true,
      sortValue: (lot: Lot) => lot.producer,
      render: (lot: Lot) => (
        <span className="max-w-[180px] truncate block">{lot.producer}</span>
      ),
    },
    {
      key: 'broker',
      header: 'Broker Name',
      className: 'hidden lg:table-cell min-w-[12rem]',
      sortable: true,
      sortValue: (lot: Lot) => lot.broker,
      render: (lot: Lot) => (
        <span className="max-w-[180px] truncate block">{lot.broker}</span>
      ),
    },
    {
      key: 'purchasePrice',
      header: PURCHASE_RATE_COLUMN_HEADER,
      className: 'text-right whitespace-nowrap min-w-[6.5rem]',
      sortable: true,
      sortValue: (lot: Lot) => lot.purchasePrice,
      render: (lot: Lot) => (
        <span className="tabular-nums">{formatRateCell(lot.purchasePrice)}</span>
      ),
    },
    {
      key: 'poQty',
      header: 'PO Qty',
      className: 'text-right whitespace-nowrap min-w-[6rem]',
      sortable: true,
      sortValue: (lot: Lot) => lot.quantityPurchased,
      render: (lot: Lot) => (
        <span className="tabular-nums">{formatMt(lot.quantityPurchased)}</span>
      ),
    },
    {
      key: 'remaining',
      header: 'Remaining',
      className: 'text-right whitespace-nowrap min-w-[6rem]',
      sortable: true,
      sortValue: (lot: Lot) => lot.remaining,
      render: (lot: Lot) => <span className="tabular-nums">{formatMt(lot.remaining)}</span>,
    },
    {
      key: 'allocated',
      header: 'Allocated',
      className: 'text-right whitespace-nowrap min-w-[6rem]',
      sortable: true,
      sortValue: (lot: Lot) => lot.allocated,
      render: (lot: Lot) => (
        <span className={cn('tabular-nums', lot.allocated > 0 && 'text-blue-600 dark:text-blue-400 font-medium')}>
          {formatMt(lot.allocated)}
        </span>
      ),
    },
    {
      key: 'available',
      header: 'Available',
      className: 'text-right whitespace-nowrap min-w-[6.5rem]',
      sortable: true,
      sortValue: (lot: Lot) => lot.available,
      render: (lot: Lot) => (
        <span className={cn('font-medium tabular-nums', availableQtyClass(lot.available))}>
          {formatMt(lot.available)}
        </span>
      ),
    },
    {
      key: 'purchaseDate',
      header: 'Purchased',
      className: 'hidden md:table-cell whitespace-nowrap min-w-[7rem]',
      sortable: true,
      sortValue: (lot: Lot) => lot.purchaseDate,
      render: (lot: Lot) => <span className="tabular-nums">{formatDate(lot.purchaseDate)}</span>,
    },
  ], [])

  return (
    <DataTable<Lot>
      data={sortedLots}
      columns={columns}
      qtyNote
      stickyFirstColumn
      sortKey={sort.key}
      sortDirection={sort.direction}
      onSortChange={handleSortChange}
      emptyState={
        <EmptyState
          icon={<Package className="h-10 w-10" />}
          title="No lots match your filters"
          description="Try clearing filters or create a purchase order to add inventory."
        />
      }
      onRowClick={lot => navigate(`/inventory/${lot.id}`)}
      getRowId={lot => lot.id}
      mobileRender={(lot) => {
        const isLow = lot.available >= 0 && lot.available < 20
        const overAllocated = lot.available < 0
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className={tableRefCellClass}>{lot.lotNumber}</span>
              <div className="flex items-center gap-1 shrink-0">
                {overAllocated ? (
                  <Badge variant="danger">Over-allocated</Badge>
                ) : isLow ? (
                  <Badge variant="warning"><AlertTriangle className="h-3 w-3" /> Low</Badge>
                ) : null}
              </div>
            </div>
            <p className="font-medium text-heading truncate">{lot.commodity}</p>
            <div className="flex items-center justify-between text-sm">
              <span className={cn('tabular-nums font-medium', availableQtyClass(lot.available))}>
                {formatMt(lot.available)} available
              </span>
              <span className="text-muted tabular-nums">{formatMt(lot.remaining)} on hand</span>
            </div>
            <p className="text-xs text-muted truncate">{lot.producer} · {formatDate(lot.purchaseDate)}</p>
          </div>
        )
      }}
    />
  )
}

export function InventoryPage() {
  const { lots, items } = useTradeStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const isLargeScreen = useLargeScreen()
  const [search, setSearch] = useState('')
  const [commodityFilter, setCommodityFilter] = useState('all')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const urlQ = searchParams.get('q')
  const lowStockOnly = searchParams.get('lowStock') === 'true'
  const urlView = searchParams.get('view')
  const view: InventoryView = urlView === 'table'
    ? 'table'
    : urlView === 'cards'
      ? 'cards'
      : (isLargeScreen ? 'table' : 'cards')

  const setLowStockOnly = (enabled: boolean) => {
    const params = new URLSearchParams(searchParams)
    if (enabled) params.set('lowStock', 'true')
    else params.delete('lowStock')
    setSearchParams(params, { replace: true })
  }

  const setView = (next: InventoryView) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'cards') params.set('view', 'cards')
    else params.delete('view')
    setSearchParams(params, { replace: true })
  }

  const commodities = useMemo(
    () => [...new Set([...items, ...lots.map(l => l.commodity)])].sort(),
    [items, lots],
  )

  useEffect(() => {
    if (urlQ) setSearch(urlQ)
  }, [urlQ])

  const filtered = lots.filter(l => {
    const matchSearch = l.lotNumber.toLowerCase().includes(search.toLowerCase()) ||
      l.commodity.toLowerCase().includes(search.toLowerCase()) ||
      l.producer.toLowerCase().includes(search.toLowerCase())
    const matchCommodity = commodityFilter === 'all' || l.commodity === commodityFilter
    const matchLowStock = !lowStockOnly || (l.available >= 0 && l.available < 20)
    return matchSearch && matchCommodity && matchLowStock
  })

  const itemStats = useMemo(() => {
    const map = new Map<string, {
      remaining: number
      allocated: number
      available: number
      unit: string
    }>()

    for (const lot of lots) {
      const current = map.get(lot.commodity) ?? {
        remaining: 0,
        allocated: 0,
        available: 0,
        unit: lot.unit,
      }
      current.remaining = roundQtyMt(current.remaining + lot.remaining)
      current.allocated = roundQtyMt(current.allocated + lot.allocated)
      current.available = roundQtyMt(current.available + lot.available)
      map.set(lot.commodity, current)
    }

    return [...map.entries()]
      .map(([commodity, stats]) => ({ commodity, ...stats }))
      .sort((a, b) => a.commodity.localeCompare(b.commodity))
  }, [lots])

  const filterChips = useMemo(() => {
    const chips: { id: string; prefix: string; value: string }[] = []
    if (search.trim()) chips.push({ id: 'search', prefix: 'Search', value: search.trim() })
    if (commodityFilter !== 'all') chips.push({ id: 'commodity', prefix: 'Commodity', value: commodityFilter })
    if (lowStockOnly) chips.push({ id: 'lowStock', prefix: 'Stock', value: 'Low stock only' })
    return chips
  }, [search, commodityFilter, lowStockOnly])

  const handleRemoveChip = (id: string) => {
    if (id === 'search') setSearch('')
    if (id === 'commodity') setCommodityFilter('all')
    if (id === 'lowStock') setLowStockOnly(false)
  }

  const handleClearFilters = () => {
    setSearch('')
    setCommodityFilter('all')
    setLowStockOnly(false)
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Inventory"
        subtitle={`${lots.length} lots across ${itemStats.length} item${itemStats.length === 1 ? '' : 's'}`}
        breadcrumb={<Breadcrumb items={[{ label: 'Tradeal', href: '/' }, { label: 'Inventory' }]} />}
      />

      {itemStats.length > 0 && (
        <StatGrid cols={6}>
          {itemStats.map(stat => (
            <InventoryItemStat
              key={stat.commodity}
              commodity={stat.commodity}
              remaining={stat.remaining}
              available={stat.available}
              allocated={stat.allocated}
              unit={stat.unit}
              selected={commodityFilter === stat.commodity}
              onClick={() => {
                setCommodityFilter(prev => prev === stat.commodity ? 'all' : stat.commodity)
                setFiltersOpen(true)
              }}
            />
          ))}
        </StatGrid>
      )}

      <FilterBar>
        <div className="w-full sm:w-64">
          <Input icon placeholder="Search lots..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button
          variant="outline"
          size="md"
          onClick={() => setFiltersOpen(v => !v)}
        >
          <Filter className="h-4 w-4" /> Filters
        </Button>
        <ViewToggle view={view} onChange={setView} />
      </FilterBar>

      {filtersOpen && (
        <Card className="mb-4 p-8">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
            <div className="w-full sm:w-56">
              <Select
                label="Commodity"
                options={[
                  { value: 'all', label: 'All Commodities' },
                  ...commodities.map(c => ({ value: c, label: c })),
                ]}
                value={commodityFilter}
                onChange={e => setCommodityFilter(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                variant={lowStockOnly ? 'secondary' : 'outline'}
                size="md"
                onClick={() => setLowStockOnly(!lowStockOnly)}
              >
                <AlertTriangle className="h-4 w-4" />
                Low stock only
              </Button>
            </div>
          </div>
        </Card>
      )}

      <AppliedFilterChips
        chips={filterChips}
        onRemove={handleRemoveChip}
        onClearAll={handleClearFilters}
      />

      {filtered.length === 0 ? (
        <EmptyState
          card
          icon={<Package className="h-10 w-10" />}
          title="No lots match your filters"
          description="Adjust filters or create a purchase order to add inventory."
          action={
            <Button to="/purchase-orders/new" size="sm"><Plus className="h-4 w-4" /> New PO</Button>
          }
        />
      ) : view === 'table' ? (
        <InventoryTable lots={filtered} />
      ) : (
        <InventoryCards lots={filtered} />
      )}
    </div>
  )
}
