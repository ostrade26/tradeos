import { forwardRef, type ChangeEvent } from 'react'
import { Input } from './Input'
import { cn, formatMt, qtyMaxError } from '../../lib/utils'

interface QtyInputProps extends Omit<React.ComponentProps<typeof Input>, 'type' | 'trailing' | 'error'> {
  maxQty?: number
  maxQtyMessage?: string
  /** Suggested qty for the fill shortcut — does not cap entry (use maxQty to enforce a limit). */
  fillQty?: number
  error?: string
  fillLabel?: string
}

export const QtyInput = forwardRef<HTMLInputElement, QtyInputProps>(
  ({ maxQty, maxQtyMessage, fillQty, error, fillLabel = 'Use all', value = '', onChange, disabled, className, ...props }, ref) => {
    const stringValue = String(value ?? '')
    const maxError = maxQty != null ? qtyMaxError(stringValue, maxQty, maxQtyMessage) : undefined
    const displayError = maxError ?? error
    const fillValue = maxQty ?? fillQty
    const showFill = fillValue != null && fillValue > 0 && !disabled && !maxError

    const trailing = showFill ? (
      <button
        type="button"
        tabIndex={-1}
        onClick={() => {
          onChange?.({ target: { value: formatMt(fillValue) } } as ChangeEvent<HTMLInputElement>)
        }}
        className="rounded px-1.5 py-0.5 text-[11px] font-medium leading-none text-accent hover:bg-accent/10 transition-colors cursor-pointer whitespace-nowrap"
      >
        {fillLabel}
      </button>
    ) : undefined

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={value}
        trailing={trailing}
        error={displayError}
        disabled={disabled}
        onChange={onChange}
        className={cn('tabular-nums', className)}
        {...props}
      />
    )
  },
)
QtyInput.displayName = 'QtyInput'
