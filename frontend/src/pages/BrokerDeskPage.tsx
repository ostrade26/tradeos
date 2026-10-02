import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Download, FileText, Pencil, Trash2 } from 'lucide-react'
import { ApiError } from '../api/client'
import { organisationApi, type BrokerContractShare } from '../api/organisationApi'
import { PageHeader, FilterBar } from '../components/ui/CommandPalette'
import { Breadcrumb, EmptyState, Tabs } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { DataTable } from '../components/ui/DataTable'
import { Badge } from '../components/ui/Badge'
import { DetailPanelMenu } from '../components/ui/DetailPanelMenu'
import { ConfirmDeleteModal } from '../components/ui/DeleteActions'
import { OngoingContractStatus } from '../components/contracts/OngoingContractStatus'
import { formatCurrency, formatDate, formatMt } from '../lib/utils'
import { formatIndianAmount, parseIndianAmount } from '../lib/indianAmount'
import { RATE_COLUMN_HEADER, orderLineAmount } from '../lib/orderRate'
import { exportToCSV } from '../lib/export'
import { useToast } from '../hooks/useToast'
import { ConfirmationProgress } from '../components/contracts/ConfirmationProgress'
import { appPath } from '../lib/appShellMode'
import { CONTRACT_SHARES_REFRESH_EVENT, dispatchContractSharesRefresh } from '../lib/contractSharesRefresh'
import { brokerContractStatus, brokerDeskTab, type BrokerDeskTab } from '../lib/brokerContractStatus'
import { useTableDensity } from '../hooks/useTableDensity'

function deliveryLabel(value: string): string {
  if (!value) return '—'
  const formatted = formatDate(value)
  return formatted === '—' ? value : formatted
}

function shareValue(share: BrokerContractShare): number {
  return orderLineAmount(parseFloat(share.quantity) || 0, parseIndianAmount(share.rate))
}

export function BrokerDeskPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { classes } = useTableDensity()
  const [shares, setShares] = useState<BrokerContractShare[]>([])
  const [search, setSearch] = useState('')
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [reloadKey, setReloadKey] = useState(0)
  const [pendingDelete, setPendingDelete] = useState<BrokerContractShare | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const tabParam = searchParams.get('tab')
  const tab: BrokerDeskTab = tabParam === 'completed' || tabParam === 'deleted' ? tabParam : 'pending'

  useEffect(() => {
    let cancelled = false
    organisationApi.listBrokerShares()
      .then(res => {
        if (!cancelled) setShares(res.shares)
      })
      .catch(err => {
        if (!cancelled) toast.error(err instanceof ApiError ? err.message : 'Could not load contracts')
      })
    return () => {
      cancelled = true
    }
  }, [toast, reloadKey])

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

  useEffect(() => {
    const raw = searchParams.get('share')
    if (!raw) return
    const id = Number(raw)
    if (!Number.isFinite(id)) return
    navigate(appPath(`/contract-shares/${id}`), { replace: true })
  }, [navigate, searchParams])

  const counts = {
    pending: shares.filter(share => brokerDeskTab(share) === 'pending').length,
    completed: shares.filter(share => brokerDeskTab(share) === 'completed').length,
    deleted: shares.filter(share => brokerDeskTab(share) === 'deleted').length,
  }

  const filtered = shares.filter(share => {
    if (brokerDeskTab(share) !== tab) return false
    const haystack = [share.contract_ref, share.buyer_name, share.seller_name, share.item_name].join(' ').toLowerCase()
    return haystack.includes(search.trim().toLowerCase())
  })

  const filteredOut = Boolean(search.trim())

  const setTab = (next: string) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'pending') params.delete('tab')
    else params.set('tab', next)
    setSearchParams(params, { replace: true })
    setSelectedRows([])
  }

  const removeShare = async () => {
    if (!pendingDelete) return
    setDeleteError('')
    try {
      await organisationApi.deleteBrokerShare(pendingDelete.id)
      toast.success(`${pendingDelete.contract_ref} deleted`, {
        description: 'The buyer and the seller have been notified.',
      })
      setPendingDelete(null)
      dispatchContractSharesRefresh()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not delete contract'
      setDeleteError(message)
      throw err
    }
  }

  const exportRows = (selectedRows.length
    ? filtered.filter(share => selectedRows.includes(String(share.id)))
    : filtered
  ).map(share => ({
    ref: share.contract_ref,
    status: brokerContractStatus(share),
    buyer: share.buyer_name,
    seller: share.seller_name,
    commodity: share.item_name,
    quantity: share.quantity,
    rate: parseIndianAmount(share.rate),
    value: shareValue(share),
    deliveryDate: share.delivery_period,
    paymentStatus: share.payment_terms,
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
      { key: 'deliveryDate', header: 'Delivery' },
      { key: 'paymentStatus', header: 'Payment' },
    ], 'contracts')
    toast.success(`Exported ${exportRows.length} contract${exportRows.length === 1 ? '' : 's'}`)
  }

  const openShare = (share: BrokerContractShare) => {
    navigate(appPath(`/contract-shares/${share.id}`))
  }

  const columns = [
    { key: 'ref', header: 'Contract Ref', render: (share: BrokerContractShare) => (
      <span className="inline-flex items-center gap-2">
        <span className="font-medium text-heading">{share.contract_ref}</span>
        {share.edited ? <Badge variant="warning">Edited</Badge> : null}
      </span>
    )},
    { key: 'status', header: 'Status', render: (share: BrokerContractShare) => <OngoingContractStatus share={share} /> },
    { key: 'confirmedBy', header: 'Confirmed', render: (share: BrokerContractShare) => (
      <div className="min-w-[11rem] py-1">
        <ConfirmationProgress
          buyerConfirmed={share.buyer_confirmed}
          sellerConfirmed={share.seller_confirmed}
          role="broker"
          compact
        />
      </div>
    ) },
    { key: 'buyer', header: 'Buyer', render: (share: BrokerContractShare) => share.buyer_name },
    { key: 'seller', header: 'Seller', render: (share: BrokerContractShare) => share.seller_name },
    { key: 'commodity', header: 'Commodity', render: (share: BrokerContractShare) => share.item_name || '—' },
    { key: 'quantity', header: 'Qty', className: 'text-right', render: (share: BrokerContractShare) => (
      <span className="tabular-nums">{formatMt(parseFloat(share.quantity) || 0)}</span>
    )},
    { key: 'rate', header: RATE_COLUMN_HEADER, render: (share: BrokerContractShare) => {
      const rate = parseIndianAmount(share.rate)
      return rate ? formatIndianAmount(rate) : '—'
    }, className: 'text-right' },
    { key: 'value', header: 'Value', render: (share: BrokerContractShare) => (
      <span className="font-medium">{formatCurrency(shareValue(share))}</span>
    ), className: 'text-right' },
    { key: 'deliveryDate', header: 'Delivery', render: (share: BrokerContractShare) => (
      <span className="tabular-nums">{deliveryLabel(share.delivery_period)}</span>
    )},
    { key: 'paymentStatus', header: 'Payment', render: (share: BrokerContractShare) => share.payment_terms || '—' },
    { key: 'actions', header: '', render: (share: BrokerContractShare) => (
      tab === 'deleted' ? null : (
        <DetailPanelMenu
          tableTrigger={classes.menuTrigger}
          items={[
            {
              type: 'link',
              label: 'Edit',
              icon: Pencil,
              href: appPath(`/contract-shares/${share.id}/edit`),
            },
            {
              type: 'button',
              label: 'Delete',
              icon: Trash2,
              tone: 'danger',
              onClick: () => {
                setDeleteError('')
                setPendingDelete(share)
              },
            },
          ]}
        />
      )
    )},
  ]

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Contract Confirmations"
        subtitle={`${filtered.length} contracts`}
        breadcrumb={<Breadcrumb items={[{ label: 'Tradeal', href: appPath('/') }, { label: 'Contracts' }]} />}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4" /> Export</Button>
            <Button size="sm" to={appPath('/contracts/new')}><Plus className="h-4 w-4" /> New Contract</Button>
          </>
        }
      />

      <Tabs
        className="mb-4"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'pending', label: 'Pending', count: counts.pending },
          { id: 'completed', label: 'Completed', count: counts.completed },
          { id: 'deleted', label: 'Deleted', count: counts.deleted },
        ]}
      />

      <FilterBar>
        <div className="w-64">
          <Input icon placeholder="Search contracts..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
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
            title={filteredOut
              ? 'No contracts match your search'
              : tab === 'completed'
                ? 'No completed contracts'
                : tab === 'deleted'
                  ? 'No deleted contracts'
                  : 'No pending contracts'}
            description={filteredOut
              ? 'Try a different contract, buyer, seller, or commodity.'
              : tab === 'completed'
                ? 'A contract moves here when the full quantity has been delivered.'
                : tab === 'deleted'
                  ? 'Contracts you delete stay here.'
                  : 'Create a contract confirmation to get started.'}
            action={
              filteredOut ? (
                <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                  Clear search
                </Button>
              ) : tab === 'pending' ? (
                <Button size="sm" to={appPath('/contracts/new')}><Plus className="h-4 w-4" /> New Contract</Button>
              ) : undefined
            }
          />
        }
        onRowClick={openShare}
        stickyFirstColumn
        stickyLastColumn
        selectedRows={selectedRows}
        onSelectRow={id => setSelectedRows(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
        onSelectAllVisible={(select, ids) => {
          setSelectedRows(prev => select
            ? [...new Set([...prev, ...ids])]
            : prev.filter(id => !ids.includes(id)))
        }}
        getRowId={share => String(share.id)}
      />

      <ConfirmDeleteModal
        open={pendingDelete != null}
        onClose={() => { setPendingDelete(null); setDeleteError('') }}
        onConfirm={removeShare}
        title="Delete contract"
        error={deleteError}
      >
        <p className="text-sm text-gray-600 dark:text-gray-300">
          <span className="font-medium text-heading">{pendingDelete?.contract_ref}</span> will move to Deleted. The buyer and the seller will be notified.
        </p>
      </ConfirmDeleteModal>
    </div>
  )
}
