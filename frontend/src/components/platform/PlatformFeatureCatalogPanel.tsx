import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Card, CardHeader } from '../ui/Card'
import { DataTable, TableSkeleton } from '../ui/DataTable'
import { EmptyState } from '../ui/Tabs'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { DetailPanelMenu } from '../ui/DetailPanelMenu'
import { ApiError } from '../../api/client'
import {
  platformApi,
  type PlatformFeatureOffer,
  type ProductionUpdatesSummary,
} from '../../api/platformApi'
import { useToast } from '../../hooks/useToast'
import { formatDateTime } from '../../lib/utils'
import {
  PlatformFeatureOfferModal,
  type FeatureOfferFormPayload,
} from './PlatformFeatureOfferModal'

function statusBadge(status: string) {
  if (status === 'listed') return <Badge variant="success">Published</Badge>
  if (status === 'retired') return <Badge variant="default">Unpublished</Badge>
  return <Badge variant="info">Draft</Badge>
}

function pricingLabel(offer: PlatformFeatureOffer): string {
  if (offer.pricing_type === 'free') return 'Free'
  if (offer.pricing_type === 'contact') return 'Contact'
  if (offer.price_cents > 0) return `₹${(offer.price_cents / 100).toLocaleString('en-IN')}`
  return 'Paid'
}

export type PlatformFeatureCatalogPanelHandle = {
  refresh: () => Promise<void>
}

export const PlatformFeatureCatalogPanel = forwardRef<
  PlatformFeatureCatalogPanelHandle,
  object
>(function PlatformFeatureCatalogPanel(_props, ref) {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [offers, setOffers] = useState<PlatformFeatureOffer[]>([])
  const [summary, setSummary] = useState<ProductionUpdatesSummary | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PlatformFeatureOffer | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<PlatformFeatureOffer | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const createPrefill = useMemo(() => {
    const key = searchParams.get('createKey')?.trim()
    const title = searchParams.get('createTitle')?.trim()
    if (!key && !title) return undefined
    return { feature_key: key ?? '', title: title ?? key ?? '' }
  }, [searchParams])

  useEffect(() => {
    if (createPrefill?.feature_key || createPrefill?.title) {
      setEditing(null)
      setModalOpen(true)
    }
  }, [createPrefill])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [offersRes, summaryRes] = await Promise.all([
        platformApi.listFeatureOffers(),
        platformApi.productionUpdates(),
      ])
      setOffers(offersRes.offers)
      setSummary(summaryRes)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not load features catalog')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  useImperativeHandle(ref, () => ({ refresh: load }), [load])

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
    if (searchParams.has('createKey') || searchParams.has('createTitle')) {
      const next = new URLSearchParams(searchParams)
      next.delete('createKey')
      next.delete('createTitle')
      setSearchParams(next, { replace: true })
    }
  }

  const saveOffer = async (payload: FeatureOfferFormPayload) => {
    setSaving(true)
    try {
      if (editing) {
        await platformApi.updateFeatureOffer(editing.id, payload)
        toast.success('Feature updated')
      } else {
        await platformApi.createFeatureOffer(payload)
        toast.success('Feature created as draft')
      }
      closeModal()
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save offer')
    } finally {
      setSaving(false)
    }
  }

  const setStatus = async (offerId: number, catalog_status: string) => {
    setBusyId(offerId)
    try {
      await platformApi.setFeatureOfferCatalogStatus(offerId, catalog_status)
      toast.success(catalog_status === 'listed' ? 'Published to Features' : 'Unpublished from Features')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update status')
    } finally {
      setBusyId(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await platformApi.deleteFeatureOffer(deleting.id)
      toast.success('Feature deleted')
      setDeleting(null)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete')
      throw err
    } finally {
      setDeleteBusy(false)
    }
  }

  const hasProductionUpdates =
    (summary?.ui_items?.length ?? 0) > 0 || (summary?.feature_items?.length ?? 0) > 0
  const releaseSubtitle = summary?.release
    ? `${summary.release.version ?? 'Draft'} · ${summary.release.title ?? 'Deploy'}`
    : undefined

  return (
    <div className="space-y-4">
      {hasProductionUpdates ? (
        <Card padding={false}>
          <div className="px-6 pt-6">
            <CardHeader title="Production updates" subtitle={releaseSubtitle} />
          </div>
          <div className="px-6 pb-6 space-y-4">
            {summary?.ui_items?.length ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Shipped (UI & fixes)</p>
                <ul className="mt-2 text-sm text-heading list-disc pl-5 space-y-1">
                  {summary.ui_items.map((item, i) => (
                    <li key={`${item.title}-${i}`}>{item.title}</li>
                  ))}
                </ul>
                <p className="text-xs text-muted mt-2">Publish these via Releases → bell notifications only.</p>
              </div>
            ) : null}
            {summary?.feature_items?.length ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Feature enhancements</p>
                <ul className="mt-2 space-y-2">
                  {summary.feature_items.map(item => (
                    <li
                      key={`${item.feature_key}-${item.title}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-heading">{item.title}</p>
                        <p className="text-xs text-muted font-mono">{item.feature_key || '—'}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.catalog_status === 'listed' ? (
                          <Badge variant="success">Published</Badge>
                        ) : item.catalog_offer_id ? (
                          <Badge variant="info">
                            {item.catalog_status === 'retired' ? 'Unpublished' : 'Draft'}
                          </Badge>
                        ) : (
                          <Badge variant="warning">No feature</Badge>
                        )}
                        {!item.catalog_offer_id && item.feature_key ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditing(null)
                              setModalOpen(true)
                              setSearchParams(
                                prev => {
                                  const next = new URLSearchParams(prev)
                                  next.set('createKey', item.feature_key!)
                                  next.set('createTitle', String(item.title ?? item.feature_key))
                                  return next
                                },
                                { replace: true },
                              )
                            }}
                          >
                            New Feature
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            setEditing(null)
            setModalOpen(true)
          }}
        >
          <Plus className="h-4 w-4" aria-hidden />
          New Feature
        </Button>
      </div>

      {loading && offers.length === 0 ? (
        <TableSkeleton rows={6} cols={6} />
      ) : (
        <DataTable
          data={offers}
          columns={[
            {
              key: 'title',
              header: 'Feature',
              render: r => (
                <div>
                  <p className="font-medium text-heading">{r.title}</p>
                  <p className="text-xs text-muted font-mono">{r.feature_key}</p>
                </div>
              ),
            },
            {
              key: 'pricing',
              header: 'Pricing',
              render: r => pricingLabel(r),
            },
            {
              key: 'status',
              header: 'Status',
              render: r => statusBadge(r.catalog_status),
            },
            {
              key: 'usage',
              header: 'Orgs',
              render: r => (
                <span className="tabular-nums text-sm">
                  {r.active_orgs ?? 0} active · {r.pending_requests ?? 0} pending
                </span>
              ),
            },
            {
              key: 'listed',
              header: 'Listed',
              render: r => (r.listed_at ? formatDateTime(r.listed_at) : '—'),
            },
            {
              key: 'publish',
              header: '',
              className: 'text-center',
              render: r =>
                r.catalog_status === 'listed' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-[6.75rem]"
                    loading={busyId === r.id}
                    onClick={() => void setStatus(r.id, 'retired')}
                  >
                    Unpublish
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className="w-[6.75rem]"
                    loading={busyId === r.id}
                    onClick={() => void setStatus(r.id, 'listed')}
                  >
                    Publish
                  </Button>
                ),
            },
            {
              key: 'actions',
              header: '',
              className: 'text-center !px-1',
              render: r => (
                <DetailPanelMenu
                  align="end"
                  tableTrigger="h-7 w-7"
                  items={[
                    {
                      type: 'button',
                      label: 'Edit',
                      icon: Pencil,
                      onClick: () => {
                        setEditing(r)
                        setModalOpen(true)
                      },
                    },
                    {
                      type: 'button',
                      label: 'Delete',
                      icon: Trash2,
                      tone: 'danger',
                      onClick: () => setDeleting(r),
                    },
                  ]}
                />
              ),
            },
          ]}
          getRowId={r => String(r.id)}
          defaultPageSize={25}
          emptyState={
            <EmptyState
              title="No features yet"
              description="Create a feature orgs can browse and enable from Features."
            />
          }
        />
      )}

      <PlatformFeatureOfferModal
        open={modalOpen}
        onClose={closeModal}
        offer={editing}
        initial={editing ? undefined : createPrefill}
        saving={saving}
        onSave={saveOffer}
      />

      <ConfirmDialog
        open={deleting != null}
        onClose={() => !deleteBusy && setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete feature?"
        variant="danger"
        confirmLabel="Delete"
        slideLabel="Slide to delete"
        confirmLoading={deleteBusy}
      >
        <p className="text-sm text-heading">
          Remove <span className="font-semibold">{deleting?.title}</span>
          {deleting?.feature_key ? (
            <>
              {' '}
              (<span className="font-mono text-xs">{deleting.feature_key}</span>)
            </>
          ) : null}{' '}
          from the catalog. Orgs will no longer see this card in Features.
        </p>
        {(deleting?.active_orgs ?? 0) > 0 || (deleting?.pending_requests ?? 0) > 0 ? (
          <p className="text-sm text-warning mt-3">
            This feature has {deleting?.active_orgs ?? 0} active org
            {(deleting?.active_orgs ?? 0) === 1 ? '' : 's'} and {deleting?.pending_requests ?? 0} pending
            request{(deleting?.pending_requests ?? 0) === 1 ? '' : 's'}. Unpublish or resolve those first —
            delete will be blocked.
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  )
})
