import { useState, useEffect, useMemo, useRef, useCallback, type Dispatch, type SetStateAction } from 'react'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Package, FileText, FileUp } from 'lucide-react'
import { PageHeader } from '../components/ui/CommandPalette'
import { serializeOrderFormValues } from '../lib/unsavedChanges'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'
import { Breadcrumb, EmptyState } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { DatePicker } from '../components/ui/DatePicker'
import { QtyInput } from '../components/ui/QtyInput'
import { AmountInput } from '../components/ui/AmountInput'
import { BrokerageInput } from '../components/ui/BrokerageInput'
import { Select } from '../components/ui/Select'
import { SearchableSelect, companyToSelectOption, stringsToOptions, type SearchableSelectOption } from '../components/ui/SearchableSelect'
import { Card } from '../components/ui/Card'
import { ShareWhatsAppButton } from '../components/ui/ShareWhatsAppButton'
import { StickyFormActions } from '../components/ui/StickyFormActions'
import { FormErrorBanner, FieldValidationBanner } from '../components/ui/FieldError'
import { useToast } from '../hooks/useToast'
import { OrderCreatedModal } from '../components/orders/OrderCreatedModal'
import { ContractPdfUpload } from '../components/orders/ContractPdfUpload'
import { CaptionCard } from '../components/ui/CaptionCard'
import {
  PartyFormModal,
  partyFormToInput,
  type PartyFormValues,
} from '../components/directory/PartyFormModal'
import { formatDate, formatCurrency, formatQty, roundQtyMt, availableQtyClass, cn } from '../lib/utils'
import { soRemainingQtyClass } from '../components/ui/AvailableQtyHint'
import { type OrderSide, type DeliveryType, type TradeOrder, toBeLifted } from '../data/mockData'
import { lockedAccountPartyFields, displayPartyConfirmedBy } from '../lib/accountBuyer'
import { useAccountTrader } from '../lib/useAccountTrader'
import { parseIndianAmount, formatIndianAmount } from '../lib/indianAmount'
import { formatContractRate, orderLineAmount, parseRateNumber, rateInputLabel, syncedRateFields } from '../lib/orderRate'
import { brokerageTypeFromOrder, orderToFormValues } from '../lib/orderForm'
import {
  brokerageTermsToFormPatch,
  resolveBrokerageTerms,
} from '../lib/brokerBrokerage'
import { formatDeletionDate } from '../lib/orderDeletion'
import { canonicalItemName, collectItemNames, itemMatches } from '../lib/itemResolution'
import { shareOrderOnWhatsApp } from '../lib/whatsappShare'
import { partyMatches } from '../lib/assistant/partyMatch'
import { appPath } from '../lib/appShellMode'
import { useTradeStore } from '../store/TradeStore'
import { orderDropdownOption } from '../lib/orderSelectOptions'

function useStateForm(initial: Record<string, string>) {
  const [values, setValues] = useState(initial)
  const set = (key: string, val: string) => setValues(v => ({ ...v, [key]: val }))
  return { ...values, set, values, setValues } as FormApi
}

type FormApi = Record<string, string> & {
  set: (key: string, val: string) => void
  values: Record<string, string>
  setValues: Dispatch<SetStateAction<Record<string, string>>>
}

type OrderFieldErrors = Partial<Record<
  'partyName' | 'itemName' | 'quantity' | 'rate' | 'date' | 'deliveryPeriodStart' | 'deliveryPeriodEnd',
  string
>>

function hasManualEntryProgress(values: Record<string, string>): boolean {
  return !!(
    values.partyName.trim()
    || values.itemName.trim()
    || values.quantity.trim()
    || values.rate.trim()
    || values.brokerContractRef.trim()
  )
}

function withPlaceholder(options: SearchableSelectOption[], label = 'Select...'): SearchableSelectOption[] {
  return [{ value: '', label }, ...options]
}

function mergePartyOption(existing: SearchableSelectOption, incoming: SearchableSelectOption): SearchableSelectOption {
  return {
    ...existing,
    ...incoming,
    description: incoming.description || existing.description,
    keywords: [existing.keywords, incoming.keywords].filter(Boolean).join(' ') || undefined,
  }
}

function buildAllPartyOptions(
  companies: ReturnType<typeof useTradeStore>['companies'],
  producers: { id: string; name: string; location?: string }[],
  retailers: { id: string; name: string; location?: string }[],
): SearchableSelectOption[] {
  const byId = new Map<string, SearchableSelectOption>()

  for (const entry of [...producers, ...retailers]) {
    const option = {
      value: entry.id,
      label: entry.name,
      description: entry.location,
    }
    const existing = byId.get(entry.id)
    byId.set(entry.id, existing ? mergePartyOption(existing, option) : option)
  }

  for (const company of companies) {
    const option = companyToSelectOption(company)
    const existing = byId.get(company.id)
    byId.set(company.id, existing ? mergePartyOption(existing, option) : option)
  }

  const byName = new Map<string, SearchableSelectOption>()
  for (const option of byId.values()) {
    const key = option.label.trim().toLowerCase()
    const existing = byName.get(key)
    if (!existing) {
      byName.set(key, option)
      continue
    }
    const preferIncoming = Boolean(option.description) && !existing.description
    byName.set(key, preferIncoming ? mergePartyOption(existing, option) : mergePartyOption(option, existing))
  }

  return Array.from(byName.values()).sort((a, b) => a.label.localeCompare(b.label))
}

function applyPartySelection(form: FormApi, isPO: boolean, companyId: string, label: string) {
  form.set('partyName', label)
  form.set('partyCompanyId', companyId)
  if (isPO) {
    form.set('sellerCompanyId', companyId)
    form.set('sellerName', label)
  } else {
    form.set('buyerCompanyId', companyId)
    form.set('buyerName', label)
  }
}

interface OrderEntryPageProps {
  side: OrderSide
  linkedPoRef?: string
  editRef?: string
  prefill?: {
    qty?: string
    rate?: string
    buyer?: string
    broker?: string
    party?: string
    item?: string
  }
  sellFromLot?: {
    lotId: string
    lotNumber: string
    commodity: string
    available: number
  }
}

export function OrderEntryPage({ side, linkedPoRef, editRef, prefill, sellFromLot }: OrderEntryPageProps) {
  const navigate = useNavigate()
  const store = useTradeStore()
  const toast = useToast()
  const { name: accountTrader } = useAccountTrader()
  const isPO = side === 'purchase'
  const isEdit = !!editRef
  const editingOrder = isEdit ? store.getOrderByRef(editRef, side) : undefined
  const label = isPO ? 'Purchase Order' : 'Sales Order'
  const shortLabel = isPO ? 'PO' : 'SO'
  const pathPrefix = isPO ? appPath('/purchase-orders') : appPath('/sales-orders')

  const lastEntry = store.getLastOrder(side)
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<OrderFieldErrors>({})

  const clearFieldError = (key: keyof OrderFieldErrors) => {
    setFieldErrors(prev => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const form = useStateForm({
    ref: '',
    poRef: linkedPoRef ?? '',
    brokerContractRef: '',
    date: new Date().toISOString().slice(0, 10),
    partyName: '',
    partyCompanyId: '',
    sellerCompanyId: '',
    buyerCompanyId: '',
    extractedPartyName: '',
    extractedSellerName: '',
    extractedBuyerName: '',
    sellerConfirmedBy: '',
    buyerConfirmedBy: '',
    sellerName: isPO ? '' : accountTrader,
    buyerName: isPO ? accountTrader : '',
    itemName: '',
    spot: '',
    quantity: '',
    rate: '',
    contractRateDisplay: '',
    ratePerBasis: '',
    rateBasis: '',
    taxRate: '5',
    deliveryType: 'period',
    deliveryPeriodStart: new Date().toISOString().slice(0, 10),
    deliveryPeriodEnd: new Date().toISOString().slice(0, 10),
    brokerName: '',
    brokerageType: 'perTon',
    brokeragePct: '0',
    brokeragePerTon: '',
    paymentTerms: isPO ? 'Advance' : 'Against delivery',
    remarks: '',
  })

  const [pdfImported, setPdfImported] = useState(false)
  const [pdfUploadKey, setPdfUploadKey] = useState(0)
  const [createdOrder, setCreatedOrder] = useState<TradeOrder | null>(null)
  const orderBaseline = useRef('')
  const orderBaselineReady = useRef(false)

  const viewCreatedOrder = (saved: TradeOrder) => {
    setCreatedOrder(null)
    navigate(`${pathPrefix}?ref=${encodeURIComponent(saved.ref)}`)
  }

  const confirmPdfReplace = () => {
    if (pdfImported || !hasManualEntryProgress(form.values)) return true
    return window.confirm('Import from PDF? This will replace the fields you have entered.')
  }

  const applyPdfImport = (values: Record<string, string>, parsed?: import('../lib/parseContractPdf').ParsedContractPdf) => {
    const { brokerName: _importedBroker, ...imported } = values
    form.setValues(v => ({
      ...v,
      ...imported,
      ...(lockedAccountPartyFields(side, store.companies, accountTrader)),
      ref: v.ref || store.getNextRef(side),
      poRef: linkedPoRef ?? v.poRef,
      brokerName: v.brokerName,
    }))
    const itemNote = parsed?.itemName && values.itemName && parsed.itemName.trim() !== values.itemName.trim()
      ? `Item matched: ${parsed.itemName.trim()} → ${values.itemName}`
      : undefined
    toast.success('Contract imported from PDF', {
      description: itemNote ?? 'Review the pre-filled fields before saving.',
    })
    setPdfImported(true)
  }

  const clearSoEntry = () => {
    form.setValues(v => ({
      ...v,
      poRef: '',
      brokerContractRef: '',
      partyName: '',
      partyCompanyId: '',
      buyerCompanyId: '',
      extractedPartyName: '',
      extractedBuyerName: '',
      buyerConfirmedBy: '',
      buyerName: '',
      itemName: '',
      spot: '',
      quantity: '',
      rate: '',
      contractRateDisplay: '',
      ratePerBasis: '',
      rateBasis: '',
      deliveryType: 'period',
      deliveryPeriodStart: new Date().toISOString().slice(0, 10),
      deliveryPeriodEnd: new Date().toISOString().slice(0, 10),
      brokerName: '',
      brokerageType: 'perTon',
      brokeragePct: '0',
      brokeragePerTon: '',
      paymentTerms: 'Against delivery',
      remarks: '',
      ...lockedAccountPartyFields('sale', store.companies, accountTrader),
    }))
    setPdfImported(false)
    setPdfUploadKey(k => k + 1)
    setFieldErrors({})
    setSaveError('')
  }

  const syncBaselineAfterAutofill = useCallback((values: Record<string, string>) => {
    if (isEdit) {
      orderBaseline.current = serializeOrderFormValues(values)
      return
    }
    if (!pdfImported && !hasManualEntryProgress(values)) {
      orderBaseline.current = serializeOrderFormValues(values)
    }
  }, [isEdit, pdfImported])

  useEffect(() => {
    form.setValues(v => {
      const next = { ...v, ...lockedAccountPartyFields(side, store.companies, accountTrader) }
      if (isEdit || orderBaselineReady.current) syncBaselineAfterAutofill(next)
      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, store.companies, syncBaselineAfterAutofill])

  useEffect(() => {
    if (isEdit && editingOrder) {
      const loaded = {
        ...orderToFormValues(editingOrder),
        ...(lockedAccountPartyFields(side, store.companies, accountTrader)),
      }
      form.setValues(v => ({ ...v, ...loaded }))
      orderBaseline.current = serializeOrderFormValues(loaded)
      return
    }
    form.setValues(v => ({ ...v, ref: store.getNextRef(side) }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, isEdit, editingOrder?.id])

  useEffect(() => {
    if (isEdit || orderBaselineReady.current) return
    if (!form.ref) return
    syncBaselineAfterAutofill(form.values)
    orderBaselineReady.current = true
  }, [isEdit, form.ref, form.values, syncBaselineAfterAutofill])

  useEffect(() => {
    if (linkedPoRef) form.set('poRef', linkedPoRef)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedPoRef])

  useEffect(() => {
    if (isEdit || !prefill) return
    const partyLabel = (prefill.party || prefill.buyer || '').trim()
    const catalog = [
      ...(isPO ? store.producers : store.retailers),
      ...store.companies.map(c => ({ id: c.id, name: c.officialName })),
    ]
    const matched = partyLabel
      ? catalog.find(p => p.name.toLowerCase() === partyLabel.toLowerCase())
        ?? catalog.find(p => partyMatches(p.name, partyLabel))
      : undefined
    form.setValues(v => ({
      ...v,
      ...(prefill.qty ? { quantity: prefill.qty } : {}),
      ...(prefill.rate ? { rate: prefill.rate } : {}),
      ...(prefill.broker ? { brokerName: prefill.broker } : {}),
      ...(prefill.item ? { itemName: prefill.item } : {}),
      ...(matched
        ? isPO
          ? {
            partyName: matched.name,
            partyCompanyId: matched.id,
            sellerCompanyId: matched.id,
            sellerName: matched.name,
          }
          : {
            partyName: matched.name,
            partyCompanyId: matched.id,
            buyerCompanyId: matched.id,
            buyerName: matched.name,
          }
        : partyLabel
          ? isPO
            ? { partyName: partyLabel, sellerName: partyLabel }
            : { partyName: partyLabel, buyerName: partyLabel }
          : {}),
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, prefill?.qty, prefill?.rate, prefill?.buyer, prefill?.broker, prefill?.party, prefill?.item])

  const selectedPO = useMemo(
    () => store.tradeOrders.find(o => o.ref === form.poRef && o.side === 'purchase'),
    [store.tradeOrders, form.poRef],
  )

  const maxSellQty = form.poRef
    ? store.getRemainingSellQty(form.poRef) + (isEdit && editingOrder?.side === 'sale' ? editingOrder.orderQty : 0)
    : 0
  useEffect(() => {
    if (!isPO && selectedPO) {
      const broker = store.brokers.find(b => b.name === selectedPO.brokerName)
      const soTerms = broker
        ? resolveBrokerageTerms(broker, 'sale', selectedPO.itemName)
        : undefined
      form.setValues(v => ({
        ...v,
        itemName: selectedPO.itemName,
        spot: selectedPO.spot,
        deliveryType: selectedPO.deliveryType,
        deliveryPeriodStart: selectedPO.deliveryPeriodStart,
        deliveryPeriodEnd: selectedPO.deliveryPeriodEnd,
        brokerName: selectedPO.brokerName,
        ...(soTerms
          ? brokerageTermsToFormPatch(soTerms)
          : {
            brokerageType: brokerageTypeFromOrder(selectedPO),
            brokeragePct: String(selectedPO.brokeragePct),
            brokeragePerTon: selectedPO.brokeragePerTon != null ? formatIndianAmount(selectedPO.brokeragePerTon) : '',
          }),
        ...(isEdit && v.quantity ? { quantity: v.quantity } : {}),
      }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPO?.ref])

  const amount = orderLineAmount(
    parseFloat(form.quantity) || 0,
    parseRateNumber(form.rate),
    form.rateBasis,
  )

  const formDirty = pdfImported || (
    isEdit || orderBaselineReady.current
      ? serializeOrderFormValues(form.values) !== orderBaseline.current
      : hasManualEntryProgress(form.values)
  )
  const { requestLeave, dialog: unsavedDialog } = useUnsavedChangesGuard({
    dirty: formDirty,
    message: `Your ${shortLabel} has unsaved changes. Leave without saving?`,
  })

  const handleCancel = () => {
    requestLeave(() => {
      navigate(sellFromLot ? appPath(`/inventory/${sellFromLot.lotId}`) : pathPrefix)
    })
  }

  const handleSave = async () => {
    if (saving) return
    setSaveError('')
    setFieldErrors({})
    const errors: OrderFieldErrors = {}

    if (!form.partyName.trim()) {
      errors.partyName = `${isPO ? 'Seller' : 'Buyer'} name is required`
    }
    if (!form.itemName.trim()) {
      errors.itemName = 'Item name is required'
    }
    if (!form.quantity || parseFloat(form.quantity) <= 0) {
      errors.quantity = errors.quantity ?? 'Enter a valid quantity'
    }
    if (!form.rate || parseRateNumber(form.rate) <= 0) {
      errors.rate = 'Enter a valid rate'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    const account = lockedAccountPartyFields(side, store.companies, accountTrader)

    const contractRate = parseRateNumber(form.rate)
    const rateFields = syncedRateFields(contractRate)
    const itemName = canonicalItemName(
      form.itemName,
      collectItemNames({
        items: store.items,
        tradeOrders: store.tradeOrders,
        lots: store.lots,
      }),
    )

    const payload = {
      ref: form.ref,
      side,
      poRef: isPO ? undefined : (form.poRef.trim() || undefined),
      brokerContractRef: form.brokerContractRef || undefined,
      date: form.date,
      partyName: form.partyName,
      partyCompanyId: form.partyCompanyId || undefined,
      sellerCompanyId: (account.sellerCompanyId || form.sellerCompanyId) || undefined,
      buyerCompanyId: (account.buyerCompanyId || form.buyerCompanyId) || undefined,
      extractedPartyName: form.extractedPartyName || undefined,
      extractedSellerName: form.extractedSellerName || undefined,
      extractedBuyerName: form.extractedBuyerName || undefined,
      itemName,
      spot: form.spot,
      deliveryType: form.deliveryType as DeliveryType,
      deliveryPeriodStart: form.deliveryType === 'ready' ? form.date : (form.deliveryPeriodStart || form.date),
      deliveryPeriodEnd: form.deliveryType === 'ready' ? form.date : (form.deliveryPeriodEnd || form.date),
      rate: rateFields.rate,
      taxRate: parseFloat(form.taxRate) || 0,
      orderQty: parseFloat(form.quantity),
      brokerName: form.brokerName,
      brokeragePct: form.brokerageType === 'percent' ? (parseFloat(form.brokeragePct) || 0) : 0,
      brokeragePerTon: form.brokerageType === 'perTon'
        ? (parseIndianAmount(form.brokeragePerTon) || undefined)
        : undefined,
      sellerName: (account.sellerName || form.sellerName) || undefined,
      buyerName: (account.buyerName || form.buyerName) || undefined,
      sellerConfirmedBy: form.sellerConfirmedBy || undefined,
      buyerConfirmedBy: form.buyerConfirmedBy || undefined,
      contractRateDisplay: rateFields.contractRateDisplay,
      brand: form.spot || undefined,
      rateBasis: rateFields.rateBasis,
      ratePerBasis: rateFields.ratePerBasis,
      paymentTerms: form.paymentTerms,
      remarks: form.remarks,
    }

    try {
      setSaving(true)
      let saved: TradeOrder
      if (isEdit && editingOrder) {
        saved = await store.updateOrder(editingOrder.id, payload)
      } else {
        saved = await store.addOrder(payload)
      }
      const remaining = toBeLifted(saved)
      const registerHref = `${pathPrefix}?ref=${encodeURIComponent(saved.ref)}`
      if (isEdit) {
        toast.success(`${saved.ref} updated`, {
          description: `${formatQty(saved.orderQty)} · ${saved.itemName}`,
          action: remaining > 0
            ? {
              label: 'Record lift',
              to: isPO
                ? `/lifts/new?poRef=${encodeURIComponent(saved.ref)}`
                : `/lifts/new?poRef=${encodeURIComponent(saved.poRef ?? '')}&soRef=${encodeURIComponent(saved.ref)}`,
            }
            : { label: 'View register', to: registerHref },
        })
        navigate(registerHref)
      } else {
        orderBaseline.current = serializeOrderFormValues(form.values)
        orderBaselineReady.current = true
        setPdfImported(false)
        setCreatedOrder(saved)
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save order')
      toast.error('Could not save order', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  const saveHandlerRef = useRef(handleSave)
  saveHandlerRef.current = handleSave

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        saveHandlerRef.current()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const createdModal = (
    <OrderCreatedModal
      order={createdOrder}
      open={Boolean(createdOrder)}
      onClose={() => { if (createdOrder) viewCreatedOrder(createdOrder) }}
    />
  )

  if (isEdit && !editingOrder) {
    return (
      <>
        <div className="animate-fade-in w-full mx-auto max-w-3xl">
          <EmptyState
            card
            icon={<FileText className="h-10 w-10" />}
            title={`${shortLabel} not found`}
            description={`Could not find ${editRef} to edit.`}
            action={<Button to={pathPrefix}>Back to {shortLabel}s</Button>}
          />
        </div>
        {unsavedDialog}
      </>
    )
  }

  const showPdfImport = !isEdit && (isPO || (!sellFromLot && !linkedPoRef))

  if (!isPO) {
    return (
      <>
      <SOEntryForm
        store={store}
        form={form}
        selectedPO={selectedPO}
        maxSellQty={maxSellQty}
        lastEntry={lastEntry}
        amount={amount}
        saveError={saveError}
        fieldErrors={fieldErrors}
        onFieldEdit={clearFieldError}
        onSave={handleSave}
        onCancel={handleCancel}
        linkedPoRef={linkedPoRef}
        onClearAll={clearSoEntry}
        showPdfImport={showPdfImport}
        pdfUploadKey={pdfUploadKey}
        onPdfParsed={applyPdfImport}
        onBeforePdfApply={confirmPdfReplace}
        isEdit={isEdit}
        editingOrder={editingOrder}
        sellFromLot={sellFromLot}
        saveLoading={saving}
      />
      {createdModal}
      {unsavedDialog}
      </>
    )
  }

  const partyOptions = buildAllPartyOptions(store.companies, store.producers, store.retailers)

  return (
    <>
    <div className="w-full mx-auto max-w-3xl lg:max-w-5xl pb-24 sm:pb-0">
      <PageHeader
        title={isEdit ? `Edit ${label}` : `${label} Entry`}
        subtitle={isEdit ? `Update ${form.ref || editRef}` : <>Create a new purchase order<span className="hidden md:inline"> · ⌘S to save</span></>}
        breadcrumb={<Breadcrumb items={[
          { label: 'Tradeal', href: '/' },
          { label: isPO ? 'Purchase Orders' : 'Sales Orders', href: pathPrefix },
          { label: isEdit ? `Edit ${shortLabel}` : `New ${shortLabel}` },
        ]} />}
      />

      {editingOrder?.deleteScheduledAt && (
        <div className="mb-4 rounded-md border border-warning/40 bg-warning-muted px-4 py-3 text-sm text-warning">
          This {shortLabel} is scheduled for deletion on {formatDeletionDate(editingOrder.deleteScheduledAt)}.
        </div>
      )}

      {Object.keys(fieldErrors).length > 0 && (
        <FieldValidationBanner className="mb-4" />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {showPdfImport && (
            <ContractPdfUpload
              key={pdfUploadKey}
              side={side}
              onParsed={applyPdfImport}
              onBeforeApply={confirmPdfReplace}
            />
          )}
          <OrderFormFields
            isPO={isPO}
            shortLabel={shortLabel}
            form={form}
            store={store}
            partyOptions={partyOptions}
            spots={store.spots}
            brokers={store.brokers}
            isEdit={isEdit}
            fieldErrors={fieldErrors}
            onFieldEdit={clearFieldError}
            accountTrader={accountTrader}
            quantityAvailability={(() => {
              const enteredQty = parseFloat(form.quantity) || 0
              const lot = store.lots.find(l => l.lotNumber === `LOT-${form.ref || editingOrder?.ref}`)
              if (isEdit && lot) {
                return {
                  label: 'Available to sell on lot',
                  remaining: Math.max(0, enteredQty - lot.allocated),
                  detail: `${formatQty(lot.allocated)} allocated · ${formatQty(Math.max(0, enteredQty - (editingOrder?.liftedQty ?? 0)))} remaining stock`,
                }
              }
              return undefined
            })()}
          />
        </div>

        <OrderFormSidebar
          isPO={isPO}
          shortLabel={shortLabel}
          lastEntry={lastEntry}
          amount={amount}
          taxRate={form.taxRate}
          saveError={saveError}
          onSave={handleSave}
          onCancel={handleCancel}
          isEdit={isEdit}
          editingOrder={editingOrder}
          saveLoading={saving}
          saveDisabled={saving}
        />
      </div>

      <StickyFormActions
        saveLabel={isEdit ? `Update ${shortLabel}` : `Create ${shortLabel}`}
        onSave={handleSave}
        onCancel={handleCancel}
        error={saveError}
        saveLoading={saving}
        saveDisabled={saving}
      />
    </div>
    {createdModal}
    {unsavedDialog}
    </>
  )
}

function SOEntryForm({
  store,
  form,
  selectedPO,
  maxSellQty,
  lastEntry,
  amount,
  saveError,
  fieldErrors,
  onFieldEdit,
  onSave,
  onCancel,
  linkedPoRef,
  onClearAll,
  showPdfImport,
  pdfUploadKey,
  onPdfParsed,
  onBeforePdfApply,
  isEdit = false,
  editingOrder,
  sellFromLot,
  saveLoading = false,
}: {
  store: ReturnType<typeof useTradeStore>
  form: FormApi
  selectedPO?: TradeOrder
  maxSellQty: number
  lastEntry?: TradeOrder
  amount: number
  saveError: string
  fieldErrors: OrderFieldErrors
  onFieldEdit: (key: keyof OrderFieldErrors) => void
  onSave: () => void
  onCancel: () => void
  linkedPoRef?: string
  onClearAll: () => void
  showPdfImport: boolean
  pdfUploadKey: number
  onPdfParsed: (values: Record<string, string>, parsed?: import('../lib/parseContractPdf').ParsedContractPdf) => void
  onBeforePdfApply: () => boolean
  isEdit?: boolean
  editingOrder?: TradeOrder
  sellFromLot?: OrderEntryPageProps['sellFromLot']
  saveLoading?: boolean
}) {
  const { name: accountTrader } = useAccountTrader()
  const availablePOs = useMemo(() => {
    const base = store.getPOsAvailableForSO()
    if (isEdit && editingOrder?.poRef && !base.some(p => p.ref === editingOrder.poRef)) {
      const linked = store.getOrderByRef(editingOrder.poRef, 'purchase')
      return linked ? [linked, ...base] : base
    }
    return base
  }, [store, isEdit, editingOrder?.poRef])
  const partyOptions = buildAllPartyOptions(store.companies, store.producers, store.retailers)

  const poLinked = !!editingOrder?.poRef
  const qtyCap = sellFromLot?.available ?? maxSellQty
  const availableBeforeSo = qtyCap
  const hasEnteredQty = form.quantity.trim() !== ''
  const enteredQty = hasEnteredQty ? parseFloat(form.quantity) || 0 : 0
  const availableAfterSo = hasEnteredQty
    ? roundQtyMt(availableBeforeSo - enteredQty)
    : availableBeforeSo
  const showPoRowAction = !isEdit && !sellFromLot && !linkedPoRef

  const linkPoCaptions = selectedPO ? [
    { label: 'Item', value: selectedPO.itemName },
    {
      label: 'Available to sell',
      value: formatQty(maxSellQty),
      valueClassName: availableQtyClass(maxSellQty),
    },
    { label: 'Seller', value: selectedPO.sellerName || selectedPO.partyName },
  ] : undefined

  const linkPoSelect = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1">
        <Select
          label="Purchase Order (Lot)"
          options={withPlaceholder(
            availablePOs.map(po => orderDropdownOption(po, store.getRemainingSellQty(po.ref))),
            'None — link later',
          )}
          value={form.poRef}
          onChange={e => form.set('poRef', e.target.value)}
          disabled={(isEdit && poLinked) || !!sellFromLot || !!linkedPoRef}
        />
      </div>
      {showPoRowAction && selectedPO && (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 sm:mb-0.5"
          onClick={onClearAll}
        >
          Clear all
        </Button>
      )}
    </div>
  )

  return (
    <div className="animate-fade-in w-full mx-auto max-w-3xl lg:max-w-5xl pb-24 sm:pb-0">
      <PageHeader
        title={sellFromLot ? 'Sell from lot' : isEdit ? 'Edit Sales Order' : 'Sales Order Entry'}
        subtitle={
          sellFromLot
            ? <>{sellFromLot.lotNumber} · {sellFromLot.commodity} · {formatQty(sellFromLot.available)} available<span className="hidden md:inline"> · ⌘S to save</span></>
            : isEdit
              ? `Update ${form.ref}`
              : linkedPoRef
                ? <>Selling against {linkedPoRef}<span className="hidden md:inline"> · ⌘S to save</span></>
                : <>Create a sales order<span className="hidden md:inline"> · ⌘S to save</span></>
        }
        breadcrumb={sellFromLot ? (
          <Breadcrumb items={[
            { label: 'Tradeal', href: '/' },
            { label: 'Inventory', href: appPath('/inventory') },
            { label: sellFromLot.lotNumber, href: appPath(`/inventory/${sellFromLot.lotId}`) },
            { label: 'Sell' },
          ]} />
        ) : (
          <Breadcrumb items={[
            { label: 'Tradeal', href: '/' },
            { label: 'Sales Orders', href: appPath('/sales-orders') },
            { label: isEdit ? 'Edit SO' : 'New SO' },
          ]} />
        )}
      />

      {editingOrder?.deleteScheduledAt && (
        <div className="mb-4 rounded-md border border-warning/40 bg-warning-muted px-4 py-3 text-sm text-warning">
          This SO is scheduled for deletion on {formatDeletionDate(editingOrder.deleteScheduledAt)}.
        </div>
      )}

      {Object.keys(fieldErrors).length > 0 && (
        <FieldValidationBanner className="mb-4" />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <CaptionCard
            captions={linkPoCaptions}
            noteVariant={!!selectedPO}
          >
            {showPdfImport && (
              <div className="mb-5 pb-5 border-b border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileUp className="h-4 w-4 text-accent" />
                  Import from Contract PDF
                </h4>
                <ContractPdfUpload
                  key={pdfUploadKey}
                  embedded
                  side="sale"
                  onParsed={onPdfParsed}
                  onBeforeApply={onBeforePdfApply}
                />
              </div>
            )}
            <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
              <Package className="h-4 w-4 text-accent" /> {sellFromLot ? 'Purchase Order' : 'Link to Purchase Order'}
            </h3>
            {(sellFromLot || linkedPoRef) && (
              <p className="text-xs text-gray-500 mb-4">
                {sellFromLot
                  ? `Selling from ${sellFromLot.lotNumber}. This PO is linked to the lot.`
                  : `Linked to ${linkedPoRef}. Item follows this PO; other fields are editable.`}
              </p>
            )}
            {linkPoSelect}
          </CaptionCard>

          <OrderFormFields
            isPO={false}
            shortLabel="SO"
            form={form}
            store={store}
            partyOptions={partyOptions}
            spots={store.spots}
            brokers={store.brokers}
            isEdit={isEdit}
            poFieldsLocked={!!selectedPO}
            accountTrader={accountTrader}
            linkedPoRate={
              selectedPO
                ? formatContractRate(selectedPO.rate, selectedPO.rateBasis, selectedPO.ratePerBasis)
                : undefined
            }
            fieldErrors={fieldErrors}
            onFieldEdit={onFieldEdit}
            quantityAvailability={selectedPO || sellFromLot ? {
              label: 'Available after SO',
              remaining: availableAfterSo,
              before: availableBeforeSo,
              remainingClassName: soRemainingQtyClass(availableAfterSo),
            } : undefined}
            maxQty={qtyCap > 0 ? qtyCap : undefined}
            maxQtyMessage={
              selectedPO
                ? `Cannot exceed ${formatQty(qtyCap)} available on ${selectedPO.ref}`
                : sellFromLot
                  ? `Cannot exceed ${formatQty(qtyCap)} available on ${sellFromLot.lotNumber}`
                  : undefined
            }
          />
        </div>

        <OrderFormSidebar
          isPO={false}
          shortLabel="SO"
          lastEntry={lastEntry}
          amount={amount}
          taxRate={form.taxRate}
          saveError={saveError}
          onSave={onSave}
          onCancel={onCancel}
          isEdit={isEdit}
          editingOrder={editingOrder}
          saveLoading={saveLoading}
          saveDisabled={saveLoading}
        />
      </div>

      <StickyFormActions
        saveLabel={isEdit ? 'Update SO' : 'Create SO'}
        onSave={onSave}
        onCancel={onCancel}
        error={saveError}
        saveLoading={saveLoading}
        saveDisabled={saveLoading}
      />
    </div>
  )
}

function ContractPartiesCard({ form, isPO, accountTrader }: { form: FormApi; isPO: boolean; accountTrader: string }) {
  return (
    <Card className="border-gray-200 dark:border-gray-700">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted" />
        Contract Parties
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted">Seller</p>
          <p className="font-medium">{isPO ? (form.sellerName || 'Select seller') : accountTrader}</p>
          <p className="text-xs text-muted mt-0.5">
            Confirmed by: {displayPartyConfirmedBy(form.sellerConfirmedBy, accountTrader)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Buyer</p>
          <p className="font-medium">{isPO ? accountTrader : (form.buyerName || 'Select buyer')}</p>
          <p className="text-xs text-muted mt-0.5">
            Confirmed by: {displayPartyConfirmedBy(form.buyerConfirmedBy, accountTrader)}
          </p>
        </div>
      </div>
    </Card>
  )
}

function OrderFormFields({
  isPO,
  shortLabel,
  form,
  store,
  partyOptions,
  spots,
  brokers,
  isEdit = false,
  fieldErrors = {},
  onFieldEdit,
  quantityAvailability,
  maxQty,
  maxQtyMessage,
  poFieldsLocked = false,
  linkedPoRate,
  accountTrader,
}: {
  isPO: boolean
  shortLabel: string
  form: FormApi
  store: ReturnType<typeof useTradeStore>
  partyOptions: SearchableSelectOption[]
  spots: string[]
  brokers: { name: string }[]
  isEdit?: boolean
  poFieldsLocked?: boolean
  linkedPoRate?: string
  fieldErrors?: OrderFieldErrors
  accountTrader: string
  onFieldEdit?: (key: keyof OrderFieldErrors) => void
  quantityAvailability?: {
    label: string
    remaining: number
    before?: number
    detail?: string
    remainingClassName?: string
  }
  maxQty?: number
  maxQtyMessage?: string
}) {
  const toast = useToast()
  const isReadyDelivery = form.deliveryType === 'ready'
  const minDeliveryEnd = form.deliveryPeriodStart || undefined
  const sellerBalance = isPO && form.partyName.trim()
    ? store.getSellerOutstandingBalance(form.partyName)
    : { total: 0, lines: [] as { poRef: string; soRef: string; qtyMt: number }[] }
  const [partyModalOpen, setPartyModalOpen] = useState(false)
  const [partyModalInitial, setPartyModalInitial] = useState<Partial<PartyFormValues> | null>(null)
  const [partyModalSaving, setPartyModalSaving] = useState(false)

  const handleBrokerageModeChange = (next: 'percent' | 'perTon') => {
    form.setValues(v => ({
      ...v,
      brokerageType: next,
      ...(next === 'percent' ? { brokeragePerTon: '' } : { brokeragePct: '0' }),
    }))
  }

  const handleSaveNewParty = async (values: PartyFormValues) => {
    setPartyModalSaving(true)
    try {
      const input = partyFormToInput(values)
      const party = isPO
        ? await store.addProducer(input)
        : await store.addRetailer(input)
      toast.success('Party added to directory', { description: party.name })
      applyPartySelection(form, isPO, party.id, party.name)
      onFieldEdit?.('partyName')
      setPartyModalOpen(false)
      setPartyModalInitial(null)
    } catch (err) {
      toast.error('Could not add party', {
        description: err instanceof Error ? err.message : 'Failed to save',
      })
      throw err
    } finally {
      setPartyModalSaving(false)
    }
  }

  const sellerItemCaption = isPO && sellerBalance.total > 0
    ? {
      label: 'Remaining balance',
      value: `${formatQty(sellerBalance.total)} MT owed by ${form.partyName}`,
      detail: sellerBalance.lines.length === 1
        ? `From ${sellerBalance.lines[0].poRef} → ${sellerBalance.lines[0].soRef} — apply on the next lift.`
        : sellerBalance.lines.map(line => `${line.poRef} → ${line.soRef}: ${formatQty(line.qtyMt)}`).join(' · '),
    }
    : undefined

  const quantityCaption = quantityAvailability && isPO
    ? {
      label: quantityAvailability.label,
      value: formatQty(quantityAvailability.remaining),
      valueClassName: quantityAvailability.remainingClassName
        ? cn('font-semibold', quantityAvailability.remainingClassName)
        : undefined,
      detail: quantityAvailability.detail,
    }
    : undefined

  const pricingNoteCaptions = !isPO && quantityAvailability?.before != null
    ? [
      {
        label: 'Available before SO',
        value: formatQty(quantityAvailability.before),
        valueClassName: cn('font-semibold', availableQtyClass(quantityAvailability.before)),
      },
      {
        label: quantityAvailability.label,
        value: formatQty(quantityAvailability.remaining),
        valueClassName: quantityAvailability.remainingClassName,
      },
      ...(linkedPoRate ? [{ label: 'PO rate', value: linkedPoRate }] : []),
    ]
    : undefined

  const poRateCaption = !isPO && linkedPoRate && !pricingNoteCaptions
    ? { label: 'PO rate', value: linkedPoRate }
    : undefined

  return (
    <>
      {(isPO || form.sellerName || form.buyerName) && <ContractPartiesCard form={form} isPO={isPO} accountTrader={accountTrader} />}

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label={`${shortLabel} Ref. No.`} value={form.ref} readOnly={isEdit} onChange={e => form.set('ref', e.target.value)} />
          <DatePicker
            label="Date"
            value={form.date}
            error={fieldErrors.date}
            onChange={next => {
              onFieldEdit?.('date')
              form.set('date', next)
            }}
          />
          <Input label="Broker Contract #" value={form.brokerContractRef} onChange={e => form.set('brokerContractRef', e.target.value)} placeholder="e.g. 713" />
        </div>
      </Card>

      <CaptionCard caption={sellerItemCaption}>
        <h3 className="text-sm font-semibold mb-4">{isPO ? 'Seller' : 'Buyer'} & Item</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SearchableSelect
            label={`${isPO ? 'Seller' : 'Buyer'} Name`}
            placeholder={isPO ? 'Select seller...' : 'Select buyer...'}
            searchPlaceholder="Search parties..."
            options={partyOptions}
            value={form.partyCompanyId}
            displayLabel={form.partyName}
            error={fieldErrors.partyName}
            allowCreate
            createLabel="Add new party"
            onRequestCreate={draftName => {
              setPartyModalInitial({ name: draftName })
              setPartyModalOpen(true)
            }}
            emptyMessage="No parties in directory"
            onValueChange={(id, label) => {
              onFieldEdit?.('partyName')
              applyPartySelection(form, isPO, id, label)
            }}
          />
          <SearchableSelect
            label="Item / Material"
            placeholder="Select item..."
            searchPlaceholder="Search items..."
            options={stringsToOptions(store.items)}
            value={form.itemName}
            displayLabel={form.itemName}
            error={fieldErrors.itemName}
            disabled={poFieldsLocked}
            allowCreate={!poFieldsLocked}
            createLabel="Add new item"
            onCreate={async (name) => {
              const candidates = collectItemNames({
                items: store.items,
                tradeOrders: store.tradeOrders,
                lots: store.lots,
              })
              const finalName = canonicalItemName(name, candidates)
              const exists = candidates.some(candidate => itemMatches(candidate, finalName))
              if (!exists) {
                await store.addItem(finalName)
                toast.success('Item added', { description: finalName })
              } else if (!itemMatches(name, finalName)) {
                toast.success('Matched existing item', { description: `${name} → ${finalName}` })
              }
              return { value: finalName, label: finalName }
            }}
            emptyMessage="No saved items — add one below"
            onValueChange={(value, label) => {
              onFieldEdit?.('itemName')
              const itemName = value || label
              form.set('itemName', itemName)
              if (form.brokerName) {
                const broker = store.brokers.find(b => b.name === form.brokerName)
                const terms = broker
                  ? resolveBrokerageTerms(broker, isPO ? 'purchase' : 'sale', itemName)
                  : undefined
                if (terms) {
                  form.setValues(v => ({ ...v, itemName, ...brokerageTermsToFormPatch(terms) }))
                }
              }
            }}
          />
          <SearchableSelect
            label="Spot / Location"
            placeholder="Select spot..."
            searchPlaceholder="Search spots..."
            options={stringsToOptions(spots)}
            value={form.spot}
            displayLabel={form.spot}
            allowCreate
            createLabel="Add new spot"
            onCreate={async (name) => {
              const spot = await store.addSpot(name)
              toast.success('Spot added', { description: spot })
              return { value: spot, label: spot }
            }}
            emptyMessage="No saved spots — add one below"
            onValueChange={(_, label) => form.set('spot', label)}
          />
        </div>
      </CaptionCard>

      <CaptionCard
        captions={pricingNoteCaptions}
        caption={quantityCaption}
        secondaryCaption={poRateCaption}
        noteVariant={!!pricingNoteCaptions || !!quantityCaption || !!poRateCaption}
      >
        <h3 className="text-sm font-semibold mb-4">Quantity & Pricing</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <QtyInput
            label="Quantity (MT)"
            value={form.quantity}
            error={fieldErrors.quantity}
            maxQty={maxQty}
            maxQtyMessage={maxQtyMessage}
            onChange={e => { onFieldEdit?.('quantity'); form.set('quantity', e.target.value) }}
          />
          <AmountInput
            label={rateInputLabel(shortLabel, form.rateBasis)}
            value={form.rate}
            error={fieldErrors.rate}
            onChange={v => {
              onFieldEdit?.('rate')
              form.setValues(prev => ({
                ...prev,
                rate: v,
                ratePerBasis: v,
                rateBasis: 'PER 10 KG',
                contractRateDisplay: '',
              }))
            }}
          />
          <Input label="Tax Rate (%)" value={form.taxRate} onChange={e => form.set('taxRate', e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-300">{shortLabel} Amount</label>
            <div className="h-9 flex items-center px-3 rounded-md border border-transparent bg-gray-100 dark:bg-gray-700/50 text-sm font-semibold tabular-nums">
              {formatCurrency(orderLineAmount(parseFloat(form.quantity) || 0, parseRateNumber(form.rate), form.rateBasis))}
            </div>
          </div>
        </div>
      </CaptionCard>

      <Card>
        <h3 className="text-sm font-semibold mb-4">Delivery & Terms</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Select
                searchable={false}
                label="Delivery Type"
                options={[
                  { value: 'period', label: 'Period' },
                  { value: 'ready', label: 'Ready' },
                ]}
                value={form.deliveryType}
                onChange={e => form.set('deliveryType', e.target.value)}
              />
              {isReadyDelivery && (
                <p className="text-xs text-gray-500 dark:text-muted mt-1.5">
                  Same-day delivery — no period dates needed.
                </p>
              )}
            </div>
          </div>

          {!isReadyDelivery && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DatePicker
                label="Delivery Period Start"
                value={form.deliveryPeriodStart}
                error={fieldErrors.deliveryPeriodStart}
                onChange={start => {
                  onFieldEdit?.('deliveryPeriodStart')
                  form.set('deliveryPeriodStart', start)
                  if (!form.deliveryPeriodEnd || form.deliveryPeriodEnd < start) {
                    form.set('deliveryPeriodEnd', start)
                  }
                }}
              />
              <DatePicker
                label="Delivery Period End"
                value={form.deliveryPeriodEnd}
                min={minDeliveryEnd}
                error={fieldErrors.deliveryPeriodEnd}
                onChange={end => {
                  onFieldEdit?.('deliveryPeriodEnd')
                  form.set('deliveryPeriodEnd', end)
                }}
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Broker Name"
              placeholder="Select broker..."
              searchPlaceholder="Search brokers..."
              allowCreate
              createLabel="Add new broker"
              onCreate={async (name) => {
                const broker = await store.addBroker({ name })
                toast.success('Broker added to directory', { description: broker.name })
                return { value: broker.name, label: broker.name }
              }}
              options={brokers.map(b => ({ value: b.name, label: b.name }))}
              value={form.brokerName}
              onChange={e => {
                const brokerName = e.target.value
                form.set('brokerName', brokerName)
                const broker = store.brokers.find(b => b.name === brokerName)
                const terms = broker
                  ? resolveBrokerageTerms(broker, isPO ? 'purchase' : 'sale', form.itemName)
                  : undefined
                if (terms) {
                  form.setValues(v => ({ ...v, brokerName, ...brokerageTermsToFormPatch(terms) }))
                }
              }}
              emptyMessage="No brokers in directory — add one below"
            />
            <BrokerageInput
              mode={form.brokerageType === 'percent' ? 'percent' : 'perTon'}
              value={form.brokerageType === 'percent' ? form.brokeragePct : form.brokeragePerTon}
              onModeChange={handleBrokerageModeChange}
              onChange={v => form.set(form.brokerageType === 'percent' ? 'brokeragePct' : 'brokeragePerTon', v)}
            />
            <Input label="Payment Terms" value={form.paymentTerms} onChange={e => form.set('paymentTerms', e.target.value)} />
            <div className="col-span-2">
              <Input label="Remarks" value={form.remarks} onChange={e => form.set('remarks', e.target.value)} />
            </div>
          </div>
        </div>
      </Card>

      <PartyFormModal
        open={partyModalOpen}
        onClose={() => {
          if (partyModalSaving) return
          setPartyModalOpen(false)
          setPartyModalInitial(null)
        }}
        title="Add Party"
        initial={partyModalInitial}
        saving={partyModalSaving}
        onSave={handleSaveNewParty}
      />
    </>
  )
}

function OrderFormSidebar({
  isPO,
  shortLabel,
  lastEntry,
  amount,
  taxRate,
  saveError,
  onSave,
  onCancel,
  disabled,
  saveLoading = false,
  saveDisabled,
  isEdit = false,
  editingOrder,
}: {
  isPO: boolean
  shortLabel: string
  lastEntry?: TradeOrder
  amount: number
  taxRate: string
  saveError: string
  onSave: () => void
  onCancel: () => void
  disabled?: boolean
  saveLoading?: boolean
  saveDisabled?: boolean
  isEdit?: boolean
  editingOrder?: TradeOrder
}) {
  const isSaving = saveLoading || saveDisabled
  return (
    <div className="space-y-4 lg:sticky lg:top-4 lg:self-start lg:z-10 w-full">
      {lastEntry && (
        <Card>
          <h3 className="text-sm font-semibold text-heading mb-3">Last entry in register</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted">Deal No</span><span className="font-mono font-medium">{lastEntry.ref}</span></div>
            {lastEntry.poRef && <div className="flex justify-between"><span className="text-muted">Against PO</span><span className="font-mono">{lastEntry.poRef}</span></div>}
            <div className="flex justify-between"><span className="text-muted">Date</span><span>{formatDate(lastEntry.date)}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted shrink-0">{isPO ? 'Seller' : 'Buyer'}</span><span className="font-medium text-right truncate">{lastEntry.partyName}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted shrink-0">Item</span><span className="font-medium text-right truncate">{lastEntry.itemName}</span></div>
          </div>
        </Card>
      )}

      <Card>
        <h3 className="text-sm font-semibold mb-3">Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted">{shortLabel} Value</span><span className="font-semibold">{formatCurrency(amount)}</span></div>
          <div className="flex justify-between"><span className="text-muted">Tax ({taxRate}%)</span><span>{formatCurrency(amount * (parseFloat(taxRate) / 100 || 0))}</span></div>
          <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
            <span className="text-muted">Total</span>
            <span className="font-semibold">{formatCurrency(amount * (1 + (parseFloat(taxRate) / 100 || 0)))}</span>
          </div>
        </div>
      </Card>

      {saveError && <FormErrorBanner>{saveError}</FormErrorBanner>}

      <div className="flex flex-col gap-2 hidden sm:flex">
        {isEdit && editingOrder && (
          <ShareWhatsAppButton
            fullWidth
            onShare={() => shareOrderOnWhatsApp(editingOrder)}
          />
        )}
        <Button className="w-full" onClick={onSave} disabled={disabled || isSaving} loading={saveLoading}>
          <Save className="h-4 w-4" /> {isEdit ? `Update ${shortLabel}` : `Create ${shortLabel}`}
        </Button>
        <Button variant="outline" className="w-full" onClick={onCancel} disabled={isSaving}>
          <ArrowLeft className="h-4 w-4" /> Cancel
        </Button>
      </div>
    </div>
  )
}

export function POEntryPage() {
  const [searchParams] = useSearchParams()
  const prefill = {
    qty: searchParams.get('qty') ?? undefined,
    rate: searchParams.get('rate') ?? undefined,
    party: searchParams.get('party') ?? undefined,
    item: searchParams.get('item') ?? undefined,
    broker: searchParams.get('broker') ?? undefined,
  }
  const hasPrefill = Object.values(prefill).some(Boolean)
  return <OrderEntryPage side="purchase" prefill={hasPrefill ? prefill : undefined} />
}

export function POEditPage() {
  const { ref } = useParams()
  return <OrderEntryPage side="purchase" editRef={ref ? decodeURIComponent(ref) : undefined} />
}

export function SOEntryPage() {
  const [searchParams] = useSearchParams()
  const poRef = searchParams.get('poRef') ?? undefined
  const prefill = {
    qty: searchParams.get('qty') ?? undefined,
    rate: searchParams.get('rate') ?? undefined,
    buyer: searchParams.get('buyer') ?? searchParams.get('party') ?? undefined,
    broker: searchParams.get('broker') ?? undefined,
    item: searchParams.get('item') ?? undefined,
  }
  return <OrderEntryPage side="sale" linkedPoRef={poRef} prefill={prefill} />
}

export function SOEditPage() {
  const { ref } = useParams()
  return <OrderEntryPage side="sale" editRef={ref ? decodeURIComponent(ref) : undefined} />
}

export { LiftEntryPage, LiftEditPage } from './LiftFormPage'
