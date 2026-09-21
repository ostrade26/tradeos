import { Button } from '../ui/Button'
import { AnnouncementModalShell } from './AnnouncementModalShell'
import { announcementVariantFromKind } from '../../lib/announcementTheme'
import { updateItemsFromNotice } from '../layout/SystemUpdateModal'
import { notificationKindLabel } from '../../lib/notificationDisplay'
import { releaseCategoryLabel } from '../../lib/releaseVersion'
import type { UserNotification } from '../../api/platformApi'
import type { AnnouncementVariant } from '../../lib/announcementTheme'

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
  return []
}

function releaseHeading(notice: UserNotification, version: string): string {
  if (version) return `New Tradeal ${version}`
  const stripped = notice.title.replace(/\s*[·•|-]\s*Updates?\s*$/i, '').trim()
  return stripped || notice.title
}

function bodyHeading(variant: AnnouncementVariant, notice: UserNotification): string {
  if (variant === 'backup') return 'Save Your Work'
  if (variant === 'maintenance') {
    return notice.body.split('\n')[0]?.trim() || 'Tradeal may be briefly unavailable'
  }
  if (variant === 'marketplace') return 'Explore Available Features'
  return ''
}

function bodyCopy(variant: AnnouncementVariant, notice: UserNotification): string[] {
  if (variant === 'backup') {
    const lines = notice.body
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
    if (lines.length >= 2) return lines
    return [
      'Make sure all important data, documents, and updates are saved and backed up in advance.',
      notice.body || 'Export a backup from Settings → Data so you can restore if something goes wrong.',
    ]
  }
  if (variant === 'maintenance') {
    const parts = notice.body.split('\n').map(l => l.trim()).filter(Boolean)
    if (parts.length > 1) return parts.slice(1)
    return [
      'The system may be temporarily unavailable during the maintenance window. We apologize for the inconvenience and appreciate your understanding.',
    ]
  }
  if (variant === 'marketplace') {
    return [
      notice.body ||
        'Browse available features, learn what they offer, and enable the ones that best fit your business needs.',
    ]
  }
  return []
}

function subtitleFor(variant: AnnouncementVariant, notice: UserNotification, version: string): string {
  if (variant === 'backup') {
    return payloadText(notice.payload, 'deadline') || notice.title || 'Please secure your important data.'
  }
  if (variant === 'maintenance') {
    return payloadText(notice.payload, 'window') || payloadText(notice.payload, 'when') || ''
  }
  if (variant === 'marketplace') {
    return 'Discover tools and capabilities designed to help you get more out of Tradeal.'
  }
  if (variant === 'productUpdate' && version) {
    return 'Review what is included in this update.'
  }
  return ''
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
  if (!open || !notice) return null

  const variant = announcementVariantFromKind(notice.kind)
  const version = payloadText(notice.payload, 'version')
  const lines = changelogLines(notice)
  const title =
    variant === 'backup'
      ? 'Backup your data'
      : variant === 'maintenance'
        ? 'Maintenance Scheduled'
        : variant === 'marketplace'
          ? 'Features Marketplace'
          : releaseHeading(notice, version)

  const subtitle = subtitleFor(variant, notice, version)
  const heading = bodyHeading(variant, notice)
  const paragraphs = bodyCopy(variant, notice)
  const showChangelog = variant === 'productUpdate' && lines.length > 0

  return (
    <AnnouncementModalShell
      open={open}
      onClose={onClose}
      variant={variant}
      title={title}
      subtitle={subtitle || undefined}
      footer={
        <Button type="button" className="min-h-11 px-8 font-semibold" onClick={onClose}>
          Got it
        </Button>
      }
    >
      {showChangelog ? (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {lines.map(line => (
            <li key={`${line.label}-${line.title}`} className="py-5 first:pt-0 last:pb-0">
              {line.label ? (
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{line.label}</p>
              ) : null}
              <p className="mt-1 text-sm font-semibold text-heading leading-snug">{line.title}</p>
              {line.detail ? (
                <p className="mt-1.5 text-sm leading-relaxed text-heading/80">{line.detail}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-3 text-left">
          {heading ? <h3 className="text-base font-semibold text-heading">{heading}</h3> : null}
          {paragraphs.map(p => (
            <p key={p.slice(0, 48)} className="text-sm leading-relaxed text-heading/90">
              {p.split(/(Settings → Data)/).map((chunk, i) =>
                chunk === 'Settings → Data' ? (
                  <strong key={i} className="font-semibold text-heading">
                    {chunk}
                  </strong>
                ) : (
                  <span key={i}>{chunk}</span>
                ),
              )}
            </p>
          ))}
        </div>
      )}
    </AnnouncementModalShell>
  )
}
