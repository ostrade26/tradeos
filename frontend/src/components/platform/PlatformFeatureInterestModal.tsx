import { useEffect, useState } from 'react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { formatDateTime } from '../../lib/utils'
import { platformApi } from '../../api/platformApi'
import { AddOnBrowseCardPreview } from '../features/AddOnBrowseCardPreview'
import type { OrgFeatureOffer } from '../../api/organisationApi'

export type FeatureInterestRow = {
  id: number
  organisation_id: number
  organisation_name?: string
  requested_by_name?: string
  requested_by_username?: string
  feature_key: string
  feature_title: string
  feature_detail?: string
  card_tone?: string
  card_image_url?: string
  card_bg_hex?: string
  card_tag?: string
  pricing_type?: string
  price_cents?: number
  status: string
  platform_note?: string
  created_at: string
  reviewed_at?: string | null
}

function statusBadgeVariant(status: string): 'info' | 'success' | 'warning' | 'default' {
  if (status === 'interested') return 'info'
  if (status === 'approved') return 'success'
  if (status === 'rejected') return 'warning'
  return 'default'
}

function statusLabel(status: string): string {
  if (status === 'interested') return 'Pending'
  if (status === 'approved') return 'Active'
  if (status === 'rejected') return 'Declined'
  return status.replace(/_/g, ' ')
}

function asPricingType(value: string | undefined): OrgFeatureOffer['pricing_type'] {
  if (value === 'free' || value === 'paid' || value === 'contact') return value
  return 'paid'
}

export function PlatformFeatureInterestModal({
  open,
  interest,
  loading,
  onClose,
  onApprove,
  onReject,
}: {
  open: boolean
  interest: FeatureInterestRow | null
  loading: boolean
  onClose: () => void
  onApprove: (note: string) => Promise<void>
  onReject: (note: string) => Promise<void>
}) {
  const [note, setNote] = useState('')
  const [resolvedPricing, setResolvedPricing] = useState<{
    pricing_type: OrgFeatureOffer['pricing_type']
    price_cents: number
  } | null>(null)

  useEffect(() => {
    setNote('')
  }, [interest?.id, interest?.status])

  useEffect(() => {
    if (!open || !interest) {
      setResolvedPricing(null)
      return
    }
    if (interest.pricing_type) {
      setResolvedPricing({
        pricing_type: asPricingType(interest.pricing_type),
        price_cents: interest.price_cents ?? 0,
      })
      return
    }
    let cancelled = false
    void platformApi
      .listFeatureOffers()
      .then(res => {
        if (cancelled) return
        const offer = res.offers.find(o => o.feature_key === interest.feature_key)
        setResolvedPricing(
          offer
            ? { pricing_type: offer.pricing_type, price_cents: offer.price_cents }
            : { pricing_type: 'paid', price_cents: 0 },
        )
      })
      .catch(() => {
        if (!cancelled) setResolvedPricing({ pricing_type: 'paid', price_cents: 0 })
      })
    return () => {
      cancelled = true
    }
  }, [open, interest])

  if (!interest) return null

  const who = interest.requested_by_name || interest.requested_by_username || 'A user'
  const org = interest.organisation_name || `Organisation #${interest.organisation_id}`
  const isOpen = interest.status === 'interested'
  const isApproved = interest.status === 'approved'
  const isRejected = interest.status === 'rejected'

  const previewOffer: OrgFeatureOffer = {
    id: interest.id,
    feature_key: interest.feature_key,
    title: interest.feature_title,
    description: interest.feature_detail ?? '',
    pricing_type: resolvedPricing?.pricing_type ?? asPricingType(interest.pricing_type),
    price_cents: resolvedPricing?.price_cents ?? interest.price_cents ?? 0,
    currency: 'INR',
    catalog_status: 'listed',
    card_tone: interest.card_tone,
    card_image_url: interest.card_image_url,
    card_bg_hex: interest.card_bg_hex,
    card_tag: interest.card_tag,
    entitlement_status: isApproved ? 'active' : isOpen ? 'pending' : 'available',
    active_orgs: isApproved ? 1 : 0,
    interest_count: isOpen ? 1 : 0,
    request_count: 1,
  }

  const title = isOpen ? 'Review add-on request' : 'Change add-on access'
  const subtitle = isOpen
    ? `${org} · ${who} · ${formatDateTime(interest.created_at)}`
    : `${org} · ${who}`

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size="md"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          {isOpen || isApproved ? (
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => void onReject(note)}
            >
              {isApproved ? 'Revoke access' : 'Decline'}
            </Button>
          ) : null}
          {isOpen || isRejected ? (
            <Button type="button" disabled={loading} loading={loading} onClick={() => void onApprove(note)}>
              Approve for organisation
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusBadgeVariant(interest.status)}>{statusLabel(interest.status)}</Badge>
          {interest.reviewed_at ? (
            <span className="text-xs text-muted">Reviewed {formatDateTime(interest.reviewed_at)}</span>
          ) : null}
        </div>
        {isApproved ? (
          <p className="text-sm text-muted leading-relaxed">
            This organisation currently has access. Revoking removes the add-on from their licence and
            notifies them.
          </p>
        ) : null}
        <AddOnBrowseCardPreview active={open} offer={previewOffer} />
        {interest.platform_note?.trim() ? (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Previous note</p>
            <p className="text-sm text-heading leading-relaxed whitespace-pre-wrap">{interest.platform_note}</p>
          </div>
        ) : null}
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {isOpen ? 'Note to organisation (optional)' : 'Updated note to organisation (optional)'}
          </span>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-card px-3 py-2 text-sm text-heading"
            placeholder={
              isApproved
                ? 'Revoked — access was granted by mistake.'
                : isRejected
                  ? 'Approved — enabling this add-on for the organisation.'
                  : 'Approved — we will enable this on your licence.'
            }
          />
        </label>
      </div>
    </Modal>
  )
}
