import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { DataTable, TableSkeleton } from '../ui/DataTable'
import { EmptyState } from '../ui/Tabs'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Modal } from '../ui/Drawer'
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
  openCreate: () => void
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
  const [publishOffer, setPublishOffer] = useState<PlatformFeatureOffer | null>(null)
  const [publishBusy, setPublishBusy] = useState(false)

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
      toast.error(err instanceof ApiError ? err.message : 'Could not load add-ons catalog')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  useImperativeHandle(
    ref,
    () => ({
      refresh: load,
      openCreate: () => {
        setEditing(null)
        setModalOpen(true)
      },
    }),
    [load],
  )

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
      toast.success(editing ? 'Add-on updated' : 'Add-on created as draft')
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

  const setStatus = async (offerId: number, catalog_status: string, notify_orgs = false) => {
    setBusyId(offerId)
    try {
      const res = await platformApi.setFeatureOfferCatalogStatus(offerId, catalog_status, {
        notify_orgs,
      })
      if (catalog_status === 'listed') {
        const n = Number((res.offer as { orgs_notified?: number }).orgs_notified || 0)
        toast.success(
          notify_orgs
            ? n > 0
              ? `Listed on Add-ons · ${n} notice${n === 1 ? '' : 's'} sent`
              : 'Listed on Add-ons · no organisations to notify'
            : 'Listed on Add-ons',
        )
      } else {
        toast.success('Unpublished from Add-ons')
      }
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update status')
    } finally {
      setBusyId(null)
    }
  }

  const confirmPublish = async (notify_orgs: boolean) => {
    if (!publishOffer) return
    setPublishBusy(true)
    try {
      await setStatus(publishOffer.id, 'listed', notify_orgs)
      setPublishOffer(null)
    } finally {
      setPublishBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    if (deleting.catalog_status === 'listed') {
      toast.error('Unpublish this add-on before deleting it')
      setDeleting(null)
      return
    }
    setDeleteBusy(true)
    try {
      await platformApi.deleteFeatureOffer(deleting.id)
      toast.success('Add-on deleted')
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
      {loading && offers.length === 0 ? (
        <TableSkeleton rows={6} cols={6} />
      ) : (
        <DataTable
          data={offers}
          onRowClick={r => setUsageOffer(r)}
          columns={[
            {
              key: 'title',
              header: 'Add-on',
              render: r => (
                <div>
                  <p className="font-medium text-heading">{r.title}</p>
                  <p className="text-xs text-muted">{r.feature_key}</p>
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
                      setPublishOffer(r)
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
              title="No add-ons yet"
              description="Create an add-on orgs can browse and enable from Add-ons."
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

      <Modal
        open={publishOffer != null}
        onClose={() => !publishBusy && setPublishOffer(null)}
        title="Publish add-on"
        footerClassName="flex-wrap items-center justify-end gap-3"
        footer={
          <>
            <Button
              variant="outline"
              disabled={publishBusy}
              onClick={() => setPublishOffer(null)}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              loading={publishBusy && busyId === publishOffer?.id}
              disabled={publishBusy}
              onClick={() => void confirmPublish(false)}
            >
              List only
            </Button>
            <Button
              variant="primary"
              loading={publishBusy && busyId === publishOffer?.id}
              disabled={publishBusy}
              onClick={() => void confirmPublish(true)}
            >
              List and notify
            </Button>
          </>
        }
      >
        <p className="text-sm text-heading">
          Publish <span className="font-semibold">{publishOffer?.title}</span> to Add-ons.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          <li>
            <span className="font-medium text-heading">List only</span> — appears in Add-ons; no inbox
            notice.
          </li>
          <li>
            <span className="font-medium text-heading">List and notify</span> — also sends a notice to
            licensed organisations.
          </li>
        </ul>
      </Modal>

      <ConfirmDialog
        open={deleting != null}
        onClose={() => !deleteBusy && setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete add-on?"
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
              (<span className="text-xs">{deleting.feature_key}</span>)
            </>
          ) : null}{' '}
          from the catalog. Orgs will no longer see this card in Add-ons.
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
