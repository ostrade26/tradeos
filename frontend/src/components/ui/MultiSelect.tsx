import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectProps {
  label?: string
  placeholder?: string
  searchPlaceholder?: string
  options: MultiSelectOption[]
  values: string[]
  onChange: (values: string[]) => void
  searchable?: boolean
  emptyMessage?: string
}

function matchesQuery(option: MultiSelectOption, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return option.label.toLowerCase().includes(q)
}

export function MultiSelect({
  label,
  placeholder = 'All',
  searchPlaceholder = 'Search...',
  options,
  values,
  onChange,
  searchable = true,
  emptyMessage = 'No matches found',
}: MultiSelectProps) {
  const triggerId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number; width: number } | null>(null)

  const filtered = searchable ? options.filter(o => matchesQuery(o, query)) : options
  const selectedSet = new Set(values)

  const displayLabel = values.length === 0
    ? placeholder
    : values.length === 1
      ? (options.find(o => o.value === values[0])?.label ?? values[0])
      : `${values.length} selected`

  const syncPanelPosition = useCallback(() => {
    const el = rootRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPanelStyle({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }, [])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    syncPanelPosition()
    const onScrollOrResize = () => syncPanelPosition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, syncPanelPosition])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown, true)
    return () => document.removeEventListener('mousedown', onPointerDown, true)
  }, [open])

  const toggleValue = (value: string) => {
    if (selectedSet.has(value)) {
      onChange(values.filter(v => v !== value))
    } else {
      onChange([...values, value])
    }
  }

  const panel = open && panelStyle ? createPortal(
    <div
      ref={panelRef}
      className="fixed z-[200] rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-card"
      style={{ top: panelStyle.top, left: panelStyle.left, width: panelStyle.width }}
    >
      {searchable && (
        <div className="border-b border-gray-100 p-2 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-full rounded-md border border-gray-200 bg-white pl-8 pr-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            />
          </div>
        </div>
      )}
      <ul className="max-h-56 overflow-y-auto py-1" role="listbox" aria-multiselectable>
        {filtered.length === 0 ? (
          <li className="px-3 py-2 text-sm text-muted">{emptyMessage}</li>
        ) : filtered.map(option => {
          const checked = selectedSet.has(option.value)
          return (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={checked}
                onClick={() => toggleValue(option.value)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer',
                  checked && 'bg-accent/5',
                )}
              >
                <span className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                  checked ? 'border-accent bg-accent text-white' : 'border-gray-300 dark:border-gray-600',
                )}>
                  {checked && <Check className="h-3 w-3" />}
                </span>
                <span className="truncate">{option.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {values.length > 0 && (
        <div className="border-t border-gray-100 px-3 py-2 dark:border-gray-700">
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs font-medium text-muted hover:text-heading cursor-pointer"
          >
            Clear selection
          </button>
        </div>
      )}
    </div>,
    document.body,
  ) : null

  return (
    <div ref={rootRef} className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={triggerId} className="text-sm font-medium text-gray-600 dark:text-gray-300">{label}</label>
      )}
      <button
        id={triggerId}
        type="button"
        onClick={() => {
          setOpen(v => !v)
          if (!open) setTimeout(() => inputRef.current?.focus(), 0)
        }}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm',
          'dark:border-gray-600 dark:bg-card cursor-pointer',
          values.length === 0 ? 'text-muted' : 'text-heading',
        )}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {panel}
    </div>
  )
}
