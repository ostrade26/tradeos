import { useEffect, useId, useRef, useState } from 'react'
import { format, isValid, parse } from 'date-fns'
import { Calendar } from 'lucide-react'
import { cn } from '../../lib/utils'
import { FieldError, inputErrorClassName } from './FieldError'
import { popoverPlacementClass, useFlipPopover } from '../../hooks/useFlipPopover'
import { onOutsideClick } from '../../lib/outsideClick'
import { GridCalendar, parsePickerDate, toPickerValue } from './GridCalendar'

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

/** Formats users commonly type; canonical storage stays yyyy-MM-dd. */
const TYPED_DATE_FORMATS = [
  'd MMM yyyy',
  'dd MMM yyyy',
  'd MMMM yyyy',
  'dd MMMM yyyy',
  'yyyy/M/d',
  'yyyy/MM/dd',
]

function parseNumericDate(text: string): Date | null {
  const slash = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/)
  if (slash) {
    const day = Number(slash[1])
    const month = Number(slash[2])
    let year = Number(slash[3])
    if (slash[3]!.length === 2) year += year >= 70 ? 1900 : 2000
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    const date = new Date(year, month - 1, day)
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return null
    }
    return date
  }
  const digits = text.replace(/\D/g, '')
  if (digits.length === 8 || digits.length === 6) {
    const day = Number(digits.slice(0, 2))
    const month = Number(digits.slice(2, 4))
    let year = Number(digits.slice(4))
    if (digits.length === 6) year += year >= 70 ? 1900 : 2000
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    const date = new Date(year, month - 1, day)
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return null
    }
    return date
  }
  return null
}

function parseTypedDate(raw: string): Date | null {
  const text = raw.trim()
  if (!text) return null
  const iso = parsePickerDate(text)
  if (iso) return iso
  const numeric = parseNumericDate(text)
  if (numeric) return numeric
  for (const pattern of TYPED_DATE_FORMATS) {
    const parsed = parse(text, pattern, new Date())
    if (isValid(parsed)) return parsed
  }
  return null
}

function withinBounds(date: Date, min?: string, max?: string): boolean {
  const value = toPickerValue(date)
  if (min && value < min) return false
  if (max && value > max) return false
  return true
}

function displayFromValue(value: string): string {
  const selected = parsePickerDate(value)
  return selected ? format(selected, 'd MMM yyyy') : ''
}

export function DatePicker({
  label,
  value,
  onChange,
  min,
  max,
  error,
  className,
  placeholder = 'e.g. 24/09/2026',
  disabled = false,
}: DatePickerProps) {
  const autoId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(() => displayFromValue(value))
  const [localError, setLocalError] = useState('')
  const placement = useFlipPopover(open, triggerRef, panelRef)

  useEffect(() => {
    if (document.activeElement === inputRef.current) return
    setText(displayFromValue(value))
    setLocalError('')
  }, [value])

  useEffect(() => {
    if (!open) return
    return onOutsideClick(e => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    })
  }, [open])

  const commitText = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) {
      setLocalError('')
      setText('')
      if (value) onChange('')
      return
    }
    const parsed = parseTypedDate(trimmed)
    if (!parsed || !withinBounds(parsed, min, max)) {
      setLocalError(parsed ? 'Date is out of range' : 'Enter a valid date (e.g. 24/09/2026)')
      setText(trimmed)
      return
    }
    const next = toPickerValue(parsed)
    setLocalError('')
    setText(format(parsed, 'd MMM yyyy'))
    if (next !== value) onChange(next)
  }

  const shownError = error || localError

  return (
    <div ref={rootRef} className={cn('relative flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={autoId} className="text-sm font-medium text-gray-600 dark:text-gray-300">
          {label}
        </label>
      )}
      <div
        className={cn(
          'flex h-11 sm:h-9 w-full items-center gap-1 rounded-md border border-gray-200 bg-white pr-1',
          'transition-colors dark:border-gray-600 dark:bg-card',
          open && 'border-accent ring-1 ring-accent/30',
          shownError && inputErrorClassName,
          disabled && 'opacity-60 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50',
        )}
      >
        <input
          ref={inputRef}
          id={autoId}
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={placeholder}
          value={text}
          aria-invalid={shownError ? true : undefined}
          onChange={e => {
            setText(e.target.value)
            if (localError) setLocalError('')
          }}
          onBlur={() => commitText(text)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitText(text)
              setOpen(false)
              inputRef.current?.blur()
            }
            if (e.key === 'Escape') setOpen(false)
          }}
          className={cn(
            'min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-heading outline-none',
            'placeholder:text-placeholder',
            disabled && 'cursor-not-allowed',
          )}
        />
        <button
          ref={triggerRef}
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label="Open calendar"
          aria-expanded={open}
          onClick={() => !disabled && setOpen(v => !v)}
          className={cn(
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted',
            'hover:bg-gray-100 hover:text-heading dark:hover:bg-gray-800 cursor-pointer attex-focus',
            disabled && 'cursor-not-allowed',
          )}
        >
          <Calendar className="h-4 w-4" />
        </button>
      </div>
      {shownError && <FieldError>{shownError}</FieldError>}

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
            onChange={next => {
              onChange(next)
              const selected = parsePickerDate(next)
              setText(selected ? format(selected, 'd MMM yyyy') : '')
              setLocalError('')
            }}
            min={min}
            max={max}
            onPick={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  )
}
