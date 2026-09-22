import { cn, formatMt, noAutofill } from '../../lib/utils'
import { useState, useEffect, useRef, type ReactNode } from 'react'
import { Search, Command } from 'lucide-react'
import { useFocusTrap } from '../../hooks/useFocusTrap'

interface CommandItem {
  id: string
  label: string
  description?: string
  group?: string
  action: () => void
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  items: CommandItem[]
}

export function CommandPalette({ open, onClose, items }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, open)

  useEffect(() => {
    if (!open) { setQuery(''); setSelected(0) }
  }, [open])

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const filtered = items.filter(item =>
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    item.description?.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
      if (e.key === 'Enter' && filtered[selected]) { filtered[selected].action(); onClose() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, filtered, selected, onClose])

  if (!open) return null

  const groups = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    const g = item.group || 'Actions'
    if (!acc[g]) acc[g] = []
    acc[g].push(item)
    return acc
  }, {})

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] sm:pt-[20vh] px-4">
      <div className="fixed inset-0 bg-black/45 dark:bg-black/55" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative z-10 w-full max-w-lg rounded-xl bg-white dark:bg-card shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in"
      >
        <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 px-4">
          <Search className="h-4 w-4 text-muted shrink-0" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            placeholder="Search orders, parties, lifts, tankers..."
            aria-label="Search commands"
            {...noAutofill}
            className="flex-1 h-12 bg-transparent text-sm text-heading placeholder:text-placeholder focus:outline-none"
          />
          <kbd className="hidden sm:flex items-center gap-0.5 rounded border border-gray-200 dark:border-gray-600 px-1.5 py-0.5 text-[10px] text-muted">
            <Command className="h-3 w-3" />K
          </kbd>
        </div>
        <div className="max-h-72 overflow-y-auto py-2" role="listbox">
          {Object.entries(groups).map(([group, groupItems]) => (
            <div key={group}>
              <p className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted">{group}</p>
              {groupItems.map(item => {
                const globalIndex = filtered.indexOf(item)
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={globalIndex === selected}
                    onClick={() => { item.action(); onClose() }}
                    className={cn(
                      'flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors cursor-pointer',
                      globalIndex === selected ? 'bg-gray-100 dark:bg-gray-700/50' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                    )}
                  >
                    <span className="text-sm text-heading">{item.label}</span>
                    {item.description && <span className="text-xs text-muted">{item.description}</span>}
                  </button>
                )
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted">No results found</p>
          )}
        </div>
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, breadcrumb, actions, hideActionsOnMobile, actionsAlign = 'start' }: {
  title: string
  subtitle?: ReactNode
  breadcrumb?: ReactNode
  actions?: ReactNode
  /** Hide page CTAs on small screens when a FAB already covers create. */
  hideActionsOnMobile?: boolean
  /** Vertical alignment of actions vs title block on sm+ */
  actionsAlign?: 'start' | 'end'
}) {
  return (
    <div className="mb-5 sm:mb-6">
      {breadcrumb}
      <div
        className={cn(
          'flex flex-col gap-3 sm:flex-row sm:justify-between mt-2',
          actionsAlign === 'end' ? 'sm:items-end' : 'sm:items-start',
        )}
      >
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-heading tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted mt-0.5 break-words">{subtitle}</p>}
        </div>
        {actions && (
          <div className={cn(
            'flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto',
            hideActionsOnMobile && 'hidden md:flex',
          )}>
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3 mb-4">
      {children}
    </div>
  )
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div>
      {label && (
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted">{label}</span>
          <span className="font-medium text-gray-700 dark:text-gray-300 tabular-nums">{formatMt(value)}/{formatMt(max)}</span>
        </div>
      )}
      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700/50 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
