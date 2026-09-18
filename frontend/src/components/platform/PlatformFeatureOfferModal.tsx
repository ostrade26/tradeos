import { useEffect, useState } from 'react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import type { PlatformFeatureOffer } from '../../api/platformApi'

export type FeatureOfferFormPayload = {
  feature_key: string
  title: string
  description: string
  pricing_type: 'free' | 'paid' | 'contact'
  price_cents: number
  currency: string
  sort_order: number
}

function emptyForm(): FeatureOfferFormPayload {
  return {
    feature_key: '',
    title: '',
    description: '',
    pricing_type: 'free',
    price_cents: 0,
    currency: 'INR',
    sort_order: 0,
  }
}

function formFromOffer(offer: PlatformFeatureOffer): FeatureOfferFormPayload {
  return {
    feature_key: offer.feature_key,
    title: offer.title,
    description: offer.description ?? '',
    pricing_type: offer.pricing_type,
    price_cents: offer.price_cents ?? 0,
    currency: offer.currency ?? 'INR',
    sort_order: offer.sort_order ?? 0,
  }
}

function centsFromRupees(value: string): number {
  const n = Number(value.replace(/,/g, '').trim())
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

export function PlatformFeatureOfferModal({
  open,
  onClose,
  offer,
  initial,
  saving,
  onSave,
}: {
  open: boolean
  onClose: () => void
  offer: PlatformFeatureOffer | null
  initial?: Partial<FeatureOfferFormPayload>
  saving: boolean
  onSave: (payload: FeatureOfferFormPayload) => void | Promise<void>
}) {
  const [form, setForm] = useState<FeatureOfferFormPayload>(emptyForm())
  const [priceRupees, setPriceRupees] = useState('')

  useEffect(() => {
    if (!open) return
    if (offer) {
      const f = formFromOffer(offer)
      setForm(f)
      setPriceRupees(f.price_cents > 0 ? String(f.price_cents / 100) : '')
    } else {
      const base = emptyForm()
      setForm({ ...base, ...initial })
      setPriceRupees('')
    }
  }, [open, offer, initial])

  const submit = () => {
    const price_cents = form.pricing_type === 'paid' ? centsFromRupees(priceRupees) : 0
    void onSave({ ...form, price_cents })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={offer ? 'Edit add-on offer' : 'Create add-on offer'}
      subtitle="Listed offers appear in organisation Settings → Add-ons."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button loading={saving} disabled={!form.title.trim() || !form.feature_key.trim()} onClick={submit}>
            {offer ? 'Save changes' : 'Create draft'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Feature key"
          value={form.feature_key}
          onChange={e => setForm(f => ({ ...f, feature_key: e.target.value }))}
          placeholder="chatbot"
          disabled={!!offer}
        />
        <p className="text-xs text-muted -mt-2">
          {offer ? 'Key cannot change after creation.' : 'Used for entitlements (hasAppliedUpdate).'}
        </p>
        <Input
          label="Title"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="AI assistant"
        />
        <label className="block">
          <span className="text-sm font-medium text-heading">Description</span>
          <textarea
            className="mt-1.5 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-heading shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-gray-600 dark:bg-gray-900"
            rows={3}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
        </label>
        <Select
          label="Pricing"
          value={form.pricing_type}
          onChange={e =>
            setForm(f => ({
              ...f,
              pricing_type: e.target.value as FeatureOfferFormPayload['pricing_type'],
            }))
          }
          options={[
            { value: 'free', label: 'Free — org admin enables instantly' },
            { value: 'paid', label: 'Paid — org requests, you approve' },
            { value: 'contact', label: 'Contact Tradeal — org requests access' },
          ]}
        />
        {form.pricing_type === 'paid' ? (
          <Input
            label="Price (INR)"
            value={priceRupees}
            onChange={e => setPriceRupees(e.target.value)}
            placeholder="999"
            inputMode="decimal"
          />
        ) : null}
        <Input
          label="Sort order"
          type="number"
          value={String(form.sort_order)}
          onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
        />
      </div>
    </Modal>
  )
}
