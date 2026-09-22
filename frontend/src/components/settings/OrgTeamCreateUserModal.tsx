import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, UserPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { OrgRoleSlug, OrganisationDetailResponse } from '../../api/platformApi'
import { organisationApi } from '../../api/organisationApi'
import { ApiError } from '../../api/client'
import { getTeamAddUserSeatWarning, type TeamAddUserSeatWarning } from '../../lib/teamSeatAvailability'
import { ORG_ROLE_OPTIONS } from '../../lib/platformLabels'
import { settingsPath } from '../../lib/settingsSections'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Drawer'
import { PasswordInput } from '../ui/PasswordInput'
import { Select } from '../ui/Select'
import { useToast } from '../../hooks/useToast'
import { cn } from '../../lib/utils'

const ORG_TEAM_ROLE_OPTIONS = ORG_ROLE_OPTIONS.filter(o => o.value !== 'platform_admin' as never)

function AddUserFormFields({
  email,
  setEmail,
  name,
  setName,
  roleSlug,
  setRoleSlug,
  password,
  setPassword,
}: {
  email: string
  setEmail: (v: string) => void
  name: string
  setName: (v: string) => void
  roleSlug: OrgRoleSlug
  setRoleSlug: (v: OrgRoleSlug) => void
  password: string
  setPassword: (v: string) => void
}) {
  return (
    <>
      <p className="text-sm text-muted mb-4">
        Email is used to sign in. We email login credentials to this address. Leave the password blank to auto-generate one.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Email (sign-in)"
          type="email"
          value={email}
          autoComplete="off"
          onChange={e => setEmail(e.target.value)}
          className="sm:col-span-2"
        />
        <Input
          label="Display name"
          value={name}
          onChange={e => setName(e.target.value)}
          className="sm:col-span-2"
        />
        <Select
          searchable={false}
          label="Role"
          options={ORG_TEAM_ROLE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
          value={roleSlug}
          onChange={e => setRoleSlug(e.target.value as OrgRoleSlug)}
          className="sm:col-span-2"
        />
        <PasswordInput
          label="Password (optional)"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="new-password"
          className="sm:col-span-2"
          placeholder="Leave blank to auto-generate"
        />
      </div>
    </>
  )
}

function AttachedSeatWarningStrip({
  warning,
  canRequestSeats,
  planHref,
  onClose,
  loading,
}: {
  warning: TeamAddUserSeatWarning | null
  canRequestSeats: boolean
  planHref: string
  onClose: () => void
  loading: boolean
}) {
  return (
    <div
      role={loading ? undefined : 'alert'}
      className={cn(
        'border-t px-6 py-5 rounded-b-xl',
        'border-amber-200/90 bg-amber-50/95 text-amber-950',
        'dark:border-amber-900/55 dark:bg-amber-950/45 dark:text-amber-100',
      )}
    >
      {loading ? (
        <p className="text-sm text-muted dark:text-amber-200/80">Checking licensed seat availability…</p>
      ) : warning ? (
        <div className="flex gap-3 text-sm">
          <AlertTriangle
            className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden
          />
          <div className="min-w-0 space-y-2">
            <p className="font-semibold text-heading dark:text-amber-50">{warning.title}</p>
            <p className="leading-relaxed text-amber-950/85 dark:text-amber-100/90">{warning.detail}</p>
            {canRequestSeats ? (
              <Link
                to={planHref}
                onClick={onClose}
                className="inline-block text-sm font-medium text-accent hover:underline"
              >
                Go to Plan &amp; team
              </Link>
            ) : (
              <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
                Contact your organisation admin to request additional seats.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function OrgTeamCreateUserModal({
  open,
  onClose,
  onCreated,
  billing,
  billingLoading,
  canRequestSeats,
}: {
  open: boolean
  onClose: () => void
  onCreated: (userId: number) => void | Promise<void>
  billing: OrganisationDetailResponse | null
  billingLoading: boolean
  canRequestSeats: boolean
}) {
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [roleSlug, setRoleSlug] = useState<OrgRoleSlug>('operator')

  const seatWarning = useMemo(
    () => getTeamAddUserSeatWarning(billing, billingLoading),
    [billing, billingLoading],
  )

  const showAttachedStrip = billingLoading || seatWarning != null

  useEffect(() => {
    if (open) {
      setEmail('')
      setName('')
      setPassword('')
      setRoleSlug('operator')
    }
  }, [open])

  const submit = async () => {
    if (seatWarning?.blocksCreate) return
    const trimmedPassword = password.trim()
    if (trimmedPassword && trimmedPassword.length < 4) {
      toast.error('Password must be at least 4 characters, or leave blank to auto-generate')
      return
    }
    setSubmitting(true)
    try {
      const result = await organisationApi.createMember({
        email: email.trim(),
        name: name.trim(),
        password: trimmedPassword || undefined,
        role_slug: roleSlug,
      })
      await onCreated(result.id)
      if (result.welcome_email_sent) {
        toast.success(`Welcome email sent to ${email.trim()}`)
      } else {
        toast.error('User created, but the welcome email could not be sent. Share the password manually if you set one.')
      }
      onClose()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create user')
    } finally {
      setSubmitting(false)
    }
  }

  const valid =
    email.trim().includes('@') && !seatWarning?.blocksCreate && !billingLoading
    && (!password.trim() || password.trim().length >= 4)

  const planHref = settingsPath('plan')

  const formFields = (
    <AddUserFormFields
      email={email}
      setEmail={setEmail}
      name={name}
      setName={setName}
      roleSlug={roleSlug}
      setRoleSlug={setRoleSlug}
      password={password}
      setPassword={setPassword}
    />
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add user"
      size="md"
      footer={
        showAttachedStrip ? undefined : (
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button loading={submitting} disabled={!valid} onClick={() => void submit()}>
              <UserPlus className="h-4 w-4" aria-hidden />
              Create user
            </Button>
          </div>
        )
      }
    >
      {showAttachedStrip ? (
        <div className="-mx-6 -my-6 flex flex-col">
          <div className="px-6 py-6">{formFields}</div>
          <AttachedSeatWarningStrip
            warning={seatWarning}
            loading={billingLoading}
            canRequestSeats={canRequestSeats}
            planHref={planHref}
            onClose={onClose}
          />
        </div>
      ) : (
        formFields
      )}
    </Modal>
  )
}
