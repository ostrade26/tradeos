import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '../ui/Button'
import { organisationApi, type OrgFeatureOffer } from '../../api/organisationApi'
import { useToast } from '../../hooks/useToast'
import { useAuth, usePermissions } from '../../hooks/useAuth'
import { ApiError } from '../../api/client'
import { authApi } from '../../api/tradeApi'
import { sessionFromApi } from '../../lib/authSession'
import { saveAuthSession } from '../../lib/auth'
import { cn } from '../../lib/utils'
import {
  ADDON_CATALOG_CARD_FRAME,
  FeatureOfferCatalogCard,
  featureOfferPriceLabel,
} from '../features/FeatureOfferCatalogCard'
import {
  isPreviewAddOnKey,
  mergeAddOnOffersWithPreview,
} from '../../lib/addOnMarketplacePreview'

const MARKETPLACE_GRID = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'

function AddOnTileSkeleton() {
  return (
    <div className={cn(ADDON_CATALOG_CARD_FRAME, 'animate-pulse overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.05] dark:bg-card dark:ring-white/10')}>
      <div className="p-6 h-full flex flex-col">
        <div className="relative pr-14">
          <div className="h-6 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="mt-2 h-5 w-24 rounded-full bg-gray-100 dark:bg-gray-800" />
          <div className="absolute right-0 top-0 h-12 w-12 rounded-xl bg-gray-100 dark:bg-gray-800" />
        </div>
        <div className="mt-5 space-y-2 flex-1">
          <div className="h-3 w-full rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-3 w-5/6 rounded bg-gray-100 dark:bg-gray-800" />
        </div>
        <div className="mt-6 flex justify-between border-t border-gray-200 pt-4 dark:border-gray-700">
          <div className="h-6 w-24 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-9 w-24 rounded-lg bg-gray-100 dark:bg-gray-800" />
        </div>
      </div>
    </div>
  )
}

function AddOnOfferCard({
  offer,
  canManage,
  busy,
  onEnable,
  onRequest,
}: {
  offer: OrgFeatureOffer
  canManage: boolean
  busy: boolean
  onEnable: () => void
  onRequest: () => void
}) {
  const price = featureOfferPriceLabel(offer.pricing_type, offer.price_cents)

  const action =
    offer.entitlement_status === 'active' ? (
      <span className="text-sm font-semibold text-success">Active</span>
    ) : offer.entitlement_status === 'pending' ? (
      <span className="text-sm font-semibold text-info">Pending</span>
    ) : !canManage ? (
      <span className="max-w-[8rem] text-right text-xs leading-snug text-muted">Org admin required</span>
    ) : offer.pricing_type === 'free' ? (
      <Button size="sm" loading={busy} disabled={busy} onClick={onEnable}>
        Enable
      </Button>
    ) : (
      <Button size="sm" loading={busy} disabled={busy} onClick={onRequest}>
        Request
      </Button>
    )

  return (
    <div className={ADDON_CATALOG_CARD_FRAME}>
      <FeatureOfferCatalogCard
        className="h-full w-full"
        featureKey={offer.feature_key}
        title={offer.title}
        description={offer.description}
        cardTone={offer.card_tone}
        priceLabel={price}
        footer={action}
      />
    </div>
  )
}

export function AddOnsMarketplace() {
  const toast = useToast()
  const { session, applySession } = useAuth()
  const { hasPermission } = usePermissions()
  const canManage = hasPermission('organisation.edit')
  const [offers, setOffers] = useState<OrgFeatureOffer[]>([])
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const displayOffers = useMemo(() => mergeAddOnOffersWithPreview(offers), [offers])

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setLoading(true)
    try {
      const res = await organisationApi.listAddOns()
      setOffers(res.offers)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not load features')
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

  const refreshSession = async () => {
    if (!session?.token) return
    const me = await authApi.me()
    applySession(sessionFromApi(me, session.token))
    saveAuthSession(sessionFromApi(me, session.token))
  }

  const enable = async (key: string) => {
    if (isPreviewAddOnKey(key)) {
      toast.info('Preview tile only — connect real catalog offers to enable.')
      return
    }
    setBusyKey(key)
    try {
      await organisationApi.enableAddOn(key)
      toast.success('Feature enabled for your organisation')
      await refreshSession()
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not enable')
    } finally {
      setBusyKey(null)
    }
  }

  const requestAccess = async (key: string) => {
    if (isPreviewAddOnKey(key)) {
      toast.info('Preview tile only — connect real catalog offers to request access.')
      return
    }
    setBusyKey(key)
    try {
      await organisationApi.requestAddOn(key)
      toast.success('Request sent — Tradeal will review')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not send request')
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="w-full min-w-0">
      {loading ? (
        <div className={MARKETPLACE_GRID}>
          {Array.from({ length: 8 }).map((_, i) => (
            <AddOnTileSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className={cn(MARKETPLACE_GRID)}>
          {displayOffers.map(offer => (
            <AddOnOfferCard
              key={offer.feature_key}
              offer={offer}
              canManage={canManage}
              busy={busyKey === offer.feature_key}
              onEnable={() => void enable(offer.feature_key)}
              onRequest={() => void requestAccess(offer.feature_key)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
