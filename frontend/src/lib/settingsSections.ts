import type { LucideIcon } from 'lucide-react'
import { CreditCard, Database, Keyboard, Palette, User } from 'lucide-react'
import { appPath } from './appShellMode'

export type SettingsSectionId = 'appearance' | 'account' | 'data' | 'plan' | 'team' | 'shortcuts'

export interface SettingsSectionDef {
  id: SettingsSectionId
  segment: string
  label: string
  description: string
  icon: LucideIcon
  /** Hide unless org can view subscription/request seats or manage team */
  planTeamSection?: boolean
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
    label: 'Plan & team',
    description: 'Subscription, seats, and licensed users',
    icon: CreditCard,
    planTeamSection: true,
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
  return value === 'team' || SETTINGS_SECTIONS.some(s => s.id === value)
}

export function settingsPath(segment: string) {
  return appPath(`/settings/${segment}`)
}

export function isSettingsAreaPath(pathname: string) {
  const base = appPath('/settings')
  return pathname === base || pathname.startsWith(`${base}/`)
}
