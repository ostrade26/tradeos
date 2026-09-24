import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Mail, FileDown, Check } from 'lucide-react'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb, Stepper } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { AmountInput } from '../components/ui/AmountInput'
import { Select } from '../components/ui/Select'
import { Card } from '../components/ui/Card'
import { DatePicker } from '../components/ui/DatePicker'
import { formatCurrency, formatQty } from '../lib/utils'
import { parseIndianAmount } from '../lib/indianAmount'
import { orderLineAmount } from '../lib/orderRate'
import { useToast } from '../hooks/useToast'
import { useTradeStore } from '../store/TradeStore'

const steps = [
  { id: 'parties', label: 'Parties' },
  { id: 'commodity', label: 'Commodity' },
  { id: 'terms', label: 'Terms' },
  { id: 'review', label: 'Review' },
]

export function CreateContractPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const store = useTradeStore()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    buyer: 'Shree Agro Traders',
    seller: 'Golden Palm Industries',
    commodity: 'Palm Oil',
    quantity: '100',
    unit: 'MT',
    rate: '1490.45',
    brokerage: '0.5',
    gst: '5',
    location: 'Mumbai, Maharashtra',
    paymentTerms: '50% advance, 50% on delivery',
    deliveryDate: '2026-08-20',
    broker: 'Rajesh Mehta',
  })

  const value = orderLineAmount(parseFloat(form.quantity) || 0, parseIndianAmount(form.rate))
  const brokerageAmt = value * (parseFloat(form.brokerage) / 100)

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  return (
    <div className="animate-fade-in max-w-3xl">
      <PageHeader
        title="Create Contract Confirmation"
        subtitle="Multi-party trade agreement"
        breadcrumb={<Breadcrumb items={[
          { label: 'Tradeal', href: '/' },
          { label: 'Contracts', href: '/contracts' },
          { label: 'New Contract' },
        ]} />}
      />

      <div className="mb-8 overflow-x-auto">
        <Stepper steps={steps} current={step} />
      </div>

      {step === 0 && (
        <Card className="space-y-4 animate-fade-in">
          <h3 className="text-sm font-semibold text-heading">Parties & Broker</h3>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Buyer" searchable allowCustom searchPlaceholder="Search buyers..." options={[
              { value: 'Shree Agro Traders', label: 'Shree Agro Traders' },
              { value: 'Metro Retail Chain', label: 'Metro Retail Chain' },
            ]} value={form.buyer} onChange={e => update('buyer', e.target.value)} />
            <Select label="Seller" searchable searchPlaceholder="Search sellers..." options={[
              { value: 'Golden Palm Industries', label: 'Golden Palm Industries' },
              { value: 'Kerala Oil Mills', label: 'Kerala Oil Mills' },
              { value: 'Sunrise Commodities', label: 'Sunrise Commodities' },
            ]} value={form.seller} onChange={e => update('seller', e.target.value)} />
            <Select label="Broker" searchable searchPlaceholder="Search brokers..." options={[
              { value: 'Rajesh Mehta', label: 'Rajesh Mehta' },
              { value: 'Priya Nair', label: 'Priya Nair' },
              { value: 'Amit Sharma', label: 'Amit Sharma' },
            ]} value={form.broker} onChange={e => update('broker', e.target.value)} />
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card className="space-y-4 animate-fade-in">
          <h3 className="text-sm font-semibold text-heading">Commodity Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Commodity" searchable allowCustom searchPlaceholder="Search commodities..." options={[
              { value: 'Palm Oil', label: 'Palm Oil' },
              { value: 'Soybean Oil', label: 'Soybean Oil' },
              { value: 'Coconut Oil', label: 'Coconut Oil' },
            ]} value={form.commodity} onChange={e => update('commodity', e.target.value)} />
            <Input label="Quantity" value={form.quantity} onChange={e => update('quantity', e.target.value)} />
            <Select label="Unit" searchable={false} options={[
              { value: 'MT', label: 'Metric Tons (MT)' },
              { value: 'KL', label: 'Kiloliters (KL)' },
            ]} value={form.unit} onChange={e => update('unit', e.target.value)} />
            <AmountInput label="Rate (₹/10 KG)" value={form.rate} onChange={v => update('rate', v)} />
          </div>
          <div className="rounded-lg bg-gray-100 dark:bg-gray-700/50/50 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Contract Value</span>
              <span className="font-semibold text-heading">{formatCurrency(value)}</span>
            </div>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="space-y-4 animate-fade-in">
          <h3 className="text-sm font-semibold text-heading">Terms & Delivery</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Delivery Location" value={form.location} onChange={e => update('location', e.target.value)} />
            <DatePicker
              label="Delivery Date"
              value={form.deliveryDate}
              onChange={v => update('deliveryDate', v)}
            />
            <Input label="Brokerage (%)" value={form.brokerage} onChange={e => update('brokerage', e.target.value)} />
            <Input label="GST (%)" value={form.gst} onChange={e => update('gst', e.target.value)} />
            <div className="col-span-2">
              <Input label="Payment Terms" value={form.paymentTerms} onChange={e => update('paymentTerms', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-muted">Attachments</label>
            <div className="mt-1.5 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
              <p className="text-sm text-muted">Drop files here or click to upload</p>
              <p className="text-xs text-muted mt-1">PDF, DOC, XLS up to 10MB</p>
            </div>
          </div>
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-4 animate-fade-in">
          <Card>
            <h3 className="text-sm font-semibold text-heading mb-4">Contract Summary</h3>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-8 space-y-4">
              <div className="text-center border-b border-gray-200 dark:border-gray-700 pb-4">
                <p className="text-xs text-muted uppercase tracking-wider">Contract Confirmation</p>
                <p className="text-lg font-semibold text-heading mt-1">New contract</p>
              </div>
              <div className="grid grid-cols-2 gap-y-3 text-sm">
                <div><span className="text-muted">Buyer</span><p className="font-medium">{form.buyer}</p></div>
                <div><span className="text-muted">Seller</span><p className="font-medium">{form.seller}</p></div>
                <div><span className="text-muted">Commodity</span><p className="font-medium">{form.commodity}</p></div>
                <div><span className="text-muted">Quantity</span><p className="font-medium">{formatQty(parseFloat(form.quantity) || 0, form.unit)}</p></div>
                <div><span className="text-muted">Rate</span><p className="font-medium">{formatCurrency(parseIndianAmount(form.rate))}/10 KG</p></div>
                <div><span className="text-muted">Total Value</span><p className="font-medium">{formatCurrency(value)}</p></div>
                <div><span className="text-muted">Broker</span><p className="font-medium">{form.broker}</p></div>
                <div><span className="text-muted">Brokerage</span><p className="font-medium">{formatCurrency(brokerageAmt)} ({form.brokerage}%)</p></div>
                <div><span className="text-muted">Delivery</span><p className="font-medium">{form.location}</p></div>
                <div><span className="text-muted">Payment</span><p className="font-medium">{form.paymentTerms}</p></div>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-heading mb-3">Email Preview</h3>
            <div className="rounded-lg bg-gray-100 dark:bg-gray-700/50/50 p-4 text-sm space-y-2">
              <p><span className="text-muted">To:</span> {form.buyer}, {form.seller}</p>
              <p><span className="text-muted">Subject:</span> Contract Confirmation — {form.commodity} {formatQty(parseFloat(form.quantity) || 0, form.unit)}</p>
              <p className="text-gray-600 dark:text-muted pt-2">Dear Parties, Please find attached the Contract Confirmation for {formatQty(parseFloat(form.quantity) || 0, form.unit)} of {form.commodity} at {formatCurrency(parseIndianAmount(form.rate))}/10 KG. Total contract value: {formatCurrency(value)}...</p>
            </div>
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between mt-6">
        <Button variant="outline" onClick={() => step > 0 ? setStep(s => s - 1) : navigate('/contracts')}>
          <ArrowLeft className="h-4 w-4" /> {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        <div className="flex gap-2">
          {step === 3 && (
            <>
              <Button variant="outline" onClick={() => toast.info('PDF export is not available yet')}>
                <FileDown className="h-4 w-4" /> Generate PDF
              </Button>
              <Button variant="outline" onClick={() => toast.info('Email sending is not available yet')}>
                <Mail className="h-4 w-4" /> Send Email
              </Button>
            </>
          )}
          <Button loading={saving} onClick={() => {
            if (step < 3) {
              setStep(s => s + 1)
              return
            }
            void (async () => {
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
                  deliveryDate: form.deliveryDate,
                  location: form.location,
                  paymentStatus: 'outstanding',
                  status: 'confirmed',
                })
                toast.success('Contract created', {
                  description: `${created.ref} · ${formatQty(created.quantity, created.unit)} ${created.commodity}`,
                })
                navigate(`/contracts/${created.id}`)
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Could not create contract')
              } finally {
                setSaving(false)
              }
            })()
          }}>
            {step === 3 ? <><Check className="h-4 w-4" /> Confirm & Create</> : <>Next <ArrowRight className="h-4 w-4" /></>}
          </Button>
        </div>
      </div>
    </div>
  )
}
