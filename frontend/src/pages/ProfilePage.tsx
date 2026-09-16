import { useEffect, useState } from 'react'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb } from '../components/ui/Tabs'
import { Card, CardHeader } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { useAuth } from '../hooks/useAuth'
import { useUser } from '../hooks/useUser'
import { useToast } from '../hooks/useToast'

export function ProfilePage() {
  const { roleLabel } = useAuth()
  const { profile, initials, updateProfile } = useUser()
  const toast = useToast()
  const [form, setForm] = useState(profile)

  useEffect(() => {
    setForm(profile)
  }, [profile])

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }))
  }

  const handleSave = async () => {
    try {
      await updateProfile(form)
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
        subtitle="Your account details shown in the header and trade documents"
        breadcrumb={<Breadcrumb items={[{ label: 'Tradeal', href: '/' }, { label: 'Profile' }]} />}
      />

      <Card>
        <CardHeader title="Account" subtitle="Basic information for your trading desk" />
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent text-xl font-semibold text-white">
            {initials}
          </div>
          <div>
            <p className="text-base font-semibold text-heading">{form.name || '—'}</p>
            <p className="text-sm text-muted">{roleLabel || form.role}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Company / trader name" value={form.name} onChange={set('name')} placeholder="" />
          <Input label="Location" value={form.location} onChange={set('location')} placeholder="" />
          <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="" />
          <Input label="Phone" type="tel" value={form.phone} onChange={set('phone')} placeholder="" />
          <div className="sm:col-span-2">
            <Input label="Role" value={roleLabel || form.role} readOnly />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <Button onClick={handleSave} disabled={!dirty}>
            Save changes
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={!dirty}>
            Reset
          </Button>
        </div>
      </Card>
    </div>
  )
}
