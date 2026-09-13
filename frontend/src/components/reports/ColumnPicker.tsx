import { useEffect, useState } from 'react'
import { Columns } from 'lucide-react'
import { Checkbox } from '../ui/Checkbox'
import type { ReportColumn } from '../../lib/reports/builders'
import { storageGet, storageSet } from '../../lib/storage'

export function ColumnPicker({
  reportId,
  columns,
  visible,
  onChange,
}: {
  reportId: string
  columns: ReportColumn[]
  visible: string[]
  onChange: (keys: string[]) => void
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [open])

  return (
    <div className="relative print:hidden">
      <button
        type="button"
        className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-gray-200 px-3 text-sm text-heading hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 cursor-pointer attex-focus"
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
      >
        <Columns className="h-4 w-4" />
        Columns
      </button>
      {open && (
        <div
          className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-card"
          onClick={e => e.stopPropagation()}
        >
          {columns.map(col => {
            const on = visible.includes(col.key)
            return (
              <div key={col.key} className="flex items-center rounded px-1 hover:bg-gray-50 dark:hover:bg-gray-800">
                <Checkbox
                  label={col.header}
                  checked={on}
                  onChange={() => {
                    const next = on ? visible.filter(k => k !== col.key) : [...visible, col.key]
                    if (next.length === 0) return
                    onChange(next)
                    storageSet(`tradeos.report-cols.${reportId}`, JSON.stringify(next))
                  }}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function loadVisibleColumns(reportId: string, columns: ReportColumn[]): string[] {
  try {
    const raw = storageGet(`tradeos.report-cols.${reportId}`)
    if (!raw) return columns.map(c => c.key)
    const parsed = JSON.parse(raw) as string[]
    const allowed = new Set(columns.map(c => c.key))
    const next = parsed.filter(k => allowed.has(k))
    return next.length ? next : columns.map(c => c.key)
  } catch {
    return columns.map(c => c.key)
  }
}

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))
}
