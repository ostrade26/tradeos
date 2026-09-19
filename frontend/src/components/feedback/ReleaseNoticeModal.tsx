import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '../ui/Button'
import { ReleaseUpdateIllustration } from '../../assets/illustrations/ReleaseUpdateIllustration'
import { updateItemsFromNotice } from '../layout/SystemUpdateModal'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { lockBodyScroll, unlockBodyScroll } from '../../lib/bodyScrollLock'
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

function releaseHeading(notice: UserNotification, version: string): string {
  if (version) return `Tradeal ${version}`
  const stripped = notice.title.replace(/\s*[·•|-]\s*Updates?\s*$/i, '').trim()
  return stripped || notice.title
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
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, open && notice != null)

  useEffect(() => {
    if (!open || !notice) return
    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [open, notice])

  useEffect(() => {
    if (!open || !notice) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, notice, onClose])

  if (!open || !notice) return null

  const version = payloadText(notice.payload, 'version')
  const heading = releaseHeading(notice, version)
  const lines = changelogLines(notice)

  return createPortal(
    <div className="fixed inset-0 z-[2350] flex items-center justify-center p-4 sm:p-8" role="presentation">
      <div className="absolute inset-0 bg-black/55 dark:bg-black/65" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-notice-title"
        className="relative z-10 flex w-full max-w-[34rem] max-h-[min(92vh,44rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 animate-fade-in dark:bg-card dark:ring-white/10"
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Soft header — Figma: light blue gradient, copy left, illustration right */}
        <div className="relative shrink-0 bg-gradient-to-b from-[#F4F7FF] via-[#E8F0FE] to-[#D6E6FF] px-6 py-6 dark:from-accent/15 dark:via-accent/10 dark:to-accent/5">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-lg p-2 text-muted hover:bg-black/5 hover:text-heading cursor-pointer dark:hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mx-auto flex w-full max-w-lg items-center justify-center gap-1 sm:gap-2">
            <div className="min-w-0 shrink">
              <p className="text-sm text-heading/80">Update</p>
              <h2
                id="release-notice-title"
                className="mt-1 text-2xl font-bold tracking-tight text-heading sm:text-[1.75rem] leading-tight"
              >
                {heading}
              </h2>
              <p className="mt-2 text-base font-medium text-heading/90">What's Included</p>
            </div>
            <div className="w-[12rem] shrink-0 sm:w-[14rem]">
              <div className="relative aspect-square w-full">
                <ReleaseUpdateIllustration className="absolute inset-0 h-full w-full object-contain select-none pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Changelog — equal padding all sides; doubled item spacing */}
        <div className="min-h-0 flex-1 overflow-y-auto p-8 sm:p-10">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {lines.map(line => (
              <li key={`${line.label}-${line.title}`} className="py-8 first:pt-0 last:pb-0">
                <p className="text-xs font-medium text-muted">{line.label}</p>
                <p className="mt-1 text-sm font-semibold text-heading leading-snug">{line.title}</p>
                {line.detail ? (
                  <p className="mt-1.5 text-sm leading-relaxed text-heading/80">{line.detail}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        <div className="shrink-0 border-t border-gray-200 px-6 py-6 dark:border-gray-700">
          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>
              Got it
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
