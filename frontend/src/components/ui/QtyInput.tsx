import { forwardRef, useId, type ChangeEvent, type InputHTMLAttributes } from 'react'
import { cn, formatMt, noAutofill, qtyMaxError } from '../../lib/utils'
import { FieldError, inputErrorClassName } from './FieldError'

interface QtyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'readOnly'> {
  label?: string
  maxQty?: number
  maxQtyMessage?: string
  /** Suggested qty for the fill shortcut — does not cap entry (use maxQty to enforce a limit). */
  fillQty?: number
  error?: string
  fillLabel?: string
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void
}

/**
 * Quantity field — never uses the autofill readOnly lock (that blocked typing in delivery modals).
 * Fill action sits in the label row so it cannot cover the input hit target.
 */
export const QtyInput = forwardRef<HTMLInputElement, QtyInputProps>(
  ({
    maxQty,
    maxQtyMessage,
    fillQty,
    error,
    fillLabel = 'Use all',
    value = '',
    onChange,
    disabled,
    className,
    label,
    id: idProp,
    ...props
  }, ref) => {
    const autoId = useId()
    const id = idProp ?? autoId
    const stringValue = String(value ?? '')
    const maxError = maxQty != null ? qtyMaxError(stringValue, maxQty, maxQtyMessage) : undefined
    const displayError = maxError ?? error
    const fillValue = maxQty ?? fillQty
    const showFill = fillValue != null && fillValue > 0 && !disabled

    const fillButton = showFill ? (
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={() => {
          onChange?.({ target: { value: formatMt(fillValue) } } as ChangeEvent<HTMLInputElement>)
        }}
        className="rounded px-1 py-0.5 text-[11px] font-medium leading-none text-accent hover:bg-accent/10 transition-colors cursor-pointer whitespace-nowrap"
      >
        {fillLabel}
      </button>
    ) : null

    return (
      <div className="flex flex-col gap-1.5">
        {(label || fillButton) && (
          <div className="flex items-center justify-between gap-2 min-h-[1.25rem]">
            {label ? (
              <label htmlFor={id} className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {label}
              </label>
            ) : <span />}
            {fillButton}
          </div>
        )}
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          value={stringValue}
          disabled={disabled}
          aria-invalid={displayError ? true : undefined}
          aria-describedby={displayError ? `${id}-error` : undefined}
          {...noAutofill}
          {...props}
          onChange={onChange}
          className={cn(
            'h-11 sm:h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-heading tabular-nums',
            'placeholder:text-placeholder transition-colors duration-150',
            'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30',
            'dark:border-gray-600 dark:bg-card dark:text-heading',
            disabled && 'opacity-60 cursor-not-allowed',
            displayError && inputErrorClassName,
            className,
          )}
        />
        {displayError && <FieldError id={`${id}-error`}>{displayError}</FieldError>}
      </div>
    )
  },
)
QtyInput.displayName = 'QtyInput'
