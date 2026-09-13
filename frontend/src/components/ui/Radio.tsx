import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {}

/** Outline circle when unchecked; accent dot when checked (matches Checkbox styling). */
export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { className, disabled, ...props },
  ref,
) {
  return (
    <span
      className={cn(
        'group relative inline-flex shrink-0 items-center justify-center',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <input
        ref={ref}
        type="radio"
        disabled={disabled}
        className="peer sr-only"
        {...props}
      />
      <span
        aria-hidden
        className={cn(
          'flex h-4 w-4 items-center justify-center rounded-full border transition-colors',
          'border-gray-300 bg-white shadow-sm',
          'dark:border-gray-600 dark:bg-card',
          'group-has-[:checked]:border-accent',
          'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent/50',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'h-2 w-2 rounded-full bg-accent scale-0 transition-transform',
            'group-has-[:checked]:scale-100',
          )}
        />
      </span>
    </span>
  )
})
