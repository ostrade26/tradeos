import { useEffect, useState } from 'react'
import type { OrganisationMember } from '../../api/organisationApi'
import { organisationApi } from '../../api/organisationApi'
import { ApiError } from '../../api/client'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Drawer'
import { PasswordInput } from '../ui/PasswordInput'
import { useToast } from '../../hooks/useToast'

export function OrgTeamPasswordModal({
  member,
  changeMode,
  onClose,
  onSaved,
}: {
  member: OrganisationMember | null
  changeMode: boolean
  onClose: () => void
  onSaved: (userId: number) => void
}) {
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const open = member != null

  useEffect(() => {
    if (open) setPassword('')
  }, [open, member?.id])

  const submit = async () => {
    if (!member) return
    setSubmitting(true)
    try {
      await organisationApi.setMemberPassword(member.id, password)
      toast.success('Password updated — user will need to sign in again')
      onSaved(member.id)
      onClose()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not set password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={changeMode ? 'Change password' : 'Set password'}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button loading={submitting} disabled={password.length < 4} onClick={() => void submit()}>
            {changeMode ? 'Update password' : 'Save password'}
          </Button>
        </div>
      }
    >
      {member && (
        <>
          <p className="text-sm text-muted mb-4">
            {changeMode ? 'Choose a new password for' : 'Set a password for'}{' '}
            <span className="font-medium text-heading">{member.email || member.username}</span>. Active sessions
            will be signed out.
          </p>
          <PasswordInput
            label="New password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </>
      )}
    </Modal>
  )
}
