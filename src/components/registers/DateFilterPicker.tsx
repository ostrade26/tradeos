import { useEffect, useRef, useState } from 'react'
import { Calendar, ChevronDown, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { dateRangeForPreset, formatDateFilterLabel, type DatePreset } from '../../lib/orderFilters'
import { popoverPlacementClass, useFlipPopover } from '../../hooks/useFlipPopover'
import { GridCalendar } from '../ui/GridCalendar'

type DateMode = 'single' | 'range'

const datePresets: { id: DatePreset; label: string }[] = [
  { id: 'last3days', label: 'Last 3 days' },
  { id: 'last1month', label: 'Last 1 month' },
]

interface DateFilterPickerProps {
  label?: string
  dateFrom: string
  dateTo: string
  onChange: (dateFrom: string, dateTo: string) => void
}

function inferMode(dateFrom: string, dateTo: string): DateMode {
  if (dateFrom && dateTo && dateFrom !== dateTo) return 'range'
  return 'single'
}

export function DateFilterPicker({ label = 'Date', dateFrom, dateTo, onChange }: DateFilterPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<DateMode>(() => inferMode(dateFrom, dateTo))
  const [draftFrom, setDraftFrom] = useState(dateFrom)
  const [draftTo, setDraftTo] = useState(dateTo)
  const placement = useFlipPopover(open, triggerRef, panelRef, [mode])

  useEffect(() => {
    if (!open) return
    setMode(inferMode(dateFrom, dateTo))
    setDraftFrom(dateFrom)
    setDraftTo(dateTo)
  }, [open, dateFrom, dateTo])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const display = formatDateFilterLabel(dateFrom, dateTo) || 'Any date'

  const applyPreset = (preset: DatePreset) => {
    const range = dateRangeForPreset(preset)
    onChange(range.dateFrom, range.dateTo)
    setOpen(false)
  }

  const applyDraft = () => {
    if (mode === 'single') {
      const day = draftFrom || draftTo
      onChange(day, day)
    } else {
      let from = draftFrom
      let to = draftTo
      if (from && to && from > to) [from, to] = [to, from]
      onChange(from, to)
    }
    setOpen(false)
  }

  const clearDates = () => {
    onChange('', '')
    setDraftFrom('')
    setDraftTo('')
    setOpen(false)
  }

  const activePreset = (() => {
    for (const preset of datePresets) {
      const range = dateRangeForPreset(preset.id)
      if (range.dateFrom === dateFrom && range.dateTo === dateTo) return preset.id
    }
    return null
  })()

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-600 dark:text-gray-300">{label}</label>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm',
          'text-heading transition-colors hover:border-gray-300 dark:border-gray-600 dark:bg-card attex-focus cursor-pointer',
          open && 'border-accent ring-1 ring-accent/30',
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0 text-muted" />
          <span className={cn('truncate', !dateFrom && !dateTo && 'text-muted')}>{display}</span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          ref={panelRef}
          className={cn(
            'absolute left-0 z-50 w-[min(100vw-2rem,20rem)] rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-600 dark:bg-card',
            popoverPlacementClass(placement),
          )}
        >
          <div className="mb-4 grid grid-cols-2 gap-2">
            {datePresets.map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                className={cn(
                  'rounded-md border px-2 py-2 text-xs font-medium transition-colors cursor-pointer attex-focus text-left',
                  activePreset === preset.id
                    ? 'border-accent bg-accent text-white'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:bg-zinc-800 dark:text-muted',
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="mb-4 flex rounded-md border border-gray-200 p-0.5 dark:border-gray-600">
            {(['single', 'range'] as const).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setMode(option)}
                className={cn(
                  'flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer attex-focus',
                  mode === option
                    ? 'bg-accent text-white'
                    : 'text-gray-500 hover:text-heading',
                )}
              >
                {option === 'single' ? 'Single date' : 'Date range'}
              </button>
            ))}
          </div>

          {mode === 'single' ? (
            <div className="mb-4">
              <GridCalendar
                value={draftFrom || draftTo}
                onChange={day => setDraftFrom(day)}
              />
            </div>
          ) : (
            <div className="mb-4 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted">From</label>
                <GridCalendar
                  value={draftFrom}
                  onChange={from => {
                    setDraftFrom(from)
                    if (!draftTo || draftTo < from) setDraftTo(from)
                  }}
                />
              </div>
              <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted">To</label>
                <GridCalendar
                  value={draftTo}
                  min={draftFrom || undefined}
                  onChange={to => setDraftTo(to)}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
            <button
              type="button"
              onClick={clearDates}
              className="text-xs text-muted hover:text-heading cursor-pointer attex-focus"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={applyDraft}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover cursor-pointer attex-focus"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface AppliedFilterChipsProps {
  chips: { id: string; prefix: string; value: string }[]
  onRemove: (id: string) => void
  onClearAll: () => void
}

function groupChipsByPrefix(chips: AppliedFilterChipsProps['chips']) {
  const groups: { label: string; chips: AppliedFilterChipsProps['chips'] }[] = []
  const indexByLabel = new Map<string, number>()
  for (const chip of chips) {
    const existing = indexByLabel.get(chip.prefix)
    if (existing === undefined) {
      indexByLabel.set(chip.prefix, groups.length)
      groups.push({ label: chip.prefix, chips: [chip] })
    } else {
      groups[existing].chips.push(chip)
    }
  }
  return groups
}

export function AppliedFilterChips({ chips, onRemove, onClearAll }: AppliedFilterChipsProps) {
  if (chips.length === 0) return null

  const groups = groupChipsByPrefix(chips)

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 pt-4 dark:border-gray-700/80">
      {groups.map(group => (
        <div key={group.label} className="inline-flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-muted">{group.label}</span>
          {group.chips.map(chip => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-700/30"
            >
              <span className="font-medium text-heading max-w-[12rem] truncate">{chip.value}</span>
              <button
                type="button"
                onClick={() => onRemove(chip.id)}
                className="rounded-full p-0.5 text-muted hover:bg-gray-200 hover:text-heading dark:hover:bg-gray-600 cursor-pointer attex-focus"
                aria-label={`Remove ${group.label} filter ${chip.value}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className={cn(
          'inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium',
          'text-gray-500 hover:border-danger/30 hover:bg-danger/5 hover:text-danger',
          'dark:border-gray-600 dark:bg-card dark:hover:bg-danger/10 cursor-pointer attex-focus',
        )}
      >
        Clear all
      </button>
    </div>
  )
}
