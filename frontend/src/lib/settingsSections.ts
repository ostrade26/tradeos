import type { LucideIcon } from 'lucide-react'
import { CreditCard, Database, Keyboard, Palette, User, Users } from 'lucide-react'

export type SettingsSectionId = 'appearance' | 'account' | 'data' | 'plan' | 'team' | 'shortcuts'

export interface SettingsSectionDef {
  id: SettingsSectionId
  segment: string
  label: string
  description: string
  icon: LucideIcon
  /** Hide unless org can view subscription or request seats */
  planSection?: boolean
  /** Hide unless org can view team members */
  teamSection?: boolean
}

export const SETTINGS_SECTIONS: readonly SettingsSectionDef[] = [
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
    description: 'Profile, alerts, and password',
    icon: User,
  },
  {
    id: 'data',
    segment: 'data',
    label: 'Data',
    description: 'Export, import, and demo tools',
    icon: Database,
  },
  {
    id: 'plan',
    segment: 'plan',
    label: 'Plan & seats',
    description: 'Subscription and seat requests',
    icon: CreditCard,
    planSection: true,
  },
  {
    id: 'team',
    segment: 'team',
    label: 'Team',
    description: 'Licensed users, roles, and access',
    icon: Users,
    teamSection: true,
  },
  {
    id: 'shortcuts',
    segment: 'shortcuts',
    label: 'Shortcuts',
    description: 'Keyboard shortcuts',
    icon: Keyboard,
  },
] as const

export function isSettingsSectionId(value: string | undefined): value is SettingsSectionId {
  return SETTINGS_SECTIONS.some(s => s.id === value)
}

export function settingsPath(segment: string) {
  return `/settings/${segment}`
}

export function isSettingsAreaPath(pathname: string) {
  return pathname === '/settings' || pathname.startsWith('/settings/')
}
