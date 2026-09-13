import { forwardRef, type InputHTMLAttributes } from 'react'
import { Check, Minus } from 'lucide-react'
import { cn } from '../../lib/utils'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  /** Dense/table layouts — 16px control only, no 44px touch padding. */
  compact?: boolean
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, id, disabled, compact = false, ...props },
  ref,
) {
  const inputId = id ?? (label ? `checkbox-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined)

  return (
    <label
      htmlFor={inputId}
      className={cn(
        'group inline-flex cursor-pointer items-center gap-2',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <span className={cn(
        'relative inline-flex shrink-0 items-center justify-center',
        compact ? 'h-4 w-4' : 'h-11 w-11',
      )}>
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          disabled={disabled}
          className="peer sr-only"
          {...props}
        />
        <span
          aria-hidden
          className={cn(
            'flex h-4 w-4 items-center justify-center rounded border transition-colors',
            'border-gray-300 bg-white shadow-sm',
            'dark:border-gray-600 dark:bg-card',
            'group-has-[:checked]:border-accent group-has-[:checked]:bg-accent',
            'group-has-[:indeterminate]:border-accent group-has-[:indeterminate]:bg-accent',
            'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent/50',
          )}
        />
        <Check
          aria-hidden
          className={cn(
            'pointer-events-none absolute h-3 w-3 text-white',
            'opacity-0 transition-opacity group-has-[:checked]:opacity-100',
            'group-has-[:indeterminate]:hidden',
          )}
          strokeWidth={3}
        />
        <Minus
          aria-hidden
          className={cn(
            'pointer-events-none absolute hidden h-3 w-3 text-white',
            'group-has-[:indeterminate]:block',
          )}
          strokeWidth={3}
        />
      </span>
      {label && <span className="text-sm text-heading">{label}</span>}
    </label>
  )
})
