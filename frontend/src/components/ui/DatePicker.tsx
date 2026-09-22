import { useEffect, useId, useRef, useState } from 'react'
import { format } from 'date-fns'
import { Calendar } from 'lucide-react'
import { cn } from '../../lib/utils'
import { FieldError, inputErrorClassName } from './FieldError'
import { popoverPlacementClass, useFlipPopover } from '../../hooks/useFlipPopover'
import { onOutsideClick } from '../../lib/outsideClick'
import { GridCalendar, parsePickerDate } from './GridCalendar'

interface DatePickerProps {
  label?: string
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  error?: string
  className?: string
  placeholder?: string
  disabled?: boolean
}

export function DatePicker({
  label,
  value,
  onChange,
  min,
  max,
  error,
  className,
  placeholder = 'Select date',
  disabled = false,
}: DatePickerProps) {
  const autoId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const selected = parsePickerDate(value)
  const placement = useFlipPopover(open, triggerRef, panelRef)

  useEffect(() => {
    if (!open) return
    return onOutsideClick(e => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    })
  }, [open])

  const display = selected ? format(selected, 'd MMM yyyy') : placeholder

  return (
    <div ref={rootRef} className={cn('relative flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={autoId} className="text-sm font-medium text-gray-600 dark:text-gray-300">
          {label}
        </label>
      )}
      <button
        ref={triggerRef}
        id={autoId}
        type="button"
        onClick={() => !disabled && setOpen(v => !v)}
        disabled={disabled}
        aria-expanded={open}
        aria-invalid={error ? true : undefined}
        className={cn(
          'flex h-11 sm:h-9 w-full items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm text-left',
          'transition-colors attex-focus cursor-pointer dark:border-gray-600 dark:bg-card',
          open && 'border-accent ring-1 ring-accent/30',
          error && inputErrorClassName,
          !value && 'text-placeholder',
          disabled && 'opacity-60 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50',
        )}
      >
        <Calendar className="h-4 w-4 shrink-0 text-muted" />
        <span className="truncate">{display}</span>
      </button>
      {error && <FieldError>{error}</FieldError>}

      {open && (
        <div
          ref={panelRef}
          className={cn(
            'absolute left-0 z-50 w-[min(100vw-2rem,18.5rem)] rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-600 dark:bg-card',
            popoverPlacementClass(placement),
          )}
        >
          <GridCalendar
            value={value}
            onChange={onChange}
            min={min}
            max={max}
            onPick={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  )
}
