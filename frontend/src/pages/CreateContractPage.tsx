import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { isBrokerAccount } from '../lib/auth'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { AmountInput } from '../components/ui/AmountInput'
import { Select } from '../components/ui/Select'
import { Card } from '../components/ui/Card'
import { DatePicker } from '../components/ui/DatePicker'
import { StickyFormActions } from '../components/ui/StickyFormActions'
import { FormErrorBanner } from '../components/ui/FieldError'
import { formatCurrency, formatDeliveryPeriodRange, formatQty, cn } from '../lib/utils'
import { parseIndianAmount } from '../lib/indianAmount'
import { orderLineAmount } from '../lib/orderRate'
import { useToast } from '../hooks/useToast'
import { useTradeStore } from '../store/TradeStore'
import { useAuth } from '../hooks/useAuth'
import { organisationApi, type BrokerContractShare } from '../api/organisationApi'
import { ContractReceiveModal } from '../components/contracts/ContractReceiveModal'
import { ContractDeliveryPanel } from '../components/contracts/ContractDeliveryPanel'
import { ContractPartyField, useContractPartyOrgLookup, type ContractPartyValue } from '../components/contracts/ContractPartyField'
import { Modal } from '../components/ui/Drawer'
import type { BrokerContractDelivery } from '../api/organisationApi'
import { ApiError } from '../api/client'
import { appPath, APP_HOME } from '../lib/appShellMode'
import { dispatchContractSharesRefresh } from '../lib/contractSharesRefresh'
import {
  brokerContractPdfDataUrl,
  downloadBrokerContractPdf,
  suggestedBrokerContractFilename,
  type BrokerContractPdfInput,
} from '../lib/brokerContractPdf'
import { Download } from 'lucide-react'

function buyerPartyFromForm(form: ReturnType<typeof emptyForm>): ContractPartyValue {
  return {
    onTradeal: form.buyerOnTradeal,
    orgCode: form.buyerOrgCode,
    externalName: form.buyerExternalName,
    externalEmail: form.buyerExternalEmail,
    externalPhone: form.buyerExternalPhone,
  }
}

function sellerPartyFromForm(form: ReturnType<typeof emptyForm>): ContractPartyValue {
  return {
    onTradeal: form.sellerOnTradeal,
    orgCode: form.sellerOrgCode,
    externalName: form.sellerExternalName,
    externalEmail: form.sellerExternalEmail,
    externalPhone: form.sellerExternalPhone,
  }
}

function applyBuyerParty(form: ReturnType<typeof emptyForm>, party: ContractPartyValue) {
  return {
    ...form,
    buyerOnTradeal: party.onTradeal,
    buyerOrgCode: party.orgCode,
    buyerExternalName: party.externalName,
    buyerExternalEmail: party.externalEmail,
    buyerExternalPhone: party.externalPhone,
  }
}

function applySellerParty(form: ReturnType<typeof emptyForm>, party: ContractPartyValue) {
  return {
    ...form,
    sellerOnTradeal: party.onTradeal,
    sellerOrgCode: party.orgCode,
    sellerExternalName: party.externalName,
    sellerExternalEmail: party.externalEmail,
    sellerExternalPhone: party.externalPhone,
  }
}

function emptyForm(brokerName: string) {
  return {
    buyer: '',
    seller: '',
    buyerOnTradeal: true,
    sellerOnTradeal: true,
    buyerExternalName: '',
    buyerExternalEmail: '',
    buyerExternalPhone: '',
    sellerExternalName: '',
    sellerExternalEmail: '',
    sellerExternalPhone: '',
    buyerOrgCode: '',
    sellerOrgCode: '',
    commodity: '',
    quantity: '',
    unit: 'MT',
    rate: '',
    brokerage: '',
    gst: '5',
    location: '',
    paymentTerms: '',
    deliveryType: 'period',
    deliveryFrom: '',
    deliveryTo: '',
    broker: brokerName,
  }
}

const MONTH_INDEX: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

function isoFromLabel(label: string): string {
  const match = label.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/)
  if (!match) return ''
  const month = MONTH_INDEX[match[2].toLowerCase()]
  if (!month) return ''
  return `${match[3]}-${month}-${match[1].padStart(2, '0')}`
}

function parseStoredDelivery(period: string): { deliveryType: string; deliveryFrom: string; deliveryTo: string; location: string } {
  const parts = period.split(' · ').map(part => part.trim()).filter(Boolean)
  const head = parts[0] ?? ''
  const location = parts.slice(1).join(' · ')
  if (/^ready$/i.test(head)) {
    return { deliveryType: 'ready', deliveryFrom: '', deliveryTo: '', location }
  }
  const range = head.split(/\s+[–-]\s+/)
  const from = isoFromLabel(range[0] ?? '')
  const to = isoFromLabel(range[1] ?? range[0] ?? '')
  if (!from) return { deliveryType: 'period', deliveryFrom: '', deliveryTo: '', location: period }
  return { deliveryType: 'period', deliveryFrom: from, deliveryTo: to || from, location }
}

function formFromShare(share: BrokerContractShare, brokerName: string) {
  const delivery = parseStoredDelivery(share.delivery_period)
  const gstMatch = /^GST\s+([\d.]+)%$/i.exec(share.note.trim())
  const buyerExternal = share.buyer_party?.channel === 'external'
  const sellerExternal = share.seller_party?.channel === 'external'
  return {
    buyer: share.buyer_name,
    seller: share.seller_name,
    buyerOnTradeal: !buyerExternal,
    sellerOnTradeal: !sellerExternal,
    buyerExternalName: buyerExternal ? (share.buyer_party?.name || share.buyer_name) : '',
    buyerExternalEmail: buyerExternal ? (share.buyer_party?.email || '') : '',
    buyerExternalPhone: buyerExternal ? (share.buyer_party?.phone || '') : '',
    sellerExternalName: sellerExternal ? (share.seller_party?.name || share.seller_name) : '',
    sellerExternalEmail: sellerExternal ? (share.seller_party?.email || '') : '',
    sellerExternalPhone: sellerExternal ? (share.seller_party?.phone || '') : '',
    buyerOrgCode: share.buyer_org_code,
    sellerOrgCode: share.seller_org_code,
    commodity: share.item_name,
    quantity: share.quantity,
    unit: 'MT',
    rate: share.rate,
    brokerage: share.brokerage.replace(/%/g, ''),
    gst: gstMatch?.[1] ?? '',
    location: delivery.location,
    paymentTerms: share.payment_terms,
    deliveryType: delivery.deliveryType,
    deliveryFrom: delivery.deliveryFrom,
    deliveryTo: delivery.deliveryTo,
    broker: brokerName,
  }
}

function deliveryLabel(form: ReturnType<typeof emptyForm>): string {
  if (form.deliveryType === 'ready') return 'Ready'
  return formatDeliveryPeriodRange(form.deliveryFrom, form.deliveryTo)
}

function deliveryPeriodStored(form: ReturnType<typeof emptyForm>): string {
  if (form.deliveryType === 'ready') {
    return ['Ready', form.location.trim()].filter(Boolean).join(' · ')
  }
  return [formatDeliveryPeriodRange(form.deliveryFrom, form.deliveryTo), form.location.trim()]
    .filter(part => part && part !== '—')
    .join(' · ')
}

function contractNoteFromForm(form: ReturnType<typeof emptyForm>, editing?: BrokerContractShare): string {
  if (form.gst.trim()) return `GST ${form.gst.trim()}%`
  if (editing && !/^GST\s/i.test(editing.note)) return editing.note
  return ''
}

function contractPdfInputFromForm(
  form: ReturnType<typeof emptyForm>,
  contractRef: string | undefined,
  editing?: BrokerContractShare,
): BrokerContractPdfInput {
  return {
    contractRef: contractRef || 'Draft',
    buyer: form.buyer.trim(),
    seller: form.seller.trim(),
    broker: form.broker.trim(),
    commodity: form.commodity.trim(),
    quantity: form.quantity.trim(),
    unit: form.unit,
    rate: form.rate.trim(),
    brokerage: form.brokerage.trim() ? `${form.brokerage.trim()}%` : '',
    deliveryPeriod: deliveryPeriodStored(form),
    location: form.location.trim(),
    paymentTerms: form.paymentTerms.trim(),
    note: contractNoteFromForm(form, editing),
  }
}

export function CreateContractPage() {
  const { session } = useAuth()
  if (!isBrokerAccount(session)) {
    return <Navigate to={appPath('/contracts')} replace />
  }
  return <ContractEntry />
}

export function EditBrokerContractPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { session } = useAuth()
  const [share, setShare] = useState<BrokerContractShare | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (!isBrokerAccount(session)) return
    const shareId = Number(id)
    if (!Number.isFinite(shareId)) {
      setMissing(true)
      return
    }
    let cancelled = false
    organisationApi.getBrokerShare(shareId)
      .then(res => {
        if (cancelled) return
        if (res.share.role !== 'broker') {
          navigate(appPath('/contracts'), { replace: true })
          return
        }
        setShare(res.share)
      })
      .catch(err => {
        if (cancelled) return
        setMissing(true)
        toast.error(err instanceof ApiError ? err.message : 'Could not open contract')
      })
    return () => {
      cancelled = true
    }
  }, [id, navigate, session, toast])

  if (!isBrokerAccount(session)) return <Navigate to={appPath('/contracts')} replace />
  if (missing) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Contract not found"
          breadcrumb={<Breadcrumb items={[
            { label: 'Tradeal', href: APP_HOME },
            { label: 'Contracts', href: appPath('/contracts') },
            { label: 'Edit' },
          ]} />}
        />
        <Button variant="outline" to={appPath('/contracts')}>Back to contracts</Button>
      </div>
    )
  }
  if (!share) return <p className="text-sm text-muted">Loading contract…</p>
  if (share.deleted_at) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title={share.contract_ref}
          subtitle="This contract has been deleted."
          breadcrumb={<Breadcrumb items={[
            { label: 'Tradeal', href: APP_HOME },
            { label: 'Contracts', href: appPath('/contracts?tab=deleted') },
            { label: share.contract_ref },
          ]} />}
        />
        <Button variant="outline" to={appPath(`/contract-shares/${share.id}`)}>View contract</Button>
      </div>
    )
  }
  return <ContractEntry editing={share} />
}

function ContractEntry({ editing }: { editing?: BrokerContractShare }) {
  const navigate = useNavigate()
  const toast = useToast()
  const store = useTradeStore()
  const { session } = useAuth()
  const brokerDesk = isBrokerAccount(session) || Boolean(editing)
  const [saving, setSaving] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [deliveryOpen, setDeliveryOpen] = useState(false)
  const [deliveryResult, setDeliveryResult] = useState<BrokerContractDelivery | null>(null)
  const [sentShareId, setSentShareId] = useState<number | null>(null)
  const [saveError, setSaveError] = useState('')
  const [form, setForm] = useState(() => (
    editing
      ? formFromShare(editing, session?.organisationName || session?.name || '')
      : emptyForm(session?.organisationName || session?.name || '')
  ))
  const buyerOrg = useContractPartyOrgLookup(brokerDesk && form.buyerOnTradeal, form.buyerOrgCode)
  const sellerOrg = useContractPartyOrgLookup(brokerDesk && form.sellerOnTradeal, form.sellerOrgCode)

  useEffect(() => {
    const name = session?.organisationName || session?.name || ''
    if (!name) return
    setForm(current => current.broker ? current : { ...current, broker: name })
  }, [session])

  useEffect(() => {
    if (!brokerDesk) return
    const buyer = form.buyerOnTradeal ? (buyerOrg.organisation?.name ?? '') : form.buyerExternalName
    const seller = form.sellerOnTradeal ? (sellerOrg.organisation?.name ?? '') : form.sellerExternalName
    setForm(current => (
      current.buyer === buyer && current.seller === seller
        ? current
        : { ...current, buyer, seller }
    ))
  }, [
    brokerDesk,
    buyerOrg.organisation,
    sellerOrg.organisation,
    form.buyerOnTradeal,
    form.sellerOnTradeal,
    form.buyerExternalName,
    form.sellerExternalName,
  ])

  const value = orderLineAmount(parseFloat(form.quantity) || 0, parseIndianAmount(form.rate))
  const brokerageAmt = value * (parseFloat(form.brokerage) / 100)
  const update = (key: string, val: string) => setForm(current => ({ ...current, [key]: val }))
  const contractsHref = appPath('/contracts')
  const cancel = () => navigate(editing ? appPath(`/contract-shares/${editing.id}`) : brokerDesk ? APP_HOME : contractsHref)

  const save = async () => {
    setSaveError('')
    if (brokerDesk) {
      if (editing && (!form.buyerOnTradeal || !form.sellerOnTradeal)) {
        setSaveError('Editing off-Tradeal parties is not supported yet. Delete and resend if you need to change them.')
        return
      }
      if (form.buyerOnTradeal) {
        if (buyerOrg.loading || sellerOrg.loading) return
        if (!buyerOrg.organisation) {
          setSaveError(buyerOrg.error || 'Enter a valid buyer organisation code')
          return
        }
      } else if (!form.buyerExternalName.trim()) {
        setSaveError('Enter the buyer name')
        return
      } else if (!form.buyerExternalEmail.trim() && !form.buyerExternalPhone.trim()) {
        setSaveError('Enter buyer email or mobile to send the contract')
        return
      }
      if (form.sellerOnTradeal) {
        if (sellerOrg.loading) return
        if (!sellerOrg.organisation) {
          setSaveError(sellerOrg.error || 'Enter a valid seller organisation code')
          return
        }
      } else if (!form.sellerExternalName.trim()) {
        setSaveError('Enter the seller name')
        return
      } else if (!form.sellerExternalEmail.trim() && !form.sellerExternalPhone.trim()) {
        setSaveError('Enter seller email or mobile to send the contract')
        return
      }
    } else if (!form.buyer.trim() || !form.seller.trim()) {
      setSaveError('Enter the buyer and the seller')
      return
    }
    if (!form.commodity.trim()) {
      setSaveError('Enter a commodity')
      return
    }
    if (!(parseFloat(form.quantity) > 0)) {
      setSaveError('Enter a quantity')
      return
    }
    if (form.deliveryType === 'period' && (!form.deliveryFrom || !form.deliveryTo)) {
      setSaveError('Enter a from and to date for period delivery')
      return
    }
    if (form.deliveryType === 'period' && form.deliveryTo < form.deliveryFrom) {
      setSaveError('The to date cannot be before the from date')
      return
    }

    if (brokerDesk) {
      setReviewOpen(true)
      return
    }

    setSaving(true)
    try {
      const created = await store.createContract({
        buyer: form.buyer,
        seller: form.seller,
        commodity: form.commodity,
        quantity: parseFloat(form.quantity) || 0,
        unit: form.unit,
        rate: parseIndianAmount(form.rate),
        broker: form.broker,
        deliveryDate: form.deliveryType === 'ready' ? '' : form.deliveryFrom,
        location: form.location,
        paymentStatus: 'outstanding',
        status: 'confirmed',
      })
      toast.success('Contract created', {
        description: `${created.ref} · ${formatQty(created.quantity, created.unit)} ${created.commodity}`,
      })
      navigate(appPath(`/contracts/${created.id}`))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create contract'
      setSaveError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const sendContract = async () => {
    const period = deliveryPeriodStored(form)
    setSaving(true)
    try {
      const note = contractNoteFromForm(form, editing)
      const body = {
        buyer_org_code: form.buyerOnTradeal ? form.buyerOrgCode.trim() : '',
        seller_org_code: form.sellerOnTradeal ? form.sellerOrgCode.trim() : '',
        buyer_external_name: form.buyerOnTradeal ? '' : form.buyerExternalName.trim(),
        buyer_external_email: form.buyerOnTradeal ? '' : form.buyerExternalEmail.trim(),
        buyer_external_phone: form.buyerOnTradeal ? '' : form.buyerExternalPhone.trim(),
        seller_external_name: form.sellerOnTradeal ? '' : form.sellerExternalName.trim(),
        seller_external_email: form.sellerOnTradeal ? '' : form.sellerExternalEmail.trim(),
        seller_external_phone: form.sellerOnTradeal ? '' : form.sellerExternalPhone.trim(),
        note,
        item_name: form.commodity.trim(),
        quantity: form.quantity.trim(),
        rate: form.rate.trim(),
        brokerage: form.brokerage.trim() ? `${form.brokerage.trim()}%` : '',
        delivery_period: period,
        payment_terms: form.paymentTerms.trim(),
      }
      const attachPdf = !form.buyerOnTradeal || !form.sellerOnTradeal
      const pdfInput = contractPdfInputFromForm(form, editing?.contract_ref, editing)
      const pdfFilename = suggestedBrokerContractFilename(pdfInput)
      const pdf_data = attachPdf ? await brokerContractPdfDataUrl(pdfInput) : ''
      if (editing) {
        const share = await organisationApi.updateBrokerShare(editing.id, body)
        toast.success('Contract updated', {
          description: `${share.share.contract_ref}. The buyer and the seller have been notified.`,
        })
        setReviewOpen(false)
        dispatchContractSharesRefresh()
        navigate(appPath(`/contract-shares/${share.share.id}`))
        return
      }
      const res = await organisationApi.sendBrokerShare({
        ...body,
        contract_ref: '',
        filename: attachPdf ? pdfFilename : '',
        pdf_data,
      })
      toast.success('Contract sent', {
        description: res.share.contract_ref,
      })
      setReviewOpen(false)
      setDeliveryResult(res.delivery)
      setSentShareId(res.share.id)
      setDeliveryOpen(true)
      dispatchContractSharesRefresh()
    } finally {
      setSaving(false)
    }
  }

  const deliveryWhen = deliveryLabel(form)
  const hasOffTradealParty = brokerDesk && (!form.buyerOnTradeal || !form.sellerOnTradeal)

  const exportContractPdf = () => {
    if (!form.buyer.trim() || !form.seller.trim()) {
      toast.error('Choose buyer and seller before exporting the PDF')
      return
    }
    if (!form.commodity.trim()) {
      toast.error('Enter a commodity before exporting the PDF')
      return
    }
    downloadBrokerContractPdf(contractPdfInputFromForm(form, editing?.contract_ref, editing))
    toast.success('Contract PDF downloaded')
  }

  return (
    <div className="animate-fade-in w-full pb-24 sm:pb-0">
      <PageHeader
        title={editing ? 'Edit contract' : 'Contract entry'}
        subtitle={editing ? editing.contract_ref : 'Create a contract confirmation'}
        breadcrumb={<Breadcrumb items={[
          { label: 'Tradeal', href: APP_HOME },
          { label: 'Contracts', href: contractsHref },
          { label: editing ? editing.contract_ref : 'New contract', href: editing ? appPath(`/contract-shares/${editing.id}`) : undefined },
          ...(editing ? [{ label: 'Edit' }] : []),
        ]} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-8 lg:col-span-2" padding={false}>
          <div className="space-y-4 [&>*+*]:border-t [&>*+*]:border-gray-100 [&>*+*]:pt-4 dark:[&>*+*]:border-gray-800">
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {brokerDesk ? (
                <>
                  <ContractPartyField
                    label="Buyer"
                    value={buyerPartyFromForm(form)}
                    organisation={buyerOrg.organisation}
                    channelToggleDisabled={Boolean(editing && !form.buyerOnTradeal)}
                    fieldError={
                      form.buyerOnTradeal && form.buyerOrgCode.trim() && !buyerOrg.loading && !buyerOrg.organisation
                        ? (buyerOrg.error || 'Enter a valid organisation code')
                        : undefined
                    }
                    onChange={party => setForm(current => applyBuyerParty(current, party))}
                  />
                  <ContractPartyField
                    label="Seller"
                    value={sellerPartyFromForm(form)}
                    organisation={sellerOrg.organisation}
                    channelToggleDisabled={Boolean(editing && !form.sellerOnTradeal)}
                    fieldError={
                      form.sellerOnTradeal && form.sellerOrgCode.trim() && !sellerOrg.loading && !sellerOrg.organisation
                        ? (sellerOrg.error || 'Enter a valid organisation code')
                        : undefined
                    }
                    onChange={party => setForm(current => applySellerParty(current, party))}
                  />
                </>
              ) : (
                <>
                  <Input label="Buyer" value={form.buyer} onChange={e => update('buyer', e.target.value)} />
                  <Input label="Seller" value={form.seller} onChange={e => update('seller', e.target.value)} />
                </>
              )}
              <Input label="Broker" value={form.broker} readOnly={brokerDesk} onChange={e => update('broker', e.target.value)} />
            </section>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Commodity"
                searchable
                allowCustom
                searchPlaceholder="Search commodities..."
                options={[
                  { value: 'Palm Oil', label: 'Palm Oil' },
                  { value: 'Soybean Oil', label: 'Soybean Oil' },
                  { value: 'Coconut Oil', label: 'Coconut Oil' },
                ]}
                value={form.commodity}
                onChange={e => update('commodity', e.target.value)}
              />
              <Input label="Quantity" value={form.quantity} onChange={e => update('quantity', e.target.value)} />
              <Select
                label="Unit"
                searchable={false}
                options={[
                  { value: 'MT', label: 'Metric Tons (MT)' },
                  { value: 'KL', label: 'Kiloliters (KL)' },
                ]}
                value={form.unit}
                onChange={e => update('unit', e.target.value)}
              />
              <AmountInput label="Rate (₹/10 KG)" value={form.rate} onChange={v => update('rate', v)} />
            </section>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Select
                  searchable={false}
                  label="Delivery type"
                  options={[
                    { value: 'period', label: 'Period' },
                    { value: 'ready', label: 'Ready' },
                  ]}
                  value={form.deliveryType}
                  onChange={e => update('deliveryType', e.target.value)}
                />
                {form.deliveryType === 'ready' ? (
                  <p className="text-xs text-muted mt-1">Ready delivery has no dates.</p>
                ) : null}
              </div>
              {form.deliveryType === 'period' ? (
                <DatePicker
                  label="From"
                  value={form.deliveryFrom}
                  onChange={start => {
                    update('deliveryFrom', start)
                    if (!form.deliveryTo || form.deliveryTo < start) update('deliveryTo', start)
                  }}
                />
              ) : null}
              {form.deliveryType === 'period' ? (
                <DatePicker
                  label="To"
                  value={form.deliveryTo}
                  min={form.deliveryFrom || undefined}
                  onChange={end => update('deliveryTo', end)}
                />
              ) : null}
              <Input label="Delivery location" value={form.location} onChange={e => update('location', e.target.value)} />
              <Input label="Brokerage (%)" value={form.brokerage} onChange={e => update('brokerage', e.target.value)} />
              <Input label="GST (%)" value={form.gst} onChange={e => update('gst', e.target.value)} />
              <div className="sm:col-span-3">
                <Input label="Payment terms" value={form.paymentTerms} onChange={e => update('paymentTerms', e.target.value)} />
              </div>
            </section>
          </div>
        </Card>

        <div className="w-full space-y-3 lg:sticky lg:top-6 lg:z-10 lg:self-start">
          <div className="rounded-md bg-card shadow-[var(--shadow-card)] overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-heading">Summary</h3>
              <span className="text-sm text-muted truncate">{form.commodity || 'New contract'}</span>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-muted shrink-0">Buyer</span>
                <span className="font-medium text-heading text-right truncate">{form.buyer || '—'}</span>
              </div>
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-muted shrink-0">Seller</span>
                <span className="font-medium text-heading text-right truncate">{form.seller || '—'}</span>
              </div>
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-muted shrink-0">Delivery</span>
                <span className="font-medium text-heading text-right">{deliveryWhen}</span>
              </div>
              <div className="rounded-md bg-gray-50/90 dark:bg-gray-800/50 px-4 py-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted">Quantity</span>
                  <span className="tabular-nums text-heading">{formatQty(parseFloat(form.quantity) || 0, form.unit)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted">Contract value</span>
                  <span className="tabular-nums text-heading">{formatCurrency(value)}</span>
                </div>
                <div className="flex justify-between gap-3 border-t border-gray-200 dark:border-gray-700 pt-2">
                  <span className="font-semibold text-heading">Brokerage</span>
                  <span className={cn('font-semibold tabular-nums text-heading')}>
                    {formatCurrency(brokerageAmt)}
                  </span>
                </div>
              </div>
            </div>
            {hasOffTradealParty ? (
              <div className="border-t border-gray-200 bg-gray-100/90 px-6 py-4 dark:border-gray-700 dark:bg-gray-800/50">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Off-Tradeal party</p>
                <p className="mt-1 text-sm text-heading leading-relaxed">
                  Export a PDF they can keep and import into Tradeal when they join.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full sm:w-auto"
                  onClick={exportContractPdf}
                >
                  <Download className="h-4 w-4" />
                  Export contract PDF
                </Button>
              </div>
            ) : null}
          </div>

          <div className="sticky bottom-0 z-20 hidden shrink-0 bg-body pt-1 sm:flex flex-col gap-2 w-full">
            {saveError ? <FormErrorBanner>{saveError}</FormErrorBanner> : null}
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={cancel} disabled={saving}>
                Cancel
              </Button>
              <Button className="flex-[1.4]" onClick={() => void save()} disabled={saving} loading={saving}>
                {editing ? 'Save changes' : brokerDesk ? 'Create and send' : 'Create contract'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <StickyFormActions
        saveLabel={editing ? 'Save changes' : brokerDesk ? 'Create and send' : 'Create contract'}
        onSave={() => void save()}
        onCancel={cancel}
        error={saveError}
        saveLoading={saving}
        saveDisabled={saving}
      />
      {brokerDesk ? (
        <ContractReceiveModal
          open={reviewOpen}
          share={null}
          draft={{
            heading: form.commodity.trim() || 'New contract',
            caption: editing
              ? 'The buyer and the seller will be notified of what changed.'
              : 'This contract will be sent to the buyer and the seller.',
            facts: [
              { label: 'Buyer', value: form.buyer },
              { label: 'Seller', value: form.seller },
              { label: 'Quantity', value: formatQty(parseFloat(form.quantity) || 0, form.unit) },
              { label: 'Rate', value: form.rate ? `${formatCurrency(parseIndianAmount(form.rate))}/10 KG` : '' },
              { label: 'Value', value: formatCurrency(value) },
              { label: 'Brokerage', value: form.brokerage.trim() ? `${form.brokerage.trim()}%` : '' },
              { label: 'Delivery', value: deliveryWhen },
              { label: 'Location', value: form.location.trim() },
              { label: 'Payment', value: form.paymentTerms.trim() },
            ].filter(item => item.value),
          }}
          onSend={sendContract}
          onClose={() => { if (!saving) setReviewOpen(false) }}
        />
      ) : null}
      <Modal
        open={deliveryOpen}
        onClose={() => {
          setDeliveryOpen(false)
          if (sentShareId != null) navigate(appPath(`/contract-shares/${sentShareId}`))
        }}
        title="Contract sent"
        subtitle="Share the link with any party not on Tradeal yet."
        footer={(
          <Button
            onClick={() => {
              setDeliveryOpen(false)
              if (sentShareId != null) navigate(appPath(`/contract-shares/${sentShareId}`))
            }}
          >
            View contract
          </Button>
        )}
      >
        <ContractDeliveryPanel buyer={deliveryResult?.buyer} seller={deliveryResult?.seller} />
      </Modal>
    </div>
  )
}
