export type ReleaseCategory =
  | 'ui_and_fixes'
  | 'feature_enhancement'
  | 'bug_fix'
  | 'improvement'
  | 'cosmetic'
  | 'new_feature'
  | 'product_update'

/** Primary categories for new releases (platform admin). */
export const RELEASE_CATEGORIES: { value: ReleaseCategory; label: string; hint: string }[] = [
  {
    value: 'ui_and_fixes',
    label: 'Bug fix & UI uplift',
    hint: 'Notify users what changed. Ships with production — publish from Releases.',
  },
  {
    value: 'feature_enhancement',
    label: 'Marketplace feature',
    hint: 'Creates a draft on Features & Access. Tradeal sets free/paid and publishes to orgs from there.',
  },
]

const LEGACY_INFORM: ReleaseCategory[] = ['bug_fix', 'improvement', 'cosmetic']
const LEGACY_GATED: ReleaseCategory[] = ['new_feature', 'product_update']

export const GATED_RELEASE_CATEGORIES: ReleaseCategory[] = ['feature_enhancement', ...LEGACY_GATED]

export function isGatedReleaseCategory(category: string): boolean {
  return GATED_RELEASE_CATEGORIES.includes(category as ReleaseCategory)
}

export function isInformReleaseCategory(category: string): boolean {
  return category === 'ui_and_fixes' || LEGACY_INFORM.includes(category as ReleaseCategory)
}

export function releaseCategoryLabel(category: string): string {
  const primary = RELEASE_CATEGORIES.find(c => c.value === category)
  if (primary) return primary.label
  const legacy: Record<string, string> = {
    bug_fix: 'Bug fix',
    improvement: 'Improvement',
    cosmetic: 'Cosmetic',
    new_feature: 'New feature',
    product_update: 'Product update',
  }
  return legacy[category] ?? category.replace(/_/g, ' ')
}

export function parseSemver(value: string): [number, number, number] {
  const parts = value.trim().replace(/^v/, '').split('.')
  const nums = [0, 0, 0] as [number, number, number]
  for (let i = 0; i < 3; i += 1) {
    const n = Number(parts[i])
    nums[i] = Number.isFinite(n) ? n : 0
  }
  return nums
}

export function suggestNextVersion(latest: string | null | undefined, categories: string[] = []): string {
  const gated = categories.some(isGatedReleaseCategory)
  if (!latest) return '1.0.0'
  const [major, minor, patch] = parseSemver(latest)
  if (gated) return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}
