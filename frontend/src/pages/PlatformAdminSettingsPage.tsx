import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Moon, Sun, User, ChevronRight, Palette, Rows3, KeyRound } from 'lucide-react'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb } from '../components/ui/Tabs'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { useTheme } from '../hooks/useTheme'
import { useTableDensity } from '../hooks/useTableDensity'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import type { TableDensity } from '../lib/tableDensity'
import { cn } from '../lib/utils'
import { CUSTOM_ACCENT_ID } from '../lib/accentColor'
import { ChangePasswordModal } from '../components/settings/ChangePasswordForm'
import { PlatformCreateAdminModal } from '../components/platform/PlatformCreateAdminModal'
import {
  PlatformSignInCredentialsModal,
  type SignInCredentialsPayload,
} from '../components/platform/PlatformSignInCredentialsModal'
import { platformApi, type PlatformAdminAccount } from '../api/platformApi'
import { ApiError } from '../api/client'

function SettingRow({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Moon
  title: string
  description: string
  action: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-gray-200 dark:border-gray-700 last:border-0">
      <div className="flex gap-3 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700/50">
          <Icon className="h-4 w-4 text-muted" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-heading">{title}</p>
          <p className="text-xs text-muted mt-0.5">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )
}

export function PlatformAdminSettingsPage() {
  const { theme, setTheme, accentId, accentPreset, accentPresets, customHex, setAccentId, setCustomAccent } =
    useTheme()
  const { density, setDensity } = useTableDensity()
  const { session } = useAuth()
  const toast = useToast()
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [admins, setAdmins] = useState<PlatformAdminAccount[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)
  const [credentials, setCredentials] = useState<SignInCredentialsPayload | null>(null)

  const loadAdmins = async () => {
    try {
      const res = await platformApi.listAdmins()
      setAdmins(res.admins)
    } catch {
      setAdmins([])
    }
  }

  useEffect(() => {
    void loadAdmins()
  }, [])

  const toCredentials = (admin: PlatformAdminAccount): SignInCredentialsPayload => ({
    name: admin.name,
    login_id: admin.login_id || admin.username,
    username: admin.username,
    email: admin.email,
    temporary_password: admin.temporary_password,
  })

  const addAdmin = async (body: { name: string; username: string }) => {
    setCreating(true)
    try {
      const res = await platformApi.createAdmin(body)
      setCreateOpen(false)
      setCredentials(toCredentials(res.admin))
      toast.success('Tradeal Admin added')
      await loadAdmins()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not add Tradeal Admin')
    } finally {
      setCreating(false)
    }
  }

  const resetAdmin = async (username: string) => {
    const userId = credentials?.recipient_user_id
    if (!userId) return
    setResetBusy(true)
    try {
      const res = await platformApi.resetAdminSignIn(userId, { username })
      setCredentials({
        name: res.name,
        login_id: res.login_id || res.username,
        username: res.username,
        email: res.email,
        temporary_password: res.temporary_password,
        recipient_user_id: userId,
      })
      toast.success('Sign-in reset')
      await loadAdmins()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not reset sign-in')
    } finally {
      setResetBusy(false)
    }
  }

  return (
    <div className="animate-fade-in max-w-2xl">
      <PageHeader
        title="Settings"
        subtitle="Appearance and account preferences"
        breadcrumb={
          <Breadcrumb
            items={[
              { label: 'Platform Admin', href: '/platform-admin/organisations' },
              { label: 'Settings' },
            ]}
          />
        }
      />

      <div className="space-y-6">
        <Card padding={false}>
          <div className="px-6 pt-6">
            <CardHeader title="Appearance" subtitle="Theme, table density, and accent colour" />
          </div>
          <div className="px-6 pb-4">
            <SettingRow
              icon={theme === 'dark' ? Moon : Sun}
              title="Theme"
              description="Light or dark interface"
              action={
                <div className="flex rounded-md border border-gray-200 dark:border-gray-600 p-0.5">
                  {(['light', 'dark'] as const).map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setTheme(option)}
                      className={cn(
                        'rounded px-3 py-1.5 text-xs font-medium capitalize cursor-pointer attex-focus',
                        theme === option
                          ? 'bg-accent text-white'
                          : 'text-gray-500 hover:text-heading',
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              }
            />
            <SettingRow
              icon={Rows3}
              title="Table density"
              description="Row spacing in registers and lists"
              action={
                <div className="flex rounded-md border border-gray-200 dark:border-gray-600 p-0.5">
                  {(['comfortable', 'compact'] as TableDensity[]).map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setDensity(option)}
                      className={cn(
                        'rounded px-3 py-1.5 text-xs font-medium capitalize cursor-pointer attex-focus',
                        density === option
                          ? 'bg-accent text-white'
                          : 'text-gray-500 hover:text-heading',
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              }
            />
            <SettingRow
              icon={Palette}
              title="Primary colour"
              description={`Accent for buttons, links, and highlights · ${accentPreset.label}`}
              action={
                <div className="flex flex-wrap justify-end gap-2.5 max-w-[14rem]">
                  {accentPresets.map(preset => {
                    const selected = accentId === preset.id
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        title={preset.label}
                        aria-label={preset.label}
                        aria-pressed={selected}
                        onClick={() => setAccentId(preset.id)}
                        className={cn(
                          'h-8 w-8 rounded-full cursor-pointer transition-all attex-focus border-2 border-transparent',
                          selected
                            ? 'ring-2 ring-offset-2 ring-heading dark:ring-offset-[var(--color-card)] scale-105'
                            : 'hover:scale-105 opacity-90 hover:opacity-100',
                        )}
                        style={{ backgroundColor: preset.accent }}
                      />
                    )
                  })}
                  <label
                    title="Custom colour"
                    className={cn(
                      'relative h-8 w-8 rounded-full cursor-pointer overflow-hidden attex-focus border-2 border-transparent',
                      accentId === CUSTOM_ACCENT_ID
                        ? 'ring-2 ring-offset-2 ring-heading dark:ring-offset-[var(--color-card)] scale-105'
                        : 'opacity-90 hover:opacity-100 hover:scale-105',
                    )}
                  >
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-full"
                      style={{
                        background:
                          accentId === CUSTOM_ACCENT_ID
                            ? customHex
                            : 'conic-gradient(from 180deg, #ff3b30, #ff9500, #34c759, #007aff, #af52de, #ff2d55, #ff3b30)',
                      }}
                    />
                    <input
                      type="color"
                      value={customHex}
                      aria-label="Pick a custom primary colour"
                      onChange={e => setCustomAccent(e.target.value)}
                      onClick={() => {
                        if (accentId !== CUSTOM_ACCENT_ID) setCustomAccent(customHex)
                      }}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                </div>
              }
            />
          </div>
        </Card>

        <Card padding={false}>
          <div className="px-6 pt-6">
            <CardHeader title="Account" subtitle="Profile and sign-in" />
          </div>
          <div className="px-6 pb-2">
            <Link
              to="/platform-admin/profile"
              className="flex items-center justify-between gap-4 py-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/40 -mx-2 px-2 rounded-lg transition-colors"
            >
              <div className="flex gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700/50">
                  <User className="h-4 w-4 text-muted" />
                </div>
                <div>
                  <p className="text-sm font-medium text-heading">Edit profile</p>
                  <p className="text-xs text-muted mt-0.5">Name, location, email, and phone</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted shrink-0" />
            </Link>
            <SettingRow
              icon={KeyRound}
              title="Password"
              description="Change the password you use to sign in"
              action={
                <Button variant="outline" size="sm" onClick={() => setPasswordModalOpen(true)}>
                  Change password
                </Button>
              }
            />
          </div>
        </Card>

        <Card padding={false}>
          <div className="px-6 pt-6 flex items-start justify-between gap-4">
            <CardHeader
              title="Tradeal team"
              subtitle={
                admins.length < 2
                  ? 'You are the only Tradeal Admin. Add a second person so one of you can reset the other if a password is forgotten.'
                  : 'Platform console operators. One of you can reset the other’s sign-in if they are locked out.'
              }
            />
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Add admin
            </Button>
          </div>
          <div className="px-6 pb-2">
            {admins.map(admin => {
              const isYou = session?.userId === admin.id
              return (
                <div
                  key={admin.id}
                  className="flex items-center justify-between gap-4 py-4 border-b border-gray-200 dark:border-gray-700 last:border-0"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-medium text-heading truncate">{admin.name || admin.username}</p>
                      {isYou ? <Badge variant="info">You</Badge> : null}
                    </div>
                    <p className="text-xs text-muted font-mono mt-0.5 truncate">@{admin.username}</p>
                  </div>
                  {isYou ? (
                    <p className="text-xs text-muted shrink-0">Change password above</p>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCredentials({
                          name: admin.name,
                          login_id: admin.login_id || admin.username,
                          username: admin.username,
                          email: admin.email,
                          recipient_user_id: admin.id,
                        })
                      }
                    >
                      Reset sign-in
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <ChangePasswordModal open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} />
      <PlatformCreateAdminModal
        open={createOpen}
        onClose={() => !creating && setCreateOpen(false)}
        loading={creating}
        onSubmit={body => void addAdmin(body)}
      />
      <PlatformSignInCredentialsModal
        open={credentials != null}
        onClose={() => !resetBusy && setCredentials(null)}
        payload={credentials}
        title="Tradeal Admin sign-in"
        generatingPassword={resetBusy}
        onGeneratePassword={
          credentials && !credentials.temporary_password
            ? username => void resetAdmin(username)
            : undefined
        }
      />
    </div>
  )
}
