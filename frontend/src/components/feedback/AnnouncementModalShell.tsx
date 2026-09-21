import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { lockBodyScroll, unlockBodyScroll } from '../../lib/bodyScrollLock'
import {
  ANNOUNCEMENT_THEMES,
  resolveAnnouncementVariant,
  type AnnouncementVariant,
} from '../../lib/announcementTheme'
import { ModalPanaIllustration, MODAL_ILLUSTRATION_FRAME, MODAL_ILLUSTRATION_IMG } from '../../assets/illustrations/modalPanaIllustrations'
import { cn } from '../../lib/utils'

type AnnouncementModalShellProps = {
  open: boolean
  onClose: () => void
  variant: AnnouncementVariant
  title: string
  /** Centred line under the title (date window, short pitch, etc.) */
  subtitle?: string
  /** Optional status row under the subtitle (e.g. “Updates Applied”). */
  status?: ReactNode
  /** Full-bleed progress divider between header and body (0–100). */
  progress?: number
  /** Progress fill tone when showing the divider. */
  progressTone?: 'accent' | 'danger'
  dismissible?: boolean
  children?: ReactNode
  footer?: ReactNode
  footerClassName?: string
  maxWidthClass?: string
  /** Hide illustration (rare). */
  hideIllustration?: boolean
}

export function AnnouncementModalShell({
  open,
  onClose,
  variant,
  title,
  subtitle,
  status,
  progress,
  progressTone = 'accent',
  dismissible = true,
  children,
  footer,
  footerClassName,
  maxWidthClass = 'max-w-[39rem]',
  hideIllustration = false,
}: AnnouncementModalShellProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const resolved = resolveAnnouncementVariant(variant)
  const theme = ANNOUNCEMENT_THEMES[resolved]
  useFocusTrap(panelRef, open)

  useEffect(() => {
    if (!open) return
    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [open])

  useEffect(() => {
    if (!open || !dismissible) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, dismissible])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[2350] flex items-center justify-center p-4 sm:p-8" role="presentation">
      <div
        className="absolute inset-0 bg-black/55 dark:bg-black/65"
        onClick={dismissible ? onClose : undefined}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-modal-title"
        className={cn(
          'relative z-10 flex w-full max-h-full flex-col overflow-hidden rounded-md bg-white shadow-2xl animate-fade-in dark:bg-card',
          'ring-1 ring-black/5 dark:ring-white/10',
          theme.ring,
          maxWidthClass,
        )}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className={cn('relative shrink-0 px-6 pb-6 pt-10 text-center sm:px-8', theme.headerGradient)}>
          {dismissible ? (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 rounded-md p-2 text-muted hover:bg-black/5 hover:text-heading cursor-pointer attex-focus dark:hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}

          {!hideIllustration ? (
            <div className={MODAL_ILLUSTRATION_FRAME}>
              <ModalPanaIllustration
                kind={theme.illustration}
                className={MODAL_ILLUSTRATION_IMG}
              />
            </div>
          ) : null}

          <h2
            id="announcement-modal-title"
            className="mt-5 text-2xl font-bold tracking-tight text-heading sm:text-[1.75rem] leading-tight"
          >
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-2 text-sm leading-relaxed text-heading/90 sm:text-base">{subtitle}</p>
          ) : null}
          {status ? <div className="mt-3 flex justify-center">{status}</div> : null}
        </div>

        {progress != null ? (
          <div
            className="h-1 shrink-0 overflow-hidden bg-gray-100 dark:bg-gray-800"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.max(0, Math.min(100, progress))}
            aria-label="Update progress"
          >
            <div
              className={cn(
                'h-full transition-[width] duration-300 ease-out',
                progressTone === 'danger' ? 'bg-danger' : 'bg-accent',
              )}
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        ) : null}

        {children != null ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">{children}</div>
        ) : null}

        {footer ? (
          <div
            className={cn(
              'shrink-0 border-t border-gray-200 px-6 py-5 dark:border-gray-700',
              'flex flex-col-reverse gap-3 sm:flex-row sm:justify-end',
              footerClassName,
            )}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
