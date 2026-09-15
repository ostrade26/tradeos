import { cn } from '../../lib/utils'
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { lockBodyScroll, unlockBodyScroll } from '../../lib/bodyScrollLock'
import { useDetailPanelSlot } from '../layout/DetailPanelSlot'

/** Above docked detail column (z-1000). Context menus use z-1250 (DetailPanelMenu). */
const OVERLAY_Z = 1200

/** Full-screen dim overlay — no blur; keeps focus on modal/drawer content */
const overlayClass = 'absolute inset-0 bg-black/45 dark:bg-black/55'

const panelWidths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }

interface DetailPanelShellProps {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
  headerActions?: ReactNode
  className?: string
  bodyClassName?: string
  docked?: boolean
}

export function DetailPanelShell({
  title,
  subtitle,
  children,
  footer,
  onClose,
  headerActions,
  className,
  bodyClassName,
  docked = false,
}: DetailPanelShellProps) {
  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-white dark:bg-card', className)}>
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3 sm:px-5">
        <div className="min-w-0 pr-3">
          <h2 id="drawer-title" className="text-base font-semibold text-heading truncate">{title}</h2>
          {subtitle && <p className="text-[14px] text-muted mt-0.5 truncate">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {headerActions}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 cursor-pointer attex-focus"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className={cn(
        'min-h-0 flex-1 overflow-y-auto px-4 sm:px-5 text-[14px] leading-relaxed scrollbar-none',
        bodyClassName,
      )}>{children}</div>
      {footer && (
        <div className={cn(
          'shrink-0 border-t border-gray-200 px-4 py-4 dark:border-gray-700 sm:px-5 pb-[max(1rem,env(safe-area-inset-bottom))]',
          docked
            ? 'bg-white dark:bg-card shadow-[0_-1px_3px_0_rgb(0_0_0_0.06)]'
            : 'bg-gray-50/80 dark:bg-gray-800/30',
        )}>
          {footer}
        </div>
      )}
    </div>
  )
}

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  width?: 'sm' | 'md' | 'lg'
  headerActions?: ReactNode
}

export function Drawer({ open, onClose, title, subtitle, children, footer, width = 'md', headerActions }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, open)

  useEffect(() => {
    if (!open) return
    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 flex justify-end" style={{ zIndex: OVERLAY_Z }}>
      <div className={overlayClass} onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className={cn('relative z-10 flex h-full max-h-viewport w-full flex-col bg-white shadow-lg animate-slide-in dark:bg-card overscroll-contain', panelWidths[width])}
        onMouseDown={e => e.stopPropagation()}
      >
        <DetailPanelShell
          title={title}
          subtitle={subtitle}
          footer={footer}
          onClose={onClose}
          headerActions={headerActions}
        >
          {children}
        </DetailPanelShell>
      </div>
    </div>,
    document.body,
  )
}

interface DockedPanelProps {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
  headerActions?: ReactNode
  width?: 'sm' | 'md' | 'lg'
  className?: string
}

export function DockedPanel({
  title,
  subtitle,
  children,
  footer,
  onClose,
  headerActions,
  width = 'lg',
  className,
}: DockedPanelProps) {
  const { containerRef, open, setOpen } = useDetailPanelSlot()

  useLayoutEffect(() => {
    setOpen(true, width)
    return () => setOpen(false)
  }, [setOpen, width])

  const container = containerRef.current
  if (!open || !container) return null

  return createPortal(
    <div className={cn('flex h-full min-h-0 flex-col overflow-hidden', className)}>
      <DetailPanelShell
        title={title}
        subtitle={subtitle}
        footer={footer}
        onClose={onClose}
        headerActions={headerActions}
        docked
      >
        {children}
      </DetailPanelShell>
    </div>,
    container,
  )
}

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  footerClassName?: string
  size?: 'sm' | 'md' | 'lg'
  /** Hide the title bar — use for hero-style dialogs; pass `title` for screen readers. */
  hideHeader?: boolean
}

export function Modal({ open, onClose, title, children, footer, footerClassName, size = 'md', hideHeader = false }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, open)

  useEffect(() => {
    if (!open) return
    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-5 sm:p-8" style={{ zIndex: OVERLAY_Z }}>
      <div className={overlayClass} onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={hideHeader ? undefined : 'modal-title'}
        aria-label={hideHeader ? title : undefined}
        className={cn(
          'relative z-10 w-full max-h-modal overflow-y-auto rounded-xl bg-white dark:bg-card shadow-xl animate-fade-in overscroll-contain',
          sizes[size],
        )}
        onMouseDown={e => e.stopPropagation()}
      >
          {hideHeader ? (
            <>
              <span className="sr-only">{title}</span>
              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 z-10 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer attex-focus"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-5">
              <h2 id="modal-title" className="text-lg font-semibold text-heading pr-3">{title}</h2>
              <button type="button" onClick={onClose} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer attex-focus" aria-label="Close dialog">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className={cn('px-6', hideHeader ? 'pt-8 pb-6' : 'py-6')}>{children}</div>
          {footer && (
            <div className={cn(
              'flex border-t border-gray-200 dark:border-gray-700 px-6 py-6',
              footerClassName ?? 'items-center justify-end gap-3',
            )}>
              {footer}
            </div>
          )}
      </div>
    </div>,
    document.body,
  )
}
