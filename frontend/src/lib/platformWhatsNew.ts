import { releaseCategoryLabel, type ReleaseCategory } from './releaseVersion'

export interface PlatformWhatsNewItem {
  category: ReleaseCategory
  title: string
  detail: string
}

/** Bump this when shipping notes the platform admin should review after deploy. */
export const PLATFORM_WHATS_NEW_VERSION = '1.1.0'

export const PLATFORM_WHATS_NEW: {
  version: string
  title: string
  items: PlatformWhatsNewItem[]
} = {
  version: PLATFORM_WHATS_NEW_VERSION,
  title: 'Tradeal 1.1.0 is live',
  items: [
    {
      category: 'new_feature',
      title: 'Releases with versioning',
      detail: 'Create a numbered what’s-new pack, then publish it to one user, one organisation, or all active licences.',
    },
    {
      category: 'new_feature',
      title: 'Targeted notices and Update',
      detail: 'Org users get in-app notices. New features stay off until an organisation admin clicks Update.',
    },
    {
      category: 'product_update',
      title: 'Licence and AMC in Platform Admin',
      detail: 'Perpetual licences, AMC periods, and payments are managed from the console without locking trade data.',
    },
    {
      category: 'cosmetic',
      title: 'Send notice layout',
      detail: 'What’s included and Message sit on their own rows, with tighter checkbox alignment to field captions.',
    },
  ],
}

export function platformWhatsNewCategoryLabel(category: ReleaseCategory): string {
  return releaseCategoryLabel(category)
}
