import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Building2 } from 'lucide-react'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Badge } from '../components/ui/Badge'
import { AddOnMarketplaceGridCard, ADDON_MARKETPLACE_GRID } from '../components/features/AddOnMarketplaceGridCard'
import { featureOfferPriceLabel } from '../components/features/FeatureOfferCatalogCard'
import { organisationApi, type OrgFeatureOffer } from '../api/organisationApi'
import { useToast } from '../hooks/useToast'
import { useAuth, usePermissions } from '../hooks/useAuth'
import { ApiError } from '../api/client'
import { authApi } from '../api/tradeApi'
import { sessionFromApi } from '../lib/authSession'
import { saveAuthSession } from '../lib/auth'
import { APP_HOME, appPath } from '../lib/appShellMode'
import { cn } from '../lib/utils'
import { darkenHex } from '../lib/accentColor'
import {
  addOnCardSurface,
  addOnCardSurfaceFromHex,
  iconForAddOnTone,
  resolveAddOnCardTag,
  resolveAddOnCardTone,
  resolveCardBgHex,
} from '../lib/featureOfferVisuals'
import {
  addOnMarketplaceStats,
  formatEnabledCount,
} from '../lib/addOnMarketplaceStats'
import { isPreviewAddOnKey, mergeAddOnOffersWithPreview } from '../lib/addOnMarketplacePreview'
import { browseAddOns } from '../lib/addOnMarketplaceSections'

export function AddOnDetailPage() {
  const { featureKey: rawKey } = useParams<{ featureKey: string }>()
  const featureKey = rawKey ? decodeURIComponent(rawKey) : ''
  const navigate = useNavigate()
  const toast = useToast()
  const { session, applySession, isPlatformAdmin } = useAuth()
  const { hasPermission } = usePermissions()
  const canBrowse = hasPermission('organisation.subscription.view') && !isPlatformAdmin
  const canManage = hasPermission('organisation.edit')

  const [offers, setOffers] = useState<OrgFeatureOffer[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirmRequest, setConfirmRequest] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await organisationApi.listAddOns()
      setOffers(res.offers)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not load add-on')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const displayOffers = useMemo(() => mergeAddOnOffersWithPreview(offers), [offers])
  const offer = useMemo(
    () => displayOffers.find(o => o.feature_key === featureKey) ?? null,
    [displayOffers, featureKey],
  )

  const related = useMemo(() => {
    if (!offer) return []
    return browseAddOns(displayOffers)
      .filter(o => o.feature_key !== offer.feature_key)
      .slice(0, 4)
  }, [displayOffers, offer])

  const refreshSession = async () => {
    if (!session?.token) return
    const me = await authApi.me()
    applySession(sessionFromApi(me, session.token))
    saveAuthSession(sessionFromApi(me, session.token))
  }

  const enable = async () => {
    if (!offer) return
    if (isPreviewAddOnKey(offer.feature_key)) {
      toast.info('Preview tile only — connect real catalog offers to enable.')
      return
    }
    setBusy(true)
    try {
      await organisationApi.enableAddOn(offer.feature_key)
      toast.success('Add-on enabled for your organisation')
      await refreshSession()
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not enable')
    } finally {
      setBusy(false)
    }
  }

  const requestAccess = async () => {
    if (!offer) return
    if (isPreviewAddOnKey(offer.feature_key)) {
      toast.info('Preview tile only — connect real catalog offers to request access.')
      return
    }
    setBusy(true)
    try {
      await organisationApi.requestAddOn(offer.feature_key)
      toast.success('Request sent — Tradeal will review')
      setConfirmRequest(false)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not send request')
      throw err
    } finally {
      setBusy(false)
    }
  }

  if (!canBrowse) {
    return <Navigate to={APP_HOME} replace />
  }

  if (!featureKey) {
    return <Navigate to={appPath('/addons')} replace />
  }

  if (!loading && !offer) {
    return (
      <div className="animate-fade-in w-full min-w-0 max-w-3xl">
        <PageHeader
          title="Add-on not found"
          subtitle="This add-on is not listed or is no longer available."
          breadcrumb={
            <Breadcrumb
              items={[
                { label: 'Tradeal', href: APP_HOME },
                { label: 'Add-ons', href: appPath('/addons') },
                { label: 'Not found' },
              ]}
            />
          }
        />
        <Button to={appPath('/addons')} variant="outline" size="sm">
          Back to Add-ons
        </Button>
      </div>
    )
  }

  if (loading || !offer) {
    return (
      <div className="animate-fade-in w-full min-w-0 max-w-3xl space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-10 w-72 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="aspect-[16/9] animate-pulse rounded-md bg-gray-200 dark:bg-gray-700" />
        <div className="space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
        </div>
      </div>
    )
  }

  const price = featureOfferPriceLabel(offer.pricing_type, offer.price_cents)
  const stats = addOnMarketplaceStats(offer)
  const surfaceKind = resolveAddOnCardTone(offer.feature_key, offer.title, offer.card_tone)
  const Icon = iconForAddOnTone(surfaceKind)
  const category = resolveAddOnCardTag(offer)
  const customBg = resolveCardBgHex(offer.card_bg_hex)
  const surface = customBg ? addOnCardSurfaceFromHex(customBg) : addOnCardSurface(surfaceKind)
  const categoryPill = addOnCardSurface(surfaceKind).categoryPill
  const image = (offer.card_image_url || '').trim()
  const imagePanelStyle = customBg ? { backgroundColor: darkenHex(customBg, 0.1) } : undefined
  const aboutBody =
    offer.description.trim() ||
    'This add-on extends Tradeal for your organisation. Enable free add-ons instantly, or request access to paid ones.'

  const cta =
    offer.entitlement_status === 'active' ? (
      <Badge variant="success" className="h-10 px-4 text-sm">
        Active for your organisation
      </Badge>
    ) : offer.entitlement_status === 'pending' ? (
      <Badge variant="info" className="h-10 px-4 text-sm">
        Access request pending
      </Badge>
    ) : !canManage ? (
      <p className="text-sm text-muted">Ask an organisation admin to enable this add-on.</p>
    ) : offer.pricing_type === 'free' ? (
      <Button size="lg" loading={busy} disabled={busy} onClick={() => void enable()}>
        Enable add-on
      </Button>
    ) : (
      <Button
        size="lg"
        variant="outline"
        loading={busy}
        disabled={busy}
        onClick={() => setConfirmRequest(true)}
      >
        Request access
      </Button>
    )

  return (
    <div className="animate-fade-in w-full min-w-0 max-w-none">
      <div className="max-w-3xl">
        <PageHeader
          title={offer.title}
          breadcrumb={
            <Breadcrumb
              items={[
                { label: 'Tradeal', href: APP_HOME },
                { label: 'Add-ons', href: appPath('/addons') },
                { label: offer.title },
              ]}
            />
          }
          actions={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigate(appPath('/addons'))}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          }
          actionsAlign="start"
        />

        <div className="space-y-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span
                className={cn(
                  'text-lg font-semibold tabular-nums',
                  price === 'Free' ? 'text-success' : 'text-heading',
                )}
              >
                {price}
              </span>
            {stats.enabledCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-muted">
                <Building2 className="h-4 w-4 shrink-0" aria-hidden />
                {formatEnabledCount(stats.enabledCount)}
              </span>
            ) : null}
            <span
              className={cn(
                'inline-flex rounded-md px-2.5 py-0.5 text-xs font-semibold',
                categoryPill,
              )}
            >
              {category}
            </span>
            </div>
            <div className="shrink-0">{cta}</div>
          </div>

          <div
            className={cn(
              'relative aspect-[16/9] overflow-hidden rounded-md ring-1 ring-black/[0.06] dark:ring-white/10',
              !customBg && surface.imagePanel,
            )}
            style={imagePanelStyle}
          >
            {image ? (
              <img src={image} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Icon className={cn('h-24 w-24', surface.iconFallback)} strokeWidth={1.25} aria-hidden />
              </div>
            )}
          </div>

          <section className="space-y-3" aria-labelledby="addon-about">
            <h2 id="addon-about" className="text-lg font-semibold tracking-tight text-heading">
              About {offer.title}
            </h2>
            <p className="text-sm text-muted leading-relaxed whitespace-pre-wrap">{aboutBody}</p>
          </section>
        </div>
      </div>

      {related.length > 0 ? (
        <section className="mt-10 space-y-4" aria-labelledby="addon-related">
          <h2 id="addon-related" className="text-lg font-semibold tracking-tight text-heading">
            Related add-ons
          </h2>
          <div className={ADDON_MARKETPLACE_GRID}>
            {related.map(item => (
              <AddOnMarketplaceGridCard key={item.feature_key} offer={item} />
            ))}
          </div>
          <Link
            to={appPath('/addons')}
            className="inline-block text-sm font-semibold text-accent hover:underline"
          >
            Browse all add-ons
          </Link>
        </section>
      ) : null}

      <ConfirmDialog
        open={confirmRequest}
        onClose={() => !busy && setConfirmRequest(false)}
        onConfirm={() => requestAccess()}
        title="Request this add-on?"
        confirmLabel="Send request"
        cancelLabel="Not now"
        confirmLoading={busy}
      >
        <p className="text-sm text-heading">
          Send a request for <span className="font-semibold">{offer.title}</span> to Tradeal?
        </p>
        <p className="mt-3 text-sm text-muted">
          Tradeal will review and notify your organisation. Only send when you intend to use this
          add-on.
        </p>
      </ConfirmDialog>
    </div>
  )
}
