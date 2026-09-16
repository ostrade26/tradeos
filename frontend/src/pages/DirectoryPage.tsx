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
  brokerBrokerageSummary,
  brokerToFormRows,
  formRowsToItemBrokerages,
  formValueToBrokerageTerms,
} from '../lib/brokerBrokerage'
import { formatIndianAmount } from '../lib/indianAmount'
import type { BrokerageTerms } from '../data/mockData'

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

type PartyEntry = (Producer | Retailer) & { kind: PartyKind }

const emptyForm: DirectoryFormState = {
  name: '',
  email: '',
  phone: '',
  location: '',
  products: '',
  brokerage: emptyBrokerBrokerageForm,
}

type DirectoryEntry = Broker | Producer | Retailer

function termsToFormFields(terms?: BrokerageTerms) {
  if (!terms) {
    return { mode: 'perTon' as const, value: '' }
  }
  return {
    mode: terms.mode,
    value: terms.mode === 'percent' ? String(terms.value) : formatIndianAmount(terms.value),
  }
}

function entryToForm(entry: DirectoryEntry, tab: DirectoryTab) {
  if (tab === 'brokers') {
    const b = entry as Broker
    const purchase = termsToFormFields(b.purchaseBrokerage)
    const sale = termsToFormFields(b.saleBrokerage)
    return {
      name: b.name,
      email: b.email,
      phone: b.phone,
      location: '',
      products: '',
      brokerage: {
        purchaseBrokerageMode: purchase.mode,
        purchaseBrokerageValue: purchase.value,
        saleBrokerageMode: sale.mode,
        saleBrokerageValue: sale.value,
        itemBrokerages: brokerToFormRows(b),
      } satisfies BrokerBrokerageFormState,
    }
  }
  const p = entry as Producer | Retailer
  return {
    name: p.name,
    email: '',
    phone: '',
    location: p.location,
    products: p.products.join(', '),
    brokerage: emptyBrokerBrokerageForm,
  }
}

function partyEntryToForm(entry: PartyEntry) {
  return entryToForm(entry, 'parties')
}

type DirectoryFormState = ReturnType<typeof entryToForm>

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
  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; kind?: PartyKind } | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [blockedDelete, setBlockedDelete] = useState<{ name: string; reason: string } | null>(null)

  const setTab = (id: string) => {
    setSearch('')
    setSearchParams(id === 'parties' ? {} : { tab: id }, { replace: true })
  }

  const [partyEditKind, setPartyEditKind] = useState<PartyKind>('producer')

  const openAdd = () => {
    setEditId(null)
    setPartyEditKind('producer')
    setForm(emptyForm)
    setFormError('')
    setFormOpen(true)
  }

  const openEdit = (entry: DirectoryEntry | PartyEntry) => {
    setEditId(entry.id)
    if (active === 'parties' && 'kind' in entry) {
      setPartyEditKind(entry.kind)
      setForm(partyEntryToForm(entry))
    } else {
      setForm(entryToForm(entry as DirectoryEntry, active))
    }
    setFormError('')
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditId(null)
    setFormError('')
  }

  const handleSave = async () => {
    setFormError('')
    try {
      const label = tabLabels[active]
      if (active === 'brokers') {
        const input = {
          name: form.name,
          email: form.email,
          phone: form.phone,
          purchaseBrokerage: formValueToBrokerageTerms(
            form.brokerage.purchaseBrokerageMode,
            form.brokerage.purchaseBrokerageValue,
          ),
          saleBrokerage: formValueToBrokerageTerms(
            form.brokerage.saleBrokerageMode,
            form.brokerage.saleBrokerageValue,
          ),
          itemBrokerages: formRowsToItemBrokerages(form.brokerage.itemBrokerages),
        }
        if (editId) {
          await updateBroker(editId, input)
          toast.success(`${label} updated`, { description: form.name.trim() })
        } else {
          await addBroker(input)
          toast.success(`${label} added`, { description: form.name.trim() })
        }
      } else if (active === 'parties') {
        const input = { name: form.name, location: form.location, products: form.products }
        if (editId) {
          if (partyEditKind === 'producer') {
            await updateProducer(editId, input)
          } else {
            await updateRetailer(editId, input)
          }
          toast.success(`${label} updated`, { description: form.name.trim() })
        } else {
          await addProducer(input)
          toast.success(`${label} added`, { description: form.name.trim() })
        }
      }
      closeForm()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save'
      setFormError(message)
      toast.error(`Could not save ${tabLabels[active].toLowerCase()}`, { description: message })
    }
  }

  const canDelete = (id: string, kind?: PartyKind) => {
    if (active === 'brokers') return canDeleteBroker(id)
    return kind === 'retailer' ? canDeleteRetailer(id) : canDeleteProducer(id)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteError('')
    const name = deleteTarget.name
    try {
      if (active === 'brokers') await deleteBroker(deleteTarget.id)
      else if (deleteTarget.kind === 'retailer') await deleteRetailer(deleteTarget.id)
      else await deleteProducer(deleteTarget.id)
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
    className: 'w-24 text-right',
    render: (r: PartyEntry) => (
      <div className="flex items-center justify-end gap-0.5">
        <button
          type="button"
          title={`Edit ${r.name}`}
          aria-label={`Edit ${r.name}`}
          onClick={e => { e.stopPropagation(); openEdit(r) }}
          className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <DeleteActionButton
          label={r.name}
          check={canDelete(r.id, r.kind)}
          onDelete={() => {
            setDeleteError('')
            setDeleteTarget({ id: r.id, name: r.name, kind: r.kind })
          }}
          onBlocked={reason => setBlockedDelete({ name: r.name, reason })}
        />
      </div>
    ),
  }

  const actionsColumn = {
    key: 'actions',
    header: '',
    className: 'w-24 text-right',
    render: (r: DirectoryEntry) => (
      <div className="flex items-center justify-end gap-0.5">
        <button
          type="button"
          title={`Edit ${r.name}`}
          aria-label={`Edit ${r.name}`}
          onClick={e => { e.stopPropagation(); openEdit(r) }}
          className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <DeleteActionButton
          label={r.name}
          check={canDelete(r.id)}
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
      || p.location.toLowerCase().includes(q)
      || p.products.some(prod => prod.toLowerCase().includes(q))
    return [
      ...producers.filter(match).map(p => ({ ...p, kind: 'producer' as const })),
      ...retailers.filter(match).map(r => ({ ...r, kind: 'retailer' as const })),
    ].sort((a, b) => a.name.localeCompare(b.name))
  }, [producers, retailers, search])

  const partyCount = producers.length + retailers.length

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
  const formTitle = `${editId ? 'Edit' : 'Add'} ${tabLabels[active]}`

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
              { key: 'name', header: 'Name', render: r => (
                <Link to={`/party?name=${encodeURIComponent(r.name)}`} className="font-medium text-heading hover:text-accent">
                  {r.name}
                </Link>
              )},
              { key: 'location', header: 'Location', render: r => r.location || '—' },
              { key: 'products', header: 'Products', render: r => r.products.length ? r.products.join(', ') : '—' },
              partyActionsColumn,
            ]}
          />
        )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={formTitle}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button onClick={handleSave}>{editId ? 'Update' : 'Save'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Name"
            placeholder={`${tabLabels[active]} name`}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            autoFocus
          />
          {active === 'brokers' && (
            <>
              <Input
                label="Email"
                type="email"
                placeholder="email@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
              <Input
                label="Phone"
                placeholder="+91 ..."
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              />
              <BrokerBrokerageForm
                value={form.brokerage}
                onChange={brokerage => setForm(f => ({ ...f, brokerage }))}
                itemOptions={items}
              />
            </>
          )}
          {(active === 'parties') && (
            <>
              <Input
                label="Location"
                placeholder="City, state"
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              />
              <Input
                label="Products"
                placeholder="Palm Oil, Soybean (comma-separated)"
                value={form.products}
                onChange={e => setForm(f => ({ ...f, products: e.target.value }))}
              />
            </>
          )}
          {formError && <p className="text-sm text-danger">{formError}</p>}
        </div>
      </Modal>

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
