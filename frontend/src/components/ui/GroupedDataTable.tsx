import { Fragment, type ReactNode } from 'react'
import { cn, formatDeliveryPeriodRange, formatMt } from '../../lib/utils'
import { useTableDensity } from '../../hooks/useTableDensity'
import { EmptyState, emptyStateShellClass } from './Tabs'

export interface GroupedColumn<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  className?: string
  align?: 'left' | 'right'
  sumKey?: keyof T
  sumFormat?: (val: number) => string
}

interface GroupedDataTableProps<T extends { id: string; itemName: string }> {
  data: T[]
  columns: GroupedColumn<T>[]
  groupBy: keyof T
  onRowClick?: (row: T) => void
  emptyState?: ReactNode
  emptyMessage?: string
}

export function GroupedDataTable<T extends { id: string; itemName: string }>({
  data,
  columns,
  groupBy,
  onRowClick,
  emptyState,
  emptyMessage = 'No records found',
}: GroupedDataTableProps<T>) {
  const { classes: density } = useTableDensity()

  if (data.length === 0) {
    const state = emptyState ?? <EmptyState title={emptyMessage} />
    return <div className={emptyStateShellClass}>{state}</div>
  }

  const groups = data.reduce<Record<string, T[]>>((acc, row) => {
    const key = String(row[groupBy])
    if (!acc[key]) acc[key] = []
    acc[key].push(row)
    return acc
  }, {})

  const sumColumns = columns.filter(c => c.sumKey)

  return (
    <div className="overflow-x-auto rounded-md bg-card shadow-[var(--shadow-card)] dark:border-gray-700">
      <table className={cn('w-full', density.text, density.leading)}>
        <thead>
          <tr className="border-b border-gray-200/80 bg-gray-50/50 dark:border-gray-700 dark:bg-card/50">
            {columns.map(col => (
              <th
                key={col.key}
                className={cn(
                  density.groupHeaderCell,
                  `${density.text} font-medium text-muted whitespace-nowrap`,
                  col.align === 'right' ? 'text-right' : 'text-left',
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(groups).map(([groupName, rows]) => (
            <Fragment key={groupName}>
              {rows.map(row => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'border-b border-gray-100 dark:border-gray-700/50 transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                  )}
                >
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className={cn(
                        density.groupBodyCell,
                        `${density.text} text-gray-700 dark:text-gray-300 whitespace-nowrap`,
                        col.align === 'right' && 'text-right tabular-nums',
                        col.className
                      )}
                    >
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-gray-50/80 dark:bg-gray-700/20 border-b-2 border-gray-200 dark:border-gray-600">
                {columns.map((col, i) => {
                  if (i === 0) {
                    return (
                      <td key={col.key} className={cn(density.groupTotalCell, `${density.text} font-semibold text-danger`)}>
                        {groupName} Total
                      </td>
                    )
                  }
                  const sumCol = sumColumns.find(s => s.key === col.key)
                  if (sumCol?.sumKey) {
                    const total = rows.reduce((s, r) => s + Number(r[sumCol.sumKey!] ?? 0), 0)
                    return (
                      <td key={col.key} className={cn(density.groupTotalCell, `${density.text} font-semibold text-danger tabular-nums`, col.align === 'right' && 'text-right')}>
                        {sumCol.sumFormat ? sumCol.sumFormat(total) : formatMt(total)}
                      </td>
                    )
                  }
                  return <td key={col.key} className={density.groupTotalCell} />
                })}
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function VerifiedPeriod({
  period,
  start,
  end,
  deliveryType,
  verified: _verified,
  display = 'range',
}: {
  period?: string
  start?: string
  end?: string
  deliveryType?: 'period' | 'ready'
  verified?: boolean
  /** Register + detail: Ready stays Ready; period shows the date range. */
  display?: 'label' | 'range'
}) {
  const className = 'tabular-nums text-gray-700 dark:text-gray-300'
  const periodLower = period?.trim().toLowerCase()
  const isReady = deliveryType === 'ready' || periodLower === 'ready'

  if (isReady) {
    return <span className={className}>Ready</span>
  }

  const s = start?.slice(0, 10)
  const e = end?.slice(0, 10)

  if (s || e) {
    return (
      <span className={cn(className, 'whitespace-nowrap')}>
        {formatDeliveryPeriodRange(s ?? '', e ?? '')}
      </span>
    )
  }

  if (period && periodLower !== 'period') {
    return <span className={className}>{period}</span>
  }

  return <span className={className}>—</span>
}
