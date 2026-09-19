import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { DataTable, TableSkeleton } from '../ui/DataTable'
import { EmptyState } from '../ui/Tabs'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { DetailPanelMenu } from '../ui/DetailPanelMenu'
import { useDetailPanelSlot } from '../layout/DetailPanelSlot'
import { ApiError } from '../../api/client'
import { platformApi, type PlatformFeatureOffer } from '../../api/platformApi'
import { useToast } from '../../hooks/useToast'
import { useLargeScreen } from '../../hooks/useMediaQuery'
import { loadOrderPanelDocked, saveOrderPanelDocked } from '../../lib/orderPanelDock'
import { formatDateTime } from '../../lib/utils'
import {
  PlatformFeatureOfferModal,
  type FeatureOfferFormPayload,
} from './PlatformFeatureOfferModal'
import { PlatformFeatureOfferUsageDrawer } from './PlatformFeatureOfferUsageDrawer'

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
  const { setOpen: setDetailPanelOpen } = useDetailPanelSlot()
  const isLargeScreen = useLargeScreen()
  const [panelDocked, setPanelDocked] = useState(() => loadOrderPanelDocked())
  const effectiveDocked = panelDocked && isLargeScreen
  const [loading, setLoading] = useState(true)
  const [offers, setOffers] = useState<PlatformFeatureOffer[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PlatformFeatureOffer | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<PlatformFeatureOffer | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [usageOffer, setUsageOffer] = useState<PlatformFeatureOffer | null>(null)

  const closeUsage = useCallback(() => {
    setDetailPanelOpen(false)
    setUsageOffer(null)
  }, [setDetailPanelOpen])

  const handleDockChange = useCallback(
    (docked: boolean) => {
      if (!docked) setDetailPanelOpen(false)
      setPanelDocked(docked)
      saveOrderPanelDocked(docked)
    },
    [setDetailPanelOpen],
  )

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
      const offersRes = await platformApi.listFeatureOffers()
      setOffers(offersRes.offers)
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
      const res = editing
        ? await platformApi.updateFeatureOffer(editing.id, payload)
        : await platformApi.createFeatureOffer(payload)
      toast.success(editing ? 'Feature updated' : 'Feature created as draft')
      closeModal()
      await load()
      if (usageOffer && res.offer.id === usageOffer.id) {
        setUsageOffer(res.offer)
      }
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
      toast.success(
        catalog_status === 'listed'
          ? 'Published to Features · organisations notified'
          : 'Unpublished from Features',
      )
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update status')
    } finally {
      setBusyId(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    if (deleting.catalog_status === 'listed') {
      toast.error('Unpublish this feature before deleting it')
      setDeleting(null)
      return
    }
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

  return (
    <div className="space-y-4">
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
          onRowClick={r => setUsageOffer(r)}
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
                    onClick={e => {
                      e.stopPropagation()
                      void setStatus(r.id, 'retired')
                    }}
                  >
                    Unpublish
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className="w-[6.75rem]"
                    loading={busyId === r.id}
                    onClick={e => {
                      e.stopPropagation()
                      void setStatus(r.id, 'listed')
                    }}
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
                <div onClick={e => e.stopPropagation()}>
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
                      ...(r.catalog_status === 'listed'
                        ? []
                        : [
                            {
                              type: 'button' as const,
                              label: 'Delete',
                              icon: Trash2,
                              tone: 'danger' as const,
                              onClick: () => setDeleting(r),
                            },
                          ]),
                    ]}
                  />
                </div>
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

      <PlatformFeatureOfferUsageDrawer
        offer={usageOffer}
        open={usageOffer != null}
        onClose={closeUsage}
        docked={effectiveDocked}
        onDockChange={handleDockChange}
      />

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
          <p className="text-sm text-muted mt-3">
            {deleting?.active_orgs ?? 0} organisation
            {(deleting?.active_orgs ?? 0) === 1 ? '' : 's'} already have access
            {(deleting?.pending_requests ?? 0) > 0
              ? ` and ${deleting?.pending_requests} pending request${
                  (deleting?.pending_requests ?? 0) === 1 ? '' : 's'
                }`
              : ''}
            . Deleting removes the catalog card only — existing access is unchanged.
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  )
})
