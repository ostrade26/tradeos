import { useEffect, useState } from 'react'
import { Modal } from '../ui/Drawer'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import type { OrgRoleSlug, PlatformUser } from '../../api/platformApi'
import { ORG_ROLE_OPTIONS } from '../../lib/platformLabels'

interface Props {
  open: boolean
  onClose: () => void
  user: PlatformUser | null
  loading: boolean
  onSubmit: (patch: { role_slug: OrgRoleSlug; status: 'active' | 'disabled' }) => void
}

export function PlatformEditUserModal({ open, onClose, user, loading, onSubmit }: Props) {
  const [roleSlug, setRoleSlug] = useState<OrgRoleSlug>('operator')
  const [status, setStatus] = useState<'active' | 'disabled'>('active')

  useEffect(() => {
    if (!open || !user) return
    setRoleSlug(user.role_slug as OrgRoleSlug)
    setStatus(user.status === 'disabled' ? 'disabled' : 'active')
  }, [open, user])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit user access"
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            loading={loading}
            onClick={() => onSubmit({ role_slug: roleSlug, status })}
          >
            Save changes
          </Button>
        </div>
      }
    >
      {user && (
        <div className="space-y-4 pt-1">
          <p className="text-sm text-muted">
            <span className="font-medium text-heading">{user.name}</span>
            <span className="text-muted"> · @{user.username}</span>
          </p>
          <Select
            label="Role"
            searchable={false}
            value={roleSlug}
            onChange={e => setRoleSlug(e.target.value as OrgRoleSlug)}
            options={ORG_ROLE_OPTIONS.map(r => ({ value: r.value, label: r.label }))}
          />
          <Select
            label="Status"
            searchable={false}
            value={status}
            onChange={e => setStatus(e.target.value as 'active' | 'disabled')}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'disabled', label: 'Disabled' },
            ]}
          />
        </div>
      )}
    </Modal>
  )
}
