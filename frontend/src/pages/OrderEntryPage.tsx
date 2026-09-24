import { useState, useEffect, useMemo, useRef, useCallback, type Dispatch, type SetStateAction, type ReactNode } from 'react'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { Package, FileText, FileUp } from 'lucide-react'
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
import { FieldValidationBanner, FormErrorBanner } from '../components/ui/FieldError'
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
import { lockedAccountPartyFields } from '../lib/accountBuyer'
import { useAccountTrader } from '../lib/useAccountTrader'
import { parseIndianAmount, formatIndianAmount } from '../lib/indianAmount'
import { formatContractRate, orderLineAmount, parseRateNumber, rateInputLabel, syncedRateFields } from '../lib/orderRate'
import {
  validateBrokerContractRef,
  validateOrderQuantity,
  validateOrderRatePer10Kg,
  validateOrderRef,
  validateSpot,
  validateTaxRate,
} from '../lib/orderFieldValidation'
import { brokerageTypeFromOrder, orderToFormValues } from '../lib/orderForm'
import {
  brokerageTermsToFormPatch,
  resolveBrokerageTerms,
} from '../lib/brokerBrokerage'
import { formatDeletionDate } from '../lib/orderDeletion'
import { formatOrderRef, formatPoRef } from '../lib/tradeRefs'
import { uniqueSorted } from '../lib/orderFilters'
import { collapseRepeatedPartyLocation } from '../lib/liftBalance'
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
  | 'partyName'
  | 'itemName'
  | 'quantity'
  | 'rate'
  | 'date'
  | 'deliveryPeriodStart'
  | 'deliveryPeriodEnd'
  | 'ref'
  | 'brokerContractRef'
  | 'spot'
  | 'taxRate',
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

    const refError = validateOrderRef(form.ref, side)
    if (refError) errors.ref = refError

    const brokerRefError = validateBrokerContractRef(form.brokerContractRef)
    if (brokerRefError) errors.brokerContractRef = brokerRefError

    if (!form.partyName.trim()) {
      errors.partyName = `${isPO ? 'Seller' : 'Buyer'} name is required`
    }
    if (!form.itemName.trim()) {
      errors.itemName = 'Item name is required'
    }

    const spotError = validateSpot(form.spot)
    if (spotError) errors.spot = spotError

    const qty = parseFloat(form.quantity)
    const qtyError = validateOrderQuantity(qty)
    if (qtyError) errors.quantity = qtyError

    const ratePer10 = parseRateNumber(form.rate)
    const rateError = validateOrderRatePer10Kg(ratePer10)
    if (rateError) errors.rate = rateError

    const tax = form.taxRate.trim() === '' ? 0 : parseFloat(form.taxRate)
    const taxError = validateTaxRate(Number.isFinite(tax) ? tax : NaN)
    if (taxError) errors.taxRate = taxError

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
        toast.success(`${formatOrderRef(saved.ref, saved.side)} updated`, {
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
    <div className="w-full pb-24 sm:pb-0">
      <PageHeader
        title={isEdit ? `Edit ${label}` : `${label} Entry`}
        subtitle={isEdit ? `Update ${formatOrderRef(form.ref || editRef || '', side)}` : <>Create a new purchase order<span className="hidden md:inline"> · ⌘S to save</span></>}
        breadcrumb={<Breadcrumb items={[
          { label: 'Tradeal', href: '/' },
          { label: isPO ? 'Purchase Orders' : 'Sales Orders', href: pathPrefix },
          { label: isEdit ? `Edit ${shortLabel}` : `New ${shortLabel}` },
        ]} />}
      />

      {editingOrder?.deleteScheduledAt && (
        <div className="mb-3 rounded-md border border-warning/40 bg-warning-muted px-4 py-3 text-sm text-warning">
          This {shortLabel} is scheduled for deletion on {formatDeletionDate(editingOrder.deleteScheduledAt)}.
        </div>
      )}

      {Object.keys(fieldErrors).length > 0 && (
        <FieldValidationBanner className="mb-3" />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {showPdfImport && (
            <details className="rounded-md bg-card shadow-[var(--shadow-card)] group">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold flex items-center gap-2 [&::-webkit-details-marker]:hidden">
                <FileUp className="h-4 w-4 text-accent" />
                Import from Contract PDF
                <span className="ml-auto text-xs font-normal text-muted group-open:hidden">Show</span>
                <span className="ml-auto text-xs font-normal text-muted hidden group-open:inline">Hide</span>
              </summary>
              <div className="px-4 pb-4">
                <ContractPdfUpload
                  key={pdfUploadKey}
                  embedded
                  side={side}
                  onParsed={applyPdfImport}
                  onBeforeApply={confirmPdfReplace}
                />
              </div>
            </details>
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
          />
        </div>

        <OrderFormSidebar
          isPO={isPO}
          shortLabel={shortLabel}
          form={form}
          store={store}
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

      <StickyFormActions
        saveLabel={isEdit ? `Update ${shortLabel}` : `Create ${shortLabel}`}
        onSave={handleSave}
        onCancel={handleCancel}
        error={saveError}
        saveLoading={saving}
        saveDisabled={saving}
        extra={
          isEdit && editingOrder ? (
            <ShareWhatsAppButton
              fullWidth
              onShare={() => shareOrderOnWhatsApp(editingOrder)}
            />
          ) : undefined
        }
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
  const [poLinkItem, setPoLinkItem] = useState('')
  const [poLinkSeller, setPoLinkSeller] = useState('')
  const [poLinkSpot, setPoLinkSpot] = useState('')

  const poLinkEditable = !((isEdit && !!editingOrder?.poRef) || !!sellFromLot || !!linkedPoRef)

  const availablePOs = useMemo(() => {
    const includeRef = isEdit && editingOrder?.poRef ? editingOrder.poRef : undefined
    // Do not auto-narrow by SO item — use explicit Item/Seller/Spot filters below.
    let base = store.getPOsAvailableForSO({ includeRef })
    if (isEdit && editingOrder?.poRef && !base.some(p => p.ref === editingOrder.poRef)) {
      const linked = store.getOrderByRef(editingOrder.poRef, 'purchase')
      if (linked) base = [linked, ...base]
    }
    if (!poLinkEditable) return base

    const itemQ = poLinkItem.trim().toLowerCase()
    const sellerQ = poLinkSeller.trim().toLowerCase()
    const spotQ = poLinkSpot.trim().toLowerCase()
    return base.filter(po => {
      if (itemQ && po.itemName.trim().toLowerCase() !== itemQ) return false
      const seller = (po.sellerName || po.partyName || '').trim().toLowerCase()
      if (sellerQ && seller !== sellerQ) return false
      if (spotQ && (po.spot || '').trim().toLowerCase() !== spotQ) return false
      return true
    })
  }, [
    store,
    isEdit,
    editingOrder?.poRef,
    poLinkEditable,
    poLinkItem,
    poLinkSeller,
    poLinkSpot,
  ])

  const poFilterOptions = useMemo(() => {
    const includeRef = isEdit && editingOrder?.poRef ? editingOrder.poRef : undefined
    const pool = store.getPOsAvailableForSO({ includeRef })
    const items = uniqueSorted(pool.map(p => p.itemName))
    const sellers = uniqueSorted(pool.map(p => p.sellerName || p.partyName))
    const spots = uniqueSorted(pool.map(p => p.spot))
    return { items, sellers, spots }
  }, [store, isEdit, editingOrder?.poRef])

  const partyOptions = buildAllPartyOptions(store.companies, store.producers, store.retailers)

  useEffect(() => {
    if (!poLinkEditable || !form.poRef) return
    if (!availablePOs.some(p => p.ref === form.poRef)) {
      form.set('poRef', '')
    }
  }, [poLinkEditable, availablePOs, form.poRef, form])

  const poLinked = !!editingOrder?.poRef
  const qtyCap = sellFromLot?.available ?? maxSellQty
  const availableBeforeSo = qtyCap
  const hasEnteredQty = form.quantity.trim() !== ''
  const enteredQty = hasEnteredQty ? parseFloat(form.quantity) || 0 : 0
  const availableAfterSo = hasEnteredQty
    ? roundQtyMt(availableBeforeSo - enteredQty)
    : availableBeforeSo
  const showPoRowAction = !isEdit && !sellFromLot && !linkedPoRef

  const linkPoSelect = (
    <div className="space-y-2">
      {poLinkEditable ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Select
            label="Item"
            searchable
            options={withPlaceholder(
              poFilterOptions.items.map(item => ({ value: item, label: item })),
              'All items',
            )}
            value={poLinkItem}
            onChange={e => setPoLinkItem(e.target.value)}
          />
          <Select
            label="Seller"
            searchable
            options={withPlaceholder(
              poFilterOptions.sellers.map(seller => ({ value: seller, label: seller })),
              'All sellers',
            )}
            value={poLinkSeller}
            onChange={e => setPoLinkSeller(e.target.value)}
          />
          <Select
            label="Spot"
            searchable
            options={withPlaceholder(
              poFilterOptions.spots.map(spot => ({ value: spot, label: spot })),
              'All spots',
            )}
            value={poLinkSpot}
            onChange={e => setPoLinkSpot(e.target.value)}
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
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
          {poLinkEditable ? (
            <p className="mt-1 text-xs text-muted">
              {availablePOs.length} open PO{availablePOs.length === 1 ? '' : 's'}
              {(poLinkItem || poLinkSeller || poLinkSpot) ? ' matching filters' : ' with availability'}
            </p>
          ) : null}
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
    </div>
  )

  return (
    <div className="animate-fade-in w-full pb-24 sm:pb-0">
      <PageHeader
        title={sellFromLot ? 'Sell from lot' : isEdit ? 'Edit Sales Order' : 'Sales Order Entry'}
        subtitle={
          sellFromLot
            ? <>{sellFromLot.lotNumber} · {sellFromLot.commodity} · {formatQty(sellFromLot.available)} available<span className="hidden md:inline"> · ⌘S to save</span></>
            : isEdit
              ? `Update ${formatOrderRef(form.ref, 'sale')}`
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
        <div className="mb-3 rounded-md border border-warning/40 bg-warning-muted px-4 py-3 text-sm text-warning">
          This SO is scheduled for deletion on {formatDeletionDate(editingOrder.deleteScheduledAt)}.
        </div>
      )}

      {Object.keys(fieldErrors).length > 0 && (
        <FieldValidationBanner className="mb-3" />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {showPdfImport && (
            <details className="rounded-md bg-card shadow-[var(--shadow-card)] group">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold flex items-center gap-2 [&::-webkit-details-marker]:hidden">
                <FileUp className="h-4 w-4 text-accent" />
                Import from Contract PDF
                <span className="ml-auto text-xs font-normal text-muted group-open:hidden">Show</span>
                <span className="ml-auto text-xs font-normal text-muted hidden group-open:inline">Hide</span>
              </summary>
              <div className="px-4 pb-4">
                <ContractPdfUpload
                  key={pdfUploadKey}
                  embedded
                  side="sale"
                  onParsed={onPdfParsed}
                  onBeforeApply={onBeforePdfApply}
                />
              </div>
            </details>
          )}
          <CaptionCard bodyClassName="p-8">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Package className="h-4 w-4 text-accent" /> {sellFromLot ? 'Purchase Order' : 'Link to Purchase Order'}
            </h3>
            {(sellFromLot || linkedPoRef) && (
              <p className="text-xs text-gray-500 mb-2">
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
            fieldErrors={fieldErrors}
            onFieldEdit={onFieldEdit}
            maxQty={qtyCap > 0 ? qtyCap : undefined}
            maxQtyMessage={
              selectedPO
                ? `Cannot exceed ${formatQty(qtyCap)} available on ${formatPoRef(selectedPO.ref)}`
                : sellFromLot
                  ? `Cannot exceed ${formatQty(qtyCap)} available on ${sellFromLot.lotNumber}`
                  : undefined
            }
          />
        </div>

        <OrderFormSidebar
          isPO={false}
          shortLabel="SO"
          form={form}
          store={store}
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
          infoNotes={
            selectedPO || sellFromLot
              ? [
                  {
                    label: 'Available before SO',
                    value: formatQty(availableBeforeSo),
                    valueClassName: cn('font-semibold', availableQtyClass(availableBeforeSo)),
                  },
                  {
                    label: 'Available after SO',
                    value: formatQty(availableAfterSo),
                    valueClassName: soRemainingQtyClass(availableAfterSo),
                  },
                  ...(selectedPO
                    ? [{
                        label: 'PO rate',
                        value: formatContractRate(selectedPO.rate, selectedPO.rateBasis, selectedPO.ratePerBasis),
                      }]
                    : []),
                ]
              : undefined
          }
        />
      </div>

      <StickyFormActions
        saveLabel={isEdit ? 'Update SO' : 'Create SO'}
        onSave={onSave}
        onCancel={onCancel}
        error={saveError}
        saveLoading={saveLoading}
        saveDisabled={saveLoading}
        extra={
          isEdit && editingOrder ? (
            <ShareWhatsAppButton
              fullWidth
              onShare={() => shareOrderOnWhatsApp(editingOrder)}
            />
          ) : undefined
        }
      />
    </div>
  )
}

function FormFieldGroup({
  children,
  columns = 'grid-cols-1 sm:grid-cols-2',
}: {
  children: ReactNode
  columns?: string
}) {
  return (
    <section>
      <div className={cn('grid gap-3', columns)}>{children}</div>
    </section>
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
  isEdit: _isEdit = false,
  fieldErrors = {},
  onFieldEdit,
  maxQty,
  maxQtyMessage,
  poFieldsLocked = false,
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
  fieldErrors?: OrderFieldErrors
  onFieldEdit?: (key: keyof OrderFieldErrors) => void
  maxQty?: number
  maxQtyMessage?: string
}) {
  const toast = useToast()
  const isReadyDelivery = form.deliveryType === 'ready'
  const minDeliveryEnd = form.deliveryPeriodStart || undefined
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

  return (
    <>
      <Card className="p-8" padding={false}>
        <div className="space-y-4 [&>*+*]:border-t [&>*+*]:border-gray-100 [&>*+*]:pt-4 dark:[&>*+*]:border-gray-800">
          <FormFieldGroup columns="grid-cols-1 sm:grid-cols-3">
            <DatePicker
              label="Date"
              value={form.date}
              error={fieldErrors.date}
              onChange={next => {
                onFieldEdit?.('date')
                form.set('date', next)
              }}
            />
            <Input
              label="Broker Contract #"
              value={form.brokerContractRef}
              error={fieldErrors.brokerContractRef}
              onChange={e => {
                onFieldEdit?.('brokerContractRef')
                form.set('brokerContractRef', e.target.value)
              }}
              placeholder="e.g. 713"
            />
          </FormFieldGroup>

          <FormFieldGroup columns="grid-cols-1 sm:grid-cols-3">
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
              error={fieldErrors.spot}
              allowCreate
              createLabel="Add new spot"
              onCreate={async (name) => {
                const spotError = validateSpot(name)
                if (spotError) {
                  toast.error(spotError)
                  throw new Error(spotError)
                }
                const spot = await store.addSpot(name)
                toast.success('Spot added', { description: spot })
                return { value: spot, label: spot }
              }}
              emptyMessage="No saved spots — add one below"
              onValueChange={(_, label) => {
                onFieldEdit?.('spot')
                form.set('spot', label)
              }}
            />
          </FormFieldGroup>

          <FormFieldGroup columns="grid-cols-1 sm:grid-cols-3">
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
            <Input
              label="Tax Rate (%)"
              value={form.taxRate}
              error={fieldErrors.taxRate}
              onChange={e => {
                onFieldEdit?.('taxRate')
                form.set('taxRate', e.target.value)
              }}
            />
          </FormFieldGroup>

          <FormFieldGroup columns="grid-cols-1 sm:grid-cols-3">
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
                <p className="text-xs text-gray-500 dark:text-muted mt-1">
                  Same-day — no period dates.
                </p>
              )}
            </div>
            {!isReadyDelivery ? (
              <DatePicker
                label="Delivery Start"
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
            ) : null}
            {!isReadyDelivery ? (
              <DatePicker
                label="Delivery End"
                value={form.deliveryPeriodEnd}
                min={minDeliveryEnd}
                error={fieldErrors.deliveryPeriodEnd}
                onChange={end => {
                  onFieldEdit?.('deliveryPeriodEnd')
                  form.set('deliveryPeriodEnd', end)
                }}
              />
            ) : null}
          </FormFieldGroup>

          <FormFieldGroup columns="grid-cols-1 sm:grid-cols-3">
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
          </FormFieldGroup>

          <FormFieldGroup columns="grid-cols-1">
            <Input label="Remarks" value={form.remarks} onChange={e => form.set('remarks', e.target.value)} />
          </FormFieldGroup>
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
  form,
  store,
  lastEntry,
  amount,
  taxRate,
  infoNotes,
  quantityAvailability,
  saveError,
  onSave,
  onCancel,
  saveLoading = false,
  saveDisabled,
  isEdit = false,
  editingOrder,
}: {
  isPO: boolean
  shortLabel: string
  form: FormApi
  store: ReturnType<typeof useTradeStore>
  lastEntry?: TradeOrder
  amount: number
  taxRate: string
  infoNotes?: { label: string; value: ReactNode; valueClassName?: string }[]
  quantityAvailability?: {
    label: string
    remaining: number
    detail?: string
    remainingClassName?: string
  }
  saveError: string
  onSave: () => void
  onCancel: () => void
  saveLoading?: boolean
  saveDisabled?: boolean
  isEdit?: boolean
  editingOrder?: TradeOrder
}) {
  const isSaving = saveLoading || saveDisabled
  const showParties = isPO || !!form.sellerName || !!form.buyerName
  const sellerBalance = isPO && form.partyName.trim()
    ? store.getSellerOutstandingBalance(form.partyName)
    : { total: 0, lines: [] as { poRef: string; soRef: string; qtyMt: number }[] }

  const previewNotes = [
    ...(infoNotes ?? []),
    ...(isPO && sellerBalance.total > 0
      ? [{
          label: 'Remaining balance',
          value: `${formatQty(sellerBalance.total)} owed by ${collapseRepeatedPartyLocation(form.partyName)}`,
        }]
      : []),
    ...(quantityAvailability && isPO
      ? [{
          label: quantityAvailability.label,
          value: formatQty(quantityAvailability.remaining),
          valueClassName: quantityAvailability.remainingClassName
            ? cn('font-semibold', quantityAvailability.remainingClassName)
            : undefined,
        }]
      : []),
  ]

  return (
    <div className="space-y-3 w-full lg:sticky lg:top-4 lg:self-start lg:z-10">
      {previewNotes.length > 0 && (
        <div className="rounded-md bg-card shadow-[var(--shadow-card)] overflow-hidden">
          <div
            className={cn(
              'flex flex-wrap items-stretch divide-x divide-gray-200 px-3 py-3 dark:divide-gray-700',
              isPO
                ? 'bg-gray-100/90 dark:bg-gray-800/50'
                : 'bg-card',
            )}
          >
            {previewNotes.map(note => (
              <div key={note.label} className="min-w-0 flex-1 px-2 first:pl-0 last:pr-0 py-1">
                <p className="text-xs font-medium text-muted leading-tight">{note.label}</p>
                <div className={cn('mt-1 text-sm font-semibold tabular-nums text-heading leading-tight', note.valueClassName)}>
                  {note.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-md bg-card shadow-[var(--shadow-card)] overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-heading">Summary</h3>
          <span className="text-sm text-heading truncate">
            {formatOrderRef(form.ref, isPO ? 'purchase' : 'sale')}
          </span>
        </div>

        <div className="px-6 py-4 space-y-4">
          {showParties ? (
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-muted shrink-0">{isPO ? 'Seller' : 'Buyer'}</span>
              <span
                className="font-medium text-heading text-right truncate"
                title={
                  isPO
                    ? (form.sellerName || form.partyName || undefined)
                    : (form.buyerName || form.partyName || undefined)
                }
              >
                {isPO
                  ? (form.sellerName || form.partyName || 'Select seller')
                  : (form.buyerName || form.partyName || 'Select buyer')}
              </span>
            </div>
          ) : null}

          <div className="rounded-md bg-gray-50/90 dark:bg-gray-800/50 px-4 py-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted">{shortLabel} Value</span>
              <span className="tabular-nums text-heading">{formatCurrency(amount)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted">Tax ({taxRate}%)</span>
              <span className="tabular-nums text-heading">
                {formatCurrency(amount * (parseFloat(taxRate) / 100 || 0))}
              </span>
            </div>
            <div className="flex justify-between gap-3 border-t border-gray-200 dark:border-gray-700 pt-2">
              <span className="font-semibold text-heading">Total</span>
              <span className="font-semibold tabular-nums text-heading">
                {formatCurrency(amount * (1 + (parseFloat(taxRate) / 100 || 0)))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {lastEntry && (
        <details className="rounded-md bg-card shadow-[var(--shadow-card)] group">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden flex items-center">
            Last entry
            <span className="ml-auto text-xs font-normal text-muted">{formatOrderRef(lastEntry.ref, lastEntry.side)}</span>
          </summary>
          <div className="px-4 pb-3 space-y-1.5 text-sm">
            {lastEntry.poRef && <div className="flex justify-between"><span className="text-muted">Against PO</span><span>{formatPoRef(lastEntry.poRef)}</span></div>}
            <div className="flex justify-between"><span className="text-muted">Date</span><span>{formatDate(lastEntry.date)}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted shrink-0">{isPO ? 'Seller' : 'Buyer'}</span><span className="font-medium text-right truncate">{lastEntry.partyName}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted shrink-0">Item</span><span className="font-medium text-right truncate">{lastEntry.itemName}</span></div>
          </div>
        </details>
      )}

      <div className="hidden sm:flex flex-col gap-2 w-full">
        {saveError && <FormErrorBanner>{saveError}</FormErrorBanner>}
        {isEdit && editingOrder && (
          <ShareWhatsAppButton
            fullWidth
            onShare={() => shareOrderOnWhatsApp(editingOrder)}
          />
        )}
        <div className="flex gap-2 w-full">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button className="flex-[1.4]" onClick={onSave} disabled={isSaving} loading={saveLoading}>
            {isEdit ? `Update ${shortLabel}` : `Create ${shortLabel}`}
          </Button>
        </div>
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
