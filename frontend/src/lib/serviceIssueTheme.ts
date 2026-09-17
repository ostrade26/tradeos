import type { LucideIcon } from 'lucide-react'
import { CloudOff, Database, HelpCircle, ServerCrash, WifiOff, ZapOff } from 'lucide-react'
import type { ServiceIssueKind } from './serviceIssue'

export type ServiceIssueTheme = {
  /** Full viewport blank page (404). */
  fullPage: boolean
  label: string
  icon: LucideIcon
  gradient: string
  badge: string
  ring: string
  title: string
  primaryButton: string
}

export const SERVICE_ISSUE_THEMES: Record<ServiceIssueKind, ServiceIssueTheme> = {
  no_internet: {
    fullPage: false,
    label: 'Offline',
    icon: WifiOff,
    gradient: 'from-slate-600 via-slate-500 to-slate-700 dark:from-slate-700 dark:via-slate-600 dark:to-slate-800',
    badge: 'bg-slate-500/15 text-slate-800 dark:text-slate-100',
    ring: 'ring-slate-400/30',
    title: 'text-slate-900 dark:text-white',
    primaryButton: 'bg-slate-700 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white',
  },
  connectivity: {
    fullPage: false,
    label: 'Connection',
    icon: CloudOff,
    gradient: 'from-amber-500 via-orange-500 to-amber-600 dark:from-amber-600 dark:via-orange-600 dark:to-amber-700',
    badge: 'bg-amber-500/20 text-amber-950 dark:text-amber-50',
    ring: 'ring-amber-400/40',
    title: 'text-amber-950 dark:text-amber-50',
    primaryButton: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  database: {
    fullPage: false,
    label: 'Data',
    icon: Database,
    gradient: 'from-rose-600 via-rose-500 to-red-600 dark:from-rose-700 dark:via-rose-600 dark:to-red-700',
    badge: 'bg-rose-500/20 text-rose-950 dark:text-rose-50',
    ring: 'ring-rose-400/35',
    title: 'text-rose-950 dark:text-rose-50',
    primaryButton: 'bg-rose-600 hover:bg-rose-700 text-white',
  },
  not_found: {
    fullPage: true,
    label: '404',
    icon: HelpCircle,
    gradient: 'from-accent via-[#4a6fe0] to-accent-hover dark:from-accent dark:via-accent-hover dark:to-[#2f4eb0]',
    badge: 'bg-accent-muted text-accent dark:text-accent',
    ring: 'ring-accent/35',
    title: 'text-heading',
    primaryButton: 'bg-accent hover:bg-accent-hover text-white',
  },
  server: {
    fullPage: false,
    label: 'Server',
    icon: ServerCrash,
    gradient: 'from-orange-600 via-red-500 to-orange-700 dark:from-orange-700 dark:via-red-600 dark:to-orange-800',
    badge: 'bg-orange-500/20 text-orange-950 dark:text-orange-50',
    ring: 'ring-orange-400/35',
    title: 'text-orange-950 dark:text-orange-50',
    primaryButton: 'bg-orange-600 hover:bg-orange-700 text-white',
  },
  generic: {
    fullPage: false,
    label: 'Error',
    icon: ZapOff,
    gradient: 'from-zinc-600 via-zinc-500 to-zinc-700 dark:from-zinc-700 dark:via-zinc-600 dark:to-zinc-800',
    badge: 'bg-zinc-500/20 text-zinc-900 dark:text-zinc-100',
    ring: 'ring-zinc-400/30',
    title: 'text-zinc-900 dark:text-white',
    primaryButton: 'bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900',
  },
}

export function serviceIssueUsesFullPage(kind: ServiceIssueKind): boolean {
  return SERVICE_ISSUE_THEMES[kind].fullPage
}
