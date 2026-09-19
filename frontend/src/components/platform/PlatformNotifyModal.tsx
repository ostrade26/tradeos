import { useEffect, useMemo, useState } from 'react'
import { Bell, DatabaseBackup } from 'lucide-react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Checkbox } from '../ui/Checkbox'
import { platformBroadcastLabels } from '../../lib/inboxLabels'
import { useToast } from '../../hooks/useToast'
import { ApiError } from '../../api/client'
import {
  platformApi,
  type BackupReminderFrequency,
  type BackupReminderSettings,
  type NotificationAudience,
  type NotificationKind,
  type NotificationRecipientScope,
  type PlatformOrganisation,
  type PlatformUser,
} from '../../api/platformApi'

type NotifyKind = Extract<
  NotificationKind,
  'release_notes' | 'maintenance' | 'payment_reminder' | 'announcement' | 'backup_reminder'
>

const KIND_OPTIONS: {
  value: NotifyKind
  label: string
  hint: string
  title: string
  body: string
}[] = [
  {
    value: 'release_notes',
    label: 'Product update',
    hint: 'Bug fixes, UI changes, and shipped enhancements',
    title: 'Tradeal product update',
    body: 'We have shipped improvements to Tradeal. See what changed below.',
  },
  {
    value: 'maintenance',
    label: 'Maintenance',
    hint: 'One-time downtime or service window notice',
    title: 'Scheduled maintenance',
    body: 'Tradeal will be unavailable for maintenance on [date] from [start time] to [end time]. Please plan accordingly. We will confirm when service is restored.',
  },
  {
    value: 'backup_reminder',
    label: 'Backup reminder',
    hint: 'Set how often to remind org admins and licensed users to export a backup',
    title: 'Backup reminder',
    body: 'Please export a Tradeal backup from Settings → Data and store it safely. During early testing this helps you recover quickly if something goes wrong.',
  },
  {
    value: 'payment_reminder',
    label: 'Payment reminder',
    hint: 'Licence or AMC payment due',
    title: 'Payment reminder',
    body: 'A licence or AMC payment is due. Please complete payment so we can keep your account in good standing.',
  },
  {
    value: 'announcement',
    label: 'General announcement',
    hint: 'Policy, account, or other information',
    title: 'Message from Tradeal',
    body: '',
  },
]

const FREQUENCY_OPTIONS: { value: BackupReminderFrequency; label: string; description: string }[] = [
  { value: 'daily', label: 'Every day', description: 'End of each day' },
  { value: 'twice_weekly', label: 'Twice a week', description: 'Choose weekdays' },
  { value: 'weekly', label: 'Once a week', description: 'Choose one weekday' },
  { value: 'off', label: 'Off', description: 'Pause scheduled reminders' },
]

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Mon' },
  { value: 1, label: 'Tue' },
  { value: 2, label: 'Wed' },
  { value: 3, label: 'Thu' },
  { value: 4, label: 'Fri' },
  { value: 5, label: 'Sat' },
  { value: 6, label: 'Sun' },
]

function formatLastSent(settings: BackupReminderSettings | null): string {
  if (!settings?.last_sent_at) return 'Not sent yet'
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: settings.timezone || 'Asia/Kolkata',
    }).format(new Date(settings.last_sent_at))
  } catch {
    return settings.last_sent_at
  }
}

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
  const toast = useToast()
  const [audience, setAudience] = useState<NotificationAudience>(defaultAudience)
  const [orgId, setOrgId] = useState('')
  const [recipientId, setRecipientId] = useState('')
  const [scope, setScope] = useState<NotificationRecipientScope>('org_admin')
  const [excludeExpiredAmc, setExcludeExpiredAmc] = useState(true)
  const [kind, setKind] = useState<NotifyKind | ''>('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [items, setItems] = useState('')

  const [backupSettings, setBackupSettings] = useState<BackupReminderSettings | null>(null)
  const [backupLoading, setBackupLoading] = useState(false)
  const [backupSaving, setBackupSaving] = useState(false)
  const [backupSending, setBackupSending] = useState(false)
  const [frequency, setFrequency] = useState<BackupReminderFrequency>('daily')
  const [sendHour, setSendHour] = useState('18')
  const [sendMinute, setSendMinute] = useState('0')
  const [weekdays, setWeekdays] = useState<number[]>([1, 4])

  const sendHourNum = Number(sendHour)
  const sendHour12 = String(sendHourNum % 12 === 0 ? 12 : sendHourNum % 12)
  const sendPeriod = sendHourNum < 12 ? 'AM' : 'PM'

  const setSendHour12 = (hour12: string, period: 'AM' | 'PM') => {
    const h = Number(hour12)
    const base = h === 12 ? 0 : h
    setSendHour(String(period === 'AM' ? base : base + 12))
  }

  useEffect(() => {
    if (!open) return
    setAudience(defaultAudience)
    setOrgId(organisationId ? String(organisationId) : '')
    setRecipientId(defaultRecipientUserId ? String(defaultRecipientUserId) : '')
    setScope('org_admin')
    setKind('')
    setTitle('')
    setBody('')
    setItems('')
    setExcludeExpiredAmc(true)
    setBackupSettings(null)
  }, [open, organisationId, defaultRecipientUserId, defaultAudience])

  useEffect(() => {
    if (!open || kind !== 'backup_reminder') return
    let cancelled = false
    setBackupLoading(true)
    void platformApi
      .getBackupReminders()
      .then(res => {
        if (cancelled) return
        const s = res.settings
        setBackupSettings(s)
        setFrequency(!s.enabled ? 'off' : s.frequency)
        setSendHour(String(s.send_hour))
        setSendMinute(String(s.send_minute ?? 0))
        setWeekdays(s.weekdays?.length ? s.weekdays : [1, 4])
        setTitle(s.title)
        setBody(s.body)
        setExcludeExpiredAmc(s.exclude_expired_amc)
        setAudience('active_licences')
        setScope('all_users')
      })
      .catch(err => {
        if (!cancelled) {
          toast.error(err instanceof ApiError ? err.message : 'Could not load backup schedule')
        }
      })
      .finally(() => {
        if (!cancelled) setBackupLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, kind, toast])

  const recipients = useMemo(
    () => users.filter(u => u.organisation_id === Number(orgId) && u.status === 'active'),
    [users, orgId],
  )

  const selectedKind = KIND_OPTIONS.find(k => k.value === kind) ?? null
  const isBackup = kind === 'backup_reminder'
  const needsOrg = !isBackup && audience !== 'active_licences'
  const isProductUpdate = kind === 'release_notes'
  const canSend = Boolean(kind && !isBackup && title.trim() && (!needsOrg || orgId))
  const canSaveBackup = Boolean(isBackup && title.trim() && !backupLoading)

  const saveBackupSchedule = async () => {
    setBackupSaving(true)
    try {
      const res = await platformApi.updateBackupReminders({
        enabled: frequency !== 'off',
        frequency: frequency === 'off' ? 'daily' : frequency,
        send_hour: Number(sendHour),
        send_minute: Number(sendMinute),
        weekdays,
        title: title.trim(),
        body: body.trim(),
        exclude_expired_amc: excludeExpiredAmc,
      })
      setBackupSettings(res.settings)
      toast.success('Backup reminder schedule saved')
      onClose()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save schedule')
    } finally {
      setBackupSaving(false)
    }
  }

  const sendBackupNow = async () => {
    setBackupSending(true)
    try {
      await platformApi.updateBackupReminders({
        enabled: frequency !== 'off',
        frequency: frequency === 'off' ? 'daily' : frequency,
        send_hour: Number(sendHour),
        send_minute: Number(sendMinute),
        weekdays,
        title: title.trim(),
        body: body.trim(),
        exclude_expired_amc: excludeExpiredAmc,
      })
      const res = await platformApi.runBackupReminders()
      toast.success(`Sent to ${res.sent} ${res.sent === 1 ? 'person' : 'people'}`)
      onClose()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not send reminders')
    } finally {
      setBackupSending(false)
    }
  }

  const toggleWeekday = (day: number) => {
    setWeekdays(prev => {
      if (prev.includes(day)) {
        const next = prev.filter(d => d !== day)
        return next.length ? next : prev
      }
      return [...prev, day].sort((a, b) => a - b)
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={platformBroadcastLabels.modalTitle}
      subtitle={platformBroadcastLabels.modalSubtitle}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading || backupSaving || backupSending}>
            Cancel
          </Button>
          {isBackup ? (
            <>
              <Button
                variant="outline"
                loading={backupSending}
                disabled={!canSaveBackup || backupSaving}
                onClick={() => void sendBackupNow()}
              >
                Send now
              </Button>
              <Button
                loading={backupSaving}
                disabled={!canSaveBackup || backupSending}
                onClick={() => void saveBackupSchedule()}
              >
                <DatabaseBackup className="h-4 w-4" aria-hidden />
                Save schedule
              </Button>
            </>
          ) : (
            <Button
              loading={loading}
              disabled={!canSend}
              onClick={() => {
                if (!kind) return
                onSubmit({
                  audience,
                  organisation_id: orgId ? Number(orgId) : null,
                  recipient_user_id: audience === 'user' && recipientId ? Number(recipientId) : null,
                  recipient_scope: audience === 'user' ? 'org_admin' : scope,
                  exclude_expired_amc: excludeExpiredAmc,
                  kind,
                  title: title.trim(),
                  body: body.trim(),
                  items: isProductUpdate ? items.trim() : undefined,
                })
              }}
            >
              <Bell className="h-4 w-4" aria-hidden />
              Send
            </Button>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        <div className="sm:col-span-2">
          <Select
            searchable={false}
            label="Update type"
            value={kind}
            onChange={e => {
              const next = e.target.value as NotifyKind | ''
              setKind(next)
              const preset = KIND_OPTIONS.find(k => k.value === next)
              if (preset) {
                setTitle(preset.title)
                setBody(preset.body)
              } else {
                setTitle('')
                setBody('')
              }
              setItems('')
              setExcludeExpiredAmc(next !== 'payment_reminder')
              if (next === 'backup_reminder') {
                setAudience('active_licences')
                setScope('all_users')
              }
            }}
            options={[
              { value: '', label: 'Select update type…' },
              ...KIND_OPTIONS.map(k => ({
                value: k.value,
                label: k.label,
                description: k.hint,
              })),
            ]}
          />
          {selectedKind ? (
            <p className="text-xs text-muted mt-1.5">{selectedKind.hint}</p>
          ) : null}
        </div>

        {kind && isBackup ? (
          backupLoading ? (
            <p className="sm:col-span-2 text-sm text-muted py-2">Loading schedule…</p>
          ) : (
            <>
              <Select
                searchable={false}
                label="Frequency"
                value={frequency}
                onChange={e => setFrequency(e.target.value as BackupReminderFrequency)}
                options={FREQUENCY_OPTIONS.map(o => ({
                  value: o.value,
                  label: o.label,
                  description: o.description,
                }))}
              />
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                  Send time (India)
                </p>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5.5rem] gap-2">
                  <Select
                    searchable={false}
                    value={sendHour12}
                    onChange={e => setSendHour12(e.target.value, sendPeriod)}
                    options={Array.from({ length: 12 }, (_, i) => {
                      const h = i + 1
                      return { value: String(h), label: String(h) }
                    })}
                    disabled={frequency === 'off'}
                  />
                  <Select
                    searchable={false}
                    value={sendMinute}
                    onChange={e => setSendMinute(e.target.value)}
                    options={Array.from({ length: 60 }, (_, m) => ({
                      value: String(m),
                      label: String(m).padStart(2, '0'),
                    }))}
                    disabled={frequency === 'off'}
                  />
                  <Select
                    searchable={false}
                    value={sendPeriod}
                    onChange={e => setSendHour12(sendHour12, e.target.value as 'AM' | 'PM')}
                    options={[
                      { value: 'AM', label: 'AM' },
                      { value: 'PM', label: 'PM' },
                    ]}
                    disabled={frequency === 'off'}
                  />
                </div>
              </div>
              {(frequency === 'twice_weekly' || frequency === 'weekly') && (
                <div className="sm:col-span-2">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                    {frequency === 'weekly' ? 'Send on' : 'Send on these days'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_OPTIONS.map(d => {
                      const active = weekdays.includes(d.value)
                      return (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => {
                            if (frequency === 'weekly') setWeekdays([d.value])
                            else toggleWeekday(d.value)
                          }}
                          className={`rounded-md px-2.5 py-1.5 text-xs font-medium border transition-colors ${
                            active
                              ? 'border-accent bg-accent/10 text-accent'
                              : 'border-gray-200 dark:border-gray-600 text-muted hover:bg-gray-50 dark:hover:bg-gray-800/50'
                          }`}
                        >
                          {d.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              <div className="sm:col-span-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 px-3 py-2.5">
                <p className="text-sm text-heading">Recipients</p>
                <p className="text-xs text-muted mt-0.5">
                  Organisation admins and all licensed users on active licences
                </p>
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="Title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  disabled={frequency === 'off'}
                />
              </div>
              <label className="flex flex-col gap-2.5 sm:col-span-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Message</span>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={4}
                  disabled={frequency === 'off'}
                  className="min-h-[6.5rem] w-full resize-y rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-card px-3 py-2 text-sm text-heading disabled:opacity-60"
                />
              </label>
              <div className="sm:col-span-2">
                <Checkbox
                  tight
                  label="Exclude organisations with expired AMC"
                  checked={excludeExpiredAmc}
                  onChange={e => setExcludeExpiredAmc(e.target.checked)}
                  disabled={frequency === 'off'}
                />
              </div>
              <p className="sm:col-span-2 text-xs text-muted">
                Last sent: {formatLastSent(backupSettings)}
              </p>
            </>
          )
        ) : null}

        {kind && !isBackup ? (
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
            {isProductUpdate ? (
              <label className="flex flex-col gap-2.5 sm:col-span-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  What changed (one per line, optional)
                </span>
                <textarea
                  value={items}
                  onChange={e => setItems(e.target.value)}
                  rows={4}
                  placeholder={
                    'Fixed PO save on slow networks\nClearer lift timeline labels\nFaster directory search'
                  }
                  className="min-h-[6.5rem] w-full resize-y rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-card px-3 py-2 text-sm text-heading"
                />
              </label>
            ) : null}
            <label className="flex flex-col gap-2.5 sm:col-span-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Message</span>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={isProductUpdate ? 4 : 5}
                placeholder={
                  kind === 'maintenance'
                    ? 'Include date, time window, and any action users should take.'
                    : undefined
                }
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
          </>
        ) : null}
      </div>
    </Modal>
  )
}
