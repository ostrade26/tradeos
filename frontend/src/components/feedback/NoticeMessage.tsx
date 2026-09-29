import { noticeChangelog } from '../../lib/notificationDisplay'
import { releaseCategoryLabel } from '../../lib/releaseVersion'
import { RichTextContent } from '../ui/RichTextContent'

/** Release copy from a notice. Formatted changelog detail, otherwise the plain body. */
export function NoticeMessage({
  payload,
  fallback,
}: {
  payload?: { changelog?: unknown } | null
  fallback?: string
}) {
  const lines = noticeChangelog(payload)
  if (!lines.length) {
    const text = (fallback || '').trim()
    if (!text) return null
    return <p className="text-sm text-heading whitespace-pre-wrap leading-relaxed">{text}</p>
  }
  return (
    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
      {lines.map(line => (
        <li key={`${line.category}-${line.title}`} className="py-3 first:pt-0 last:pb-0">
          {line.category ? (
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {releaseCategoryLabel(line.category)}
            </p>
          ) : null}
          <p className="mt-1 text-sm font-semibold text-heading leading-snug">{line.title}</p>
          {line.detail ? (
            <RichTextContent value={line.detail} className="mt-1.5 text-heading/80" />
          ) : null}
        </li>
      ))}
    </ul>
  )
}
