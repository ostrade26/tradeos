import { useEffect, useState } from 'react'
import { Modal } from '../ui/Drawer'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { loginUsernameError } from '../../lib/username'

export function PlatformCreateAdminModal({
  open,
  onClose,
  loading,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  loading: boolean
  onSubmit: (body: { name: string; username: string }) => void
}) {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')

  useEffect(() => {
    if (!open) {
      setName('')
      setUsername('')
    }
  }, [open])

  const usernameError = username.trim() ? loginUsernameError(username) : null
  const valid = name.trim().length >= 2 && !loginUsernameError(username)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Tradeal Admin"
      subtitle="They can sign in to the platform console and reset another admin if one of you is locked out."
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            loading={loading}
            disabled={!valid || loading}
            onClick={() => onSubmit({ name: name.trim(), username: username.trim().toLowerCase() })}
          >
            Add
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          autoComplete="name"
        />
        <Input
          label="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoComplete="off"
          error={usernameError ?? undefined}
        />
      </div>
    </Modal>
  )
}
