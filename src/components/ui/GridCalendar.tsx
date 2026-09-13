import { useEffect, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export function parsePickerDate(value: string): Date | null {
  if (!value) return null
  const parsed = parseISO(value)
  return isValid(parsed) ? parsed : null
}

export function toPickerValue(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

interface GridCalendarProps {
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  className?: string
  /** When set, fire after a day is picked (e.g. close parent popover). */
  onPick?: () => void
}

export function GridCalendar({ value, onChange, min, max, className, onPick }: GridCalendarProps) {
  const selected = parsePickerDate(value)
  const minDate = parsePickerDate(min ?? '')
  const maxDate = parsePickerDate(max ?? '')
  const [viewMonth, setViewMonth] = useState(() => selected ?? new Date())

  useEffect(() => {
    if (selected) setViewMonth(selected)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const isDisabled = (day: Date) => {
    if (minDate && isBefore(day, minDate) && !isSameDay(day, minDate)) return true
    if (maxDate && isAfter(day, maxDate) && !isSameDay(day, maxDate)) return true
    return false
  }

  const pickDay = (day: Date) => {
    if (isDisabled(day)) return
    onChange(toPickerValue(day))
    onPick?.()
  }

  const goToToday = () => {
    const today = new Date()
    setViewMonth(today)
    if (!isDisabled(today)) {
      onChange(toPickerValue(today))
      onPick?.()
    }
  }

  const todayDisabled = isDisabled(new Date())

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setViewMonth(m => subMonths(m, 1))}
          className="rounded-md border border-gray-200 p-1.5 text-muted hover:bg-gray-50 hover:text-heading dark:border-gray-600 dark:hover:bg-gray-800 cursor-pointer attex-focus"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex min-w-0 flex-col items-center gap-1">
          <span className="text-sm font-semibold text-heading">{format(viewMonth, 'MMMM yyyy')}</span>
          <button
            type="button"
            onClick={goToToday}
            disabled={todayDisabled}
            className={cn(
              'text-xs font-medium text-accent hover:underline cursor-pointer attex-focus',
              todayDisabled && 'cursor-not-allowed opacity-40 no-underline hover:no-underline',
            )}
          >
            Today
          </button>
        </div>
        <button
          type="button"
          onClick={() => setViewMonth(m => addMonths(m, 1))}
          className="rounded-md border border-gray-200 p-1.5 text-muted hover:bg-gray-50 hover:text-heading dark:border-gray-600 dark:hover:bg-gray-800 cursor-pointer attex-focus"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map(day => (
          <div
            key={day}
            className="flex h-9 items-center justify-center text-xs font-medium uppercase tracking-wide text-muted"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map(day => {
          const inMonth = isSameMonth(day, viewMonth)
          const selectedDay = selected ? isSameDay(day, selected) : false
          const disabled = isDisabled(day)
          const today = isSameDay(day, new Date())

          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={disabled}
              onClick={() => pickDay(day)}
              className={cn(
                'flex h-10 w-full items-center justify-center rounded-md border text-sm tabular-nums transition-colors cursor-pointer attex-focus',
                inMonth ? 'border-gray-200 dark:border-gray-600' : 'border-transparent text-muted/60',
                selectedDay && 'border-accent bg-accent text-white hover:bg-accent',
                !selectedDay && !disabled && inMonth && 'hover:border-accent/40 hover:bg-accent-muted',
                today && !selectedDay && 'font-semibold text-accent',
                disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent',
              )}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}
