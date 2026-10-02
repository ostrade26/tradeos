import { useEffect, useId, useRef, useState } from 'react'
import { format } from 'date-fns'
import { cn } from '../../lib/utils'
import { parseFlexibleTypedDate } from '../../lib/parseFlexibleTypedDate'
import { parsePickerDate, toPickerValue } from './GridCalendar'
import { FieldError, inputErrorClassName } from './FieldError'

interface DateTextInputProps {
  label?: string
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  error?: string
  className?: string
  placeholder?: string
  disabled?: boolean
  id?: string
}

function displayFromValue(value: string): string {
  const selected = parsePickerDate(value)
  return selected ? format(selected, 'd MMM yyyy') : ''
}

function withinBounds(date: Date, min?: string, max?: string): boolean {
  const iso = toPickerValue(date)
  if (min && iso < min) return false
  if (max && iso > max) return false
  return true
}

export function DateTextInput({
  label,
  value,
  onChange,
  min,
  max,
  error,
  className,
  placeholder = 'DD/MM/YYYY',
  disabled = false,
  id: idProp,
}: DateTextInputProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(() => displayFromValue(value))
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    if (document.activeElement === inputRef.current) return
    setText(displayFromValue(value))
    setLocalError('')
  }, [value])

  const commitText = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) {
      setLocalError('')
      setText('')
      if (value) onChange('')
      return
    }
    const parsed = parseFlexibleTypedDate(trimmed)
    if (!parsed || !withinBounds(parsed, min, max)) {
      setLocalError(parsed ? 'Date is out of range' : 'Enter a valid date')
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
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <label htmlFor={id} className="text-sm font-medium text-gray-600 dark:text-gray-300">
          {label}
        </label>
      ) : null}
      <input
        ref={inputRef}
        id={id}
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
            inputRef.current?.blur()
          }
        }}
        className={cn(
          'h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-heading outline-none',
          'placeholder:text-placeholder transition-colors dark:border-gray-600 dark:bg-card',
          'focus:border-accent focus:ring-1 focus:ring-accent/30',
          shownError && inputErrorClassName,
          disabled && 'cursor-not-allowed opacity-60 bg-gray-50 dark:bg-gray-800/50',
        )}
      />
      {shownError ? <FieldError>{shownError}</FieldError> : null}
    </div>
  )
}
