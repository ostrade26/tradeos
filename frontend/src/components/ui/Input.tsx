import { cn, noAutofill } from '../../lib/utils'
import { forwardRef, useId, useState, type FocusEvent, type InputHTMLAttributes, type ReactNode } from 'react'
import { Search } from 'lucide-react'
import { FieldError, inputErrorClassName } from './FieldError'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: boolean
  trailing?: ReactNode
}

const TEXTISH = new Set(['text', 'search', 'email', 'tel', 'url', 'password', undefined])

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, trailing, id: idProp, autoComplete, readOnly, onFocus, onInput, type, ...props }, ref) => {
    const autoId = useId()
    const id = idProp ?? autoId
    const isTextish = TEXTISH.has(type)
    const [blockAutofill, setBlockAutofill] = useState(isTextish)

    const unlockForKeyboard = (el: HTMLInputElement) => {
      if (blockAutofill && !readOnly) {
        setBlockAutofill(false)
        el.removeAttribute('readonly')
      }
    }

    const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
      unlockForKeyboard(e.currentTarget)
      onFocus?.(e)
    }

    const handleInput: NonNullable<InputHTMLAttributes<HTMLInputElement>['onInput']> = e => {
      // System / password-manager autofill can fill while still readOnly — unlock so it does not stay grey.
      unlockForKeyboard(e.currentTarget)
      onInput?.(e)
    }

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-gray-600 dark:text-gray-300">{label}</label>
        )}
        <div className="relative">
          {icon && (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          )}
          <input
            ref={ref}
            id={id}
            type={type}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className={cn(
              'h-11 sm:h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-heading',
              'placeholder:text-placeholder transition-colors duration-150',
              'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30',
              'dark:border-gray-600 dark:bg-card dark:text-heading',
              // Temporary autofill lock uses readOnly — keep the same surface as an editable field.
              'read-only:bg-white dark:read-only:bg-card read-only:text-heading',
              icon && 'pl-9',
              trailing && 'pr-[4.75rem]',
              error && inputErrorClassName,
              className
            )}
            {...noAutofill}
            {...props}
            readOnly={readOnly || (isTextish && blockAutofill)}
            autoComplete={autoComplete ?? 'off'}
            onPointerDown={e => unlockForKeyboard(e.currentTarget)}
            onFocus={handleFocus}
            onInput={handleInput}
            onAnimationStart={e => {
              // Chrome fires this when applying :-webkit-autofill.
              if (e.animationName === 'onAutoFillStart') {
                unlockForKeyboard(e.currentTarget)
              }
            }}
          />
          {trailing && (
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-auto">
              {trailing}
            </div>
          )}
        </div>
        {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
      </div>
    )
  }
)
Input.displayName = 'Input'
