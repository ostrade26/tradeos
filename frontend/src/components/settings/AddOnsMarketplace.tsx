import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '../ui/Button'
import { organisationApi } from '../../api/organisationApi'
import { useToast } from '../../hooks/useToast'
import { ApiError } from '../../api/client'
import {
  ADDON_MARKETPLACE_GRID,
  AddOnMarketplaceGridCard,
  AddOnMarketplaceGridSkeleton,
} from '../features/AddOnMarketplaceGridCard'
import { mergeAddOnOffersWithPreview } from '../../lib/addOnMarketplacePreview'
import {
  buildAddOnBrowseSections,
  browseAddOns,
  yoursAddOns,
} from '../../lib/addOnMarketplaceSections'

export function AddOnsMarketplace({
  pageView,
  onPageViewChange,
  onBrowseCountChange,
  onYoursCountChange,
}: {
  pageView: 'catalog' | 'yours'
  onPageViewChange: (view: 'catalog' | 'yours') => void
  onBrowseCountChange?: (count: number) => void
  onYoursCountChange?: (count: number) => void
}) {
  const toast = useToast()
  const [offers, setOffers] = useState<Awaited<ReturnType<typeof organisationApi.listAddOns>>['offers']>([])
  const [loading, setLoading] = useState(true)

  const displayOffers = useMemo(() => mergeAddOnOffersWithPreview(offers), [offers])
  const yours = useMemo(() => yoursAddOns(displayOffers), [displayOffers])
  const browse = useMemo(() => browseAddOns(displayOffers), [displayOffers])
  const browseView = useMemo(
    () => buildAddOnBrowseSections(browse, { sort: 'curated', query: '', pricing: 'all' }),
    [browse],
  )

  useEffect(() => {
    onBrowseCountChange?.(browse.length)
  }, [browse.length, onBrowseCountChange])

  useEffect(() => {
    onYoursCountChange?.(yours.length)
  }, [yours.length, onYoursCountChange])

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setLoading(true)
    try {
      const res = await organisationApi.listAddOns()
      setOffers(res.offers)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not load add-ons')
    } finally {
      if (!opts?.quiet) setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load({ quiet: true })
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [load])

  const catalogEmpty = !loading && displayOffers.length === 0
  const browseEmpty = !loading && browseView.sections.length === 0
  const yoursEmpty = !loading && yours.length === 0

  return (
    <div className="w-full min-w-0 space-y-6">
      {loading ? (
        <div className={ADDON_MARKETPLACE_GRID}>
          {Array.from({ length: 8 }).map((_, i) => (
            <AddOnMarketplaceGridSkeleton key={i} />
          ))}
        </div>
      ) : catalogEmpty ? (
        <p className="text-sm text-muted">No add-ons are listed yet.</p>
      ) : pageView === 'yours' ? (
        yoursEmpty ? (
          <div className="rounded-md border border-dashed border-gray-200 px-5 py-8 dark:border-gray-700">
            <p className="text-sm text-heading font-medium">Nothing enabled yet</p>
            <p className="mt-1 text-sm text-muted">
              Browse add-ons to enable free ones or request paid capabilities.
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-4"
              onClick={() => onPageViewChange('catalog')}
            >
              Browse Add-ons
            </Button>
          </div>
        ) : (
          <div className={ADDON_MARKETPLACE_GRID}>
            {yours.map(offer => (
              <AddOnMarketplaceGridCard key={offer.feature_key} offer={offer} />
            ))}
          </div>
        )
      ) : browseEmpty ? (
        <p className="text-sm text-muted">No add-ons available to browse.</p>
      ) : (
        <div className="space-y-10">
          {browseView.sections.map(section => (
            <section key={section.id} aria-labelledby={`addon-section-${section.id}`}>
              {browseView.sections.length > 1 || section.id !== 'browse' ? (
                <div className="mb-4 min-w-0">
                  <h3
                    id={`addon-section-${section.id}`}
                    className="text-base font-semibold tracking-tight text-heading"
                  >
                    {section.title}
                  </h3>
                  <p className="mt-0.5 text-sm text-muted">{section.subtitle}</p>
                </div>
              ) : (
                <h3 id={`addon-section-${section.id}`} className="sr-only">
                  {section.title}
                </h3>
              )}
              <div className={ADDON_MARKETPLACE_GRID}>
                {section.offers.map(offer => (
                  <AddOnMarketplaceGridCard key={offer.feature_key} offer={offer} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
