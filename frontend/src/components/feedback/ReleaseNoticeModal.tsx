import { Button } from '../ui/Button'
import { AnnouncementModalShell } from './AnnouncementModalShell'
import { updateItemsFromNotice } from '../layout/SystemUpdateModal'
import { announcementVariantFromKind } from '../../lib/announcementTheme'
import { notificationKindLabel } from '../../lib/notificationDisplay'
import { releaseCategoryLabel } from '../../lib/releaseVersion'
import type { UserNotification } from '../../api/platformApi'

function payloadText(payload: Record<string, string>, key: string): string {
  return String(payload[key] ?? '').trim()
}

function changelogLines(item: UserNotification): { label: string; title: string; detail: string }[] {
  const raw = payloadText(item.payload, 'changelog')
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { category?: string; title?: string; detail?: string }[]
      if (Array.isArray(parsed) && parsed.length) {
        return parsed
          .map(entry => ({
            label: entry.category ? releaseCategoryLabel(entry.category) : notificationKindLabel(item.kind),
            title: String(entry.title || '').trim(),
            detail: String(entry.detail || '').trim(),
          }))
          .filter(entry => entry.title)
      }
    } catch {
      /* fall through */
    }
  }
  const items = updateItemsFromNotice(item)
  if (items.length) {
    return items.map(title => ({ label: notificationKindLabel(item.kind), title, detail: '' }))
  }
  return [{ label: notificationKindLabel(item.kind), title: item.title, detail: item.body }]
}

export function ReleaseNoticeModal({
  open,
  notice,
  onClose,
}: {
  open: boolean
  notice: UserNotification | null
  onClose: () => void
}) {
  if (!notice) return null

  const variant = announcementVariantFromKind(notice.kind)
  const version = payloadText(notice.payload, 'version')
  const lines = changelogLines(notice)

  return (
    <AnnouncementModalShell
      open={open}
      onClose={onClose}
      variant={variant}
      title={notice.title}
      subtitle={version ? `Version ${version} · What's included` : "What's included in this release"}
      version={version || undefined}
      footer={
        <Button type="button" className="min-h-11 px-8 text-base font-semibold" onClick={onClose}>
          Got it
        </Button>
      }
    >
      <ul className="space-y-4 text-left">
        {lines.map(line => (
          <li key={`${line.label}-${line.title}`} className="rounded-lg border border-gray-200/80 px-4 py-3 dark:border-gray-700">
            <p className="text-xs font-bold uppercase tracking-wide text-accent">{line.label}</p>
            <p className="mt-1 text-sm font-semibold text-heading">{line.title}</p>
            {line.detail ? <p className="mt-1 text-sm leading-relaxed text-muted">{line.detail}</p> : null}
          </li>
        ))}
      </ul>
    </AnnouncementModalShell>
  )
}
