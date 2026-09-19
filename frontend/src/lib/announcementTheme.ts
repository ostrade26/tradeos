import type { LucideIcon } from 'lucide-react'
import { Megaphone } from 'lucide-react'
import { platformFeatureIcon, platformReleaseIcon } from './platformProductIcons'
import type { NotificationKind } from '../api/platformApi'

export type AnnouncementVariant = 'release' | 'feature' | 'update'

export type AnnouncementTheme = {
  label: string
  icon: LucideIcon
  gradient: string
  badge: string
  ring: string
  primaryButton: string
}

/** Primary brand styling — aligned with service-issue 404 / app accent. */
const accentRelease: AnnouncementTheme = {
  label: 'New version',
  icon: platformReleaseIcon,
  gradient: 'from-accent via-[#4a6fe0] to-accent-hover dark:from-accent dark:via-accent-hover dark:to-[#2f4eb0]',
  badge: 'bg-white/20 text-white backdrop-blur-sm',
  ring: 'ring-accent/35',
  primaryButton: 'bg-accent hover:bg-accent-hover text-white',
}

export const ANNOUNCEMENT_THEMES: Record<AnnouncementVariant, AnnouncementTheme> = {
  release: accentRelease,
  update: {
    ...accentRelease,
    label: 'Product update',
    icon: Megaphone,
  },
  feature: {
    ...accentRelease,
    label: 'New feature',
    icon: platformFeatureIcon,
  },
}

export function announcementVariantFromKind(kind: NotificationKind | string): AnnouncementVariant {
  if (kind === 'feature_launch') return 'feature'
  if (
    kind === 'product_update' ||
    kind === 'maintenance' ||
    kind === 'announcement' ||
    kind === 'backup_reminder'
  ) {
    return 'update'
  }
  return 'release'
}
