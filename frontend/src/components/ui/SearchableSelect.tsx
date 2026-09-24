import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Plus, Search } from 'lucide-react'
import { cn, noAutofill } from '../../lib/utils'
import { FieldError, inputErrorClassName } from './FieldError'

export interface SearchableSelectOption {
  value: string
  label: string
  description?: string
  keywords?: string
}

interface SearchableSelectProps {
  label?: string
  placeholder?: string
  searchPlaceholder?: string
  options: SearchableSelectOption[]
  value: string
  displayLabel?: string
  onValueChange: (value: string, label: string) => void
  allowCustom?: boolean
  allowCreate?: boolean
  onCreate?: (name: string) => SearchableSelectOption | Promise<SearchableSelectOption>
  /** When set, "Add new" opens an external flow (e.g. modal) instead of the inline name form. */
  onRequestCreate?: (draftName: string) => void
  createLabel?: string
  searchable?: boolean
  emptyMessage?: string
  disabled?: boolean
  error?: string
  className?: string
  /** Shorter control for dense toolbars (e.g. table pagination). */
  compact?: boolean
}

/** Above Modal/Drawer overlay (1200) so listboxes work inside dialogs. */
const SELECT_PORTAL_Z_INDEX = 1250

function matchesQuery(option: SearchableSelectOption, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = [
    option.label,
    option.description ?? '',
    option.keywords ?? '',
  ].join(' ').toLowerCase()
  return haystack.includes(q)
}

export function stringsToOptions(items: string[]): SearchableSelectOption[] {
  return items.map(item => ({ value: item, label: item }))
}

export function SearchableSelect({
  label,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  options,
  value,
  displayLabel,
  onValueChange,
  allowCustom = false,
  allowCreate = false,
  onCreate,
  onRequestCreate,
  createLabel = 'Add new',
  searchable = true,
  emptyMessage = 'No matches found',
  disabled = false,
  error,
  className,
  compact = false,
}: SearchableSelectProps) {
  const listboxId = useId()
  const createInputId = useId()
  const triggerId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const createInputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(-1)
  const [panelStyle, setPanelStyle] = useState<{
    top: number
    left: number
    width: number
    maxHeight: number
  } | null>(null)
  const [creating, setCreating] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createError, setCreateError] = useState('')
  const [creatingBusy, setCreatingBusy] = useState(false)
  const [blockAutofill, setBlockAutofill] = useState(true)
  const [blockCreateAutofill, setBlockCreateAutofill] = useState(true)

  const selectionOnly = allowCreate && !allowCustom

  const selected = options.find(o => o.value === value)
  const resolvedLabel = selected?.label ?? displayLabel ?? ''
  const filtered = searchable
    ? options.filter(o => matchesQuery(o, query))
    : options

  const handleClose = useCallback((commitCustom = true) => {
    if (commitCustom && allowCustom && searchable && !selectionOnly) {
      const trimmed = query.trim()
      if (trimmed && trimmed !== resolvedLabel) {
        onValueChange('', trimmed)
      } else if (!trimmed) {
        onValueChange('', '')
      }
    } else if (!allowCustom && !selected) {
      setQuery(resolvedLabel)
    }
    setCreating(false)
    setCreateName('')
    setCreateError('')
    setOpen(false)
  }, [allowCustom, searchable, selectionOnly, query, resolvedLabel, selected, onValueChange])

  const syncPanelPosition = useCallback(() => {
    const el = rootRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const gap = 4
    const viewportPad = 8
    const measured = panelRef.current?.offsetHeight
    /** Hard cap so long directories never fill the viewport and hide the Add CTA footer. */
    const PANEL_CAP = 240
    // Compact page-size lists are short; fall back so first paint can flip correctly.
    const estimatedHeight = measured && measured > 0
      ? Math.min(measured, PANEL_CAP)
      : Math.min(PANEL_CAP, 40 + options.length * 36)
    const spaceBelow = window.innerHeight - rect.bottom - viewportPad
    const spaceAbove = rect.top - viewportPad
    const openUp = spaceBelow < estimatedHeight && spaceAbove > spaceBelow
    const available = openUp ? spaceAbove - gap : spaceBelow - gap
    const maxHeight = Math.min(PANEL_CAP, Math.max(120, available))
    const top = openUp
      ? Math.max(viewportPad, rect.top - gap - Math.min(estimatedHeight, maxHeight))
      : rect.bottom + gap
    setPanelStyle({
      top,
      left: rect.left,
      width: rect.width,
      maxHeight,
    })
  }, [options.length])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    syncPanelPosition()
    // Re-measure after paint so flip uses real panel height.
    const raf = requestAnimationFrame(() => syncPanelPosition())
    const onScrollOrResize = () => syncPanelPosition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, syncPanelPosition])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return
      handleClose()
    }
    // Capture phase: Modal/Drawer stopPropagation on bubble, which would skip document listeners.
    document.addEventListener('mousedown', onPointerDown, true)
    return () => document.removeEventListener('mousedown', onPointerDown, true)
  }, [open, handleClose])

  useEffect(() => {
    if (!open) return

    const closeIfFocusLeft = () => {
      requestAnimationFrame(() => {
        const active = document.activeElement
        if (rootRef.current?.contains(active) || panelRef.current?.contains(active)) return
        handleClose()
      })
    }

    document.addEventListener('focusin', closeIfFocusLeft)
    return () => document.removeEventListener('focusin', closeIfFocusLeft)
  }, [open, handleClose])

  useEffect(() => {
    setHighlight(-1)
  }, [query, open])

  const selectOption = (option: SearchableSelectOption) => {
    onValueChange(option.value, option.label)
    setQuery(option.label)
    setCreating(false)
    setCreateName('')
    setCreateError('')
    setOpen(false)
  }

  const handleCreate = async () => {
    if (!onCreate) return
    const trimmed = createName.trim()
    if (!trimmed) {
      setCreateError('Name is required')
      return
    }
    setCreatingBusy(true)
    setCreateError('')
    try {
      const option = await onCreate(trimmed)
      selectOption(option)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to add')
    } finally {
      setCreatingBusy(false)
    }
  }

  const startCreating = () => {
    setCreating(true)
    setCreateName(searchable && query.trim() ? query.trim() : '')
    setCreateError('')
    setTimeout(() => createInputRef.current?.focus(), 0)
  }

  const openPanel = () => {
    if (disabled) return
    setQuery('')
    setCreating(false)
    setCreateName('')
    setCreateError('')
    setOpen(true)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) {
        openPanel()
        return
      }
      setHighlight(i => Math.min(i + 1, Math.max(filtered.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && filtered.length > 0) {
        const pick = highlight >= 0
          ? filtered[highlight]
          : (filtered.find(o => o.value === value) ?? filtered[0])
        selectOption(pick)
      } else {
        handleClose(true)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setQuery(resolvedLabel)
      setOpen(false)
    }
  }

  const showSearchIcon = searchable

  return (
    <div ref={rootRef} className={cn('flex flex-col', compact && !label ? 'gap-0' : 'gap-1.5', className)}>
      {label && (
        <label htmlFor={triggerId} className="text-sm font-medium text-gray-600 dark:text-gray-300">{label}</label>
      )}

      <div className="relative">
        {showSearchIcon && (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
        )}
        <input
          ref={inputRef}
          id={triggerId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="none"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${triggerId}-error` : undefined}
          disabled={disabled}
          readOnly={!searchable || blockAutofill}
          placeholder={open && searchable ? searchPlaceholder : (resolvedLabel || placeholder)}
          value={open && searchable ? query : resolvedLabel}
          {...noAutofill}
          onChange={e => {
            if (!searchable) return
            setQuery(e.target.value)
            if (!open) setOpen(true)
          }}
          onPointerDown={e => {
            if (searchable && blockAutofill) {
              setBlockAutofill(false)
              e.currentTarget.removeAttribute('readonly')
            }
          }}
          onFocus={e => {
            if (searchable && blockAutofill) {
              setBlockAutofill(false)
              e.currentTarget.removeAttribute('readonly')
            }
            openPanel()
          }}
          onClick={() => {
            if (!searchable && !open) openPanel()
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            'w-full rounded-md border border-gray-200 bg-white pr-9 text-sm text-heading',
            compact ? 'h-8 pr-8 text-[14px] tabular-nums' : 'h-11 sm:h-9',
            'placeholder:text-placeholder transition-colors duration-150',
            'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30',
            'dark:border-gray-600 dark:bg-card dark:text-heading',
            showSearchIcon ? 'pl-9' : compact ? 'pl-2.5 text-center' : 'pl-3',
            !searchable && 'cursor-pointer',
            disabled && 'opacity-60 cursor-not-allowed',
            error && inputErrorClassName,
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label="Toggle list"
          onClick={() => {
            if (disabled) return
            if (open) handleClose(false)
            else openPanel()
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        </button>
      </div>

      {error && <FieldError id={`${triggerId}-error`}>{error}</FieldError>}

      {open && panelStyle && createPortal(
        <div
          ref={panelRef}
          id={listboxId}
          role="listbox"
          style={{
            position: 'fixed',
            top: panelStyle.top,
            left: panelStyle.left,
            width: panelStyle.width,
            maxHeight: panelStyle.maxHeight,
            zIndex: SELECT_PORTAL_Z_INDEX,
          }}
          className="flex flex-col rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-card shadow-lg overflow-hidden"
        >
          <div
            className="min-h-0 flex-1 overflow-y-auto py-1"
            onMouseLeave={() => setHighlight(-1)}
          >
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted">
                {allowCustom && searchable && query.trim()
                  ? `Use “${query.trim()}” as entered`
                  : emptyMessage}
              </p>
            ) : (
              filtered.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => selectOption(option)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer',
                    (option.value === value || (highlight >= 0 && index === highlight))
                      ? 'bg-accent/10 text-heading'
                      : 'text-heading hover:bg-gray-50 dark:hover:bg-gray-800/60',
                  )}
                >
                  <p className="font-medium truncate">{option.label}</p>
                  {option.description && (
                    <p className="text-xs text-muted mt-0.5 leading-snug line-clamp-2">{option.description}</p>
                  )}
                </button>
              ))
            )}
          </div>
          {allowCustom && searchable && !selectionOnly && query.trim() && filtered.every(o => o.label.toLowerCase() !== query.trim().toLowerCase()) && (
            <button
              type="button"
              onClick={() => {
                onValueChange('', query.trim())
                setOpen(false)
              }}
              className="w-full border-t border-gray-200 dark:border-gray-700 px-3 py-2 text-left text-sm text-accent hover:bg-accent/5 cursor-pointer"
            >
              Use “{query.trim()}” as new name
            </button>
          )}
          {allowCreate && onRequestCreate && (
            <button
              type="button"
              onClick={() => {
                onRequestCreate(searchable && query.trim() ? query.trim() : '')
                setOpen(false)
              }}
              className="w-full shrink-0 border-t border-gray-200 dark:border-gray-700 px-3 py-2.5 text-left text-sm text-accent hover:bg-accent/5 cursor-pointer flex items-center gap-2"
            >
              <Plus className="h-4 w-4 shrink-0" />
              {createLabel}
            </button>
          )}
          {allowCreate && onCreate && !onRequestCreate && (
            creating ? (
              <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 p-3 space-y-2">
                <label htmlFor={createInputId} className="text-xs font-medium text-gray-500">{createLabel}</label>
                <input
                  id={createInputId}
                  ref={createInputRef}
                  type="text"
                  value={createName}
                  disabled={creatingBusy}
                  placeholder="Enter name"
                  readOnly={blockCreateAutofill}
                  {...noAutofill}
                  onPointerDown={e => {
                    if (blockCreateAutofill) {
                      setBlockCreateAutofill(false)
                      e.currentTarget.removeAttribute('readonly')
                    }
                  }}
                  onFocus={e => {
                    if (blockCreateAutofill) {
                      setBlockCreateAutofill(false)
                      e.currentTarget.removeAttribute('readonly')
                    }
                  }}
                  onChange={e => {
                    setCreateName(e.target.value)
                    setCreateError('')
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handleCreate()
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      setCreating(false)
                      setCreateName('')
                      setCreateError('')
                    }
                  }}
                  className="h-8 w-full rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-card px-2 text-sm focus:outline-none focus:border-accent"
                />
                {createError && <FieldError>{createError}</FieldError>}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={creatingBusy}
                    onClick={() => {
                      setCreating(false)
                      setCreateName('')
                      setCreateError('')
                    }}
                    className="h-8 px-3 rounded text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={creatingBusy}
                    onClick={() => void handleCreate()}
                    className="h-8 px-3 rounded bg-accent text-white text-xs font-medium hover:bg-accent/90 cursor-pointer disabled:opacity-60"
                  >
                    {creatingBusy ? 'Adding…' : 'Add'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={startCreating}
                className="w-full shrink-0 border-t border-gray-200 dark:border-gray-700 px-3 py-2.5 text-left text-sm text-accent hover:bg-accent/5 cursor-pointer flex items-center gap-2"
              >
                <Plus className="h-4 w-4 shrink-0" />
                {createLabel}
              </button>
            )
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}

export function companyToSelectOption(company: {
  id: string
  officialName: string
  location?: string
  aliases?: string[]
}): SearchableSelectOption {
  return {
    value: company.id,
    label: company.officialName,
    description: company.location,
    keywords: company.aliases?.join(' '),
  }
}
