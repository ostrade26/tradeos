import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { randomUUID } from '../lib/randomId'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../lib/utils'

export type ToastVariant = 'success' | 'error' | 'info'

export interface ToastAction {
  label: string
  to?: string
  onClick?: () => void
}

export interface ToastItem {
  id: string
  message: string
  description?: string
  variant?: ToastVariant
  action?: ToastAction
}

interface ToastContextValue {
  toast: (item: Omit<ToastItem, 'id'>) => void
  success: (message: string, opts?: Omit<ToastItem, 'id' | 'message' | 'variant'>) => void
  error: (message: string, opts?: Omit<ToastItem, 'id' | 'message' | 'variant'>) => void
  info: (message: string, opts?: Omit<ToastItem, 'id' | 'message' | 'variant'>) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const variantStyles: Record<ToastVariant, {
  container: string
  message: string
  description: string
  action: string
  dismiss: string
  icon: string
}> = {
  success: {
    container: 'bg-emerald-600 border-emerald-700 dark:bg-emerald-700 dark:border-emerald-500 shadow-emerald-900/25',
    message: 'text-white',
    description: 'text-emerald-50/90',
    action: 'text-white hover:text-emerald-50',
    dismiss: 'text-emerald-100 hover:text-white hover:bg-emerald-700/80 dark:hover:bg-emerald-600/80',
    icon: 'text-emerald-100',
  },
  error: {
    container: 'bg-red-600 border-red-700 dark:bg-red-700 dark:border-red-500 shadow-red-900/25',
    message: 'text-white',
    description: 'text-red-50/90',
    action: 'text-white hover:text-red-50',
    dismiss: 'text-red-100 hover:text-white hover:bg-red-700/80 dark:hover:bg-red-600/80',
    icon: 'text-red-100',
  },
  info: {
    container: 'bg-accent border-[var(--color-accent-hover)] dark:bg-[var(--color-accent-hover)] dark:border-accent shadow-accent/25',
    message: 'text-white',
    description: 'text-blue-50/90',
    action: 'text-white hover:text-blue-50',
    dismiss: 'text-blue-100 hover:text-white hover:bg-[var(--color-accent-hover)]/80',
    icon: 'text-blue-100',
  },
}

const variantIcons: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

function ToastViewport({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 z-[1300] pointer-events-none"
      aria-live="polite"
      aria-relevant="additions"
    >
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[min(36vh,11rem)] bg-gradient-to-t from-gray-300/85 via-gray-200/35 to-transparent dark:from-gray-950/80 dark:via-gray-900/30 dark:to-transparent"
        aria-hidden
      />
      <div className="relative flex flex-col items-center gap-2 px-4 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] w-full max-w-md mx-auto">
      {toasts.map(t => {
        const variant = t.variant ?? 'info'
        const styles = variantStyles[variant]
        const Icon = variantIcons[variant]
        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto w-full rounded-lg border shadow-lg px-4 py-3 animate-fade-in',
              styles.container,
            )}
            role={variant === 'error' ? 'alert' : 'status'}
            aria-live={variant === 'error' ? 'assertive' : 'polite'}
          >
            <div className="flex gap-3">
              <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', styles.icon)} />
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-semibold', styles.message)}>{t.message}</p>
                {t.description && <p className={cn('text-xs mt-0.5', styles.description)}>{t.description}</p>}
                {t.action && (
                  t.action.to ? (
                    <Link
                      to={t.action.to}
                      className={cn('inline-block text-xs font-semibold mt-2 hover:underline', styles.action)}
                      onClick={() => onDismiss(t.id)}
                    >
                      {t.action.label} →
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={cn('text-xs font-semibold mt-2 hover:underline cursor-pointer', styles.action)}
                      onClick={() => {
                        t.action?.onClick?.()
                        onDismiss(t.id)
                      }}
                    >
                      {t.action.label} →
                    </button>
                  )
                )}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(t.id)}
                className={cn('shrink-0 rounded p-1 cursor-pointer', styles.dismiss)}
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )
      })}
      </div>
    </div>,
    document.body,
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const push = useCallback((item: Omit<ToastItem, 'id'>) => {
    const id = randomUUID()
    setToasts(prev => [...prev.slice(-4), { ...item, id }])
    window.setTimeout(() => dismiss(id), 5000)
  }, [dismiss])

  const value = useMemo<ToastContextValue>(() => ({
    toast: push,
    success: (message, opts) => push({ ...opts, message, variant: 'success' }),
    error: (message, opts) => push({ ...opts, message, variant: 'error' }),
    info: (message, opts) => push({ ...opts, message, variant: 'info' }),
  }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
