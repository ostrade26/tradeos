import { useEffect, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb } from '../components/ui/Tabs'
import { Card, CardHeader } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { useAuth } from '../hooks/useAuth'
import { useUser } from '../hooks/useUser'
import { useToast } from '../hooks/useToast'
import { ChangePasswordModal } from '../components/settings/ChangePasswordForm'
import { loginUsernameError } from '../lib/username'

export function PlatformAdminProfilePage() {
  const { roleLabel, session } = useAuth()
  const { profile, initials, updateProfile } = useUser()
  const toast = useToast()
  const [form, setForm] = useState(profile)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)

  useEffect(() => {
    setForm(profile)
  }, [profile])

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }))
  }

  const usernameError = loginUsernameError(form.username, { allowCurrent: session?.username })

  const handleSave = async () => {
    if (usernameError) {
      toast.error(usernameError)
      return
    }
    try {
      await updateProfile({ ...form, username: form.username.trim().toLowerCase() })
      toast.success('Profile updated')
    } catch {
      toast.error('Could not save profile')
    }
  }

  const handleReset = () => {
    setForm(profile)
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(profile)

  return (
    <div className="animate-fade-in max-w-2xl">
      <PageHeader
        title="Profile"
        subtitle="Your platform admin account"
        breadcrumb={
          <Breadcrumb
            items={[
              { label: 'Platform Admin', href: '/platform-admin/organisations' },
              { label: 'Profile' },
            ]}
          />
        }
      />

      <Card className="mb-6">
        <CardHeader title="Account" subtitle="Shown in the platform header and audit logs" />
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent text-xl font-semibold text-white">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-heading truncate">{form.name || session?.name || '—'}</p>
            <p className="text-sm text-muted">{roleLabel}</p>
            {form.username && (
              <p className="text-xs text-muted mt-0.5 truncate">@{form.username}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Display name" value={form.name} onChange={set('name')} placeholder="" />
          <Input
            label="Username"
            value={form.username}
            onChange={set('username')}
            error={usernameError ?? undefined}
            autoComplete="off"
          />
          <Input label="Location" value={form.location} onChange={set('location')} placeholder="" />
          <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="" />
          <Input label="Phone" type="tel" value={form.phone} onChange={set('phone')} placeholder="" />
          <div className="sm:col-span-2">
            <Input label="Role" value={roleLabel} readOnly />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <Button onClick={() => void handleSave()} disabled={!dirty || Boolean(usernameError)}>
            Save changes
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={!dirty}>
            Reset
          </Button>
        </div>
      </Card>

      <Card className="mt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700/50">
              <KeyRound className="h-4 w-4 text-muted" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-medium text-heading">Password</p>
              <p className="text-xs text-muted mt-0.5">Change the password you use to sign in</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => setPasswordModalOpen(true)}>
            Change password
          </Button>
        </div>
      </Card>

      <ChangePasswordModal open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} />
    </div>
  )
}
