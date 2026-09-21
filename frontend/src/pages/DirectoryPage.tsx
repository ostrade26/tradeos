import { useMemo, useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Pencil, Plus, BookUser } from 'lucide-react'
import { PageHeader, FilterBar } from '../components/ui/CommandPalette'
import { Breadcrumb, Tabs, EmptyState } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { DataTable } from '../components/ui/DataTable'
import { Modal } from '../components/ui/Drawer'
import { BlockedDeleteModal, ConfirmDeleteModal, DeleteActionButton } from '../components/ui/DeleteActions'
import { useTradeStore } from '../store/TradeStore'
import { useToast } from '../hooks/useToast'
import type { Broker, Producer, Retailer } from '../data/mockData'
import {
  BrokerBrokerageForm,
  emptyBrokerBrokerageForm,
  type BrokerBrokerageFormState,
} from '../components/directory/BrokerBrokerageForm'
import {
  PartyFormModal,
  emptyPartyFormValues,
  partyEntryToFormValues,
  partyFormToInput,
  type PartyFormValues,
} from '../components/directory/PartyFormModal'
import {
  brokerBrokerageSummary,
  brokerToFormRows,
  formRowsToItemBrokerages,
  formValueToBrokerageTerms,
} from '../lib/brokerBrokerage'
import { formatIndianAmount } from '../lib/indianAmount'
import { normalizeCompanyName } from '../lib/companyResolution'
import type { BrokerageTerms } from '../data/mockData'
import { Badge } from '../components/ui/Badge'

const tabs = ['parties', 'brokers'] as const
type DirectoryTab = typeof tabs[number]

function normalizeTab(value: string | null): DirectoryTab {
  if (value === 'producers' || value === 'retailers') return 'parties'
  if (value === 'brokers') return 'brokers'
  return 'parties'
}

const tabLabels: Record<DirectoryTab, string> = {
  brokers: 'Broker',
  parties: 'Party',
}

type PartyKind = 'producer' | 'retailer'

type PartyEntry = (Producer | Retailer) & {
  kind: PartyKind
  kinds: PartyKind[]
  producerId?: string
  retailerId?: string
}

function partyRoleLabel(kinds: PartyKind[]): string {
  const seller = kinds.includes('producer')
  const buyer = kinds.includes('retailer')
  if (seller && buyer) return 'Seller · Buyer'
  if (seller) return 'Seller'
  return 'Buyer'
}

function mergePartyFields(a: Producer | Retailer, b: Producer | Retailer): Producer | Retailer {
  const location = (() => {
    const left = (a.city || a.location || '').trim()
    const right = (b.city || b.location || '').trim()
    if (!left) return right
    if (!right) return left
    const l = left.toLowerCase()
    const r = right.toLowerCase()
    if (l.includes(r) && l !== r) return left
    if (r.includes(l) && r !== l) return right
    const leftParts = left.split(',').filter(Boolean).length
    const rightParts = right.split(',').filter(Boolean).length
    if (leftParts !== rightParts) return leftParts > rightParts ? left : right
    return left.length >= right.length ? left : right
  })()
  return {
    ...a,
    ...b,
    id: a.id,
    name: a.name.trim().length >= b.name.trim().length ? a.name : b.name,
    location,
    city: location || a.city || b.city,
    code: a.code || b.code,
    phone: a.phone || b.phone,
    email: a.email || b.email,
    gst: a.gst || b.gst,
    products: [...new Set([...(a.products ?? []), ...(b.products ?? [])])],
  }
}

type BrokerFormState = {
  name: string
  email: string
  phone: string
  brokerage: BrokerBrokerageFormState
}

const emptyBrokerForm = (): BrokerFormState => ({
  name: '',
  email: '',
  phone: '',
  brokerage: emptyBrokerBrokerageForm,
})

function termsToFormFields(terms?: BrokerageTerms) {
  if (!terms) {
    return { mode: 'perTon' as const, value: '' }
  }
  return {
    mode: terms.mode,
    value: terms.mode === 'percent' ? String(terms.value) : formatIndianAmount(terms.value),
  }
}

function brokerToForm(b: Broker): BrokerFormState {
  const purchase = termsToFormFields(b.purchaseBrokerage)
  const sale = termsToFormFields(b.saleBrokerage)
  return {
    name: b.name,
    email: b.email,
    phone: b.phone,
    brokerage: {
      purchaseBrokerageMode: purchase.mode,
      purchaseBrokerageValue: purchase.value,
      saleBrokerageMode: sale.mode,
      saleBrokerageValue: sale.value,
      itemBrokerages: brokerToFormRows(b),
    },
  }
}

export function DirectoryPage() {
  const store = useTradeStore()
  const toast = useToast()
  const {
    brokers, producers, retailers, items,
    addBroker, updateBroker, deleteBroker, canDeleteBroker,
    addProducer, updateProducer, deleteProducer, canDeleteProducer,
    updateRetailer, deleteRetailer, canDeleteRetailer,
  } = store
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const urlQ = searchParams.get('q')
  const active: DirectoryTab = normalizeTab(tabParam)

  const [search, setSearch] = useState('')

  useEffect(() => {
    if (urlQ) setSearch(urlQ)
  }, [urlQ])

  const [brokerFormOpen, setBrokerFormOpen] = useState(false)
  const [brokerEditId, setBrokerEditId] = useState<string | null>(null)
  const [brokerFormError, setBrokerFormError] = useState('')
  const [brokerForm, setBrokerForm] = useState(emptyBrokerForm)

  const [partyFormOpen, setPartyFormOpen] = useState(false)
  const [partyEditId, setPartyEditId] = useState<string | null>(null)
  const [partyEditKind, setPartyEditKind] = useState<PartyKind>('producer')
  const [partyInitial, setPartyInitial] = useState<Partial<PartyFormValues> | null>(null)
  const [partySaving, setPartySaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    name: string
    kind?: PartyKind
    producerId?: string
    retailerId?: string
  } | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [blockedDelete, setBlockedDelete] = useState<{ name: string; reason: string } | null>(null)

  const setTab = (id: string) => {
    setSearch('')
    setSearchParams(id === 'parties' ? {} : { tab: id }, { replace: true })
  }

  const openAdd = () => {
    if (active === 'brokers') {
      setBrokerEditId(null)
      setBrokerForm(emptyBrokerForm())
      setBrokerFormError('')
      setBrokerFormOpen(true)
      return
    }
    setPartyEditId(null)
    setPartyEditKind('producer')
    setPartyInitial(emptyPartyFormValues())
    setPartyFormOpen(true)
  }

  const openEditParty = (entry: PartyEntry) => {
    setPartyEditId(entry.id)
    setPartyEditKind(entry.kind)
    setPartyInitial(partyEntryToFormValues(entry))
    setPartyFormOpen(true)
  }

  const openEditBroker = (entry: Broker) => {
    setBrokerEditId(entry.id)
    setBrokerForm(brokerToForm(entry))
    setBrokerFormError('')
    setBrokerFormOpen(true)
  }

  const closeBrokerForm = () => {
    setBrokerFormOpen(false)
    setBrokerEditId(null)
    setBrokerFormError('')
  }

  const handleSaveBroker = async () => {
    setBrokerFormError('')
    try {
      const input = {
        name: brokerForm.name,
        email: brokerForm.email,
        phone: brokerForm.phone,
        purchaseBrokerage: formValueToBrokerageTerms(
          brokerForm.brokerage.purchaseBrokerageMode,
          brokerForm.brokerage.purchaseBrokerageValue,
        ),
        saleBrokerage: formValueToBrokerageTerms(
          brokerForm.brokerage.saleBrokerageMode,
          brokerForm.brokerage.saleBrokerageValue,
        ),
        itemBrokerages: formRowsToItemBrokerages(brokerForm.brokerage.itemBrokerages),
      }
      if (brokerEditId) {
        await updateBroker(brokerEditId, input)
        toast.success('Broker updated', { description: brokerForm.name.trim() })
      } else {
        await addBroker(input)
        toast.success('Broker added', { description: brokerForm.name.trim() })
      }
      closeBrokerForm()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save'
      setBrokerFormError(message)
      toast.error('Could not save broker', { description: message })
    }
  }

  const handleSaveParty = async (values: PartyFormValues) => {
    setPartySaving(true)
    try {
      const input = partyFormToInput(values)
      if (partyEditId) {
        const priorKey = normalizeCompanyName(partyInitial?.name ?? input.name)
        const nextKey = normalizeCompanyName(input.name)
        const twinProducer = producers.find(p => {
          const key = normalizeCompanyName(p.name)
          return (key === priorKey || key === nextKey) && p.id !== partyEditId
        })
        const twinRetailer = retailers.find(r => {
          const key = normalizeCompanyName(r.name)
          return (key === priorKey || key === nextKey) && r.id !== partyEditId
        })
        if (partyEditKind === 'producer') {
          await updateProducer(partyEditId, input)
          if (twinRetailer) await updateRetailer(twinRetailer.id, input)
        } else {
          await updateRetailer(partyEditId, input)
          if (twinProducer) await updateProducer(twinProducer.id, input)
        }
        toast.success('Party updated', { description: input.name })
      } else {
        await addProducer(input)
        toast.success('Party added', { description: input.name })
      }
      setPartyFormOpen(false)
      setPartyEditId(null)
      setPartyInitial(null)
    } catch (err) {
      toast.error('Could not save party', {
        description: err instanceof Error ? err.message : 'Failed to save',
      })
      throw err
    } finally {
      setPartySaving(false)
    }
  }

  const canDeleteParty = (entry: PartyEntry) => {
    const checks = []
    if (entry.producerId) checks.push(canDeleteProducer(entry.producerId))
    if (entry.retailerId) checks.push(canDeleteRetailer(entry.retailerId))
    if (checks.length === 0) {
      checks.push(
        entry.kind === 'retailer' ? canDeleteRetailer(entry.id) : canDeleteProducer(entry.id),
      )
    }
    const blocked = checks.find(c => !c.ok)
    return blocked ?? { ok: true as const }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteError('')
    const name = deleteTarget.name
    try {
      if (active === 'brokers') {
        await deleteBroker(deleteTarget.id)
      } else {
        if (deleteTarget.producerId) await deleteProducer(deleteTarget.producerId)
        else if (deleteTarget.kind === 'producer') await deleteProducer(deleteTarget.id)
        if (deleteTarget.retailerId) await deleteRetailer(deleteTarget.retailerId)
        else if (deleteTarget.kind === 'retailer' && !deleteTarget.producerId) await deleteRetailer(deleteTarget.id)
      }
      toast.success(`${tabLabels[active]} removed`, { description: name })
      setDeleteTarget(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not delete'
      setDeleteError(message)
      toast.error(`Could not remove ${tabLabels[active].toLowerCase()}`, { description: message })
    }
  }

  const partyActionsColumn = {
    key: 'actions',
    header: '',
    className: 'text-center',
    actionsWide: 'compact' as const,
    render: (r: PartyEntry) => (
      <div className="flex items-center justify-center gap-1">
        <button
          type="button"
          title={`Edit ${r.name}`}
          aria-label={`Edit ${r.name}`}
          onClick={e => { e.stopPropagation(); openEditParty(r) }}
          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-muted hover:text-accent hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <DeleteActionButton
          label={r.name}
          check={canDeleteParty(r)}
          className="inline-flex min-h-9 min-w-9 items-center justify-center"
          onDelete={() => {
            setDeleteError('')
            setDeleteTarget({
              id: r.id,
              name: r.name,
              kind: r.kind,
              producerId: r.producerId,
              retailerId: r.retailerId,
            })
          }}
          onBlocked={reason => setBlockedDelete({ name: r.name, reason })}
        />
      </div>
    ),
  }

  const actionsColumn = {
    key: 'actions',
    header: '',
    className: 'text-center',
    actionsWide: 'compact' as const,
    render: (r: Broker) => (
      <div className="flex items-center justify-center gap-1">
        <button
          type="button"
          title={`Edit ${r.name}`}
          aria-label={`Edit ${r.name}`}
          onClick={e => { e.stopPropagation(); openEditBroker(r) }}
          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-muted hover:text-accent hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <DeleteActionButton
          label={r.name}
          check={canDeleteBroker(r.id)}
          className="inline-flex min-h-9 min-w-9 items-center justify-center"
          onDelete={() => {
            setDeleteError('')
            setDeleteTarget({ id: r.id, name: r.name })
          }}
          onBlocked={reason => setBlockedDelete({ name: r.name, reason })}
        />
      </div>
    ),
  }

  const filteredBrokers = useMemo(() => {
    const q = search.toLowerCase()
    return brokers.filter(b =>
      b.name.toLowerCase().includes(q)
      || b.email.toLowerCase().includes(q)
      || b.phone.toLowerCase().includes(q)
    )
  }, [brokers, search])

  const filteredParties = useMemo(() => {
    const q = search.toLowerCase()
    const match = (p: Producer | Retailer) =>
      p.name.toLowerCase().includes(q)
      || (p.code ?? '').toLowerCase().includes(q)
      || (p.city || p.location || '').toLowerCase().includes(q)
      || (p.phone ?? '').toLowerCase().includes(q)
      || (p.gst ?? '').toLowerCase().includes(q)
      || p.products.some(prod => prod.toLowerCase().includes(q))

    const byKey = new Map<string, PartyEntry>()
    for (const p of producers) {
      if (!match(p)) continue
      const key = normalizeCompanyName(p.name)
      if (!key) continue
      const existing = byKey.get(key)
      if (!existing) {
        byKey.set(key, {
          ...p,
          kind: 'producer',
          kinds: ['producer'],
          producerId: p.id,
        })
        continue
      }
      byKey.set(key, {
        ...mergePartyFields(existing, p),
        kind: existing.kind,
        kinds: [...new Set([...existing.kinds, 'producer' as const])],
        producerId: p.id,
        retailerId: existing.retailerId,
      })
    }
    for (const r of retailers) {
      if (!match(r)) continue
      const key = normalizeCompanyName(r.name)
      if (!key) continue
      const existing = byKey.get(key)
      if (!existing) {
        byKey.set(key, {
          ...r,
          kind: 'retailer',
          kinds: ['retailer'],
          retailerId: r.id,
        })
        continue
      }
      byKey.set(key, {
        ...mergePartyFields(existing, r),
        kind: existing.kinds.includes('producer') ? 'producer' : 'retailer',
        kinds: [...new Set([...existing.kinds, 'retailer' as const])],
        producerId: existing.producerId,
        retailerId: r.id,
      })
    }
    return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [producers, retailers, search])

  const partyCount = useMemo(() => {
    const keys = new Set<string>()
    for (const p of producers) {
      const key = normalizeCompanyName(p.name)
      if (key) keys.add(key)
    }
    for (const r of retailers) {
      const key = normalizeCompanyName(r.name)
      if (key) keys.add(key)
    }
    return keys.size
  }, [producers, retailers])

  const hasActiveSearch = search.trim() !== ''
  const emptyState = (
    <EmptyState
      icon={<BookUser className="h-10 w-10" />}
      title={hasActiveSearch ? `No ${active === 'parties' ? 'parties' : active} match your search` : `No ${active === 'parties' ? 'parties' : active} yet`}
      description={
        hasActiveSearch
          ? 'Try adjusting your search.'
          : `Add a ${tabLabels[active].toLowerCase()} to get started.`
      }
      action={
        hasActiveSearch ? (
          <Button variant="outline" size="sm" onClick={() => setSearch('')}>Clear search</Button>
        ) : (
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add {tabLabels[active]}
          </Button>
        )
      }
    />
  )

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Directory"
        subtitle="People you trade with — brokers and parties"
        breadcrumb={<Breadcrumb items={[{ label: 'Tradeal', href: '/' }, { label: 'Directory' }]} />}
        actions={
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add {tabLabels[active]}
          </Button>
        }
      />

      <Tabs
        className="mb-4"
        tabs={[
          { id: 'parties', label: 'Parties', count: partyCount },
          { id: 'brokers', label: 'Brokers', count: brokers.length },
        ]}
        active={active}
        onChange={setTab}
      />

      <FilterBar>
        <div className="w-full sm:w-72">
          <Input
            icon
            placeholder={`Search ${active === 'parties' ? 'parties' : active}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </FilterBar>

      {active === 'brokers' && (
        <DataTable<Broker>
          data={filteredBrokers}
          emptyState={emptyState}
          columns={[
            { key: 'name', header: 'Name', render: r => (
              <Link to={`/party?name=${encodeURIComponent(r.name)}`} className="font-medium text-heading hover:text-accent">
                {r.name}
              </Link>
            )},
            { key: 'email', header: 'Email', render: r => r.email || '—' },
            { key: 'phone', header: 'Phone', render: r => r.phone || '—' },
            {
              key: 'brokerage',
              header: 'Brokerage',
              className: 'hidden lg:table-cell',
              render: r => (
                <span className="text-sm text-gray-500">{brokerBrokerageSummary(r)}</span>
              ),
            },
            actionsColumn,
          ]}
        />
      )}
      {active === 'parties' && (
        <DataTable<PartyEntry>
          data={filteredParties}
          emptyState={emptyState}
          columns={[
            { key: 'code', header: 'Code', className: 'hidden sm:table-cell', render: r => r.code || '—' },
            { key: 'name', header: 'Name', render: r => (
              <Link to={`/party?name=${encodeURIComponent(r.name)}`} className="font-medium text-heading hover:text-accent">
                {r.name}
              </Link>
            )},
            {
              key: 'role',
              header: 'Role',
              className: 'hidden md:table-cell',
              render: r => <Badge variant="default">{partyRoleLabel(r.kinds)}</Badge>,
            },
            { key: 'city', header: 'City', render: r => r.city || r.location || '—' },
            { key: 'phone', header: 'Phone', className: 'hidden md:table-cell', render: r => r.phone || '—' },
            { key: 'gst', header: 'GST', className: 'hidden lg:table-cell', render: r => r.gst || '—' },
            partyActionsColumn,
          ]}
        />
      )}

      <Modal
        open={brokerFormOpen}
        onClose={closeBrokerForm}
        title={`${brokerEditId ? 'Edit' : 'Add'} Broker`}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={closeBrokerForm}>Cancel</Button>
            <Button onClick={() => void handleSaveBroker()}>{brokerEditId ? 'Update' : 'Save'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Name"
            placeholder="Broker name"
            value={brokerForm.name}
            onChange={e => setBrokerForm(f => ({ ...f, name: e.target.value }))}
            autoFocus
          />
          <Input
            label="Email"
            type="email"
            placeholder="email@example.com"
            value={brokerForm.email}
            onChange={e => setBrokerForm(f => ({ ...f, email: e.target.value }))}
          />
          <Input
            label="Phone"
            placeholder="+91 ..."
            value={brokerForm.phone}
            onChange={e => setBrokerForm(f => ({ ...f, phone: e.target.value }))}
          />
          <BrokerBrokerageForm
            value={brokerForm.brokerage}
            onChange={brokerage => setBrokerForm(f => ({ ...f, brokerage }))}
            itemOptions={items}
          />
          {brokerFormError && <p className="text-sm text-danger">{brokerFormError}</p>}
        </div>
      </Modal>

      <PartyFormModal
        open={partyFormOpen}
        onClose={() => {
          if (partySaving) return
          setPartyFormOpen(false)
          setPartyEditId(null)
          setPartyInitial(null)
        }}
        title={`${partyEditId ? 'Edit' : 'Add'} Party`}
        initial={partyInitial}
        saving={partySaving}
        onSave={handleSaveParty}
      />

      <ConfirmDeleteModal
        open={!!deleteTarget}
        onClose={() => { setDeleteTarget(null); setDeleteError('') }}
        onConfirm={handleConfirmDelete}
        title={`Delete ${tabLabels[active]}?`}
        error={deleteError}
      >
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Remove <span className="font-medium text-heading">{deleteTarget?.name}</span> from the directory?
          This cannot be undone.
        </p>
      </ConfirmDeleteModal>

      <BlockedDeleteModal
        open={!!blockedDelete}
        onClose={() => setBlockedDelete(null)}
        name={blockedDelete?.name ?? ''}
        reason={blockedDelete?.reason ?? ''}
      />
    </div>
  )
}
