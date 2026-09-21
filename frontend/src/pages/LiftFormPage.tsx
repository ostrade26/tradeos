import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { Save, ArrowLeft, Scale } from 'lucide-react'
import { PageHeader } from '../components/ui/CommandPalette'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'
import { Breadcrumb, EmptyState } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { DatePicker } from '../components/ui/DatePicker'
import { QtyInput } from '../components/ui/QtyInput'
import { Select } from '../components/ui/Select'
import { Card } from '../components/ui/Card'
import { TABLE_QTY_NOTE } from '../components/ui/DataTable'
import { CaptionCard } from '../components/ui/CaptionCard'
import {
  LiftTankersForm,
  buildLiftTankerAvailabilityCaption,
  buildLoadOnRiskCaption,
} from '../components/lifts/LiftTankersForm'
import { LiftAllocationsForm, newAllocationDraft, type LiftAllocationDraft } from '../components/lifts/LiftAllocationsForm'
import { StockLiftForm, type StockLiftDraft } from '../components/lifts/StockLiftForm'
import { cn, formatQty, formatDate, normalizeDateToIso } from '../lib/utils'
import {
  emptyLiftTankerForm,
  formToLiftTanker,
  getLiftTankers,
  liftTankerToForm,
  sanitizeQtyInput,
  totalActualQtyFromForm,
  type LiftTankerFormValues,
  type LiftTankerFieldErrorMap,
  collectLiftTankerFieldErrors,
} from '../lib/liftTankers'
import { allocationTotal, formatLiftOrderSummary, getLiftAllocations, remainingOnOrder } from '../lib/liftAllocations'
import { formatLiftRef, formatPoRef } from '../lib/tradeRefs'
import { isStockLift, STOCK_LIFT_LABEL } from '../lib/stockLift'
import { uniqueSorted } from '../lib/orderFilters'
import { crossPoAllocationSummary, poolPOsForSo } from '../lib/sellerLiftPool'
import { CrossPoNotice } from '../components/lifts/CrossPoNotice'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { StickyFormActions } from '../components/ui/StickyFormActions'
import { FormErrorBanner, FieldValidationBanner } from '../components/ui/FieldError'
import { useTradeStore } from '../store/TradeStore'
import { useToast } from '../hooks/useToast'
import type { Lift, TradeOrder } from '../data/mockData'

function purchaseSellerName(order: TradeOrder): string {
  return (order.sellerName || order.partyName || '').trim()
}

function soMatchesSeller(so: TradeOrder, seller: string, orders: TradeOrder[]): boolean {
  if (!seller) return true
  const booked = orders.find(o => o.ref === so.poRef && o.side === 'purchase')
  if (booked && purchaseSellerName(booked) === seller) return true
  return poolPOsForSo(so, orders).some(po => purchaseSellerName(po) === seller)
}

export function LiftEntryPage() {
  return <LiftFormPage />
}

export function LiftEditPage() {
  const { liftRef } = useParams()
  const refNum = liftRef ? parseInt(liftRef, 10) : NaN
  return <LiftFormPage editLiftRef={Number.isFinite(refNum) ? refNum : undefined} />
}

function draftsFromUrl(poRef: string, soRef: string, qty = ''): LiftAllocationDraft[] {
  return [newAllocationDraft({ poRef, soRef, qty })]
}

function serializeLiftFormState(s: {
  date: string
  salesInvoiceNo: string
  remarks: string
  isSelfLift: string
  liftPurpose: string
  stockLift: StockLiftDraft
  allocations: LiftAllocationDraft[]
  tankers: LiftTankerFormValues[]
  balanceAppliedQty: string
  loadOnRisk: boolean
}) {
  return JSON.stringify({
    date: s.date,
    salesInvoiceNo: s.salesInvoiceNo,
    remarks: s.remarks,
    isSelfLift: s.isSelfLift,
    liftPurpose: s.liftPurpose,
    stockLift: s.stockLift,
    allocations: s.allocations.map(({ soRef, poRef, qty }) => ({ soRef, poRef, qty })),
    tankers: s.tankers,
    balanceAppliedQty: s.balanceAppliedQty,
    loadOnRisk: s.loadOnRisk,
  })
}

function SidebarMetaRow({
  label,
  value,
  tabular,
}: {
  label: string
  value: ReactNode
  tabular?: boolean
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted shrink-0">{label}</span>
      <span className={cn('font-medium text-right truncate', tabular && 'tabular-nums')}>{value}</span>
    </div>
  )
}

function LiftFormSidebar({
  lastLift,
  isStockMode,
  allocTotal,
  totalPlanned,
  tankerCount,
  balanceApplied,
  isSelfLift,
  saveError,
  onSave,
  onCancel,
  isEdit,
  saveLoading,
  saveDisabled,
  isDeliveredActual = false,
}: {
  lastLift?: Lift
  isStockMode: boolean
  allocTotal: number
  totalPlanned: number
  tankerCount: number
  balanceApplied: number
  isSelfLift: boolean
  saveError: string
  onSave: () => void
  onCancel: () => void
  isEdit: boolean
  saveLoading: boolean
  saveDisabled: boolean
  isDeliveredActual?: boolean
}) {
  const isSaving = saveLoading || saveDisabled
  const plannedQty = totalPlanned > 0 ? totalPlanned : allocTotal
  const tankerQtyLabel = isDeliveredActual
    ? `Total actual quantity (${tankerCount === 1 ? 'tanker' : 'tankers'})`
    : `Planned on tanker${tankerCount === 1 ? '' : 's'}`

  return (
    <div className="space-y-4 lg:sticky lg:top-4 lg:self-start lg:z-10 w-full">
      {lastLift && (
        <Card>
          <h3 className="text-sm font-semibold text-heading mb-3">Last entry in register</h3>
          <div className="space-y-2 text-sm">
            <SidebarMetaRow label="Lift ref" value={formatLiftRef(lastLift.liftRef)} />
            <SidebarMetaRow label="Date" value={formatDate(lastLift.date)} />
            <SidebarMetaRow label="Item" value={lastLift.itemName} />
            <SidebarMetaRow label="Quantity" value={formatQty(lastLift.liftedQty)} tabular />
            <SidebarMetaRow label="Orders" value={formatLiftOrderSummary(lastLift)} />
          </div>
        </Card>
      )}

      <Card>
        <h3 className="text-sm font-semibold text-heading mb-3">Summary</h3>
        <div className="space-y-2 text-sm">
          <SidebarMetaRow label="Mode" value={isStockMode ? STOCK_LIFT_LABEL : 'Customer dispatch'} />
          <SidebarMetaRow label="Lift type" value={isSelfLift ? 'Self lift' : 'Broker / third party'} />
          <SidebarMetaRow label="Allocation total" value={formatQty(allocTotal)} tabular />
          <SidebarMetaRow label={tankerQtyLabel} value={formatQty(plannedQty)} tabular />
          {balanceApplied > 0 && (
            <SidebarMetaRow label="Balance applied" value={formatQty(balanceApplied)} tabular />
          )}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
            <SidebarMetaRow label="Tankers" value={tankerCount} tabular />
          </div>
          <p className="text-xs text-muted pt-1">{TABLE_QTY_NOTE}</p>
        </div>
      </Card>

      {saveError && <FormErrorBanner>{saveError}</FormErrorBanner>}

      <div className="flex flex-col gap-2 hidden sm:flex">
        <Button className="w-full" onClick={onSave} disabled={saveDisabled} loading={saveLoading}>
          <Save className="h-4 w-4" /> {isEdit ? 'Update Lift' : 'Save Lift'}
        </Button>
        <Button variant="outline" className="w-full" onClick={onCancel} disabled={isSaving}>
          <ArrowLeft className="h-4 w-4" /> Cancel
        </Button>
      </div>
    </div>
  )
}

function LiftFormPage({ editLiftRef }: { editLiftRef?: number }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const store = useTradeStore()
  const toast = useToast()
  const isEdit = editLiftRef != null
  const editingLift = isEdit ? store.lifts.find(l => l.liftRef === editLiftRef) : undefined
  const poPending = store.getPOPending()
  const soPending = store.getSOPending()
  const [saveError, setSaveError] = useState('')
  const [tankerFieldErrors, setTankerFieldErrors] = useState<LiftTankerFieldErrorMap>({})
  const [saving, setSaving] = useState(false)
  const [itemFilter, setItemFilter] = useState('')
  const [sellerFilter, setSellerFilter] = useState('')

  const urlPoRef = searchParams.get('poRef') ?? ''
  const urlSoRef = searchParams.get('soRef') ?? ''
  const urlStock = searchParams.get('stock') === '1'
  const urlQty = searchParams.get('qty') ?? ''

  const [liftPurpose, setLiftPurpose] = useState<'dispatch' | 'stock'>(() => (urlStock ? 'stock' : 'dispatch'))
  const [stockLift, setStockLift] = useState<StockLiftDraft>(() => ({
    poRef: urlPoRef,
    qty: urlQty,
  }))

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [salesInvoiceNo, setSalesInvoiceNo] = useState('')
  const [remarks, setRemarks] = useState('')
  const [isSelfLift, setIsSelfLift] = useState('true')
  const [allocations, setAllocations] = useState<LiftAllocationDraft[]>(() => draftsFromUrl(urlPoRef, urlSoRef, urlQty))
  const [tankers, setTankers] = useState<LiftTankerFormValues[]>([emptyLiftTankerForm()])
  const [balanceAppliedQty, setBalanceAppliedQty] = useState('')
  const [loadOnRisk, setLoadOnRisk] = useState(false)
  const liftBaseline = useRef('')
  /** Set after save so the leave guard clears before navigating to the register. */
  const [registerHrefAfterSave, setRegisterHrefAfterSave] = useState<string | null>(null)

  useEffect(() => {
    if (isEdit) return
    liftBaseline.current = serializeLiftFormState({
      date,
      salesInvoiceNo,
      remarks,
      isSelfLift,
      liftPurpose,
      stockLift,
      allocations,
      tankers,
      balanceAppliedQty,
      loadOnRisk,
    })
    // Capture initial (including URL prefill) once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!editingLift) return
    setDate(normalizeDateToIso(editingLift.date) || editingLift.date.slice(0, 10))
    setSalesInvoiceNo(editingLift.salesInvoiceNo ?? '')
    setRemarks(editingLift.remarks ?? '')
    setIsSelfLift(editingLift.isSelfLift ? 'true' : 'false')
    setLiftPurpose(isStockLift(editingLift) ? 'stock' : 'dispatch')
    const loaded = getLiftAllocations(editingLift)
    if (isStockLift(editingLift) && loaded[0]) {
      setStockLift({ poRef: loaded[0].poRef, qty: String(loaded[0].qtyMt) })
    }
    const balance = editingLift.status === 'pending' ? (editingLift.balanceAppliedQtyMt ?? 0) : 0
    setAllocations(loaded.map((a, i) => newAllocationDraft({
      soRef: a.soRef,
      poRef: a.poRef,
      qty: String(i === 0 && balance > 0 ? Math.max(0, a.qtyMt - balance) : a.qtyMt),
    })))
    setTankers(getLiftTankers(editingLift).map(liftTankerToForm))
    setBalanceAppliedQty(
      editingLift.status === 'pending' && editingLift.balanceAppliedQtyMt
        ? String(editingLift.balanceAppliedQtyMt)
        : '',
    )
    setLoadOnRisk(Boolean(editingLift.loadOnRisk))
    const firstSo = store.tradeOrders.find(s => s.ref === editingLift.soRef)
    if (firstSo?.itemName) setItemFilter(firstSo.itemName)
    const bookedPo = firstSo?.poRef
      ? store.tradeOrders.find(o => o.ref === firstSo.poRef && o.side === 'purchase')
      : store.tradeOrders.find(o => o.ref === editingLift.poRef && o.side === 'purchase')
    if (bookedPo) setSellerFilter(purchaseSellerName(bookedPo))
    const balanceQty = editingLift.status === 'pending' && editingLift.balanceAppliedQtyMt
      ? String(editingLift.balanceAppliedQtyMt)
      : ''
    const liftDate = normalizeDateToIso(editingLift.date) || editingLift.date.slice(0, 10)
    liftBaseline.current = serializeLiftFormState({
      date: liftDate,
      salesInvoiceNo: editingLift.salesInvoiceNo ?? '',
      remarks: editingLift.remarks ?? '',
      isSelfLift: editingLift.isSelfLift ? 'true' : 'false',
      liftPurpose: isStockLift(editingLift) ? 'stock' : 'dispatch',
      stockLift: isStockLift(editingLift) && loaded[0]
        ? { poRef: loaded[0].poRef, qty: String(loaded[0].qtyMt) }
        : { poRef: urlPoRef, qty: urlQty },
      allocations: loaded.map((a, i) => newAllocationDraft({
        soRef: a.soRef ?? '',
        poRef: a.poRef,
        qty: String(i === 0 && balance > 0 ? Math.max(0, a.qtyMt - balance) : a.qtyMt),
      })),
      tankers: getLiftTankers(editingLift).map(liftTankerToForm),
      balanceAppliedQty: balanceQty,
      loadOnRisk: Boolean(editingLift.loadOnRisk),
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingLift?.id])

  useEffect(() => {
    if (isEdit) return
    if (urlSoRef) {
      const so = store.tradeOrders.find(s => s.ref === urlSoRef && s.side === 'sale')
      if (so?.itemName) setItemFilter(so.itemName)
      const po = so?.poRef
        ? store.tradeOrders.find(p => p.ref === so.poRef && p.side === 'purchase')
        : store.tradeOrders.find(p => p.ref === urlPoRef && p.side === 'purchase')
      if (po) setSellerFilter(purchaseSellerName(po))
    } else if (urlPoRef) {
      const po = store.tradeOrders.find(p => p.ref === urlPoRef && p.side === 'purchase')
      if (po?.itemName) setItemFilter(po.itemName)
      if (po) setSellerFilter(purchaseSellerName(po))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlPoRef, urlSoRef, isEdit])

  useEffect(() => {
    if (isEdit) return
    setAllocations(rows => rows.map(row => {
      if (!row.soRef || row.qty) return row
      const so = store.tradeOrders.find(o => o.ref === row.soRef && o.side === 'sale')
      if (!so) return row
      const pool = poolPOsForSo(so, store.tradeOrders)
      const poRef = row.poRef && pool.some(p => p.ref === row.poRef)
        ? row.poRef
        : (pool.find(p => p.ref === so.poRef) ?? pool[0])?.ref ?? row.poRef
      const po = store.tradeOrders.find(o => o.ref === poRef && o.side === 'purchase')
      const soLeft = remainingOnOrder(so, store.lifts)
      const poLeft = po ? remainingOnOrder(po, store.lifts) : soLeft
      const qty = Math.max(0, Math.min(soLeft, poLeft))
      return { ...row, poRef, qty: qty > 0 ? String(qty) : '' }
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSoRef, urlPoRef, isEdit])

  const itemOptions = useMemo(
    () => uniqueSorted([
      ...soPending.filter(s => soMatchesSeller(s, sellerFilter, store.tradeOrders)).map(s => s.itemName),
      ...poPending.filter(p => !sellerFilter || purchaseSellerName(p) === sellerFilter).map(p => p.itemName),
    ]),
    [soPending, poPending, sellerFilter, store.tradeOrders],
  )

  const sellerOptions = useMemo(
    () => uniqueSorted(
      poPending
        .filter(p => !itemFilter || p.itemName === itemFilter)
        .map(purchaseSellerName)
        .filter(Boolean),
    ),
    [poPending, itemFilter],
  )

  const isStockMode = liftPurpose === 'stock' || (isEdit && editingLift != null && isStockLift(editingLift))

  const parsedAllocations = isStockMode
    ? (stockLift.poRef && (parseFloat(stockLift.qty) || 0) > 0
      ? [{ poRef: stockLift.poRef, qtyMt: parseFloat(stockLift.qty) || 0 }]
      : [])
    : allocations
      .filter(r => r.soRef && r.poRef)
      .map(r => ({ poRef: r.poRef, soRef: r.soRef, qtyMt: parseFloat(r.qty) || 0 }))
  const allocTotal = allocationTotal(parsedAllocations.filter(a => a.qtyMt > 0))

  const crossPoMessages = useMemo(
    () => [...new Set(
      allocations
        .filter(row => row.soRef && row.poRef)
        .map(row => crossPoAllocationSummary(row.soRef, row.poRef, store.tradeOrders))
        .filter((message): message is string => message != null),
    )],
    [allocations, store.tradeOrders],
  )

  useEffect(() => {
    if (isEdit && editingLift?.status === 'delivered') return
    if (tankers.length !== 1) return
    const next = allocTotal > 0 ? String(allocTotal) : ''
    if (tankers[0].actualQty === next) return
    setTankers(t => [{ ...t[0], actualQty: next }])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allocTotal])

  const firstSoRef = allocations[0]?.soRef ?? ''
  const firstPoRef = allocations[0]?.poRef ?? ''
  const singlePair = parsedAllocations.length === 1
  const poForBalance = store.tradeOrders.find(o => o.ref === firstPoRef && o.side === 'purchase')
  const sellerForBalance = poForBalance ? purchaseSellerName(poForBalance) : ''
  const sellerOutstanding = sellerForBalance
    ? store.getSellerOutstandingBalance(sellerForBalance).total
    : 0
  const outstandingBalance = singlePair
    ? sellerOutstanding
      + (isEdit && editingLift?.status === 'pending' ? (editingLift.balanceAppliedQtyMt ?? 0) : 0)
    : 0
  const balanceApplied = singlePair ? (parseFloat(balanceAppliedQty) || 0) : 0
  const totalPlanned = totalActualQtyFromForm(tankers)

  useEffect(() => {
    const so = store.tradeOrders.find(s => s.ref === firstSoRef && s.side === 'sale')
    if (so?.itemName && so.itemName !== itemFilter) setItemFilter(so.itemName)
    const po = so?.poRef
      ? store.tradeOrders.find(o => o.ref === so.poRef && o.side === 'purchase')
      : undefined
    const seller = po ? purchaseSellerName(po) : ''
    if (seller && seller !== sellerFilter) setSellerFilter(seller)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstSoRef])

  const currentLiftFormSnapshot = () => serializeLiftFormState({
    date,
    salesInvoiceNo,
    remarks,
    isSelfLift,
    liftPurpose,
    stockLift,
    allocations,
    tankers,
    balanceAppliedQty,
    loadOnRisk,
  })

  const liftDirty = registerHrefAfterSave == null && currentLiftFormSnapshot() !== liftBaseline.current

  const { requestLeave, dialog: unsavedDialog } = useUnsavedChangesGuard({
    dirty: liftDirty,
    message: 'Your lift entry has unsaved changes. Leave without saving?',
  })

  useEffect(() => {
    if (!registerHrefAfterSave) return
    navigate(registerHrefAfterSave, { replace: true })
    setRegisterHrefAfterSave(null)
  }, [registerHrefAfterSave, navigate])

  const handleCancel = () => {
    requestLeave(() => navigate('/lifts'))
  }

  const lastLift = useMemo(() => {
    return [...store.lifts]
      .filter(l => !isEdit || l.id !== editingLift?.id)
      .sort((a, b) => b.liftRef - a.liftRef)[0]
  }, [store.lifts, isEdit, editingLift?.id])

  if (isEdit && !editingLift) {
    return (
      <>
        <div className="animate-fade-in w-full mx-auto max-w-3xl">
          <EmptyState
            card
            icon={<Scale className="h-10 w-10" />}
            title="Lift not found"
            description={`No lift record #${editLiftRef} exists.`}
            action={<Button to="/lifts">Back to Lift Register</Button>}
          />
        </div>
        {unsavedDialog}
      </>
    )
  }

  if (!isEdit && poPending.length === 0) {
    return (
      <>
        <div className="animate-fade-in w-full mx-auto max-w-3xl">
          <PageHeader
            title="Record Lift"
            subtitle="Receive stock or dispatch to a customer"
            breadcrumb={<Breadcrumb items={[
              { label: 'Tradeal', href: '/' },
              { label: 'Lift Register', href: '/lifts' },
              { label: 'New Lift' },
            ]} />}
          />
          <EmptyState
            card
            icon={<Scale className="h-10 w-10" />}
            title="Cannot record a lift yet"
            description="Create a purchase order first — then you can stock goods or dispatch to a sales order."
            action={<Button onClick={() => navigate('/purchase-orders/new')}>New PO</Button>}
          />
        </div>
        {unsavedDialog}
      </>
    )
  }

  const handleSave = async () => {
    if (saving) return
    setSaveError('')
    setTankerFieldErrors({})
    const ready = parsedAllocations.filter(a => a.qtyMt > 0)
    if (ready.length === 0) {
      setSaveError(isStockMode ? 'Select a PO and quantity to stock' : 'Add at least one SO with quantity')
      return
    }
    const tankerValidation = collectLiftTankerFieldErrors(
      tankers,
      isEdit && editingLift?.status === 'delivered' ? 'actual' : 'planned',
    )
    if (tankerValidation.message) {
      setTankerFieldErrors(tankerValidation.fields)
      return
    }
    if (balanceApplied > outstandingBalance) {
      setSaveError(`Balance adjustment cannot exceed ${formatQty(outstandingBalance)} outstanding`)
      return
    }
    const payload = {
      allocations: ready,
      date,
      tankers: tankers.map(formToLiftTanker),
      isSelfLift: isSelfLift === 'true',
      stockLift: isStockMode,
      loadOnRisk,
      ...(isSelfLift === 'false' && remarks.trim() ? { remarks: remarks.trim() } : {}),
      ...(editingLift?.status !== 'delivered' && !isStockMode
        ? { balanceAppliedQtyMt: balanceApplied }
        : {}),
      ...(isEdit && editingLift?.status === 'delivered'
        ? { salesInvoiceNo }
        : {}),
    }
    try {
      setSaving(true)
      const registerHref = (liftRef: number) =>
        `/lifts?ref=${encodeURIComponent(String(liftRef))}`

      if (isEdit && editingLift) {
        await store.updateLift(editingLift.id, payload)
        liftBaseline.current = currentLiftFormSnapshot()
        toast.success(`${formatLiftRef(editingLift.liftRef)} updated`, {
          description: `${formatQty(totalActualQtyFromForm(tankers))} ${editingLift.status === 'delivered' ? 'actual' : 'planned'}`,
        })
        setRegisterHrefAfterSave(registerHref(editingLift.liftRef))
      } else {
        const lift = await store.addLift(payload)
        liftBaseline.current = currentLiftFormSnapshot()
        toast.success(`${formatLiftRef(lift.liftRef)} recorded`, {
          description: `${formatQty(lift.liftedQty)} planned · in transit`,
        })
        setRegisterHrefAfterSave(registerHref(lift.liftRef))
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save lift')
      toast.error('Could not save lift', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  const pageTitle = isEdit ? `Edit ${formatLiftRef(editLiftRef!)}` : 'Record Lift'
  const pageSubtitle = isEdit
    ? editingLift?.status === 'delivered'
      ? 'Correct date, SO/PO links, and actual weighed quantities — changes sync to orders and inventory'
      : isStockMode
        ? 'Update date and tanker details for stock received from PO'
        : 'Update date, tanker details, and split quantity across SOs while in transit'
    : isStockMode
      ? `Receive goods into ${STOCK_LIFT_LABEL.toLowerCase()} — sell later when you have a buyer`
      : 'One tanker can cover several SOs — add each order and split the load'

  const canSave = parsedAllocations.some(a => a.qtyMt > 0)

  return (
    <>
    <div className="animate-fade-in w-full mx-auto max-w-3xl lg:max-w-5xl pb-24 sm:pb-0">
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        breadcrumb={<Breadcrumb items={[
          { label: 'Tradeal', href: '/' },
          { label: 'Lift Register', href: '/lifts' },
          { label: isEdit ? formatLiftRef(editLiftRef!) : 'New Lift' },
        ]} />}
      />

      {Object.keys(tankerFieldErrors).length > 0 && (
        <FieldValidationBanner className="mb-4" />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {!isEdit && (
            <Card>
              <h3 className="text-sm font-semibold mb-4">Lift for</h3>
              <div className="space-y-4">
                <div>
                  <SegmentedControl
                    ariaLabel="Lift purpose"
                    options={[
                      { id: 'dispatch', label: 'Customer dispatch' },
                      { id: 'stock', label: 'Own stock' },
                    ]}
                    value={liftPurpose}
                    onChange={next => {
                      setLiftPurpose(next)
                      if (next === 'stock') setIsSelfLift('true')
                    }}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    label="Item"
                    searchable
                    options={[
                      { value: '', label: 'All items' },
                      ...itemOptions.map(item => ({ value: item, label: item })),
                    ]}
                    value={itemFilter}
                    onChange={e => setItemFilter(e.target.value)}
                  />
                  <Select
                    label="Seller"
                    searchable
                    options={[
                      { value: '', label: 'All sellers' },
                      ...sellerOptions.map(seller => ({ value: seller, label: seller })),
                    ]}
                    value={sellerFilter}
                    onChange={e => setSellerFilter(e.target.value)}
                  />
                </div>
              </div>
            </Card>
          )}

          <CaptionCard
            caption={
              (!isEdit || editingLift?.status === 'pending') && outstandingBalance > 0 && singlePair
                ? {
                  label: 'Remaining balance',
                  value: `${formatQty(outstandingBalance)} owed on this PO/SO pair`,
                  detail: balanceApplied > 0
                    ? `Total dispatch: ${formatQty(totalPlanned + balanceApplied)} (${formatQty(totalPlanned)} new + ${formatQty(balanceApplied)} balance)`
                    : 'Apply this on the next lift to clear short deliveries or qty carried from a closed order.',
                }
                : undefined
            }
          >
            {isStockMode ? (
              <StockLiftForm
                value={stockLift}
                onChange={setStockLift}
                orders={store.tradeOrders}
                lifts={store.lifts}
                itemFilter={itemFilter}
                sellerFilter={sellerFilter}
                excludeLiftId={editingLift?.id}
              />
            ) : (
              <LiftAllocationsForm
                rows={allocations}
                onChange={setAllocations}
                orders={store.tradeOrders}
                lifts={store.lifts}
                itemFilter={itemFilter}
                sellerFilter={sellerFilter}
                excludeLiftId={editingLift?.id}
              />
            )}

            {crossPoMessages.length > 0 && (
              <div className="mt-4">
                <CrossPoNotice messages={crossPoMessages} />
              </div>
            )}

            {(!isEdit || editingLift?.status === 'pending') && outstandingBalance > 0 && singlePair && (
              <div className="sm:max-w-xs mt-4">
                <QtyInput
                  label="Apply balance in this lift (MT)"
                  value={balanceAppliedQty}
                  maxQty={outstandingBalance > 0 ? outstandingBalance : undefined}
                  maxQtyMessage={`Cannot exceed ${formatQty(outstandingBalance)} outstanding`}
                  onChange={e => setBalanceAppliedQty(sanitizeQtyInput(e.target.value))}
                  placeholder={`Up to ${formatQty(outstandingBalance)}`}
                />
              </div>
            )}

            {!isEdit && !isStockMode && firstPoRef && parsedAllocations.length === 0 && (
              <div className="mt-4">
                <Button to={`/sales-orders/new?poRef=${encodeURIComponent(firstPoRef)}`} variant="outline" size="sm">
                  Create SO for {formatPoRef(firstPoRef)}
                </Button>
              </div>
            )}
          </CaptionCard>

          <Card>
            <h3 className="text-sm font-semibold mb-4">Lift details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Lift Ref. No."
                value={formatLiftRef(isEdit && editLiftRef != null ? editLiftRef : store.counters.lift + 1)}
                readOnly
              />
              <DatePicker label="Lift Date" value={date} onChange={setDate} />
              <Select
                searchable={false}
                label="Lift Type"
                options={[
                  { value: 'false', label: 'Broker / Third Party' },
                  { value: 'true', label: 'Self Lift' },
                ]}
                value={isSelfLift}
                onChange={e => {
                  setIsSelfLift(e.target.value)
                  if (e.target.value === 'true') setRemarks('')
                }}
              />
              {isEdit && editingLift?.status === 'delivered' && (
                <Input
                  label="Sales Invoice No."
                  value={salesInvoiceNo}
                  onChange={e => setSalesInvoiceNo(e.target.value)}
                  className="text-base"
                />
              )}
              {isSelfLift === 'false' && (
                <div className="sm:col-span-2">
                  <Input
                    label="Remarks"
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    placeholder="Optional notes for this lift"
                  />
                </div>
              )}
            </div>
          </Card>

          <CaptionCard
            captions={[
              buildLiftTankerAvailabilityCaption({
                tankers,
                maxQtyMt: allocTotal > 0 ? allocTotal : undefined,
              }),
              buildLoadOnRiskCaption(loadOnRisk, setLoadOnRisk),
            ].filter((strip): strip is NonNullable<typeof strip> => strip != null)}
          >
            <h3 className="text-sm font-semibold mb-4">Tankers</h3>
            <LiftTankersForm
              tankers={tankers}
              maxQtyMt={allocTotal > 0 ? allocTotal : undefined}
              qtyMode={isEdit && editingLift?.status === 'delivered' ? 'actual' : 'planned'}
              fieldErrors={tankerFieldErrors}
              onChange={next => {
                setTankerFieldErrors({})
                setTankers(next)
              }}
            />
          </CaptionCard>
        </div>

        <LiftFormSidebar
          lastLift={lastLift}
          isStockMode={isStockMode}
          allocTotal={allocTotal}
          totalPlanned={totalPlanned}
          tankerCount={tankers.length}
          balanceApplied={balanceApplied}
          isSelfLift={isSelfLift === 'true'}
          saveError={saveError}
          onSave={handleSave}
          onCancel={handleCancel}
          isEdit={isEdit}
          saveLoading={saving}
          saveDisabled={saving || !canSave}
          isDeliveredActual={isEdit && editingLift?.status === 'delivered'}
        />
      </div>

      <StickyFormActions
        saveLabel={isEdit ? 'Update Lift' : 'Save Lift'}
        onSave={handleSave}
        onCancel={handleCancel}
        error={saveError}
        saveLoading={saving}
        saveDisabled={saving || !canSave}
      />
    </div>
    {unsavedDialog}
    </>
  )
}
