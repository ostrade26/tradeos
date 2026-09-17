import { useEffect, useMemo, useState } from 'react'
import { Bell } from 'lucide-react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Checkbox } from '../ui/Checkbox'
import {
  type NotificationAudience,
  type NotificationKind,
  type NotificationRecipientScope,
  type PlatformOrganisation,
  type PlatformUser,
} from '../../api/platformApi'
const KIND_OPTIONS: { value: NotificationKind; label: string; title: string; body: string }[] = [
  {
    value: 'payment_reminder',
    label: 'Payment reminder',
    title: 'Payment reminder',
    body: 'A licence or AMC payment is due. Please complete payment so we can keep your account in good standing.',
  },
  {
    value: 'product_update',
    label: 'Product update',
    title: 'Tradeal update',
    body: 'We have released product updates for your organisation.',
  },
  {
    value: 'feature_launch',
    label: 'New feature',
    title: 'New on Tradeal',
    body: 'A new feature is available in your Tradeal workspace.',
  },
]

export function PlatformNotifyModal({
  open,
  onClose,
  organisations,
  organisationId,
  users,
  defaultRecipientUserId,
  defaultAudience = 'user',
  loading,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  organisations: PlatformOrganisation[]
  organisationId?: number | null
  users: PlatformUser[]
  defaultRecipientUserId?: number | null
  defaultAudience?: NotificationAudience
  loading: boolean
  onSubmit: (payload: {
    audience: NotificationAudience
    organisation_id: number | null
    recipient_user_id: number | null
    recipient_scope: NotificationRecipientScope
    exclude_expired_amc: boolean
    kind: NotificationKind
    title: string
    body: string
    feature_key?: string
    items?: string
  }) => void
}) {
  const [audience, setAudience] = useState<NotificationAudience>(defaultAudience)
  const [orgId, setOrgId] = useState('')
  const [recipientId, setRecipientId] = useState('')
  const [scope, setScope] = useState<NotificationRecipientScope>('org_admin')
  const [excludeExpiredAmc, setExcludeExpiredAmc] = useState(true)
  const [kind, setKind] = useState<NotificationKind>('feature_launch')
  const [title, setTitle] = useState(KIND_OPTIONS[2].title)
  const [body, setBody] = useState(KIND_OPTIONS[2].body)
  const [featureKey, setFeatureKey] = useState('')
  const [items, setItems] = useState('')

  useEffect(() => {
    if (!open) return
    setAudience(defaultAudience)
    setOrgId(organisationId ? String(organisationId) : '')
    setRecipientId(defaultRecipientUserId ? String(defaultRecipientUserId) : '')
    setScope('org_admin')
    const nextKind = defaultAudience === 'active_licences' ? 'feature_launch' : 'payment_reminder'
    const preset = KIND_OPTIONS.find(k => k.value === nextKind) ?? KIND_OPTIONS[0]
    setKind(preset.value)
    setTitle(preset.title)
    setBody(preset.body)
    setFeatureKey(preset.value === 'payment_reminder' ? '' : preset.value.replace('_', '-'))
    setItems('')
    setExcludeExpiredAmc(preset.value !== 'payment_reminder')
  }, [open, organisationId, defaultRecipientUserId, defaultAudience])

  const recipients = useMemo(
    () => users.filter(u => u.organisation_id === Number(orgId) && u.status === 'active'),
    [users, orgId],
  )

  const needsOrg = audience !== 'active_licences'
  const isUpdateKind = kind === 'product_update' || kind === 'feature_launch'
  const canSend = Boolean(title.trim() && (!needsOrg || orgId))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send notice"
      subtitle="Choose who should receive this in Tradeal"
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            loading={loading}
            disabled={!canSend}
            onClick={() =>
              onSubmit({
                audience,
                organisation_id: orgId ? Number(orgId) : null,
                recipient_user_id: audience === 'user' && recipientId ? Number(recipientId) : null,
                recipient_scope: audience === 'user' ? 'org_admin' : scope,
                exclude_expired_amc: excludeExpiredAmc,
                kind,
                title: title.trim(),
                body: body.trim(),
                feature_key: isUpdateKind ? featureKey.trim() : undefined,
                items: isUpdateKind ? items.trim() : undefined,
              })
            }
          >
            <Bell className="h-4 w-4" aria-hidden />
            Send
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
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
        <Select
          searchable={false}
          label="Type"
          value={kind}
          onChange={e => {
            const next = e.target.value as NotificationKind
            setKind(next)
            const preset = KIND_OPTIONS.find(k => k.value === next)
            if (preset) {
              setTitle(preset.title)
              setBody(preset.body)
            }
            setExcludeExpiredAmc(next !== 'payment_reminder')
            if (next === 'payment_reminder') setFeatureKey('')
            else if (!featureKey) setFeatureKey(next.replace('_', '-'))
          }}
          options={KIND_OPTIONS.map(k => ({ value: k.value, label: k.label }))}
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
        <Input label="Title" value={title} onChange={e => setTitle(e.target.value)} />
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
        {isUpdateKind ? (
          <Input
            label="Update key"
            value={featureKey}
            onChange={e => setFeatureKey(e.target.value)}
            placeholder="inventory-lots-v2"
          />
        ) : (
          <div className="hidden sm:block" />
        )}
        {isUpdateKind ? (
          <label className="flex flex-col gap-2.5 sm:col-span-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">What's included</span>
            <textarea
              value={items}
              onChange={e => setItems(e.target.value)}
              rows={4}
              placeholder={'Faster lift matching\nPurchase register improvements'}
              className="min-h-[6.5rem] w-full resize-y rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-card px-3 py-2 text-sm text-heading"
            />
            <p className="text-xs text-muted">One feature or change per line.</p>
          </label>
        ) : null}
        <label className="flex flex-col gap-2.5 sm:col-span-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Message</span>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={isUpdateKind ? 4 : 5}
            className="min-h-[6.5rem] w-full resize-y rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-card px-3 py-2 text-sm text-heading"
          />
        </label>
        <div className="sm:col-span-2">
          <Checkbox
            tight
            label="Exclude organisations with expired AMC"
            checked={excludeExpiredAmc}
            onChange={e => setExcludeExpiredAmc(e.target.checked)}
          />
        </div>
      </div>
    </Modal>
  )
}
