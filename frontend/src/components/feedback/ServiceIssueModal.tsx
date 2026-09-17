import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { lockBodyScroll, unlockBodyScroll } from '../../lib/bodyScrollLock'
import type { ServiceIssueView } from '../../lib/serviceIssue'
import { SERVICE_ISSUE_THEMES } from '../../lib/serviceIssueTheme'
import { ServiceIssueIllustration } from './ServiceIssueIllustrations'
import { ServiceIssueActions } from './ServiceIssueActions'
import { cn } from '../../lib/utils'

type ServiceIssueModalProps = {
  open: boolean
  issue: ServiceIssueView | null
  checking?: boolean
  onRefresh: () => void
  onClose: () => void
}

export function ServiceIssueModal({
  open,
  issue,
  checking = false,
  onRefresh,
  onClose,
}: ServiceIssueModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, open)

  useEffect(() => {
    if (!open) return
    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [open])

  if (!open || !issue) return null

  const theme = SERVICE_ISSUE_THEMES[issue.kind]
  const Icon = theme.icon

  return createPortal(
    <div className="fixed inset-0 z-[2400] flex items-center justify-center p-4 sm:p-8" role="presentation">
      <div className="absolute inset-0 bg-black/55 dark:bg-black/65" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="service-issue-modal-title"
        className={cn(
          'relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl animate-fade-in dark:bg-card',
          'ring-1 ring-black/5 dark:ring-white/10',
          theme.ring,
        )}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className={cn('relative px-8 pb-10 pt-12 text-center bg-gradient-to-br', theme.gradient)}>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <div
            className={cn(
              'mx-auto mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest',
              'bg-white/20 text-white backdrop-blur-sm',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {theme.label}
          </div>
          <div className="mx-auto max-w-sm rounded-2xl bg-white/95 p-4 shadow-lg dark:bg-zinc-900/95">
            <ServiceIssueIllustration kind={issue.kind} className="mx-auto h-36 w-full" />
          </div>
        </div>

        <div className="space-y-4 px-8 py-8 text-center">
          <h2 id="service-issue-modal-title" className="text-2xl font-bold tracking-tight text-heading sm:text-3xl">
            {issue.title}
          </h2>
          <p className="text-base leading-relaxed text-muted sm:text-lg">{issue.message}</p>
          <p className="text-sm leading-relaxed text-muted">{issue.hint}</p>
          <div className="pt-4">
            <ServiceIssueActions
              theme={theme}
              checking={checking}
              onRefresh={onRefresh}
              onClose={onClose}
              showHome={false}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
