import { useEffect, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Modal } from '../ui/Drawer'
import { Input } from '../ui/Input'
import { PasswordInput } from '../ui/PasswordInput'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import type { OrgRoleSlug, PlatformOrganisation } from '../../api/platformApi'
import { accountTypeLabel, ORG_ROLE_OPTIONS } from '../../lib/platformLabels'

export const emptyUserForm = (defaultOrgId = '') => ({
  username: '',
  password: '',
  name: '',
  email: '',
  phone: '',
  organisation_id: defaultOrgId,
  role_slug: 'operator' as OrgRoleSlug,
})

export type UserFormState = ReturnType<typeof emptyUserForm>

interface Props {
  open: boolean
  onClose: () => void
  organisations: PlatformOrganisation[]
  loading: boolean
  defaultOrganisationId?: string
  onSubmit: (form: UserFormState) => void
}

export function PlatformCreateUserModal({
  open,
  onClose,
  organisations,
  loading,
  defaultOrganisationId = '',
  onSubmit,
}: Props) {
  const [form, setForm] = useState(() => emptyUserForm(defaultOrganisationId))

  useEffect(() => {
    if (open) setForm(emptyUserForm(defaultOrganisationId))
  }, [open, defaultOrganisationId])

  const orgOptions = [
    { value: '', label: 'Select organisation…' },
    ...organisations.map(o => ({
      value: String(o.id),
      label: o.name,
      description: accountTypeLabel(o.account_type),
    })),
  ]

  const valid = form.username.trim() && form.password && form.organisation_id

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add user"
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button loading={loading} disabled={!valid} onClick={() => onSubmit(form)}>
            <UserPlus className="h-4 w-4" aria-hidden />
            Create user
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 pt-1">
        <Input
          label="Username (sign-in)"
          value={form.username}
          onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
          autoComplete="off"
        />
        <PasswordInput
          label="Temporary password"
          value={form.password}
          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          autoComplete="new-password"
        />
        <Input
          label="Display name"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
        />
        <Input
          label="Mobile"
          value={form.phone}
          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
        />
        <Select
          label="Organisation"
          options={orgOptions}
          value={form.organisation_id}
          onChange={e => setForm(f => ({ ...f, organisation_id: e.target.value }))}
          searchable
          emptyMessage="Create an organisation first"
        />
        <Select
          label="Role"
          className="sm:col-span-2"
          options={ORG_ROLE_OPTIONS.map(r => ({ value: r.value, label: r.label }))}
          value={form.role_slug}
          onChange={e => setForm(f => ({ ...f, role_slug: e.target.value as OrgRoleSlug }))}
          searchable={false}
        />
      </div>
    </Modal>
  )
}
