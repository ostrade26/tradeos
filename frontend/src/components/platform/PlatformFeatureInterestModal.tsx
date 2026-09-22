import { useEffect, useState } from 'react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { formatDateTime } from '../../lib/utils'
import { platformApi } from '../../api/platformApi'
import {
  FeatureOfferCatalogCard,
  featureOfferPriceLabel,
} from '../features/FeatureOfferCatalogCard'

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
  const [priceLabel, setPriceLabel] = useState<string | null>(null)

  useEffect(() => {
    setNote('')
  }, [interest?.id, interest?.status])

  useEffect(() => {
    if (!open || !interest) {
      setPriceLabel(null)
      return
    }
    if (interest.pricing_type) {
      setPriceLabel(
        featureOfferPriceLabel(
          interest.pricing_type,
          interest.price_cents ?? 0,
        ),
      )
      return
    }
    let cancelled = false
    void platformApi
      .listFeatureOffers()
      .then(res => {
        if (cancelled) return
        const offer = res.offers.find(o => o.feature_key === interest.feature_key)
        setPriceLabel(
          offer ? featureOfferPriceLabel(offer.pricing_type, offer.price_cents) : null,
        )
      })
      .catch(() => {
        if (!cancelled) setPriceLabel(null)
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

  const title = isOpen ? 'Review feature request' : 'Change feature access'
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
            This organisation currently has access. Revoking removes the feature from their licence and notifies them.
          </p>
        ) : null}
        <FeatureOfferCatalogCard
          interactive={false}
          featureKey={interest.feature_key}
          title={interest.feature_title}
          description={interest.feature_detail}
          cardTone={interest.card_tone}
          cardBgHex={interest.card_bg_hex}
          imageUrl={interest.card_image_url}
          priceLabel={priceLabel}
        />
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
                  ? 'Approved — enabling this feature for the organisation.'
                  : 'Approved — we will enable this on your licence.'
            }
          />
        </label>
      </div>
    </Modal>
  )
}
