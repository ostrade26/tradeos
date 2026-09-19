import type { UnifiedInboxItem } from './unifiedInbox'

/** Deploy push notices: Features vs Bug fixes & improvements (Releases). */
export function isDeployReviewItem(item: Pick<UnifiedInboxItem, 'kind' | 'notice'>): boolean {
  return item.kind === 'deploy_review' || item.notice?.kind === 'deploy_review'
}

export function deployReviewCta(
  item: Pick<UnifiedInboxItem, 'href' | 'notice'>,
): 'review_features' | 'review_release' {
  const cta = String(item.notice?.payload?.cta || '')
  if (cta === 'review_release') return 'review_release'
  if (cta === 'review_features') return 'review_features'
  const href = String(item.notice?.href || item.href || '')
  return href.includes('/releases') ? 'review_release' : 'review_features'
}

/** Destination for a deploy-review notice — never the inbox. */
export function deployReviewHref(item: Pick<UnifiedInboxItem, 'href' | 'notice'>): string {
  const fromNotice = String(item.notice?.href || '').trim()
  if (fromNotice.startsWith('/platform-admin/')) return fromNotice
  const fromRow = String(item.href || '').trim()
  if (fromRow.startsWith('/platform-admin/')) return fromRow
  return deployReviewCta(item) === 'review_release'
    ? '/platform-admin/releases'
    : '/platform-admin/add-ons'
}

export function deployReviewActionLabel(item: Pick<UnifiedInboxItem, 'href' | 'notice'>): string {
  return deployReviewCta(item) === 'review_release' ? 'Open Releases' : 'Open Features'
}
