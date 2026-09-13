import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Download, MoreHorizontal, FileText } from 'lucide-react'
import { PageHeader, FilterBar } from '../components/ui/CommandPalette'
import { Breadcrumb, EmptyState } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { DataTable } from '../components/ui/DataTable'
import { StatusBadge } from '../components/ui/Badge'
import { Drawer } from '../components/ui/Drawer'
import { formatCurrency, formatDate, formatMt, formatQty } from '../lib/utils'
import { formatContractRate, contractRateFromOrder, formatRateCell, RATE_COLUMN_HEADER } from '../lib/orderRate'
import { exportToCSV } from '../lib/export'
import { type Contract } from '../data/mockData'
import { useTradeStore } from '../store/TradeStore'
import { useToast } from '../hooks/useToast'

export function ContractsPage() {
  const { contracts } = useTradeStore()
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState<Contract | null>(null)
  const [selectedRows, setSelectedRows] = useState<string[]>([])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) setSearch(q)
  }, [searchParams])

  const filtered = contracts.filter(c => {
    const matchSearch = c.ref.toLowerCase().includes(search.toLowerCase()) ||
      c.buyer.toLowerCase().includes(search.toLowerCase()) ||
      c.seller.toLowerCase().includes(search.toLowerCase()) ||
      c.commodity.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    return matchSearch && matchStatus
  })

  const exportRows = (selectedRows.length
    ? filtered.filter(c => selectedRows.includes(c.id))
    : filtered
  ).map(c => ({
    ref: c.ref,
    status: c.status,
    buyer: c.buyer,
    seller: c.seller,
    commodity: c.commodity,
    quantity: c.quantity,
    rate: contractRateFromOrder(c.rate),
    value: c.value,
    broker: c.broker,
    deliveryDate: c.deliveryDate,
    paymentStatus: c.paymentStatus,
  }))

  const handleExport = () => {
    exportToCSV(exportRows, [
      { key: 'ref', header: 'Ref' },
      { key: 'status', header: 'Status' },
      { key: 'buyer', header: 'Buyer' },
      { key: 'seller', header: 'Seller' },
      { key: 'commodity', header: 'Commodity' },
      { key: 'quantity', header: 'Qty' },
      { key: 'rate', header: RATE_COLUMN_HEADER },
      { key: 'value', header: 'Value' },
      { key: 'broker', header: 'Broker' },
      { key: 'deliveryDate', header: 'Delivery' },
      { key: 'paymentStatus', header: 'Payment' },
    ], 'contracts')
    toast.success(`Exported ${exportRows.length} contract${exportRows.length === 1 ? '' : 's'}`)
  }

  const columns = [
    { key: 'ref', header: 'Contract Ref', render: (r: Contract) => (
      <span className="font-medium text-heading">{r.ref}</span>
    )},
    { key: 'status', header: 'Status', render: (r: Contract) => <StatusBadge status={r.status} /> },
    { key: 'buyer', header: 'Buyer' },
    { key: 'seller', header: 'Seller' },
    { key: 'commodity', header: 'Commodity', render: (r: Contract) => (
      <span>{r.commodity} · <span className="tabular-nums">{formatMt(r.quantity)}</span></span>
    )},
    { key: 'rate', header: RATE_COLUMN_HEADER, render: (r: Contract) => formatRateCell(r.rate), className: 'text-right' },
    { key: 'value', header: 'Value', render: (r: Contract) => (
      <span className="font-medium">{formatCurrency(r.value)}</span>
    ), className: 'text-right' },
    { key: 'broker', header: 'Broker' },
    { key: 'deliveryDate', header: 'Delivery', render: (r: Contract) => <span className="tabular-nums">{formatDate(r.deliveryDate)}</span> },
    { key: 'paymentStatus', header: 'Payment', render: (r: Contract) => <StatusBadge status={r.paymentStatus} /> },
    { key: 'actions', header: '', render: (r: Contract) => (
      <button
        type="button"
        aria-label={`More actions for ${r.ref}`}
        onClick={e => { e.stopPropagation(); setSelected(r) }}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer"
      >
        <MoreHorizontal className="h-4 w-4 text-muted" />
      </button>
    ), className: '' },
  ]

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Contract Confirmations"
        subtitle={`${filtered.length} contracts`}
        breadcrumb={<Breadcrumb items={[{ label: 'TradeOS', href: '/' }, { label: 'Contracts' }]} />}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4" /> Export</Button>
            <Button to="/contracts/new" size="sm"><Plus className="h-4 w-4" /> New Contract</Button>
          </>
        }
      />

      <FilterBar>
        <div className="w-64">
          <Input icon placeholder="Search contracts..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select
          options={[
            { value: 'all', label: 'All Statuses' },
            { value: 'draft', label: 'Draft' },
            { value: 'pending', label: 'Pending' },
            { value: 'confirmed', label: 'Confirmed' },
            { value: 'active', label: 'Active' },
            { value: 'completed', label: 'Completed' },
          ]}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        />
        {selectedRows.length > 0 && (
          <Button variant="secondary" size="md" onClick={handleExport}>
            Export {selectedRows.length} selected
          </Button>
        )}
      </FilterBar>

      <DataTable
        columns={columns}
        data={filtered}
        qtyNote
        emptyState={
          <EmptyState
            icon={<FileText className="h-10 w-10" />}
            title={search.trim() || statusFilter !== 'all' ? 'No contracts match your filters' : 'No contracts yet'}
            description={search.trim() || statusFilter !== 'all'
              ? 'Try adjusting your search or filters.'
              : 'Create a contract confirmation to get started.'}
            action={
              search.trim() || statusFilter !== 'all' ? (
                <Button variant="outline" size="sm" onClick={() => { setSearch(''); setStatusFilter('all') }}>
                  Clear filters
                </Button>
              ) : (
                <Button to="/contracts/new" size="sm"><Plus className="h-4 w-4" /> New Contract</Button>
              )
            }
          />
        }
        onRowClick={r => navigate(`/contracts/${r.id}`)}
        selectedRows={selectedRows}
        onSelectRow={id => setSelectedRows(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
        onSelectAllVisible={(select, ids) => {
          setSelectedRows(prev => select
            ? [...new Set([...prev, ...ids])]
            : prev.filter(id => !ids.includes(id)))
        }}
        getRowId={r => r.id}
      />

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.ref || ''}
        subtitle={selected ? `${selected.commodity} · ${formatQty(selected.quantity, selected.unit)}` : ''}
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted">Buyer</p><p className="text-sm font-medium">{selected.buyer}</p></div>
              <div><p className="text-xs text-muted">Seller</p><p className="text-sm font-medium">{selected.seller}</p></div>
              <div><p className="text-xs text-muted">Rate</p><p className="text-sm font-medium">{formatContractRate(selected.rate)}</p></div>
              <div><p className="text-xs text-muted">Value</p><p className="text-sm font-medium">{formatCurrency(selected.value)}</p></div>
              <div><p className="text-xs text-muted">Broker</p><p className="text-sm font-medium">{selected.broker}</p></div>
              <div><p className="text-xs text-muted">Delivery</p><p className="text-sm font-medium">{formatDate(selected.deliveryDate)}</p></div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={() => { navigate(`/contracts/${selected.id}`); setSelected(null) }}>View Details</Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
