import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import {
  addOnCardSurface,
  addOnCategoryLabel,
  addOnIllustrationForOffer,
  visualThemeForFeatureKey,
} from '../../lib/featureOfferVisuals'
import {
  ADDON_CARD_PATTERN_MASK,
  addOnCardGeometricPattern,
} from '../../lib/addOnCardPatterns'

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
  className,
}: {
  featureKey: string
  title: string
  description?: string
  priceLabel?: string | null
  footer?: ReactNode
  /** Marketplace tiles lift on hover; modals use false. */
  interactive?: boolean
  className?: string
}) {
  const illustration = addOnIllustrationForOffer(featureKey, title)
  const theme = visualThemeForFeatureKey(featureKey, title)
  const Icon = theme.icon
  const category = addOnCategoryLabel(illustration)
  const surface = addOnCardSurface(illustration)
  const pattern = addOnCardGeometricPattern(featureKey, illustration)
  const showFooter = priceLabel != null || footer != null

  return (
    <article
      className={cn(
        'relative flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1',
        surface.ring,
        interactive && surface.ringHover,
        'dark:bg-card dark:shadow-[0_1px_2px_rgba(0,0,0,0.25)]',
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
        <div className="absolute inset-0 bg-gradient-to-bl from-white/35 via-white/8 to-transparent dark:from-card/40 dark:via-card/5" />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-white/92 via-white/45 to-transparent dark:from-card dark:via-card/50" />
      </div>

      <div className="relative flex flex-1 flex-col p-6">
        <div className="relative pr-14">
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

        <p className="mt-5 flex-1 text-sm leading-relaxed text-heading/80 dark:text-muted line-clamp-6">
          {description?.trim() || 'Optional capability for your organisation.'}
        </p>

        {showFooter ? (
          <div className="mt-6 flex items-center justify-between gap-3 border-t border-gray-200/90 pt-4 dark:border-gray-700/80">
            {priceLabel != null ? (
              <p className="text-base font-semibold tabular-nums tracking-tight text-heading">{priceLabel}</p>
            ) : (
              <span />
            )}
            {footer}
          </div>
        ) : null}
      </div>
    </article>
  )
}
