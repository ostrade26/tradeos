export type ReleaseCategory =
  | 'bug_fix'
  | 'design_improvements'
  /** @deprecated kept for existing releases */
  | 'ui_and_fixes'
  | 'feature_enhancement'
  | 'improvement'
  | 'cosmetic'
  | 'new_feature'
  | 'product_update'

/** Primary categories for new releases (platform admin). */
export const RELEASE_CATEGORIES: { value: ReleaseCategory; label: string; hint: string }[] = [
  {
    value: 'bug_fix',
    label: 'Bug Fix',
    hint: 'Fixes for issues users may have hit. Ships with production — publish from Releases.',
  },
  {
    value: 'design_improvements',
    label: 'Design Improvements',
    hint: 'UI polish and layout improvements. Ships with production — publish from Releases.',
  },
]

/** Legacy gated categories (marketplace features). Kept for existing rows only. */
const LEGACY_GATED: ReleaseCategory[] = ['feature_enhancement', 'new_feature', 'product_update']
const LEGACY_INFORM: ReleaseCategory[] = ['ui_and_fixes', 'improvement', 'cosmetic']

export const GATED_RELEASE_CATEGORIES: ReleaseCategory[] = [...LEGACY_GATED]

export function isGatedReleaseCategory(category: string): boolean {
  return GATED_RELEASE_CATEGORIES.includes(category as ReleaseCategory)
}

export function isInformReleaseCategory(category: string): boolean {
  return (
    category === 'bug_fix' ||
    category === 'design_improvements' ||
    LEGACY_INFORM.includes(category as ReleaseCategory)
  )
}

export function releaseCategoryLabel(category: string): string {
  const primary = RELEASE_CATEGORIES.find(c => c.value === category)
  if (primary) return primary.label
  const legacy: Record<string, string> = {
    ui_and_fixes: 'Bug fix & UI uplift',
    feature_enhancement: 'Marketplace feature',
    improvement: 'Improvement',
    cosmetic: 'Cosmetic',
    new_feature: 'New feature',
    product_update: 'Product update',
  }
  return legacy[category] ?? category.replace(/_/g, ' ')
}

/** Options for the category select — primary list plus current value if legacy. */
export function releaseCategorySelectOptions(current?: string): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = RELEASE_CATEGORIES.map(c => ({
    value: c.value,
    label: c.label,
  }))
  if (current && !options.some(o => o.value === current)) {
    options.push({ value: current, label: releaseCategoryLabel(current) })
  }
  return options
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

/** Ascending semver compare: negative if a < b, positive if a > b. */
export function compareSemver(a: string, b: string): number {
  const left = parseSemver(a)
  const right = parseSemver(b)
  for (let i = 0; i < 3; i += 1) {
    const diff = left[i]! - right[i]!
    if (diff !== 0) return diff
  }
  return 0
}

export function suggestNextVersion(latest: string | null | undefined, categories: string[] = []): string {
  const gated = categories.some(isGatedReleaseCategory)
  if (!latest) return '1.0.0'
  const [major, minor, patch] = parseSemver(latest)
  if (gated) return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}
