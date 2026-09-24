import { useEffect, useState } from 'react'
import { Building2, Clock3, PanelRight, PanelRightClose } from 'lucide-react'
import { Drawer, DockedPanel } from '../ui/Drawer'
import { Badge } from '../ui/Badge'
import {
  DetailGroup,
  DetailPanelBody,
} from '../registers/DetailPanelSections'
import { AddOnBrowseCardPreview } from '../features/AddOnBrowseCardPreview'
import type { OrgFeatureOffer } from '../../api/organisationApi'
import { ApiError } from '../../api/client'
import {
  platformApi,
  type PlatformFeatureOffer,
  type PlatformFeatureOfferUsage,
} from '../../api/platformApi'
import { formatDateTime } from '../../lib/utils'
import { useToast } from '../../hooks/useToast'

function statusBadge(status: string) {
  if (status === 'listed') return <Badge variant="success">Published</Badge>
  if (status === 'retired') return <Badge variant="default">Unpublished</Badge>
  return <Badge variant="info">Draft</Badge>
}

export function PlatformFeatureOfferUsageDrawer({
  offer,
  open,
  onClose,
  docked = false,
  onDockChange,
}: {
  offer: PlatformFeatureOffer | null
  open: boolean
  onClose: () => void
  docked?: boolean
  onDockChange?: (docked: boolean) => void
}) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [usage, setUsage] = useState<PlatformFeatureOfferUsage | null>(null)

  useEffect(() => {
    if (!open || !offer) {
      setUsage(null)
      return
    }
    let cancelled = false
    setLoading(true)
    void platformApi
      .getFeatureOfferUsage(offer.id)
      .then(res => {
        if (!cancelled) setUsage(res)
      })
      .catch(err => {
        if (!cancelled) {
          toast.error(err instanceof ApiError ? err.message : 'Could not load feature usage')
          onClose()
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, offer, onClose, toast])

  if (!offer) return null

  const detail =
    usage?.offer?.id === offer.id ? { ...usage.offer, ...offer } : offer
  const organisations = usage?.organisations ?? []
  const pending = usage?.pending_requests ?? []
  const previewOffer: OrgFeatureOffer = {
    id: detail.id,
    feature_key: detail.feature_key,
    title: detail.title,
    description: detail.description ?? '',
    pricing_type: detail.pricing_type,
    price_cents: detail.price_cents ?? 0,
    currency: detail.currency ?? 'INR',
    catalog_status: detail.catalog_status,
    card_tone: detail.card_tone,
    card_image_url: detail.card_image_url,
    card_featured: Boolean(detail.card_featured),
    card_bg_hex: detail.card_bg_hex,
    card_tag: detail.card_tag,
    entitlement_status: 'available',
    active_orgs: organisations.length,
    interest_count: pending.length,
    request_count: organisations.length + pending.length,
  }

  const dockToggle = onDockChange ? (
    <button
      type="button"
      onClick={() => onDockChange(!docked)}
      className="hidden lg:inline-flex rounded-lg p-1.5 text-muted hover:bg-gray-100 hover:text-heading dark:hover:bg-zinc-800 cursor-pointer attex-focus"
      aria-label={docked ? 'Undock panel' : 'Dock panel to the right'}
      title={docked ? 'Undock panel' : 'Dock to right'}
    >
      {docked ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
    </button>
  ) : null

  const panelProps = {
    title: detail.title,
    subtitle: detail.feature_key,
    headerBadges: statusBadge(detail.catalog_status),
    onClose,
    headerActions: dockToggle,
    width: 'lg' as const,
  }

  const content = (
    <DetailPanelBody>
      <div className="-mx-4 sm:-mx-5 bg-gray-50/90 dark:bg-zinc-900/40 px-6 py-6 sm:px-8 sm:py-8">
        <AddOnBrowseCardPreview active={open} offer={previewOffer} />
      </div>

      <DetailGroup title="Organisations using this" icon={Building2}>
        {loading && organisations.length === 0 ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : organisations.length === 0 ? (
          <p className="text-sm text-muted">No organisations using this add-on.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800 -mx-1">
            {organisations.map(org => (
              <li key={org.organisation_id} className="flex items-start justify-between gap-4 py-3 px-1">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-heading truncate">{org.organisation_name}</p>
                  {org.org_code ? (
                    <p className="text-xs text-muted mt-0.5">{org.org_code}</p>
                  ) : null}
                </div>
                <p className="text-xs text-muted tabular-nums shrink-0">
                  {org.applied_at ? formatDateTime(org.applied_at) : '—'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </DetailGroup>

      <DetailGroup title="Pending requests" icon={Clock3}>
        {loading && pending.length === 0 ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : pending.length === 0 ? (
          <p className="text-sm text-muted">No open access requests.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800 -mx-1">
            {pending.map(req => (
              <li key={req.interest_id} className="flex items-start justify-between gap-4 py-3 px-1">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-heading truncate">{req.organisation_name}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {req.requested_by_name ? `Requested by ${req.requested_by_name}` : 'Access request'}
                    {req.org_code ? (
                      <span className=""> · {req.org_code}</span>
                    ) : null}
                  </p>
                </div>
                <p className="text-xs text-muted tabular-nums shrink-0">
                  {req.created_at ? formatDateTime(req.created_at) : '—'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </DetailGroup>
    </DetailPanelBody>
  )

  if (docked) {
    if (!open) return null
    return <DockedPanel {...panelProps}>{content}</DockedPanel>
  }

  return (
    <Drawer open={open} {...panelProps}>
      {content}
    </Drawer>
  )
}
