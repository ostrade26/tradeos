import { useEffect, useState } from 'react'
import { Modal } from '../ui/Drawer'
import { PasswordInput } from '../ui/PasswordInput'
import { Button } from '../ui/Button'
import { useToast } from '../../hooks/useToast'
import { authApi } from '../../api/tradeApi'
import { ApiError } from '../../api/client'

interface ChangePasswordModalProps {
  open: boolean
  onClose: () => void
}

export function ChangePasswordModal({ open, onClose }: ChangePasswordModalProps) {
  const toast = useToast()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSaving(false)
    }
  }, [open])

  const handleSubmit = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    if (newPassword.length < 4) {
      toast.error('New password must be at least 4 characters')
      return
    }
    setSaving(true)
    try {
      await authApi.changePassword(currentPassword, newPassword)
      toast.success('Password updated')
      onClose()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update password')
    } finally {
      setSaving(false)
    }
  }

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 4 &&
    confirmPassword.length > 0 &&
    !saving

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!saving) onClose()
      }}
      title="Change password"
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button loading={saving} disabled={!canSubmit} onClick={() => void handleSubmit()}>
            Update password
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted mb-4">
        Enter your current password, then choose a new one for signing in to Tradeal.
      </p>
      <div className="space-y-3">
        <PasswordInput
          label="Current password"
          value={currentPassword}
          onChange={e => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
        />
        <PasswordInput
          label="New password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          autoComplete="new-password"
        />
        <PasswordInput
          label="Confirm new password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>
    </Modal>
  )
}
