import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Download, MoreHorizontal, FileText } from 'lucide-react'
import { PageHeader, FilterBar } from '../components/ui/CommandPalette'
import { Breadcrumb, EmptyState } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { DataTable } from '../components/ui/DataTable'
import { Badge, StatusBadge } from '../components/ui/Badge'
import { formatCurrency, formatDate, formatMt } from '../lib/utils'
import { formatRateCell, RATE_COLUMN_HEADER } from '../lib/orderRate'
import { exportToCSV } from '../lib/export'
import { type Contract } from '../data/mockData'
import { useToast } from '../hooks/useToast'
import { organisationApi, type BrokerContractShare } from '../api/organisationApi'
import { parseIndianAmount } from '../lib/indianAmount'
import { orderLineAmount, ratePerMtFrom10Kg } from '../lib/orderRate'
import { CONTRACT_SHARES_REFRESH_EVENT } from '../lib/contractSharesRefresh'
import { brokerContractStatus } from '../lib/brokerContractStatus'
import { appPath } from '../lib/appShellMode'

function shareAsContract(share: BrokerContractShare): Contract & { edited?: boolean } {
  const quantity = parseFloat(share.quantity) || 0
  const ratePer10 = parseIndianAmount(share.rate)
  const deliveryDate = share.delivery_period.split(' · ')[0] || ''
  const status = brokerContractStatus(share)
  return {
    id: `share-${share.id}`,
    ref: share.contract_ref,
    status: status === 'deleted' ? 'cancelled' : status,
    buyer: share.buyer_name,
    seller: share.seller_name,
    commodity: share.item_name,
    quantity,
    unit: 'MT',
    rate: ratePerMtFrom10Kg(ratePer10),
    value: orderLineAmount(quantity, ratePer10),
    broker: share.sender_name,
    deliveryDate,
    paymentStatus: 'outstanding',
    createdAt: share.created_at,
    location: share.delivery_period,
    edited: share.edited,
  }
}

export function ContractsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [received, setReceived] = useState<BrokerContractShare[]>([])
  const [receivedReloadKey, setReceivedReloadKey] = useState(0)

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) setSearch(q)
  }, [searchParams])

  useEffect(() => {
    const refresh = () => setReceivedReloadKey(key => key + 1)
    window.addEventListener(CONTRACT_SHARES_REFRESH_EVENT, refresh)
    window.addEventListener('broker-shares-refresh', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener(CONTRACT_SHARES_REFRESH_EVENT, refresh)
      window.removeEventListener('broker-shares-refresh', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    organisationApi.listReceivedShares()
      .then(res => {
        if (!cancelled) setReceived(res.shares ?? [])
      })
      .catch(() => {
        if (!cancelled) setReceived([])
      })
    return () => {
      cancelled = true
    }
  }, [receivedReloadKey])

  const allContracts = received.map(shareAsContract)
  const openRow = (row: Contract) => {
    navigate(appPath(`/contract-shares/${row.id.slice('share-'.length)}`))
  }

  const filtered = allContracts.filter(c => {
    const matchSearch = c.ref.toLowerCase().includes(search.toLowerCase()) ||
      c.buyer.toLowerCase().includes(search.toLowerCase()) ||
      c.seller.toLowerCase().includes(search.toLowerCase()) ||
      c.commodity.toLowerCase().includes(search.toLowerCase()) ||
      c.broker.toLowerCase().includes(search.toLowerCase())
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
    rate: c.rate,
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
    { key: 'status', header: 'Status', render: (r: Contract & { edited?: boolean }) => (
      <span className="inline-flex items-center gap-1.5">
        <StatusBadge status={r.status} />
        {r.edited ? <Badge variant="warning">Edited</Badge> : null}
      </span>
    ) },
    { key: 'broker', header: 'Broker' },
    { key: 'buyer', header: 'Buyer' },
    { key: 'seller', header: 'Seller' },
    { key: 'commodity', header: 'Commodity', render: (r: Contract) => (
      <span>{r.commodity} · <span className="tabular-nums">{formatMt(r.quantity)}</span></span>
    )},
    { key: 'rate', header: RATE_COLUMN_HEADER, render: (r: Contract) => formatRateCell(r.rate), className: 'text-right' },
    { key: 'value', header: 'Value', render: (r: Contract) => (
      <span className="font-medium">{formatCurrency(r.value)}</span>
    ), className: 'text-right' },
    { key: 'deliveryDate', header: 'Delivery', render: (r: Contract) => <span className="tabular-nums">{formatDate(r.deliveryDate)}</span> },
    { key: 'paymentStatus', header: 'Payment', render: (r: Contract) => <StatusBadge status={r.paymentStatus} /> },
    { key: 'actions', header: '', render: (r: Contract) => (
      <button
        type="button"
        aria-label={`More actions for ${r.ref}`}
        onClick={e => { e.stopPropagation(); openRow(r) }}
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
        subtitle={`${filtered.length} from brokers`}
        breadcrumb={<Breadcrumb items={[{ label: 'Tradeal', href: appPath('/') }, { label: 'Contracts' }]} />}
        actions={
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export
          </Button>
        }
      />

      <FilterBar>
        <div className="w-64">
          <Input icon placeholder="Search contracts..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select
          options={[
            { value: 'all', label: 'All Statuses' },
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
            title={search.trim() || statusFilter !== 'all' ? 'No contracts match your filters' : 'No broker contracts yet'}
            description={search.trim() || statusFilter !== 'all'
              ? 'Try adjusting your search or filters.'
              : 'When a broker sends you a contract confirmation, it will appear here.'}
            action={
              search.trim() || statusFilter !== 'all' ? (
                <Button variant="outline" size="sm" onClick={() => { setSearch(''); setStatusFilter('all') }}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        }
        onRowClick={openRow}
        selectedRows={selectedRows}
        onSelectRow={id => setSelectedRows(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
        onSelectAllVisible={(select, ids) => {
          setSelectedRows(prev => select
            ? [...new Set([...prev, ...ids])]
            : prev.filter(id => !ids.includes(id)))
        }}
        getRowId={r => r.id}
      />
    </div>
  )
}
