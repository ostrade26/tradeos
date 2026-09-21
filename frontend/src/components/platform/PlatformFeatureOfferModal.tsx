import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ImagePlus, Shuffle, Trash2 } from 'lucide-react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Checkbox } from '../ui/Checkbox'
import type { PlatformFeatureOffer } from '../../api/platformApi'
import {
  ADDON_CATALOG_CARD_FRAME,
  FeatureOfferCatalogCard,
  featureOfferPriceLabel,
} from '../features/FeatureOfferCatalogCard'
import {
  ADDON_CARD_TONE_OPTIONS,
  resolveAddOnCardTone,
  type AddOnIllustrationKind,
} from '../../lib/featureOfferVisuals'
import { cn } from '../../lib/utils'

export type FeatureOfferFormPayload = {
  feature_key: string
  title: string
  description: string
  pricing_type: 'free' | 'paid' | 'contact'
  price_cents: number
  currency: string
  sort_order: number
  card_tone: AddOnIllustrationKind
  card_image_url: string
  card_featured: boolean
}

const CARD_TONES = ADDON_CARD_TONE_OPTIONS.map(option => option.id)
const MAX_IMAGE_BYTES = 500 * 1024

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
    card_tone: 'neutral',
    card_image_url: '',
    card_featured: false,
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
    card_tone: resolveAddOnCardTone(offer.feature_key, offer.title, offer.card_tone),
    card_image_url: offer.card_image_url ?? '',
    card_featured: Boolean(offer.card_featured),
  }
}

function centsFromRupees(value: string): number {
  const n = Number(value.replace(/,/g, '').trim())
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Choose an image file (PNG, JPG, or WebP).'))
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error('Image must be 500KB or smaller.'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result.startsWith('data:image/')) {
        reject(new Error('Could not read that image.'))
        return
      }
      resolve(result)
    }
    reader.onerror = () => reject(new Error('Could not read that image.'))
    reader.readAsDataURL(file)
  })
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
  const [imageError, setImageError] = useState('')
  const fileInputId = useId()
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setImageError('')
    if (offer) {
      const f = formFromOffer(offer)
      setForm(f)
      setCardTone(f.card_tone)
      setPriceRupees(f.price_cents > 0 ? String(f.price_cents / 100) : '')
    } else {
      const base = emptyForm()
      const merged = { ...base, ...initial }
      const tone = resolveAddOnCardTone(
        merged.feature_key,
        merged.title,
        merged.card_tone,
      )
      setForm({
        ...merged,
        card_tone: tone,
        card_image_url: merged.card_image_url ?? '',
        card_featured: Boolean(merged.card_featured),
      })
      setCardTone(tone)
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
  const hasImage = Boolean(form.card_image_url.trim())

  const applyTone = (tone: AddOnIllustrationKind) => {
    setCardTone(tone)
    setForm(f => ({ ...f, card_tone: tone }))
  }

  const onPickImage = async (file: File | null) => {
    if (!file) return
    setImageError('')
    try {
      const dataUrl = await readImageAsDataUrl(file)
      setForm(f => ({ ...f, card_image_url: dataUrl }))
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Could not use that image')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const submit = () => {
    const price_cents = form.pricing_type === 'paid' ? centsFromRupees(priceRupees) : 0
    void onSave({
      ...form,
      price_cents,
      card_tone: cardTone || 'neutral',
      card_image_url: form.card_image_url.trim(),
      card_featured: Boolean(form.card_featured),
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={offer ? 'Edit feature' : 'New Feature'}
      subtitle="Listed features appear for organisations under Features. Preview shows the org card."
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
      <div className="grid min-h-0 h-[min(40rem,calc(90dvh-12rem))] lg:grid-cols-[2fr_3fr]">
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
          <Checkbox
            tight
            label="Featured large card (2×2 in marketplace)"
            checked={form.card_featured}
            onChange={e => setForm(f => ({ ...f, card_featured: e.target.checked }))}
          />
          <p className="text-xs text-muted -mt-2">
            Only one featured card is shown. Enabling this clears featured on other offers.
          </p>
        </div>

        <div className="min-h-0 flex flex-col items-center justify-center bg-gray-50/90 dark:bg-zinc-900/40 px-6 py-6">
          <input
            ref={fileRef}
            id={fileInputId}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={e => void onPickImage(e.target.files?.[0] ?? null)}
          />
          <div className="flex w-full max-w-[36rem] flex-col items-center justify-center">
            <div
              className={cn(
                'w-full',
                form.card_featured
                  ? 'h-[calc(360px+1.25rem)] min-h-[calc(360px+1.25rem)]'
                  : ADDON_CATALOG_CARD_FRAME,
              )}
            >
              <FeatureOfferCatalogCard
                className="h-full w-full"
                interactive={false}
                elevated
                featured={form.card_featured}
                cardTone={cardTone}
                imageUrl={form.card_image_url}
                featureKey={previewKey}
                title={previewTitle}
                description={form.description}
                priceLabel={previewPriceLabel}
                imageOverlay={
                  <div className="flex flex-col items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold shadow-sm cursor-pointer attex-focus',
                        'bg-white/95 text-heading hover:bg-white',
                        'dark:bg-zinc-900/90 dark:text-heading dark:hover:bg-zinc-900',
                      )}
                    >
                      <ImagePlus className="h-3.5 w-3.5" aria-hidden />
                      {hasImage ? 'Change image' : 'Add image'}
                    </button>
                    {hasImage ? (
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, card_image_url: '' }))}
                        className="inline-flex items-center gap-1 rounded-md bg-black/45 px-2 py-1 text-[11px] font-medium text-white hover:bg-black/60 cursor-pointer attex-focus"
                      >
                        <Trash2 className="h-3 w-3" aria-hidden />
                        Remove
                      </button>
                    ) : null}
                  </div>
                }
                footer={
                  <Button size="sm" type="button" tabIndex={-1} className="pointer-events-none">
                    {previewCta}
                  </Button>
                }
              />
            </div>

            <div className="mt-6 flex w-full flex-col items-center gap-2">
              <div className="flex w-full flex-wrap items-center justify-center gap-2.5">
                {ADDON_CARD_TONE_OPTIONS.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    title={option.label}
                    aria-label={`Background ${option.label}`}
                    aria-pressed={cardTone === option.id}
                    onClick={() => applyTone(option.id)}
                    className={cn(
                      'h-8 w-8 rounded-full transition-transform cursor-pointer attex-focus',
                      option.swatch,
                      cardTone === option.id
                        ? 'outline outline-2 outline-offset-2 outline-[#5c2a2a] scale-105'
                        : 'hover:scale-105',
                    )}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => applyTone(nextCardTone(cardTone))}
                  aria-label="Shuffle card colour"
                  title="Shuffle colour"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-muted shadow-sm transition-colors hover:text-accent cursor-pointer attex-focus dark:bg-card dark:hover:bg-zinc-800"
                >
                  <Shuffle className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
              {imageError ? <p className="text-center text-xs text-danger">{imageError}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
