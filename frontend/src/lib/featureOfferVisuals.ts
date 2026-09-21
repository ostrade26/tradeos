import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  BellRing,
  Bot,
  Boxes,
  LineChart,
  MessageSquare,
  Palette,
  Plug2,
  ShieldCheck,
  Sparkles,
  Truck,
  Zap,
} from 'lucide-react'

export type AddOnIllustrationKind = 'neutral' | 'ai' | 'analytics' | 'connect' | 'ops' | 'spark'

export type AddOnVisualTheme = {
  gradient: string
  mesh: string
  iconRing: string
  icon: LucideIcon
  illustration: AddOnIllustrationKind
  accentText: string
}

const KEY_RULES: { test: RegExp; theme: AddOnVisualTheme }[] = [
  {
    test: /brand|appearance|colour|color|theme|custom-branding/i,
    theme: {
      gradient: 'from-indigo-600 via-blue-600 to-sky-500 dark:from-indigo-700 dark:via-blue-700 dark:to-sky-700',
      mesh: 'bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.3)_0%,transparent_45%),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.18)_0%,transparent_40%)]',
      iconRing: 'bg-white/25 text-white ring-white/40',
      icon: Palette,
      illustration: 'spark',
      accentText: 'text-white/90',
    },
  },
  {
    test: /chat|bot|assistant|ai|copilot|gpt/i,
    theme: {
      gradient:
        'from-violet-600 via-fuchsia-500 to-indigo-600 dark:from-violet-700 dark:via-fuchsia-600 dark:to-indigo-800',
      mesh: 'bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35)_0%,transparent_45%),radial-gradient(circle_at_85%_15%,rgba(255,255,255,0.2)_0%,transparent_40%)]',
      iconRing: 'bg-white/25 text-white ring-white/40',
      icon: Bot,
      illustration: 'ai',
      accentText: 'text-white/90',
    },
  },
  {
    test: /report|analytic|dashboard|insight|chart/i,
    theme: {
      gradient: 'from-sky-500 via-cyan-500 to-blue-600 dark:from-sky-600 dark:via-cyan-600 dark:to-blue-800',
      mesh: 'bg-[radial-gradient(circle_at_75%_30%,rgba(255,255,255,0.28)_0%,transparent_50%)]',
      iconRing: 'bg-white/25 text-white ring-white/40',
      icon: BarChart3,
      illustration: 'analytics',
      accentText: 'text-white/90',
    },
  },
  {
    test: /integrat|api|webhook|sync|connect/i,
    theme: {
      gradient: 'from-amber-500 via-orange-500 to-rose-500 dark:from-amber-600 dark:via-orange-600 dark:to-rose-700',
      mesh: 'bg-[radial-gradient(circle_at_15%_80%,rgba(255,255,255,0.22)_0%,transparent_45%)]',
      iconRing: 'bg-white/25 text-white ring-white/40',
      icon: Plug2,
      illustration: 'connect',
      accentText: 'text-white/90',
    },
  },
  {
    test: /notif|alert|inbox|bell/i,
    theme: {
      gradient: 'from-pink-500 via-rose-500 to-red-500 dark:from-pink-600 dark:via-rose-600 dark:to-red-700',
      mesh: 'bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.3)_0%,transparent_55%)]',
      iconRing: 'bg-white/25 text-white ring-white/40',
      icon: BellRing,
      illustration: 'spark',
      accentText: 'text-white/90',
    },
  },
  {
    test: /lift|inventory|stock|warehouse|truck|logistic/i,
    theme: {
      gradient: 'from-emerald-500 via-teal-500 to-green-600 dark:from-emerald-600 dark:via-teal-600 dark:to-green-800',
      mesh: 'bg-[radial-gradient(circle_at_90%_70%,rgba(255,255,255,0.2)_0%,transparent_48%)]',
      iconRing: 'bg-white/25 text-white ring-white/40',
      icon: Truck,
      illustration: 'ops',
      accentText: 'text-white/90',
    },
  },
  {
    test: /security|compliance|audit|shield/i,
    theme: {
      gradient: 'from-slate-600 via-indigo-600 to-violet-700 dark:from-slate-700 dark:via-indigo-800 dark:to-violet-900',
      mesh: 'bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.18)_0%,transparent_50%)]',
      iconRing: 'bg-white/25 text-white ring-white/40',
      icon: ShieldCheck,
      illustration: 'spark',
      accentText: 'text-white/90',
    },
  },
  {
    test: /message|sms|whatsapp|comm/i,
    theme: {
      gradient: 'from-[#25D366] via-emerald-500 to-teal-600 dark:from-emerald-700 dark:via-teal-700 dark:to-green-900',
      mesh: 'bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.25)_0%,transparent_45%)]',
      iconRing: 'bg-white/25 text-white ring-white/40',
      icon: MessageSquare,
      illustration: 'connect',
      accentText: 'text-white/90',
    },
  },
]

const ROTATION: AddOnVisualTheme[] = [
  {
    gradient: 'from-accent via-[#5b7cff] to-indigo-600 dark:from-accent dark:via-indigo-700 dark:to-indigo-950',
    mesh: 'bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.3)_0%,transparent_50%)]',
    iconRing: 'bg-white/25 text-white ring-white/40',
    icon: Sparkles,
    illustration: 'spark',
    accentText: 'text-white/90',
  },
  {
    gradient: 'from-fuchsia-500 via-purple-500 to-violet-600 dark:from-fuchsia-700 dark:via-purple-800 dark:to-violet-950',
    mesh: 'bg-[radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.22)_0%,transparent_48%)]',
    iconRing: 'bg-white/25 text-white ring-white/40',
    icon: Zap,
    illustration: 'ai',
    accentText: 'text-white/90',
  },
  {
    gradient: 'from-cyan-500 via-sky-500 to-blue-600 dark:from-cyan-700 dark:via-sky-800 dark:to-blue-950',
    mesh: 'bg-[radial-gradient(circle_at_10%_90%,rgba(255,255,255,0.2)_0%,transparent_42%)]',
    iconRing: 'bg-white/25 text-white ring-white/40',
    icon: LineChart,
    illustration: 'analytics',
    accentText: 'text-white/90',
  },
  {
    gradient: 'from-orange-500 via-amber-500 to-yellow-500 dark:from-orange-700 dark:via-amber-700 dark:to-yellow-800',
    mesh: 'bg-[radial-gradient(circle_at_60%_10%,rgba(255,255,255,0.28)_0%,transparent_50%)]',
    iconRing: 'bg-white/25 text-white ring-white/40',
    icon: Boxes,
    illustration: 'ops',
    accentText: 'text-white/90',
  },
]

function hashKey(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i += 1) {
    h = (Math.imul(31, h) + key.charCodeAt(i)) >>> 0
  }
  return h
}

export function visualThemeForFeatureKey(featureKey: string, title = ''): AddOnVisualTheme {
  const probe = `${featureKey} ${title}`
  for (const rule of KEY_RULES) {
    if (rule.test.test(probe)) return rule.theme
  }
  return ROTATION[hashKey(featureKey) % ROTATION.length]
}

export type AddOnCardSurface = {
  /** Solid left image panel */
  imagePanel: string
  /** Right content panel */
  contentPanel: string
  /** Text/price ink on content panel */
  ink: 'dark' | 'light'
  title: string
  body: string
  price: string
  categoryPill: string
  divider: string
  iconFallback: string
  ring: string
  ringHover: string
}

const CARD_SURFACES: Record<AddOnIllustrationKind, AddOnCardSurface> = {
  neutral: {
    imagePanel: 'bg-slate-500 dark:bg-slate-600',
    contentPanel: 'bg-slate-100 dark:bg-slate-800/90',
    ink: 'dark',
    title: 'text-slate-900 dark:text-slate-50',
    body: 'text-slate-700 dark:text-slate-300',
    price: 'text-slate-900 dark:text-slate-50',
    categoryPill: 'bg-slate-500 text-white dark:bg-slate-400 dark:text-slate-950',
    divider: 'border-slate-300/80 dark:border-slate-600',
    iconFallback: 'text-white/90',
    ring: 'ring-slate-200/95 dark:ring-slate-500/30',
    ringHover: 'hover:ring-slate-300 dark:hover:ring-slate-400/40',
  },
  ai: {
    imagePanel: 'bg-sky-500 dark:bg-sky-600',
    contentPanel: 'bg-sky-50 dark:bg-sky-950/50',
    ink: 'dark',
    title: 'text-slate-900 dark:text-sky-50',
    body: 'text-slate-700 dark:text-sky-100/80',
    price: 'text-slate-900 dark:text-sky-50',
    categoryPill: 'bg-sky-500 text-white dark:bg-sky-400 dark:text-sky-950',
    divider: 'border-sky-200 dark:border-sky-800',
    iconFallback: 'text-white',
    ring: 'ring-sky-200/90 dark:ring-sky-500/25',
    ringHover: 'hover:ring-sky-300 dark:hover:ring-sky-400/40',
  },
  analytics: {
    imagePanel: 'bg-pink-500 dark:bg-pink-600',
    contentPanel: 'bg-pink-50 dark:bg-pink-950/45',
    ink: 'dark',
    title: 'text-slate-900 dark:text-pink-50',
    body: 'text-slate-700 dark:text-pink-100/80',
    price: 'text-slate-900 dark:text-pink-50',
    categoryPill: 'bg-pink-500 text-white dark:bg-pink-400 dark:text-pink-950',
    divider: 'border-pink-200 dark:border-pink-800',
    iconFallback: 'text-white',
    ring: 'ring-pink-200/90 dark:ring-pink-500/25',
    ringHover: 'hover:ring-pink-300 dark:hover:ring-pink-400/40',
  },
  connect: {
    imagePanel: 'bg-orange-500 dark:bg-orange-600',
    contentPanel: 'bg-[#f7e8d8] dark:bg-orange-950/45',
    ink: 'dark',
    title: 'text-slate-900 dark:text-orange-50',
    body: 'text-slate-800 dark:text-orange-100/85',
    price: 'text-slate-900 dark:text-orange-50',
    categoryPill: 'bg-orange-500 text-white dark:bg-orange-400 dark:text-orange-950',
    divider: 'border-orange-200/90 dark:border-orange-800',
    iconFallback: 'text-white',
    ring: 'ring-orange-200/95 dark:ring-orange-500/25',
    ringHover: 'hover:ring-orange-300 dark:hover:ring-orange-400/40',
  },
  ops: {
    imagePanel: 'bg-emerald-500 dark:bg-emerald-600',
    contentPanel: 'bg-emerald-50 dark:bg-emerald-950/45',
    ink: 'dark',
    title: 'text-slate-900 dark:text-emerald-50',
    body: 'text-slate-700 dark:text-emerald-100/80',
    price: 'text-slate-900 dark:text-emerald-50',
    categoryPill: 'bg-emerald-500 text-white dark:bg-emerald-400 dark:text-emerald-950',
    divider: 'border-emerald-200 dark:border-emerald-800',
    iconFallback: 'text-white',
    ring: 'ring-emerald-200/90 dark:ring-emerald-500/25',
    ringHover: 'hover:ring-emerald-300 dark:hover:ring-emerald-400/40',
  },
  spark: {
    imagePanel: 'bg-cyan-500 dark:bg-cyan-600',
    contentPanel: 'bg-cyan-50 dark:bg-cyan-950/45',
    ink: 'dark',
    title: 'text-slate-900 dark:text-cyan-50',
    body: 'text-slate-700 dark:text-cyan-100/80',
    price: 'text-slate-900 dark:text-cyan-50',
    categoryPill: 'bg-cyan-500 text-white dark:bg-cyan-400 dark:text-cyan-950',
    divider: 'border-cyan-200 dark:border-cyan-800',
    iconFallback: 'text-white',
    ring: 'ring-cyan-200/90 dark:ring-cyan-500/25',
    ringHover: 'hover:ring-cyan-300 dark:hover:ring-cyan-400/40',
  },
}

export function addOnCardSurface(kind: AddOnIllustrationKind): AddOnCardSurface {
  return CARD_SURFACES[kind]
}

/** Stable category + surface for catalog cards (avoids regex mis-matches on preview keys). */
export function addOnIllustrationForOffer(featureKey: string, title: string): AddOnIllustrationKind {
  const key = featureKey.toLowerCase()
  if (key.includes('analytics') || key.includes('report') || key.includes('dashboard')) return 'analytics'
  if (key.includes('whatsapp') || key.includes('message') || key.includes('integrat') || key.includes('api')) {
    return 'connect'
  }
  if (key.includes('lift') || key.includes('inventory') || key.includes('truck') || key.includes('scheduler')) {
    return 'ops'
  }
  if (key.includes('assistant') || key.includes('chat') || key.includes('bot') || key.includes('ai')) return 'ai'
  return visualThemeForFeatureKey(featureKey, title).illustration
}

export function iconForAddOnTone(kind: AddOnIllustrationKind): LucideIcon {
  switch (kind) {
    case 'ai':
      return Bot
    case 'analytics':
      return BarChart3
    case 'connect':
      return Plug2
    case 'ops':
      return Truck
    case 'spark':
      return Sparkles
    default:
      return Boxes
  }
}

/** Prefer a saved card tone; otherwise derive from key/title. */
export function resolveAddOnCardTone(
  featureKey: string,
  title: string,
  cardTone?: string | null,
): AddOnIllustrationKind {
  const tone = (cardTone || '').trim().toLowerCase()
  if (
    tone === 'neutral' ||
    tone === 'ai' ||
    tone === 'analytics' ||
    tone === 'connect' ||
    tone === 'ops' ||
    tone === 'spark'
  ) {
    return tone
  }
  return addOnIllustrationForOffer(featureKey, title)
}

export function addOnCategoryLabel(kind: AddOnIllustrationKind): string {
  const map: Record<AddOnIllustrationKind, string> = {
    neutral: 'Feature',
    ai: 'AI · Chatbot',
    analytics: 'Analytics',
    connect: 'Integrations',
    ops: 'Operations',
    spark: 'Productivity',
  }
  return map[kind]
}

/** Accent swatches / shuffle colours for feature cards. */
export const ADDON_CARD_TONE_OPTIONS: Array<{
  id: AddOnIllustrationKind
  label: string
  swatch: string
}> = [
  { id: 'neutral', label: 'Grey', swatch: 'bg-slate-400' },
  { id: 'ai', label: 'Blue', swatch: 'bg-sky-500' },
  { id: 'ops', label: 'Green', swatch: 'bg-emerald-500' },
  { id: 'connect', label: 'Orange', swatch: 'bg-orange-500' },
  { id: 'analytics', label: 'Pink', swatch: 'bg-pink-500' },
  { id: 'spark', label: 'Cyan', swatch: 'bg-cyan-500' },
]

export function pricingChipLabel(pricingType: string, priceCents: number): string {
  if (pricingType === 'free') return 'Free'
  if (pricingType === 'contact') return 'Talk to us'
  if (priceCents > 0) return `₹${(priceCents / 100).toLocaleString('en-IN')}`
  return 'Premium'
}
