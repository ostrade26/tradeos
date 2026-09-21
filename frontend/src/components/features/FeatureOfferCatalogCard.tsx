import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { Badge } from '../ui/Badge'
import {
  addOnCardSurface,
  addOnCategoryLabel,
  iconForAddOnTone,
  resolveAddOnCardTone,
  type AddOnIllustrationKind,
} from '../../lib/featureOfferVisuals'

/** Standard marketplace tile (~180px). */
export const ADDON_CATALOG_CARD_FRAME = 'w-full h-[180px] min-h-[180px]'

/** Featured tile spans 2×2 grid cells. */
export const ADDON_CATALOG_CARD_FRAME_FEATURED = 'w-full h-full min-h-[180px]'

export function featureOfferPriceLabel(pricingType: string, priceCents: number): string {
  if (pricingType === 'free') return 'Free'
  if (pricingType === 'contact') return 'Custom'
  if (priceCents > 0) return `₹${(priceCents / 100).toLocaleString('en-IN')}`
  return 'Paid'
}

export function FeatureOfferCatalogCard({
  featureKey,
  title,
  description,
  priceLabel,
  footer,
  interactive = true,
  elevated = false,
  featured = false,
  tone,
  cardTone,
  imageUrl,
  imageOverlay,
  className,
}: {
  featureKey: string
  title: string
  description?: string
  priceLabel?: string | null
  footer?: ReactNode
  /** Marketplace tiles lift on hover; modals use false. */
  interactive?: boolean
  /** Softer multi-layer elevation (create/edit preview). */
  elevated?: boolean
  /** Large 2×2 marketplace hero card. */
  featured?: boolean
  /** Override card accent surface (create/edit preview). */
  tone?: AddOnIllustrationKind
  /** Persisted accent from the feature offer. */
  cardTone?: string | null
  /** Optional left-panel image (URL or data URL). */
  imageUrl?: string | null
  /** Edit controls rendered over the image panel (create/edit modal). */
  imageOverlay?: ReactNode
  className?: string
}) {
  const surfaceKind = resolveAddOnCardTone(featureKey, title, cardTone ?? tone)
  const Icon = iconForAddOnTone(surfaceKind)
  const category = addOnCategoryLabel(surfaceKind)
  const surface = addOnCardSurface(surfaceKind)
  const showFooter = priceLabel != null || footer != null
  const isFree = priceLabel === 'Free'
  const image = (imageUrl || '').trim()

  return (
    <article
      className={cn(
        'relative flex h-full overflow-hidden rounded-md ring-1',
        elevated
          ? 'shadow-[0_18px_40px_-16px_rgba(15,23,42,0.22),0_8px_16px_-8px_rgba(15,23,42,0.1)] dark:shadow-[0_18px_40px_-16px_rgba(0,0,0,0.55),0_8px_16px_-8px_rgba(0,0,0,0.35)]'
          : 'shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.25)]',
        surface.ring,
        interactive && surface.ringHover,
        interactive &&
          'transform-gpu transition-[transform,box-shadow] duration-[560ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-12px_rgba(15,23,42,0.12)] dark:hover:shadow-[0_12px_28px_-12px_rgba(0,0,0,0.4)] motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none',
        className,
      )}
    >
      <div
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden',
          featured ? 'w-1/2' : 'w-[40%]',
          surface.imagePanel,
        )}
      >
        {!image ? (
          <div
            className="pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay"
            style={{
              backgroundImage:
                'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.55\'/%3E%3C/svg%3E")',
            }}
            aria-hidden
          />
        ) : null}
        {image ? (
          <img
            src={image}
            alt=""
            className="absolute inset-0 z-[1] h-full w-full object-cover"
          />
        ) : (
          <Icon
            className={cn(
              'relative z-[1]',
              featured ? 'h-16 w-16' : 'h-12 w-12',
              surface.iconFallback,
            )}
            strokeWidth={1.75}
            aria-hidden
          />
        )}
        {imageOverlay ? (
          <div className="absolute inset-0 z-[2] flex items-center justify-center p-2">
            {imageOverlay}
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          'relative flex min-w-0 flex-1 flex-col',
          featured ? 'px-6 py-6' : 'px-4 py-4',
          surface.contentPanel,
        )}
      >
        <span
          className={cn(
            'inline-flex w-fit max-w-full truncate rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide',
            surface.categoryPill,
          )}
        >
          {category}
        </span>
        <h3
          className={cn(
            'mt-2 truncate font-semibold tracking-tight leading-snug',
            featured ? 'text-2xl' : 'text-lg',
            surface.title,
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            'mt-1.5 text-[12px] leading-snug break-words',
            featured ? 'line-clamp-4' : 'line-clamp-2',
            surface.body,
          )}
        >
          {description?.trim() || 'Optional capability for your organisation.'}
        </p>

        {showFooter ? (
          <div
            className={cn(
              'mt-auto flex min-h-[2rem] items-center justify-between gap-3 border-t pt-3',
              surface.divider,
            )}
          >
            {priceLabel != null ? (
              isFree ? (
                <Badge
                  variant="success"
                  className={cn(
                    'inline-flex items-center font-semibold px-3 leading-none',
                    featured ? 'h-9 text-lg' : 'h-8 text-base',
                  )}
                >
                  Free
                </Badge>
              ) : (
                <p
                  className={cn(
                    'inline-flex items-center font-semibold tabular-nums tracking-tight leading-none',
                    featured ? 'h-9 text-2xl' : 'h-8 text-lg',
                    surface.price,
                  )}
                >
                  {priceLabel}
                </p>
              )
            ) : (
              <span />
            )}
            <div className={cn('flex shrink-0 items-center', featured ? 'h-9' : 'h-8')}>{footer}</div>
          </div>
        ) : null}
      </div>
    </article>
  )
}
