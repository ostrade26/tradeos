import { cn } from '../../lib/utils'
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { lockBodyScroll, unlockBodyScroll } from '../../lib/bodyScrollLock'
import { useDetailPanelSlot } from '../layout/DetailPanelSlot'

/** Above docked detail column (z-1000). Context menus use z-1250 (DetailPanelMenu). */
export const DETAIL_OVERLAY_Z = 1200
/** Register table sits above the undocked overlay so rows stay selectable. */
export const REGISTER_TABLE_LAYER_Z = 1210

const OVERLAY_Z = DETAIL_OVERLAY_Z

/** Full-screen dim overlay — no blur; keeps focus on modal/drawer content */
const overlayClass = 'absolute inset-0 bg-black/45 dark:bg-black/55'

const panelWidths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }

interface DetailPanelShellProps {
  title: string
  subtitle?: string
  /** Status chips etc. — shown on the subtitle row (e.g. org active). */
  headerBadges?: ReactNode
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
  headerBadges,
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
        <div className="min-w-0 pr-3 flex-1">
          <h2 id="drawer-title" className="text-base font-semibold text-heading truncate">{title}</h2>
          {(subtitle || headerBadges) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 min-w-0">
              {subtitle ? (
                <p className="text-[14px] text-muted tabular-nums truncate">{subtitle}</p>
              ) : null}
              {headerBadges}
            </div>
          )}
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
  headerBadges?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: 'sm' | 'md' | 'lg'
  headerActions?: ReactNode
  /** `registerDetail` — modal backdrop; register table layer (z-1210) stays clickable. */
  variant?: 'modal' | 'registerDetail'
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  headerBadges,
  children,
  footer,
  width = 'md',
  headerActions,
  variant = 'modal',
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const isRegisterDetail = variant === 'registerDetail'
  useFocusTrap(panelRef, open && variant === 'modal')

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

  const panelShell = (
    <DetailPanelShell
      title={title}
      subtitle={subtitle}
      headerBadges={headerBadges}
      footer={footer}
      onClose={onClose}
      headerActions={headerActions}
    >
      {children}
    </DetailPanelShell>
  )

  const panelNode = (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal={isRegisterDetail ? 'false' : 'true'}
      aria-labelledby="drawer-title"
      className={cn(
        'fixed inset-y-0 right-0 z-10 flex max-h-viewport w-full flex-col bg-white shadow-lg animate-slide-in dark:bg-card overscroll-contain',
        panelWidths[width],
      )}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {panelShell}
    </div>
  )

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: OVERLAY_Z }}>
      <button
        type="button"
        aria-label="Close panel"
        className={cn(overlayClass, 'fixed inset-0 z-0 cursor-default border-0 p-0')}
        onClick={onClose}
      />
      {panelNode}
    </div>,
    document.body,
  )
}

interface DockedPanelProps {
  title: string
  subtitle?: string
  headerBadges?: ReactNode
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
  headerBadges,
  children,
  footer,
  onClose,
  headerActions,
  width = 'lg',
  className,
}: DockedPanelProps) {
  const { containerRef, setOpen } = useDetailPanelSlot()

  useLayoutEffect(() => {
    setOpen(true, width)
    return () => setOpen(false)
  }, [setOpen, width])

  const container = containerRef.current
  if (!container) return null

  return createPortal(
    <div className={cn('flex h-full min-h-0 flex-col overflow-hidden', className)}>
      <DetailPanelShell
        title={title}
        subtitle={subtitle}
        headerBadges={headerBadges}
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
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  footerClassName?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Hide the title bar — use for hero-style dialogs; pass `title` for screen readers. */
  hideHeader?: boolean
  /** When false, Escape, overlay click, and the close button are disabled. */
  dismissible?: boolean
  bodyClassName?: string
  /** Optional second body below the main one — muted surface, same padding as body. */
  secondaryBody?: ReactNode
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  footerClassName,
  size = 'md',
  hideHeader = false,
  dismissible = true,
  bodyClassName,
  secondaryBody,
}: ModalProps) {
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
      if (e.key === 'Escape' && dismissible) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, dismissible])

  if (!open) return null

  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-5xl' }

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-5 sm:p-8" style={{ zIndex: OVERLAY_Z }}>
      <div className={overlayClass} onClick={dismissible ? onClose : undefined} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={hideHeader ? undefined : 'modal-title'}
        aria-label={hideHeader ? title : undefined}
        className={cn(
          'relative z-10 w-full max-h-modal rounded-xl bg-white dark:bg-card shadow-xl animate-fade-in overscroll-contain',
          bodyClassName?.includes('split-pane') ? 'flex flex-col overflow-hidden' : 'overflow-y-auto',
          sizes[size],
        )}
        onMouseDown={e => e.stopPropagation()}
      >
          {hideHeader ? (
            <>
              <span className="sr-only">{title}</span>
              {dismissible ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute top-4 right-4 z-10 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer attex-focus"
                  aria-label="Close dialog"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </>
          ) : (
            <div className="flex shrink-0 items-start justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-5">
              <div className="min-w-0 pr-3">
                <h2 id="modal-title" className="text-lg font-semibold text-heading">{title}</h2>
                {subtitle ? <p className="text-sm text-muted mt-0.5">{subtitle}</p> : null}
              </div>
              {dismissible ? (
                <button type="button" onClick={onClose} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer attex-focus" aria-label="Close dialog">
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          )}
          <div className={cn('px-6', hideHeader ? 'pt-8 pb-6' : 'py-6', bodyClassName)}>{children}</div>
          {secondaryBody ? (
            <div className="border-t border-gray-200 bg-gray-100/80 px-6 py-6 dark:border-gray-700 dark:bg-gray-800/40">
              {secondaryBody}
            </div>
          ) : null}
          {footer && (
            <div className={cn(
              'flex shrink-0 border-t border-gray-200 dark:border-gray-700 px-6 py-6',
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
