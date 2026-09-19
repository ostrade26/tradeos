import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useOutletContext, useParams } from 'react-router-dom'
import { ChevronRight, KeyRound, Moon, Palette, PanelLeft, Rows3, Sun, UserPlus } from 'lucide-react'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb } from '../components/ui/Tabs'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Input } from '../components/ui/Input'
import { useTheme } from '../hooks/useTheme'
import { useTableDensity } from '../hooks/useTableDensity'
import { useAuth } from '../hooks/useAuth'
import { useUser } from '../hooks/useUser'
import { useToast } from '../hooks/useToast'
import type { TableDensity } from '../lib/tableDensity'
import type { SidebarStyle } from '../lib/sidebarStyle'
import { cn } from '../lib/utils'
import { ChangePasswordModal } from '../components/settings/ChangePasswordForm'
import { AccentColourPicker } from '../components/settings/AccentColourPicker'
import { BrandingUpsellNote } from '../components/settings/BrandingUpsellNote'
import { PlatformCreateAdminModal } from '../components/platform/PlatformCreateAdminModal'
import {
  PlatformSignInCredentialsModal,
  type SignInCredentialsPayload,
} from '../components/platform/PlatformSignInCredentialsModal'
import { platformApi, type PlatformAdminAccount } from '../api/platformApi'
import { ApiError } from '../api/client'
import { loginUsernameError } from '../lib/username'
import {
  PLATFORM_SETTINGS_SECTIONS,
  isPlatformSettingsSectionId,
  platformSettingsPath,
  type PlatformSettingsSectionId,
} from '../lib/platformSettingsSections'

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

type PlatformSettingsOutlet = {
  openPassword: () => void
}

function usePlatformSettingsOutlet() {
  return useOutletContext<PlatformSettingsOutlet>()
}

export function PlatformAdminSettingsLayout() {
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)

  return (
    <>
      <Outlet context={{ openPassword: () => setPasswordModalOpen(true) } satisfies PlatformSettingsOutlet} />
      <ChangePasswordModal open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} />
    </>
  )
}

export function PlatformAdminSettingsHubPage() {
  return (
    <div className="animate-fade-in max-w-3xl">
      <PageHeader
        title="Settings"
        subtitle="Choose a category"
        breadcrumb={
          <Breadcrumb
            items={[
              { label: 'Platform Admin', href: '/platform-admin/organisations' },
              { label: 'Settings' },
            ]}
          />
        }
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {PLATFORM_SETTINGS_SECTIONS.map(section => {
          const Icon = section.icon
          return (
            <Link key={section.id} to={platformSettingsPath(section.segment)} className="group block">
              <Card hover className="h-full flex items-start gap-3 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700/50">
                  <Icon className="h-5 w-5 text-muted group-hover:text-accent transition-colors" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-heading">{section.label}</p>
                  <p className="text-xs text-muted mt-0.5">{section.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted shrink-0 mt-0.5 group-hover:text-accent transition-colors" />
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function AppearanceSection() {
  const {
    theme,
    setTheme,
    accentId,
    accentPreset,
    accentPresets,
    customHex,
    setAccentId,
    setCustomAccent,
    sidebarStyle,
    setSidebarStyle,
    brandingEnabled,
  } = useTheme()
  const { density, setDensity } = useTableDensity()

  return (
    <Card padding={false}>
      <div className="px-6 pt-6">
        <CardHeader title="Appearance" subtitle="How Tradeal looks on your device" />
      </div>
      <div className="px-6 pb-2">
        <SettingRow
          icon={theme === 'dark' ? Moon : Sun}
          title="Theme"
          description="Light or dark mode"
          action={
            <div className="flex rounded-md border border-gray-200 dark:border-gray-600 p-0.5">
              {(['light', 'dark'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded capitalize cursor-pointer transition-colors',
                    theme === t ? 'bg-accent text-white' : 'text-gray-500 hover:text-heading',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          }
        />
        <SettingRow
          icon={Rows3}
          title="Table density"
          description="Compact or relaxed row spacing"
          action={
            <div className="flex rounded-md border border-gray-200 dark:border-gray-600 p-0.5">
              {(['compact', 'relaxed'] as const satisfies TableDensity[]).map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDensity(option)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded capitalize cursor-pointer transition-colors',
                    density === option ? 'bg-accent text-white' : 'text-gray-500 hover:text-heading',
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          }
        />
        <SettingRow
          icon={PanelLeft}
          title="Side navigation"
          description={
            brandingEnabled
              ? 'Theme colour or default surface'
              : 'Unlock Theme colour or Default surface'
          }
          action={
            brandingEnabled ? (
              <div className="flex rounded-md border border-gray-200 dark:border-gray-600 p-0.5">
                {([
                  { id: 'theme' as const, label: 'Theme' },
                  { id: 'default' as const, label: 'Default' },
                ] satisfies { id: SidebarStyle; label: string }[]).map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSidebarStyle(option.id)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded cursor-pointer transition-colors',
                      sidebarStyle === option.id ? 'bg-accent text-white' : 'text-gray-500 hover:text-heading',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : (
              <BrandingUpsellNote />
            )
          }
        />
        <SettingRow
          icon={Palette}
          title="Primary colour"
          description={
            brandingEnabled
              ? `Accent · ${accentPreset.label}`
              : 'Choose accents that match your brand'
          }
          action={
            brandingEnabled ? (
              <AccentColourPicker
                accentId={accentId}
                accentPresets={accentPresets}
                customHex={customHex}
                onSelectPreset={setAccentId}
                onSelectCustom={setCustomAccent}
              />
            ) : (
              <BrandingUpsellNote />
            )
          }
        />
      </div>
    </Card>
  )
}

function AccountSection() {
  const { openPassword } = usePlatformSettingsOutlet()
  const { roleLabel, session } = useAuth()
  const { profile, initials, updateProfile } = useUser()
  const toast = useToast()
  const [form, setForm] = useState(profile)

  useEffect(() => {
    setForm(profile)
  }, [profile])

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }))
  }

  const usernameError = loginUsernameError(form.username, { allowCurrent: session?.username })
  const dirty = JSON.stringify(form) !== JSON.stringify(profile)

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Profile" subtitle="Shown in the platform header and audit logs" />
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent text-xl font-semibold text-white">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-heading truncate">{form.name || session?.name || '—'}</p>
            <p className="text-sm text-muted">{roleLabel}</p>
            {form.username ? (
              <p className="text-xs text-muted mt-0.5 truncate">{form.username}</p>
            ) : null}
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
          <Button variant="outline" onClick={() => setForm(profile)} disabled={!dirty}>
            Reset
          </Button>
        </div>
      </Card>

      <Card padding={false}>
        <div className="px-6 pt-6">
          <CardHeader title="Sign-in" subtitle="Password for this Tradeal Admin account" />
        </div>
        <div className="px-6 pb-2">
          <SettingRow
            icon={KeyRound}
            title="Password"
            description="Change the password you use to sign in"
            action={
              <Button variant="outline" size="sm" onClick={openPassword}>
                Change password
              </Button>
            }
          />
        </div>
      </Card>
    </div>
  )
}

function TeamSection() {
  const { session } = useAuth()
  const toast = useToast()
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
    <>
      <Card padding={false}>
        <div className="px-6 pt-6">
          <CardHeader
            title="Tradeal team"
            subtitle={
              admins.length < 2
                ? 'You are the only Tradeal Admin. Add a second person so one of you can reset the other if a password is forgotten.'
                : 'Platform console operators. One of you can reset the other’s sign-in if they are locked out.'
            }
            action={
              <Button size="sm" className="shrink-0" onClick={() => setCreateOpen(true)}>
                <UserPlus className="h-4 w-4" aria-hidden />
                Add admin
              </Button>
            }
          />
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
                  <p className="text-xs text-muted font-mono mt-0.5 truncate">{admin.username}</p>
                </div>
                {isYou ? (
                  <p className="text-xs text-muted shrink-0">Change password in Account</p>
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
    </>
  )
}

function ShortcutsSection() {
  return (
    <Card padding={false}>
      <div className="px-6 pt-6">
        <CardHeader title="Keyboard shortcuts" subtitle="From anywhere in the app" />
      </div>
      <div className="px-6 pb-4 divide-y divide-gray-200 dark:divide-gray-700">
        {[
          { keys: '⌘ K', action: 'Open command palette' },
          { keys: 'Esc', action: 'Close drawer or dialog' },
        ].map(item => (
          <div key={item.keys} className="flex items-center justify-between gap-4 py-3">
            <span className="text-sm text-heading">{item.action}</span>
            <kbd className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-mono text-muted dark:border-gray-600 dark:bg-gray-800">
              {item.keys}
            </kbd>
          </div>
        ))}
      </div>
    </Card>
  )
}

export function PlatformAdminSettingsSectionPage() {
  const { section: sectionParam } = useParams<{ section: string }>()

  if (!sectionParam || !isPlatformSettingsSectionId(sectionParam)) {
    return <Navigate to={platformSettingsPath()} replace />
  }

  const section = sectionParam as PlatformSettingsSectionId
  const meta = PLATFORM_SETTINGS_SECTIONS.find(s => s.id === section)

  return (
    <div className="animate-fade-in max-w-2xl">
      <PageHeader
        title={meta?.label ?? 'Settings'}
        subtitle={meta?.description}
        breadcrumb={
          <Breadcrumb
            items={[
              { label: 'Platform Admin', href: '/platform-admin/organisations' },
              { label: 'Settings', href: platformSettingsPath() },
              { label: meta?.label ?? section },
            ]}
          />
        }
      />
      {section === 'appearance' ? <AppearanceSection /> : null}
      {section === 'account' ? <AccountSection /> : null}
      {section === 'team' ? <TeamSection /> : null}
      {section === 'shortcuts' ? <ShortcutsSection /> : null}
    </div>
  )
}

/** @deprecated use PlatformAdminSettingsHubPage — kept for any stray imports */
export function PlatformAdminSettingsPage() {
  return <Navigate to={platformSettingsPath()} replace />
}
