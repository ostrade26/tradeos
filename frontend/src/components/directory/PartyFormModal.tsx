import { useEffect, useState, type ReactNode } from 'react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Checkbox } from '../ui/Checkbox'
import type { Producer, Retailer } from '../../data/mockData'
import type { AddProducerInput } from '../../store/TradeStore'

export type PartyFormValues = {
  name: string
  code: string
  address: string
  city: string
  contactPerson: string
  phone: string
  whatsapp: string
  whatsappSameAsPhone: boolean
  email: string
  tan: string
  fssai: string
  bankName: string
  bankAccount: string
  ifsc: string
  pan: string
  aadhar: string
  gst: string
  products: string
}

export const emptyPartyFormValues = (): PartyFormValues => ({
  name: '',
  code: '',
  address: '',
  city: '',
  contactPerson: '',
  phone: '',
  whatsapp: '',
  whatsappSameAsPhone: false,
  email: '',
  tan: '',
  fssai: '',
  bankName: '',
  bankAccount: '',
  ifsc: '',
  pan: '',
  aadhar: '',
  gst: '',
  products: '',
})

export function partyEntryToFormValues(entry: Producer | Retailer): PartyFormValues {
  const phone = entry.phone ?? ''
  const whatsapp = entry.whatsapp ?? ''
  return {
    name: entry.name,
    code: entry.code ?? '',
    address: entry.address ?? '',
    city: entry.city || entry.location || '',
    contactPerson: entry.contactPerson ?? '',
    phone,
    whatsapp,
    whatsappSameAsPhone: Boolean(phone && whatsapp && phone === whatsapp),
    email: entry.email ?? '',
    tan: entry.tan || entry.tin || '',
    fssai: entry.fssai ?? '',
    bankName: entry.bankName ?? '',
    bankAccount: entry.bankAccount ?? '',
    ifsc: entry.ifsc ?? '',
    pan: entry.pan ?? '',
    aadhar: entry.aadhar ?? '',
    gst: entry.gst ?? '',
    products: entry.products.join(', '),
  }
}

export function partyFormToInput(form: PartyFormValues): AddProducerInput {
  const phone = form.phone.trim()
  const whatsapp = form.whatsappSameAsPhone ? phone : form.whatsapp.trim()
  const city = form.city.trim()
  return {
    name: form.name.trim(),
    code: form.code.trim(),
    address: form.address.trim(),
    city,
    location: city,
    contactPerson: form.contactPerson.trim(),
    phone,
    whatsapp,
    email: form.email.trim(),
    tan: form.tan.trim(),
    fssai: form.fssai.trim(),
    bankName: form.bankName.trim(),
    bankAccount: form.bankAccount.trim(),
    ifsc: form.ifsc.trim(),
    pan: form.pan.trim(),
    aadhar: form.aadhar.trim(),
    gst: form.gst.trim(),
    products: form.products,
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-gray-200 pt-8 first:border-t-0 first:pt-0 dark:border-gray-700">
      <h3 className="text-[16px] font-semibold text-heading tracking-tight">{title}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

export function PartyFormModal({
  open,
  onClose,
  title,
  initial,
  saving = false,
  error = '',
  onSave,
}: {
  open: boolean
  onClose: () => void
  title: string
  initial?: Partial<PartyFormValues> | null
  saving?: boolean
  error?: string
  onSave: (values: PartyFormValues) => void | Promise<void>
}) {
  const [form, setForm] = useState<PartyFormValues>(emptyPartyFormValues)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    if (!open) return
    setForm({ ...emptyPartyFormValues(), ...initial })
    setLocalError('')
  }, [open, initial])

  const setField = <K extends keyof PartyFormValues>(key: K, value: PartyFormValues[K]) => {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'phone' && prev.whatsappSameAsPhone) {
        next.whatsapp = String(value)
      }
      if (key === 'whatsappSameAsPhone' && value === true) {
        next.whatsapp = prev.phone
      }
      return next
    })
  }

  const handleSave = async () => {
    setLocalError('')
    if (!form.name.trim()) {
      setLocalError('Name is required')
      return
    }
    try {
      await onSave(form)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  const displayError = localError || error

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!saving) onClose()
      }}
      title={title}
      size="lg"
      panelClassName="max-h-modal-short"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} loading={saving} disabled={saving}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-8">
        <Section title="Party">
          <Input
            label="Name"
            placeholder="Party name"
            value={form.name}
            onChange={e => setField('name', e.target.value)}
            autoFocus
          />
          <Input
            label="Code No"
            placeholder="Party code"
            value={form.code}
            onChange={e => setField('code', e.target.value)}
          />
          <div className="sm:col-span-2">
            <Input
              label="Address"
              placeholder="Street address"
              value={form.address}
              onChange={e => setField('address', e.target.value)}
            />
          </div>
          <Input
            label="City"
            placeholder="City"
            value={form.city}
            onChange={e => setField('city', e.target.value)}
          />
          <Input
            label="Products"
            placeholder="Palm Oil, Soybean (comma-separated)"
            value={form.products}
            onChange={e => setField('products', e.target.value)}
          />
        </Section>

        <Section title="Contact">
          <Input
            label="Contact person"
            placeholder="Contact name"
            value={form.contactPerson}
            onChange={e => setField('contactPerson', e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            placeholder="email@example.com"
            value={form.email}
            onChange={e => setField('email', e.target.value)}
          />
          <Input
            label="Phone"
            placeholder="+91 ..."
            value={form.phone}
            onChange={e => setField('phone', e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="party-whatsapp" className="text-sm font-medium text-gray-600 dark:text-gray-300">
                WhatsApp No
              </label>
              <Checkbox
                tight
                label="Same as phone"
                checked={form.whatsappSameAsPhone}
                onChange={e => setField('whatsappSameAsPhone', e.target.checked)}
              />
            </div>
            <Input
              id="party-whatsapp"
              placeholder="+91 ..."
              value={form.whatsappSameAsPhone ? form.phone : form.whatsapp}
              disabled={form.whatsappSameAsPhone}
              onChange={e => setField('whatsapp', e.target.value)}
            />
          </div>
        </Section>

        <Section title="Tax & licences">
          <Input
            label="GST No"
            placeholder="GSTIN"
            value={form.gst}
            onChange={e => setField('gst', e.target.value)}
          />
          <Input
            label="PAN"
            placeholder="ABCDE1234F"
            value={form.pan}
            onChange={e => setField('pan', e.target.value)}
          />
          <Input
            label="TAN No"
            placeholder="TAN"
            value={form.tan}
            onChange={e => setField('tan', e.target.value)}
          />
          <Input
            label="Aadhaar"
            placeholder="12-digit Aadhaar"
            value={form.aadhar}
            onChange={e => setField('aadhar', e.target.value)}
          />
          <Input
            label="FSSAI No"
            placeholder="FSSAI licence"
            value={form.fssai}
            onChange={e => setField('fssai', e.target.value)}
          />
        </Section>

        <Section title="Bank details">
          <Input
            label="Bank name"
            placeholder="Bank name"
            value={form.bankName}
            onChange={e => setField('bankName', e.target.value)}
          />
          <Input
            label="Bank A/C"
            placeholder="Account number"
            value={form.bankAccount}
            onChange={e => setField('bankAccount', e.target.value)}
          />
          <Input
            label="IFSC / RTGS"
            placeholder="IFSC code"
            value={form.ifsc}
            onChange={e => setField('ifsc', e.target.value)}
          />
        </Section>

        {displayError ? <p className="text-sm text-danger">{displayError}</p> : null}
      </div>
    </Modal>
  )
}
