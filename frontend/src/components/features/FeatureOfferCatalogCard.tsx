import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { Badge } from '../ui/Badge'
import {
  addOnCardSurface,
  addOnCategoryLabel,
  addOnIllustrationForOffer,
  visualThemeForFeatureKey,
  type AddOnIllustrationKind,
} from '../../lib/featureOfferVisuals'
import {
  ADDON_CARD_PATTERN_MASK,
  addOnCardGeometricPattern,
} from '../../lib/addOnCardPatterns'

/** Marketplace / preview tile — width fills the grid cell; height stays shared. */
export const ADDON_CATALOG_CARD_FRAME = 'w-full h-[13.5rem] min-h-[13.5rem]'

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
  tone,
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
  /** Override card accent surface (create/edit preview). */
  tone?: AddOnIllustrationKind
  className?: string
}) {
  const illustration = addOnIllustrationForOffer(featureKey, title)
  const surfaceKind = tone ?? illustration
  const theme = visualThemeForFeatureKey(featureKey, title)
  const Icon = theme.icon
  const category = addOnCategoryLabel(illustration)
  const surface = addOnCardSurface(surfaceKind)
  const pattern = addOnCardGeometricPattern(featureKey, surfaceKind)
  const showFooter = priceLabel != null || footer != null
  const isFree = priceLabel === 'Free'

  return (
    <article
      className={cn(
        'relative flex h-full flex-col overflow-hidden rounded-2xl bg-white ring-1',
        elevated
          ? 'shadow-[0_18px_40px_-16px_rgba(15,23,42,0.22),0_8px_16px_-8px_rgba(15,23,42,0.1)] dark:shadow-[0_18px_40px_-16px_rgba(0,0,0,0.55),0_8px_16px_-8px_rgba(0,0,0,0.35)]'
          : 'shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.25)]',
        surface.ring,
        interactive && surface.ringHover,
        'dark:bg-card',
        interactive &&
          'transform-gpu transition-[transform,box-shadow] duration-[560ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-12px_rgba(15,23,42,0.12)] dark:hover:shadow-[0_12px_28px_-12px_rgba(0,0,0,0.4)] motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className={cn('absolute inset-0 dark:hidden', ADDON_CARD_PATTERN_MASK)} style={pattern.style} />
        <div
          className={cn('absolute inset-0 hidden dark:block', ADDON_CARD_PATTERN_MASK)}
          style={pattern.styleDark}
        />
        <div className={cn('absolute inset-0', surface.wash)} />
        <div className="absolute inset-0 bg-gradient-to-bl from-white/20 via-white/5 to-transparent dark:from-card/25 dark:via-card/5" />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-white/70 via-white/25 to-transparent dark:from-card/70 dark:via-card/25" />
      </div>

      <div className="relative flex flex-1 flex-col min-h-0 p-6">
        <div className="relative pr-14 shrink-0">
          <h3 className="min-w-0 truncate text-lg font-semibold tracking-tight text-heading">{title}</h3>
          <span
            className={cn(
              'mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
              surface.categoryPill,
            )}
          >
            {category}
          </span>
          <span
            className={cn(
              'absolute right-0 top-0 flex h-12 w-12 items-center justify-center rounded-xl',
              surface.iconBox,
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
          </span>
        </div>

        <p className="mt-3 w-full min-w-0 self-stretch text-sm leading-snug text-heading/80 dark:text-muted line-clamp-2 break-words">
          {description?.trim() || 'Optional capability for your organisation.'}
        </p>

        {showFooter ? (
          <div className="mt-auto shrink-0 flex items-center justify-between gap-3 border-t border-gray-200/90 pt-3 dark:border-gray-700/80 min-h-[2rem]">
            {priceLabel != null ? (
              isFree ? (
                <Badge
                  variant="success"
                  className="h-8 inline-flex items-center text-lg font-semibold px-3.5 leading-none"
                >
                  Free
                </Badge>
              ) : (
                <p className="h-8 inline-flex items-center text-lg font-semibold tabular-nums tracking-tight text-heading leading-none">
                  {priceLabel}
                </p>
              )
            ) : (
              <span />
            )}
            <div className="flex h-8 items-center shrink-0">{footer}</div>
          </div>
        ) : null}
      </div>
    </article>
  )
}
