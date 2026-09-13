import type { ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'
import { cn } from '../../lib/utils'

export const inputErrorClassName =
  'border-danger ring-2 ring-danger/20 focus:border-danger focus:ring-danger/30 dark:ring-danger/25'

export const FIELD_VALIDATION_HINT = 'Fix the highlighted fields below'

interface FieldErrorProps {
  id?: string
  children?: ReactNode
  className?: string
}

export function FieldError({ id, children, className }: FieldErrorProps) {
  if (!children) return null
  return (
    <span id={id} className={cn('flex items-start gap-1.5 text-xs text-danger', className)}>
      <CircleAlert className="h-3.5 w-3.5 shrink-0 mt-px" aria-hidden />
      <span>{children}</span>
    </span>
  )
}

interface FormErrorBannerProps {
  children?: ReactNode
  className?: string
}

export function FormErrorBanner({ children, className }: FormErrorBannerProps) {
  if (!children) return null
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger dark:bg-red-950/30 dark:border-red-900 dark:text-red-400',
        className,
      )}
    >
      <CircleAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
      <p>{children}</p>
    </div>
  )
}

export function FieldValidationBanner({ className }: { className?: string }) {
  return <FormErrorBanner className={className}>{FIELD_VALIDATION_HINT}</FormErrorBanner>
}
