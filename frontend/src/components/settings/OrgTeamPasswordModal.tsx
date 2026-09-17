import { useEffect, useState } from 'react'
import type { OrganisationMember } from '../../api/organisationApi'
import { organisationApi } from '../../api/organisationApi'
import { ApiError } from '../../api/client'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Drawer'
import { PasswordInput } from '../ui/PasswordInput'
import { useToast } from '../../hooks/useToast'
import { loginUsernameError } from '../../lib/username'

export function OrgTeamPasswordModal({
  member,
  changeMode,
  onClose,
  onSaved,
}: {
  member: OrganisationMember | null
  changeMode: boolean
  onClose: () => void
  onSaved: (userId: number, username?: string) => void
}) {
  const toast = useToast()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const open = member != null
  const currentUsername = (member?.username || member?.email || '').trim()
  const usernameError = loginUsernameError(username, { allowCurrent: currentUsername })
  const usernameChanged = username.trim().toLowerCase() !== currentUsername.toLowerCase()
  const canSubmit = !usernameError && (usernameChanged || password.length >= 4)

  useEffect(() => {
    if (open && member) {
      setPassword('')
      setUsername(member.username || member.email || '')
    }
  }, [open, member?.id])

  const submit = async () => {
    if (!member || !canSubmit) return
    setSubmitting(true)
    try {
      const result = await organisationApi.setMemberPassword(member.id, {
        ...(usernameChanged ? { username: username.trim().toLowerCase() } : {}),
        ...(password.length >= 4 ? { password } : {}),
      })
      toast.success(
        password.length >= 4
          ? 'Sign-in updated — user will need to sign in again'
          : 'Username updated',
      )
      onSaved(member.id, result.username || username.trim().toLowerCase())
      onClose()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update sign-in')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={changeMode ? 'Change sign-in' : 'Set sign-in'}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button loading={submitting} disabled={!canSubmit} onClick={() => void submit()}>
            {changeMode ? 'Save' : 'Save sign-in'}
          </Button>
        </div>
      }
    >
      {member && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {changeMode ? 'Update the username and/or password for' : 'Set a username and password for'}{' '}
            <span className="font-medium text-heading">{member.name || currentUsername}</span>.
            {password.length >= 4 ? ' Active sessions will be signed out.' : ''}
          </p>
          <Input
            label="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            error={usernameError ?? undefined}
            autoComplete="off"
          />
          <PasswordInput
            label={changeMode ? 'New password (optional)' : 'Password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
      )}
    </Modal>
  )
}
