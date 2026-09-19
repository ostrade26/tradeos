import { inboxApi } from '../api/inboxApi'
import { INBOX_REFRESH_EVENT } from '../hooks/useMeInbox'

export type DeployReviewCta = 'review_features' | 'review_release'

/**
 * Mark unread deploy-review notices as read when the destination page opens.
 * Features & Access → review_features; Releases → review_release.
 * Must stay wired wherever those destinations mount.
 */
export async function ackUnreadDeployReviews(cta: DeployReviewCta) {
  try {
    const res = await inboxApi.ackDeployReviews(cta)
    if ((res.updated ?? 0) > 0) {
      window.dispatchEvent(new Event(INBOX_REFRESH_EVENT))
    }
  } catch {
    /* best-effort — inbox badge refreshes on next poll */
  }
}
