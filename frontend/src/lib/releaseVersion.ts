export type ReleaseCategory = 'bug_fix' | 'improvement' | 'cosmetic' | 'new_feature' | 'product_update'

export const RELEASE_CATEGORIES: { value: ReleaseCategory; label: string }[] = [
  { value: 'bug_fix', label: 'Bug fix' },
  { value: 'improvement', label: 'Improvement' },
  { value: 'cosmetic', label: 'Cosmetic' },
  { value: 'new_feature', label: 'New feature' },
  { value: 'product_update', label: 'Product update' },
]

export const GATED_RELEASE_CATEGORIES: ReleaseCategory[] = ['new_feature', 'product_update']

export function isGatedReleaseCategory(category: string): boolean {
  return GATED_RELEASE_CATEGORIES.includes(category as ReleaseCategory)
}

export function releaseCategoryLabel(category: string): string {
  return RELEASE_CATEGORIES.find(c => c.value === category)?.label ?? category
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
