import type { LucideIcon } from 'lucide-react'
import { DatabaseBackup, LayoutGrid, Megaphone, Rocket, Wrench } from 'lucide-react'
import type { NotificationKind } from '../api/platformApi'
import type { ModalIllustrationKey } from '../assets/illustrations/modalPanaIllustrations'

/** Five special-state announcement surfaces (mockup redesign). */
export type AnnouncementVariant =
  | 'productUpdate'
  | 'maintenance'
  | 'backup'
  | 'marketplace'
  | 'platformRelease'
  /** @deprecated aliases — map to the five above */
  | 'release'
  | 'feature'
  | 'update'

export type AnnouncementTheme = {
  label: string
  icon: LucideIcon
  /**
   * Header fill: radial from top-center (white) → solid theme color.
   * Matches Figma: origin at 50% 0%, vertical radius ~75% of header height.
   */
  headerGradient: string
  illustration: ModalIllustrationKey
  ring: string
  primaryButton: string
}

const THEMES: Record<
  'productUpdate' | 'maintenance' | 'backup' | 'marketplace' | 'platformRelease',
  AnnouncementTheme
> = {
  productUpdate: {
    label: 'Product update',
    icon: Rocket,
    headerGradient:
      'bg-[radial-gradient(ellipse_120%_75%_at_50%_0%,#ffffff_0%,rgba(62,96,213,0.2)_100%)] dark:bg-[radial-gradient(ellipse_120%_75%_at_50%_0%,rgba(255,255,255,0.06)_0%,rgba(62,96,213,0.2)_100%)]',
    illustration: 'productUpdate',
    ring: 'ring-accent/20',
    primaryButton: 'bg-accent hover:bg-accent-hover text-white',
  },
  maintenance: {
    label: 'Maintenance',
    icon: Wrench,
    headerGradient:
      'bg-[radial-gradient(ellipse_120%_75%_at_50%_0%,#ffffff_0%,rgba(232,93,4,0.2)_100%)] dark:bg-[radial-gradient(ellipse_120%_75%_at_50%_0%,rgba(255,255,255,0.06)_0%,rgba(232,93,4,0.2)_100%)]',
    illustration: 'maintenance',
    ring: 'ring-orange-300/40',
    primaryButton: 'bg-accent hover:bg-accent-hover text-white',
  },
  backup: {
    label: 'Backup',
    icon: DatabaseBackup,
    headerGradient:
      'bg-[radial-gradient(ellipse_120%_75%_at_50%_0%,#ffffff_0%,rgba(245,158,11,0.2)_100%)] dark:bg-[radial-gradient(ellipse_120%_75%_at_50%_0%,rgba(255,255,255,0.06)_0%,rgba(245,158,11,0.2)_100%)]',
    illustration: 'backup',
    ring: 'ring-amber-300/40',
    primaryButton: 'bg-accent hover:bg-accent-hover text-white',
  },
  marketplace: {
    label: 'Features',
    icon: LayoutGrid,
    headerGradient:
      'bg-[radial-gradient(ellipse_120%_75%_at_50%_0%,#ffffff_0%,rgba(14,165,233,0.2)_100%)] dark:bg-[radial-gradient(ellipse_120%_75%_at_50%_0%,rgba(255,255,255,0.06)_0%,rgba(14,165,233,0.2)_100%)]',
    illustration: 'marketplace',
    ring: 'ring-sky-300/40',
    primaryButton: 'bg-accent hover:bg-accent-hover text-white',
  },
  platformRelease: {
    label: 'Platform release',
    icon: Megaphone,
    headerGradient:
      'bg-[radial-gradient(ellipse_120%_75%_at_50%_0%,#ffffff_0%,rgba(132,204,22,0.2)_100%)] dark:bg-[radial-gradient(ellipse_120%_75%_at_50%_0%,rgba(255,255,255,0.06)_0%,rgba(132,204,22,0.2)_100%)]',
    illustration: 'platformRelease',
    ring: 'ring-lime-400/35',
    primaryButton: 'bg-accent hover:bg-accent-hover text-white',
  },
}

export function resolveAnnouncementVariant(variant: AnnouncementVariant): keyof typeof THEMES {
  if (variant === 'release' || variant === 'update') return 'productUpdate'
  if (variant === 'feature') return 'marketplace'
  return variant
}

export const ANNOUNCEMENT_THEMES: Record<AnnouncementVariant, AnnouncementTheme> = {
  productUpdate: THEMES.productUpdate,
  maintenance: THEMES.maintenance,
  backup: THEMES.backup,
  marketplace: THEMES.marketplace,
  platformRelease: THEMES.platformRelease,
  release: THEMES.productUpdate,
  feature: THEMES.marketplace,
  update: THEMES.productUpdate,
}

export function announcementVariantFromKind(kind: NotificationKind | string): AnnouncementVariant {
  if (kind === 'backup_reminder') return 'backup'
  if (kind === 'maintenance') return 'maintenance'
  if (kind === 'feature_launch' || kind === 'announcement') return 'marketplace'
  if (kind === 'release_notes' || kind === 'product_update') return 'productUpdate'
  return 'productUpdate'
}
