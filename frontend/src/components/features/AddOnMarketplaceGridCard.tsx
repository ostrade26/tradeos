import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { darkenHex } from '../../lib/accentColor'
import {
  addOnCardSurface,
  addOnCardSurfaceFromHex,
  iconForAddOnTone,
  resolveAddOnCardTag,
  resolveAddOnCardTone,
  resolveCardBgHex,
} from '../../lib/featureOfferVisuals'
import { featureOfferPriceLabel } from './FeatureOfferCatalogCard'
import {
  addOnDetailPath,
  addOnMarketplaceStats,
  formatAdoptionLabel,
} from '../../lib/addOnMarketplaceStats'
import type { OrgFeatureOffer } from '../../api/organisationApi'
import { appPath } from '../../lib/appShellMode'

/** Shared marketplace tile grid — keep Browse and Related in sync. */
export const ADDON_MARKETPLACE_GRID =
  'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-8 items-start'

const cardShellClass =
  'group flex flex-col overflow-hidden rounded-md bg-card shadow-[var(--shadow-card)]'

/** Envato / CodeCanyon-style marketplace tile (image + content-sized details). */
export function AddOnMarketplaceGridCard({
  offer,
  className,
  interactive = true,
  imageOverlay,
  imageAspectClass = 'aspect-[4/3]',
}: {
  offer: OrgFeatureOffer
  className?: string
  /** When false, renders a static preview (create/edit modal, drawers). */
  interactive?: boolean
  /** Edit controls over the image panel (create/edit modal). */
  imageOverlay?: ReactNode
  /** Image panel aspect — default 4/3; details hug content below. */
  imageAspectClass?: string
}) {
  const price = featureOfferPriceLabel(offer.pricing_type, offer.price_cents)
  const stats = addOnMarketplaceStats(offer)
  const surfaceKind = resolveAddOnCardTone(offer.feature_key, offer.title, offer.card_tone)
  const Icon = iconForAddOnTone(surfaceKind)
  const category = resolveAddOnCardTag(offer)
  const customBg = resolveCardBgHex(offer.card_bg_hex)
  const surface = customBg ? addOnCardSurfaceFromHex(customBg) : addOnCardSurface(surfaceKind)
  const categoryPill = addOnCardSurface(surfaceKind).categoryPill
  const image = (offer.card_image_url || '').trim()
  const imagePanelStyle = customBg ? { backgroundColor: darkenHex(customBg, 0.14) } : undefined
  const to = appPath(addOnDetailPath(offer.feature_key))
  const isFree = price === 'Free'

  const body = (
    <>
      <div className={cn('relative w-full shrink-0 overflow-hidden', imageAspectClass)}>
        <div
          className={cn('absolute inset-0', !customBg && surface.imagePanel)}
          style={imagePanelStyle}
        >
          {image ? (
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Icon className={cn('h-9 w-9', surface.iconFallback)} strokeWidth={1.5} aria-hidden />
            </div>
          )}
        </div>
        {offer.card_featured ? (
          <span className="absolute left-2.5 top-2.5 rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
            Featured
          </span>
        ) : null}
        {imageOverlay ? (
          <div className="absolute inset-0 z-[2] flex items-center justify-center p-2">
            {imageOverlay}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-5 px-5 py-5">
        <div className="min-w-0 space-y-1.5">
          <h3
            className={cn(
              'text-[15px] font-bold leading-snug text-heading line-clamp-2',
              interactive && 'group-hover:text-accent',
            )}
          >
            {offer.title}
          </h3>
          <p className="text-xs leading-snug text-muted line-clamp-2">
            {offer.description?.trim() || 'Optional capability for your organisation.'}
          </p>
        </div>

        <div className="flex min-w-0 items-end justify-between gap-2">
          <div className="min-w-0">
            <p
              className={cn(
                'text-lg font-bold tabular-nums leading-none tracking-tight',
                isFree ? 'text-success' : 'text-heading',
              )}
            >
              {price}
            </p>
            {stats.enabledCount > 0 ? (
              <p className="mt-1 text-xs text-muted tabular-nums">
                {formatAdoptionLabel(stats.enabledCount)}
              </p>
            ) : null}
          </div>
          <span
            className={cn(
              'inline-flex max-w-[50%] shrink-0 truncate rounded-md px-2 py-0.5 text-[11px] font-semibold',
              categoryPill,
            )}
          >
            {category}
          </span>
        </div>
      </div>
    </>
  )

  if (!interactive) {
    return (
      <div className={cn(cardShellClass, className)} aria-label={offer.title}>
        {body}
      </div>
    )
  }

  return (
    <Link
      to={to}
      aria-label={offer.title}
      className={cn(
        cardShellClass,
        'attex-focus',
        'transition-[transform,box-shadow] duration-300 ease-out',
        'hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-12px_rgba(15,23,42,0.12)]',
        'dark:hover:shadow-[0_12px_28px_-12px_rgba(0,0,0,0.4)]',
        'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        className,
      )}
    >
      {body}
    </Link>
  )
}

export function AddOnMarketplaceGridSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-md bg-card flex flex-col">
      <div className="aspect-[4/3] w-full bg-gray-200 dark:bg-gray-700" />
      <div className="flex flex-col gap-5 px-5 py-5">
        <div className="space-y-1.5">
          <div className="h-3.5 w-4/5 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-full rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-3 w-24 rounded bg-gray-100 dark:bg-gray-800" />
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="space-y-1">
            <div className="h-5 w-14 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-28 rounded bg-gray-100 dark:bg-gray-800" />
          </div>
          <div className="h-5 w-16 rounded bg-gray-100 dark:bg-gray-800" />
        </div>
      </div>
    </div>
  )
}
