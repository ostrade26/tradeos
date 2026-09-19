import type { LucideIcon } from 'lucide-react'
import { Keyboard, Palette, User, Users } from 'lucide-react'

export type PlatformSettingsSectionId = 'appearance' | 'account' | 'team' | 'shortcuts'

export interface PlatformSettingsSectionDef {
  id: PlatformSettingsSectionId
  segment: string
  label: string
  description: string
  icon: LucideIcon
}

export const PLATFORM_SETTINGS_SECTIONS: readonly PlatformSettingsSectionDef[] = [
  {
    id: 'appearance',
    segment: 'appearance',
    label: 'Appearance',
    description: 'Theme, table density, and accent',
    icon: Palette,
  },
  {
    id: 'account',
    segment: 'account',
    label: 'Account',
    description: 'Profile and password',
    icon: User,
  },
  {
    id: 'team',
    segment: 'team',
    label: 'Tradeal team',
    description: 'Platform console admins',
    icon: Users,
  },
  {
    id: 'shortcuts',
    segment: 'shortcuts',
    label: 'Shortcuts',
    description: 'Keyboard shortcuts',
    icon: Keyboard,
  },
] as const

export function isPlatformSettingsSectionId(
  value: string | undefined,
): value is PlatformSettingsSectionId {
  return PLATFORM_SETTINGS_SECTIONS.some(s => s.id === value)
}

export function platformSettingsPath(segment = '') {
  const base = '/platform-admin/settings'
  if (!segment) return base
  return `${base}/${segment}`
}

export function isPlatformSettingsAreaPath(pathname: string) {
  return pathname === '/platform-admin/settings' || pathname.startsWith('/platform-admin/settings/')
}
