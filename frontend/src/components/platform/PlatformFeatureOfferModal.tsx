import { useEffect, useMemo, useState } from 'react'
import { Shuffle } from 'lucide-react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import type { PlatformFeatureOffer } from '../../api/platformApi'
import {
  ADDON_CATALOG_CARD_FRAME,
  FeatureOfferCatalogCard,
  featureOfferPriceLabel,
} from '../features/FeatureOfferCatalogCard'
import {
  ADDON_CARD_TONE_OPTIONS,
  type AddOnIllustrationKind,
} from '../../lib/featureOfferVisuals'

export type FeatureOfferFormPayload = {
  feature_key: string
  title: string
  description: string
  pricing_type: 'free' | 'paid' | 'contact'
  price_cents: number
  currency: string
  sort_order: number
}

const CARD_TONES = ADDON_CARD_TONE_OPTIONS.map(option => option.id)

function nextCardTone(current: AddOnIllustrationKind): AddOnIllustrationKind {
  const others = CARD_TONES.filter(tone => tone !== current)
  return others[Math.floor(Math.random() * others.length)] ?? 'neutral'
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
  const [cardTone, setCardTone] = useState<AddOnIllustrationKind>('neutral')

  useEffect(() => {
    if (!open) return
    setCardTone('neutral')
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

  const previewPriceCents =
    form.pricing_type === 'paid' ? centsFromRupees(priceRupees) : form.price_cents

  const previewPriceLabel = useMemo(
    () => featureOfferPriceLabel(form.pricing_type, previewPriceCents),
    [form.pricing_type, previewPriceCents],
  )

  const previewTitle = form.title.trim() || 'Feature title'
  const previewKey = form.feature_key.trim() || 'feature'
  const previewCta = form.pricing_type === 'free' ? 'Enable' : 'Request'

  const submit = () => {
    const price_cents = form.pricing_type === 'paid' ? centsFromRupees(priceRupees) : 0
    void onSave({ ...form, price_cents })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={offer ? 'Edit feature' : 'New Feature'}
      subtitle="Listed features appear for organisations under Features."
      size="xl"
      bodyClassName="split-pane !p-0 min-h-0 flex-1 overflow-hidden"
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
      <div className="grid min-h-0 h-[min(36rem,calc(90dvh-12rem))] lg:grid-cols-2">
        <div className="min-h-0 overflow-y-auto px-6 py-6 space-y-4 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700">
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

        <div className="min-h-0 flex flex-col items-center justify-center bg-gray-50/90 dark:bg-zinc-900/40 px-6 py-6">
          <div className="flex w-full max-w-[20rem] flex-col items-center gap-4">
            <div className={ADDON_CATALOG_CARD_FRAME}>
              <FeatureOfferCatalogCard
                className="h-full w-full"
                interactive={false}
                elevated
                tone={cardTone}
                featureKey={previewKey}
                title={previewTitle}
                description={form.description}
                priceLabel={previewPriceLabel}
                footer={
                  <Button size="sm" type="button" tabIndex={-1} className="pointer-events-none">
                    {previewCta}
                  </Button>
                }
              />
            </div>
            <button
              type="button"
              onClick={() => setCardTone(current => nextCardTone(current))}
              aria-label="Shuffle card colour"
              title="Shuffle colour"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-muted shadow-sm transition-colors hover:border-accent/40 hover:text-accent cursor-pointer attex-focus dark:border-gray-600 dark:bg-card dark:hover:bg-zinc-800"
            >
              <Shuffle className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
