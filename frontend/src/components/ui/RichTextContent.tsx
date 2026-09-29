import { cn } from '../../lib/utils'
import { isReleaseRichHtml, sanitizeReleaseHtml, unescapeReleaseDetail } from '../../lib/releaseRichText'

const richClass = [
  'text-sm leading-relaxed',
  '[&_p]:my-0 [&_p+p]:mt-1.5 [&_div+div]:mt-1.5',
  '[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5',
  '[&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_li]:my-0.5',
  '[&_b]:font-semibold [&_strong]:font-semibold',
  '[&_[data-color=red]]:text-red-600 dark:[&_[data-color=red]]:text-red-400',
  '[&_[data-color=amber]]:text-amber-700 dark:[&_[data-color=amber]]:text-amber-400',
  '[&_[data-color=green]]:text-emerald-700 dark:[&_[data-color=green]]:text-emerald-400',
  '[&_[data-color=blue]]:text-blue-700 dark:[&_[data-color=blue]]:text-blue-400',
].join(' ')

/** Render a release detail, including bold, lists, and the allowed text colours. */
export function RichTextContent({
  value,
  className,
}: {
  value: string
  className?: string
}) {
  const trimmed = unescapeReleaseDetail(value)
  if (!trimmed) return null
  if (!isReleaseRichHtml(trimmed)) {
    return <p className={cn('whitespace-pre-wrap text-sm leading-relaxed', className)}>{trimmed}</p>
  }
  const safe = sanitizeReleaseHtml(trimmed)
  if (!safe) return null
  return (
    <div
      className={cn('release-rich', richClass, className)}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  )
}
