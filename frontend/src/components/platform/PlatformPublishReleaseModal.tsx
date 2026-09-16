import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { Checkbox } from '../ui/Checkbox'
import { releaseCategoryLabel } from '../../lib/releaseVersion'
import type {
  NotificationAudience,
  NotificationRecipientScope,
  PlatformOrganisation,
  PlatformRelease,
  PlatformUser,
} from '../../api/platformApi'

export function PlatformPublishReleaseModal({
  open,
  onClose,
  release,
  organisations,
  users,
  loading,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  release: PlatformRelease | null
  organisations: PlatformOrganisation[]
  users: PlatformUser[]
  loading: boolean
  onSubmit: (payload: {
    audience: NotificationAudience
    organisation_id: number | null
    recipient_user_id: number | null
    recipient_scope: NotificationRecipientScope
    exclude_expired_amc: boolean
  }) => void
}) {
  const [audience, setAudience] = useState<NotificationAudience>('active_licences')
  const [orgId, setOrgId] = useState('')
  const [recipientId, setRecipientId] = useState('')
  const [scope, setScope] = useState<NotificationRecipientScope>('org_admin')
  const [excludeExpiredAmc, setExcludeExpiredAmc] = useState(true)

  useEffect(() => {
    if (!open) return
    setAudience('active_licences')
    setOrgId('')
    setRecipientId('')
    setScope('org_admin')
    setExcludeExpiredAmc(true)
  }, [open])

  const recipients = useMemo(
    () => users.filter(u => u.organisation_id === Number(orgId) && u.status === 'active'),
    [users, orgId],
  )
  const needsOrg = audience !== 'active_licences'
  const canSend = Boolean(release && (!needsOrg || orgId))
  const gated = Boolean(release?.gated)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={release ? `Publish ${release.version}` : 'Publish release'}
      subtitle={
        gated
          ? 'New features stay off until an organisation admin clicks Update.'
          : 'This is an announcement. The changes are already in the live app.'
      }
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            loading={loading}
            disabled={!canSend || loading}
            onClick={() =>
              onSubmit({
                audience,
                organisation_id: orgId ? Number(orgId) : null,
                recipient_user_id: audience === 'user' && recipientId ? Number(recipientId) : null,
                recipient_scope: audience === 'user' ? 'org_admin' : scope,
                exclude_expired_amc: excludeExpiredAmc,
              })
            }
          >
            Publish
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        <div className="space-y-4">
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
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">This version</p>
          <ul className="mt-3 space-y-2">
            {(release?.items ?? []).map((item, index) => (
              <li key={index}>
                <p className="text-sm font-medium text-heading">{item.title}</p>
                <p className="text-xs text-muted mt-0.5">
                  {releaseCategoryLabel(item.category)}
                  {item.gated ? ' · Update required' : ''}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  )
}
