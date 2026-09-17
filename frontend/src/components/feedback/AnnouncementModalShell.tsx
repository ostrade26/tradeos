import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { lockBodyScroll, unlockBodyScroll } from '../../lib/bodyScrollLock'
import { ANNOUNCEMENT_THEMES, type AnnouncementVariant } from '../../lib/announcementTheme'
import { AnnouncementIllustration } from './AnnouncementIllustrations'
import { cn } from '../../lib/utils'

type AnnouncementModalShellProps = {
  open: boolean
  onClose: () => void
  variant: AnnouncementVariant
  title: string
  subtitle?: string
  version?: string
  badgeLabel?: string
  dismissible?: boolean
  children: ReactNode
  footer?: ReactNode
  footerClassName?: string
  maxWidthClass?: string
}

export function AnnouncementModalShell({
  open,
  onClose,
  variant,
  title,
  subtitle,
  version,
  badgeLabel,
  dismissible = true,
  children,
  footer,
  footerClassName,
  maxWidthClass = 'max-w-2xl',
}: AnnouncementModalShellProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const theme = ANNOUNCEMENT_THEMES[variant]
  const Icon = theme.icon
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

  const badge = badgeLabel ?? theme.label

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
          'relative z-10 w-full overflow-hidden rounded-2xl bg-white shadow-2xl animate-fade-in dark:bg-card',
          'ring-1 ring-black/5 dark:ring-white/10',
          theme.ring,
          maxWidthClass,
        )}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className={cn('relative px-8 pb-10 pt-12 text-center bg-gradient-to-br', theme.gradient)}>
          {dismissible ? (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white cursor-pointer"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
          <div
            className={cn(
              'mx-auto mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest',
              theme.badge,
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {badge}
            {version ? <span className="tabular-nums opacity-90">· v{version}</span> : null}
          </div>
          <div className="mx-auto max-w-sm rounded-2xl bg-white/95 p-4 shadow-lg dark:bg-zinc-900/95">
            <AnnouncementIllustration variant={variant} version={version} />
          </div>
        </div>

        <div className="px-8 py-8">
          <div className="text-center">
            <h2 id="announcement-modal-title" className="text-2xl font-bold tracking-tight text-heading sm:text-3xl">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-3 text-base leading-relaxed text-muted sm:text-lg">{subtitle}</p>
            ) : null}
          </div>
          <div className="mt-6">{children}</div>
          {footer ? (
            <div className={cn('mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end', footerClassName)}>
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}
