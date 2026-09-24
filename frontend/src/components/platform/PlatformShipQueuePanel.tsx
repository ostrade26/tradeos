import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { Pencil } from 'lucide-react'
import { ApiError } from '../../api/client'
import {
  platformApi,
  type ShipQueueItem,
} from '../../api/platformApi'
import { useToast } from '../../hooks/useToast'
import { formatDateTime } from '../../lib/utils'
import { DataTable, TableSkeleton } from '../ui/DataTable'
import { EmptyState } from '../ui/Tabs'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Modal } from '../ui/Drawer'
import { Input } from '../ui/Input'
import { Checkbox } from '../ui/Checkbox'

export type PlatformShipQueuePanelHandle = {
  refresh: () => Promise<void>
}

type PlanningDraft = {
  kind: 'feature_offer' | 'release'
  id: number
  title: string
  ready_to_ship: boolean
  target_ship_date: string
  ship_notes: string
}

export const PlatformShipQueuePanel = forwardRef<PlatformShipQueuePanelHandle>(
  function PlatformShipQueuePanel(_props, ref) {
    const toast = useToast()
    const [loading, setLoading] = useState(true)
    const [items, setItems] = useState<ShipQueueItem[]>([])
    const [counts, setCounts] = useState({ draft_offers: 0, draft_releases: 0 })
    const [planning, setPlanning] = useState<PlanningDraft | null>(null)
    const [savingPlanning, setSavingPlanning] = useState(false)
    const [listTarget, setListTarget] = useState<ShipQueueItem | null>(null)
    const [listing, setListing] = useState(false)

    const load = useCallback(async () => {
      setLoading(true)
      try {
        const res = await platformApi.getShipQueue()
        setItems(res.items)
        setCounts({ draft_offers: res.draft_offers, draft_releases: res.draft_releases })
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Could not load ship queue')
      } finally {
        setLoading(false)
      }
    }, [toast])

    useEffect(() => {
      void load()
    }, [load])

    useImperativeHandle(ref, () => ({ refresh: load }), [load])

    const openPlanning = (row: ShipQueueItem) => {
      setPlanning({
        kind: row.kind,
        id: row.id,
        title: row.title,
        ready_to_ship: Boolean(row.ready_to_ship),
        target_ship_date: row.target_ship_date || '',
        ship_notes: row.ship_notes || '',
      })
    }

    const savePlanning = async () => {
      if (!planning) return
      setSavingPlanning(true)
      try {
        const body = {
          ready_to_ship: planning.ready_to_ship,
          target_ship_date: planning.target_ship_date.trim(),
          ship_notes: planning.ship_notes.trim(),
        }
        if (planning.kind === 'feature_offer') {
          await platformApi.updateFeatureOfferShipPlanning(planning.id, body)
        } else {
          await platformApi.updateReleaseShipPlanning(planning.id, body)
        }
        toast.success('Ship planning saved')
        setPlanning(null)
        await load()
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Could not save ship planning')
      } finally {
        setSavingPlanning(false)
      }
    }

    const confirmListOffer = async (notify: boolean) => {
      if (!listTarget || listTarget.kind !== 'feature_offer') return
      setListing(true)
      try {
        await platformApi.setFeatureOfferCatalogStatus(listTarget.id, 'listed', {
          notify_orgs: notify,
        })
        toast.success(notify ? 'Listed and notified organisations' : 'Listed on Add-ons')
        setListTarget(null)
        await load()
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Could not list add-on')
      } finally {
        setListing(false)
      }
    }

    const columns = useMemo(
      () => [
        {
          key: 'kind',
          header: 'Type',
          className: 'whitespace-nowrap w-[7rem]',
          render: (r: ShipQueueItem) =>
            r.kind === 'feature_offer' ? (
              <Badge variant="info">Add-on</Badge>
            ) : (
              <Badge variant="default">Release</Badge>
            ),
        },
        {
          key: 'title',
          header: 'Item',
          className: 'min-w-[12rem]',
          render: (r: ShipQueueItem) => (
            <div className="min-w-0">
              <p className="font-medium text-heading truncate">{r.title}</p>
              <p className="text-xs text-muted truncate font-mono">{r.subtitle || r.feature_key || '—'}</p>
            </div>
          ),
        },
        {
          key: 'ready',
          header: 'Ready',
          className: 'whitespace-nowrap w-[5.5rem]',
          render: (r: ShipQueueItem) =>
            r.ready_to_ship ? (
              <span className="text-sm font-medium text-heading">Yes</span>
            ) : (
              <span className="text-sm text-muted">No</span>
            ),
        },
        {
          key: 'target',
          header: 'Target',
          className: 'whitespace-nowrap min-w-[7rem]',
          render: (r: ShipQueueItem) => (
            <span className="tabular-nums text-sm">{r.target_ship_date || '—'}</span>
          ),
        },
        {
          key: 'notes',
          header: 'Notes',
          className: 'min-w-[10rem] max-w-[18rem]',
          render: (r: ShipQueueItem) => (
            <span className="text-sm text-muted line-clamp-2">{r.ship_notes || '—'}</span>
          ),
        },
        {
          key: 'updated',
          header: 'Updated',
          className: 'whitespace-nowrap min-w-[8rem]',
          render: (r: ShipQueueItem) => (
            <span className="text-xs text-muted tabular-nums">{formatDateTime(r.updated_at)}</span>
          ),
        },
        {
          key: 'actions',
          header: '',
          // Not sticky-narrow: three labeled CTAs need content-sized width.
          className: 'whitespace-nowrap text-right min-w-[14.5rem]',
          render: (r: ShipQueueItem) => (
            <div className="flex flex-nowrap items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
              <Button variant="ghost" size="sm" onClick={() => openPlanning(r)}>
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Plan
              </Button>
              <Button variant="outline" size="sm" to={r.href}>
                Open
              </Button>
              {r.kind === 'feature_offer' ? (
                <Button size="sm" onClick={() => setListTarget(r)}>
                  List
                </Button>
              ) : (
                <Button size="sm" to={r.href}>
                  Publish
                </Button>
              )}
            </div>
          ),
        },
      ],
      [],
    )

    if (loading && items.length === 0) {
      return <TableSkeleton rows={8} cols={6} />
    }

    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Built but not user-facing yet: {counts.draft_offers} draft add-on
          {counts.draft_offers === 1 ? '' : 's'}, {counts.draft_releases} draft release
          {counts.draft_releases === 1 ? '' : 's'}. Listing and publishing stay manual.
        </p>

        <DataTable
          data={items}
          columns={columns}
          getRowId={r => `${r.kind}-${r.id}`}
          stickyFirstColumn
          stickyLastColumn={false}
          emptyState={
            <EmptyState
              title="Ship queue is empty"
              description="Draft Features & Access offers and draft Releases appear here. Create a draft add-on or release when you build something you might hold back."
              action={
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button variant="outline" size="sm" to="/platform-admin/add-ons?tab=catalog">
                    Features & Access
                  </Button>
                  <Button variant="outline" size="sm" to="/platform-admin/releases">
                    Releases
                  </Button>
                </div>
              }
            />
          }
          mobileRender={r => (
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-heading truncate">{r.title}</p>
                  <p className="text-xs text-muted font-mono truncate">{r.subtitle}</p>
                </div>
                {r.kind === 'feature_offer' ? (
                  <Badge variant="info">Add-on</Badge>
                ) : (
                  <Badge variant="default">Release</Badge>
                )}
              </div>
              <p className="text-xs text-muted">
                Ready: {r.ready_to_ship ? 'Yes' : 'No'}
                {r.target_ship_date ? ` · Target ${r.target_ship_date}` : ''}
              </p>
              {r.ship_notes ? <p className="text-sm text-muted line-clamp-3">{r.ship_notes}</p> : null}
              <div className="flex flex-wrap gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => openPlanning(r)}>
                  Plan
                </Button>
                <Button variant="outline" size="sm" to={r.href}>
                  Open
                </Button>
              </div>
            </div>
          )}
        />

        <Modal
          open={planning != null}
          onClose={() => !savingPlanning && setPlanning(null)}
          title="Ship planning"
          subtitle={planning?.title}
          footer={
            <>
              <Button variant="outline" onClick={() => setPlanning(null)} disabled={savingPlanning}>
                Cancel
              </Button>
              <Button onClick={() => void savePlanning()} loading={savingPlanning}>
                Save
              </Button>
            </>
          }
        >
          {planning ? (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Checkbox
                  checked={planning.ready_to_ship}
                  onChange={e => setPlanning({ ...planning, ready_to_ship: e.target.checked })}
                  label="Ready to ship"
                />
                <p className="text-xs text-muted pl-6">
                  Marks this item in the queue. Does not list or publish automatically.
                </p>
              </div>
              <div className="space-y-1.5">
                <Input
                  label="Target ship date"
                  type="date"
                  value={planning.target_ship_date}
                  onChange={e => setPlanning({ ...planning, target_ship_date: e.target.value })}
                />
                <p className="text-xs text-muted">Optional — you still list or publish manually.</p>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-heading" htmlFor="ship-notes">
                  Ship notes
                </label>
                <textarea
                  id="ship-notes"
                  rows={4}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-heading shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-gray-700 dark:bg-gray-900"
                  value={planning.ship_notes}
                  onChange={e => setPlanning({ ...planning, ship_notes: e.target.value })}
                  placeholder="Why waiting, who owns it, what to verify before push…"
                  maxLength={2000}
                />
              </div>
            </div>
          ) : null}
        </Modal>

        <Modal
          open={listTarget != null}
          onClose={() => !listing && setListTarget(null)}
          title="List this add-on?"
          subtitle={listTarget?.title}
          footerClassName="flex-wrap items-center justify-end gap-3"
          footer={
            <>
              <Button variant="outline" disabled={listing} onClick={() => setListTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="outline"
                loading={listing}
                disabled={listing}
                onClick={() => void confirmListOffer(false)}
              >
                List only
              </Button>
              <Button
                loading={listing}
                disabled={listing}
                onClick={() => void confirmListOffer(true)}
              >
                List and notify
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted leading-relaxed">
            This add-on will appear under organisation Add-ons. Listing is the control that pushes it
            to users — code may already be in production behind the draft.
          </p>
        </Modal>
      </div>
    )
  },
)
