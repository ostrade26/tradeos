import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { Pencil } from 'lucide-react'
import { ApiError } from '../../api/client'
import {
  platformApi,
  type NotificationAudience,
  type NotificationRecipientScope,
  type PlatformOrganisation,
  type PlatformUser,
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
import { Select } from '../ui/Select'

export type PlatformShipQueuePanelHandle = {
  refresh: () => Promise<void>
}

type PlanningDraft = {
  kind: 'feature_offer' | 'release' | 'product_update'
  id: number
  title: string
  ready_to_ship: boolean
  target_ship_date: string
  ship_notes: string
}

function kindBadge(kind: ShipQueueItem['kind']) {
  if (kind === 'feature_offer') return <Badge variant="info">Add-on</Badge>
  if (kind === 'product_update') return <Badge variant="accent">Product update</Badge>
  return <Badge variant="default">Release draft</Badge>
}

export const PlatformShipQueuePanel = forwardRef<
  PlatformShipQueuePanelHandle,
  { organisations?: PlatformOrganisation[]; users?: PlatformUser[] }
>(function PlatformShipQueuePanel({ organisations = [], users = [] }, ref) {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<ShipQueueItem[]>([])
  const [counts, setCounts] = useState({
    draft_offers: 0,
    draft_releases: 0,
    deferred_product_updates: 0,
  })
  const [planning, setPlanning] = useState<PlanningDraft | null>(null)
  const [savingPlanning, setSavingPlanning] = useState(false)
  const [listTarget, setListTarget] = useState<ShipQueueItem | null>(null)
  const [listing, setListing] = useState(false)
  const [announceTarget, setAnnounceTarget] = useState<ShipQueueItem | null>(null)
  const [announcing, setAnnouncing] = useState(false)
  const [localUsers, setLocalUsers] = useState<PlatformUser[]>([])
  const [notifyOrgs, setNotifyOrgs] = useState(true)
  const [audience, setAudience] = useState<NotificationAudience>('active_licences')
  const [orgId, setOrgId] = useState('')
  const [recipientId, setRecipientId] = useState('')
  const [scope, setScope] = useState<NotificationRecipientScope>('all_users')
  const [excludeExpiredAmc, setExcludeExpiredAmc] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await platformApi.getShipQueue()
      setItems(res.items)
      setCounts({
        draft_offers: res.draft_offers,
        draft_releases: res.draft_releases,
        deferred_product_updates: res.deferred_product_updates ?? 0,
      })
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
      } else if (planning.kind === 'product_update') {
        await platformApi.updateReleaseItemShipPlanning(planning.id, body)
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

  const openAnnounce = (row: ShipQueueItem) => {
    setAnnounceTarget(row)
    setNotifyOrgs(true)
    setAudience('active_licences')
    setOrgId('')
    setRecipientId('')
    setScope('all_users')
    setExcludeExpiredAmc(true)
    if (users.length === 0) {
      void platformApi
        .listUsers()
        .then(res => setLocalUsers(res.users))
        .catch(() => setLocalUsers([]))
    }
  }

  const audienceUsers = users.length > 0 ? users : localUsers

  const recipients = useMemo(
    () => audienceUsers.filter(u => u.organisation_id === Number(orgId) && u.status === 'active'),
    [audienceUsers, orgId],
  )
  const needsOrg = notifyOrgs && audience !== 'active_licences'
  const canAnnounce = Boolean(announceTarget && (!needsOrg || orgId))

  const confirmAnnounce = async () => {
    if (!announceTarget || announceTarget.kind !== 'product_update') return
    setAnnouncing(true)
    try {
      const res = await platformApi.announceProductUpdate(announceTarget.id, {
        audience,
        organisation_id: orgId ? Number(orgId) : null,
        recipient_user_id: audience === 'user' && recipientId ? Number(recipientId) : null,
        recipient_scope: audience === 'user' ? 'org_admin' : scope,
        exclude_expired_amc: excludeExpiredAmc,
        notify_organisations: notifyOrgs,
      })
      const sent = res.item.sent
      toast.success(
        notifyOrgs
          ? `Announced${typeof sent === 'number' ? ` · ${sent} notice${sent === 1 ? '' : 's'}` : ''}`
          : 'Marked announced (quiet)',
      )
      setAnnounceTarget(null)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not announce update')
    } finally {
      setAnnouncing(false)
    }
  }

  const columns = useMemo(
    () => [
      {
        key: 'kind',
        header: 'Type',
        className: 'whitespace-nowrap w-[8.5rem]',
        render: (r: ShipQueueItem) => kindBadge(r.kind),
      },
        {
          key: 'title',
          header: 'Item',
          className: 'min-w-[14rem]',
          render: (r: ShipQueueItem) => (
            <div className="min-w-0 space-y-1.5">
              <p className="font-medium text-heading truncate">{r.title}</p>
              <p className="text-xs text-muted truncate font-mono">{r.subtitle || r.feature_key || '—'}</p>
              {r.kind === 'release' && r.change_lines && r.change_lines.length > 0 ? (
                <ul className="mt-1 space-y-1">
                  {r.change_lines.slice(0, 6).map((line, i) => (
                    <li key={`${r.id}-${i}`} className="text-xs text-muted leading-snug">
                      <span className="text-heading">{line.title}</span>
                      {line.announce_timing === 'later' ? (
                        <span className="text-muted"> · Ship later</span>
                      ) : null}
                    </li>
                  ))}
                  {r.change_lines.length > 6 ? (
                    <li className="text-xs text-muted">+{r.change_lines.length - 6} more</li>
                  ) : null}
                </ul>
              ) : null}
              {r.kind === 'product_update' && r.detail ? (
                <p className="text-xs text-muted line-clamp-2">{r.detail}</p>
              ) : null}
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
            ) : r.kind === 'product_update' ? (
              <Button size="sm" onClick={() => openAnnounce(r)}>
                Announce
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
          Built but not live yet: {counts.draft_offers} draft add-on
          {counts.draft_offers === 1 ? '' : 's'}, {counts.draft_releases} draft release
          {counts.draft_releases === 1 ? '' : 's'}, {counts.deferred_product_updates} product update
          {counts.deferred_product_updates === 1 ? '' : 's'} waiting to announce. Drafts live here;
          the Releases page shows published versions only. Version is assigned when you publish.
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
            description="Draft Features & Access offers, draft Releases, and Ship-later product updates appear here."
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
              {kindBadge(r.kind)}
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
              {r.kind === 'product_update' ? (
                <Button size="sm" onClick={() => openAnnounce(r)}>
                  Announce
                </Button>
              ) : null}
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
                Marks this item in the queue. Does not list, publish, or announce automatically.
              </p>
            </div>
            <div className="space-y-1.5">
              <Input
                label="Target ship date"
                type="date"
                value={planning.target_ship_date}
                onChange={e => setPlanning({ ...planning, target_ship_date: e.target.value })}
              />
              <p className="text-xs text-muted">Optional — you still act manually.</p>
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

      <Modal
        open={announceTarget != null}
        onClose={() => !announcing && setAnnounceTarget(null)}
        title="Announce product update"
        subtitle={announceTarget?.title}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAnnounceTarget(null)} disabled={announcing}>
              Cancel
            </Button>
            <Button
              loading={announcing}
              disabled={!canAnnounce || announcing}
              onClick={() => void confirmAnnounce()}
            >
              {notifyOrgs ? 'Announce & notify' : 'Announce quietly'}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          <div className="space-y-4">
            <Select
              searchable={false}
              label="Organisation notice"
              value={notifyOrgs ? 'notify' : 'quiet'}
              onChange={e => setNotifyOrgs(e.target.value === 'notify')}
              options={[
                {
                  value: 'notify',
                  label: 'Send inbox notice',
                  description: 'Bell and inbox — use when people should know what changed.',
                },
                {
                  value: 'quiet',
                  label: 'Mark announced quietly',
                  description: 'Clear from Ship queue without an inbox notice.',
                },
              ]}
            />
            {notifyOrgs ? (
              <>
                <Select
                  searchable={false}
                  label="Audience"
                  value={audience}
                  onChange={e => setAudience(e.target.value as NotificationAudience)}
                  options={[
                    { value: 'user', label: 'One user' },
                    { value: 'org', label: 'One organisation' },
                    { value: 'active_licences', label: 'All active licences' },
                  ]}
                />
                {needsOrg ? (
                  <Select
                    label="Organisation"
                    value={orgId}
                    onChange={e => {
                      setOrgId(e.target.value)
                      setRecipientId('')
                    }}
                    options={organisations.map(o => ({
                      value: String(o.id),
                      label: o.name,
                      description: o.org_code ?? undefined,
                    }))}
                  />
                ) : (
                  <Select
                    searchable={false}
                    label="Organisation"
                    value="all"
                    disabled
                    options={[{ value: 'all', label: 'All active licences' }]}
                  />
                )}
                {audience === 'user' ? (
                  <Select
                    label="Recipient"
                    value={recipientId}
                    onChange={e => setRecipientId(e.target.value)}
                    options={[
                      { value: '', label: 'Organisation admin' },
                      ...recipients.map(u => ({
                        value: String(u.id),
                        label: u.name || u.email || u.username,
                        description: u.role_name,
                      })),
                    ]}
                  />
                ) : (
                  <Select
                    searchable={false}
                    label="Who in the audience"
                    value={scope}
                    onChange={e => setScope(e.target.value as NotificationRecipientScope)}
                    options={[
                      { value: 'org_admin', label: 'Organisation admins' },
                      { value: 'all_users', label: 'All licensed users' },
                    ]}
                  />
                )}
                <Checkbox
                  tight
                  label="Exclude organisations with expired AMC"
                  checked={excludeExpiredAmc}
                  onChange={e => setExcludeExpiredAmc(e.target.checked)}
                />
              </>
            ) : (
              <p className="text-sm text-muted leading-relaxed">
                Removes this row from Ship queue. Organisations won’t get a bell or inbox notice.
              </p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">This update</p>
            <p className="mt-3 text-sm font-medium text-heading">{announceTarget?.title}</p>
            {announceTarget?.detail ? (
              <p className="mt-2 text-sm text-muted leading-relaxed whitespace-pre-wrap">
                {announceTarget.detail}
              </p>
            ) : null}
            <p className="mt-3 text-xs text-muted">
              Announcing does not list Features — only a product-update notice.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
})
