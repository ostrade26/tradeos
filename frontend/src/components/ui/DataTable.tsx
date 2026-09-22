import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import { attachShiftWheelHorizontalScroll } from '../../lib/horizontalScroll'
import { useTableDensity } from '../../hooks/useTableDensity'
import { Button } from './Button'
import { Select } from './Select'
import { Checkbox } from './Checkbox'
import { EmptyState, emptyStateShellClass } from './Tabs'
import type { SortDirection } from '../../lib/registerSort'
import type { RowSelectMeta } from '../../lib/tableSelection'

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100]

export const TABLE_QTY_NOTE = 'All quantities in MT (metric tons).'

interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  className?: string
  sortable?: boolean
  sortValue?: (row: T) => string | number
  /** Multi-button row actions (e.g. Approve / Reject) — wider sticky column than the ⋯ menu. */
  actionsWide?: boolean | 'compact'
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (row: T) => void
  selectedRows?: string[]
  /** Highlight this row without checking its box (e.g. open detail). */
  activeRowId?: string
  /** Extra highlight (e.g. all rows for the open organisation). */
  isRowActive?: (row: T) => boolean
  /** Optional per-row class on `<tr>` (e.g. unread emphasis). */
  getRowClassName?: (row: T) => string | undefined
  /**
   * Soft background tone for non-selected rows (e.g. Gmail-style unread).
   * Applied to cells so sticky columns stay opaque while scrolling.
   */
  getRowTone?: (row: T) => 'unread' | undefined
  onSelectRow?: (id: string, meta?: RowSelectMeta) => void
  onSelectAllVisible?: (select: boolean, visibleIds: string[]) => void
  getRowId?: (row: T) => string
  emptyMessage?: string
  emptyState?: ReactNode
  paginate?: boolean
  defaultPageSize?: number
  pageSizeOptions?: number[]
  sortKey?: string
  sortDirection?: SortDirection
  onSortChange?: (key: string) => void
  mobileRender?: (row: T) => ReactNode
  stickyFirstColumn?: boolean
  stickyLastColumn?: boolean
  qtyNote?: boolean
  /** Stretch table to container width (default grows with column content). */
  fullWidth?: boolean
}

interface DataTablePaginationProps {
  page: number
  pageSize: number
  totalItems: number
  pageSizeOptions: number[]
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  /** When true, draw a top rule (e.g. after qty note). Table cells already supply the table/footer split. */
  withTopBorder?: boolean
}

function DataTablePagination({
  page,
  pageSize,
  totalItems,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  withTopBorder = false,
}: DataTablePaginationProps) {
  const { classes: density } = useTableDensity()
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const rangeStart = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, totalItems)

  return (
    <div className={cn(
      'flex flex-col gap-2 bg-gray-50/50 dark:bg-gray-700/10 sm:flex-row sm:items-center sm:justify-between',
      withTopBorder && 'border-t border-gray-200 dark:border-gray-700',
      density.footerNote,
    )}>
      <p className="text-[14px] text-muted tabular-nums">
        Showing {rangeStart}–{rangeEnd} of {totalItems}
      </p>

      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
        <div className="flex items-center gap-2">
          <span className="text-[14px] text-muted whitespace-nowrap">Rows per page</span>
          <div className="w-[4.75rem] shrink-0">
            <Select
              compact
              searchable={false}
              options={pageSizeOptions.map(size => ({
                value: String(size),
                label: String(size),
              }))}
              value={String(pageSize)}
              onChange={e => {
                const next = Number(e.target.value)
                if (Number.isFinite(next) && next > 0) onPageSizeChange(next)
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[5.5rem] text-center text-[14px] text-gray-500 tabular-nums">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function SortIndicator({ active, direction }: { active: boolean; direction?: SortDirection }) {
  if (!active) return <ChevronUp className="h-3 w-3 opacity-0 group-hover:opacity-30" />
  return direction === 'asc'
    ? <ChevronUp className="h-3 w-3 text-accent" />
    : <ChevronDown className="h-3 w-3 text-accent" />
}

const TABLE_CELL_SELECTED_BG = 'bg-blue-50/60 dark:bg-blue-950/25'
/** Opaque equivalent over --color-card — sticky cells need solid bg when scrolling. */
const TABLE_STICKY_SELECTED =
  'bg-[color-mix(in_srgb,#eff6ff_60%,var(--color-card)_40%)] dark:bg-[color-mix(in_srgb,#172554_25%,var(--color-card)_75%)]'
/** Gmail-style unread — soft cool tint vs plain read rows. */
const TABLE_CELL_UNREAD_BG = 'bg-sky-50/70 dark:bg-sky-950/25'
const TABLE_STICKY_UNREAD =
  'bg-[color-mix(in_srgb,#f0f9ff_70%,var(--color-card)_30%)] dark:bg-[color-mix(in_srgb,#082f49_25%,var(--color-card)_75%)]'
const TABLE_CELL_UNREAD_HOVER = 'group-hover:bg-sky-50 dark:group-hover:bg-sky-950/40'

/** Right + bottom only — adjacent cells share one edge (avoids thicker left/bottom from full borders + sticky). */
const TABLE_GRID_BORDER = 'border-b border-r border-gray-200 dark:border-gray-700/80'
const TABLE_GRID_EDGE_TOP = 'border-t border-gray-200 dark:border-gray-700/80'
const TABLE_GRID_EDGE_LEFT = 'border-l border-gray-200 dark:border-gray-700/80'

function gridCellClasses(
  selected: boolean,
  isSticky: boolean,
  isHeader = false,
  tone?: 'unread',
) {
  if (selected) {
    return cn(
      isSticky ? TABLE_STICKY_SELECTED : TABLE_CELL_SELECTED_BG,
      TABLE_GRID_BORDER,
    )
  }
  if (tone === 'unread' && !isHeader) {
    return cn(
      TABLE_GRID_BORDER,
      isSticky ? TABLE_STICKY_UNREAD : TABLE_CELL_UNREAD_BG,
      TABLE_CELL_UNREAD_HOVER,
    )
  }
  return cn(
    TABLE_GRID_BORDER,
    isHeader && 'bg-gray-50 dark:bg-gray-800',
    !isHeader && isSticky && 'bg-card group-hover:bg-gray-50 dark:group-hover:bg-zinc-800/50',
  )
}

function gridOuterEdgeClasses(opts: { top?: boolean; left?: boolean }) {
  return cn(
    opts.top && TABLE_GRID_EDGE_TOP,
    opts.left && TABLE_GRID_EDGE_LEFT,
  )
}

const STICKY_REF_SHADOW =
  'shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_8px_-4px_rgba(0,0,0,0.45)]'
const STICKY_ACTIONS_SHADOW = 'table-sticky-actions'
/** ⋯ control — horizontal sizing; vertical padding comes from table density. */
const STICKY_ACTIONS_COL =
  'px-2 w-[3.75rem] min-w-[3.75rem] max-w-[3.75rem] text-center'
const STICKY_ACTIONS_COL_COMPACT =
  'px-2 min-w-[7rem] w-[7rem] max-w-[7rem] text-center whitespace-nowrap'
const STICKY_ACTIONS_COL_WIDE =
  'px-3 min-w-[11.75rem] w-[11.75rem] max-w-[11.75rem] text-right whitespace-nowrap'

/** Checkbox column width — must match sticky offset for the first data column (`md:left-14`). */
const CHECKBOX_COL_CLASS = 'w-14 min-w-14 max-w-14 p-0'
const CHECKBOX_COL_INNER = 'flex h-full w-full items-center justify-center'

export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  onRowClick,
  selectedRows = [],
  activeRowId,
  isRowActive,
  getRowClassName,
  getRowTone,
  onSelectRow,
  onSelectAllVisible,
  getRowId,
  emptyMessage = 'No data found',
  emptyState,
  paginate = true,
  defaultPageSize = 25,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  sortKey,
  sortDirection,
  onSortChange,
  mobileRender,
  stickyFirstColumn = false,
  stickyLastColumn,
  qtyNote = false,
  fullWidth = false,
}: DataTableProps<T>) {
  const { classes: density } = useTableDensity()
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    return attachShiftWheelHorizontalScroll(el)
  }, [])
  const hasCheckboxColumn = Boolean(onSelectRow && getRowId)
  const stickyRefLeft = hasCheckboxColumn ? 'left-0 md:left-14' : 'left-0'
  const lastColIndex = columns.length - 1
  const lastColumn = columns[lastColIndex]
  const stickActions = stickyLastColumn ?? lastColumn?.key === 'actions'
  const stickyActionsColClass =
    lastColumn?.actionsWide === 'compact'
      ? STICKY_ACTIONS_COL_COMPACT
      : lastColumn?.actionsWide
        ? STICKY_ACTIONS_COL_WIDE
        : STICKY_ACTIONS_COL
  const stickyActionsColWidthPx =
    lastColumn?.actionsWide === 'compact' ? 112 : lastColumn?.actionsWide ? 188 : 60

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)

  const resolvedPageSizeOptions = useMemo(() => {
    const sizes = new Set([...pageSizeOptions, defaultPageSize, pageSize])
    return [...sizes].sort((a, b) => a - b)
  }, [pageSizeOptions, defaultPageSize, pageSize])

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize))

  useEffect(() => {
    setPage(1)
  }, [data.length, pageSize])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const visibleData = useMemo(() => {
    if (!paginate) return data
    const start = (page - 1) * pageSize
    return data.slice(start, start + pageSize)
  }, [data, page, pageSize, paginate])

  const visibleIds = useMemo(
    () => visibleData.map((row, i) => getRowId?.(row) || (row as { id?: string }).id || String(i)),
    [visibleData, getRowId],
  )

  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedRows.includes(id))
  const someVisibleSelected = visibleIds.some(id => selectedRows.includes(id))

  const handleSelectAllVisible = () => {
    if (!onSelectAllVisible) return
    onSelectAllVisible(!allVisibleSelected, visibleIds)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setPage(1)
  }

  if (data.length === 0) {
    const state = emptyState ?? <EmptyState title={emptyMessage} />
    return (
      <div className={emptyStateShellClass}>
        {state}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md bg-card shadow-[var(--shadow-card)]">
      {mobileRender && (
        <div data-register-table className={cn('md:hidden divide-y divide-gray-200 dark:divide-gray-700', density.text)}>
          {visibleData.map((row, i) => {
            const id = getRowId?.(row) || (row as { id?: string }).id || String(i)
            const checked = selectedRows.includes(id)
            const highlighted = checked || activeRowId === id || Boolean(isRowActive?.(row))
            const tone = getRowTone?.(row)
            return (
              <div
                key={id}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  density.mobileRow,
                  onRowClick && 'cursor-pointer active:bg-gray-50 dark:active:bg-gray-800/50',
                  !highlighted && tone === 'unread' && 'bg-sky-50/70 dark:bg-sky-950/25',
                  highlighted && TABLE_CELL_SELECTED_BG,
                  getRowClassName?.(row),
                )}
              >
                {mobileRender(row)}
              </div>
            )
          })}
        </div>
      )}

      <div
        ref={scrollRef}
        className={cn('overflow-x-auto scrollbar-on-hover', mobileRender && 'hidden md:block')}
      >
        <table
          data-register-table
          className={cn(
            'min-w-full border-collapse',
            fullWidth ? 'w-full' : 'w-max',
            density.text,
            density.leading,
            hasCheckboxColumn && 'select-none',
          )}
        >
          {(hasCheckboxColumn || stickyFirstColumn || stickActions) && (
            <colgroup>
              {hasCheckboxColumn && <col className="hidden md:table-column" style={{ width: 56 }} />}
              {columns.map((col, colIndex) => (
                <col
                  key={col.key}
                  style={
                    stickyFirstColumn && colIndex === 0
                      ? { minWidth: hasCheckboxColumn ? 88 : 80 }
                      : stickActions && colIndex === lastColIndex
                        ? { width: stickyActionsColWidthPx }
                        : undefined
                  }
                />
              ))}
            </colgroup>
          )}
          <thead>
            <tr>
              {onSelectRow && getRowId && (
                <th
                  className={cn(
                    CHECKBOX_COL_CLASS,
                    `${density.headerY} hidden md:table-cell`,
                    'select-none',
                    gridCellClasses(false, stickyFirstColumn, true),
                    gridOuterEdgeClasses({ top: true, left: true }),
                    stickyFirstColumn && 'sticky left-0 z-30',
                  )}
                  scope="col"
                  onMouseDown={e => {
                    if (e.shiftKey) e.preventDefault()
                  }}
                >
                  <div className={CHECKBOX_COL_INNER}>
                    {onSelectAllVisible && (
                      <Checkbox
                        compact
                        checked={allVisibleSelected}
                        ref={el => { if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected }}
                        onChange={() => handleSelectAllVisible()}
                        aria-label={allVisibleSelected ? 'Deselect all on page' : 'Select all on page'}
                      />
                    )}
                  </div>
                </th>
              )}
              {columns.map((col, colIndex) => {
                const isStickyFirst = stickyFirstColumn && colIndex === 0
                const isStickyLast = stickActions && colIndex === lastColIndex
                const isBeforeStickyActions = stickActions && colIndex === lastColIndex - 1
                const isFirstDataCol = colIndex === 0
                return (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    isStickyLast ? `${stickyActionsColClass} ${density.actionsY}` : `${density.cellX} ${density.headerY} text-left`,
                    `${density.text} font-medium text-muted`,
                    gridCellClasses(false, isStickyFirst || isStickyLast, true),
                    gridOuterEdgeClasses({ top: true, left: isFirstDataCol }),
                    hasCheckboxColumn && isFirstDataCol && 'md:border-l-0',
                    col.sortable && onSortChange && 'cursor-pointer select-none group',
                    isStickyFirst && cn(
                      'sticky z-30 whitespace-nowrap',
                      stickyRefLeft,
                      STICKY_REF_SHADOW,
                      'pr-2',
                    ),
                    isBeforeStickyActions && 'border-r-0',
                    isStickyLast && cn(
                      'sticky right-0 z-30',
                      STICKY_ACTIONS_SHADOW,
                      // Vertical edges come from inset shadow — avoid double weight with cell border.
                      'border-r-0',
                    ),
                    col.className,
                  )}
                  tabIndex={col.sortable && onSortChange ? 0 : undefined}
                  onClick={col.sortable && onSortChange ? () => onSortChange(col.key) : undefined}
                  onKeyDown={col.sortable && onSortChange ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSortChange(col.key)
                    }
                  } : undefined}
                  aria-sort={sortKey === col.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && onSortChange && (
                      <SortIndicator active={sortKey === col.key} direction={sortDirection} />
                    )}
                  </span>
                </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visibleData.map((row, i) => {
              const id = getRowId?.(row) || (row as { id?: string }).id || String(i)
              const checked = selectedRows.includes(id)
              const highlighted = checked || activeRowId === id || Boolean(isRowActive?.(row))
              const tone = highlighted ? undefined : getRowTone?.(row)
              return (
                <tr
                  key={id}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'group transition-colors duration-100',
                    onRowClick && 'cursor-pointer',
                    getRowClassName?.(row),
                  )}
                >
                  {onSelectRow && getRowId && (
                    <td
                      className={cn(
                        CHECKBOX_COL_CLASS,
                        `${density.bodyY} hidden md:table-cell`,
                        'select-none',
                        gridCellClasses(highlighted, stickyFirstColumn, false, tone),
                        gridOuterEdgeClasses({ left: true }),
                        stickyFirstColumn && 'sticky left-0 z-20',
                        !highlighted && !tone && !stickyFirstColumn && 'group-hover:bg-gray-50 dark:group-hover:bg-zinc-800/50',
                      )}
                      onMouseDown={e => {
                        // Prevent Shift+click from selecting table text.
                        if (e.shiftKey) e.preventDefault()
                      }}
                      onClick={e => {
                        e.stopPropagation()
                        onSelectRow(id, {
                          shiftKey: e.shiftKey,
                          visibleIds,
                        })
                      }}
                    >
                      <div className={CHECKBOX_COL_INNER}>
                        <Checkbox
                          compact
                          checked={checked}
                          // Clicks are handled on the cell so label+input don't double-toggle.
                          className="pointer-events-none"
                          tabIndex={-1}
                          onChange={() => {}}
                          aria-label={`Select row ${id}`}
                        />
                      </div>
                    </td>
                  )}
                  {columns.map((col, colIndex) => {
                    const isStickyFirst = stickyFirstColumn && colIndex === 0
                    const isStickyLast = stickActions && colIndex === lastColIndex
                    const isBeforeStickyActions = stickActions && colIndex === lastColIndex - 1
                    const isStickyCol = isStickyFirst || isStickyLast
                    const isFirstDataCol = colIndex === 0
                    return (
                    <td
                      key={col.key}
                      className={cn(
                        isStickyLast ? `${stickyActionsColClass} ${density.actionsY}` : `${density.cellX} ${density.bodyY}`,
                        `${density.text} text-gray-700 dark:text-gray-300`,
                        gridCellClasses(highlighted, isStickyCol, false, tone),
                        gridOuterEdgeClasses({ left: isFirstDataCol }),
                        hasCheckboxColumn && isFirstDataCol && 'md:border-l-0',
                        !highlighted && !tone && !isStickyCol && 'group-hover:bg-gray-50 dark:group-hover:bg-zinc-800/50',
                        isStickyFirst && cn(
                          'sticky z-20 whitespace-nowrap',
                          stickyRefLeft,
                          STICKY_REF_SHADOW,
                          'pr-2',
                        ),
                        isBeforeStickyActions && 'border-r-0',
                        isStickyLast && cn(
                          'sticky right-0 z-20',
                          STICKY_ACTIONS_SHADOW,
                          // Vertical edges come from inset shadow — avoid double weight with cell border.
                          'border-r-0',
                        ),
                        col.className,
                      )}
                      onClick={isStickyLast ? e => e.stopPropagation() : undefined}
                    >
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                    </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {(qtyNote || paginate) && (
        <div>
          {qtyNote && (
            <p className={cn(density.footerNote, density.text, 'text-muted')}>{TABLE_QTY_NOTE}</p>
          )}
          {paginate && (
            <DataTablePagination
              page={page}
              pageSize={pageSize}
              totalItems={data.length}
              pageSizeOptions={resolvedPageSizeOptions}
              onPageChange={setPage}
              onPageSizeChange={handlePageSizeChange}
              withTopBorder={Boolean(qtyNote)}
            />
          )}
        </div>
      )}
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-md bg-card shadow-[var(--shadow-card)] dark:border-gray-700 overflow-hidden">
      <div className="border-b border-gray-200/80 bg-gray-50/50 dark:border-gray-700 dark:bg-card/50 px-4 py-3">
        <div className="flex gap-8">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="skeleton h-3 w-16 rounded" />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-8 px-4 py-4 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="skeleton h-4 rounded" style={{ width: `${60 + (j * 13) % 40}px` }} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function DashboardStatSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-md bg-card shadow-[var(--shadow-card)] p-8 space-y-3">
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-8 w-32 rounded" />
          <div className="skeleton h-3 w-40 rounded" />
        </div>
      ))}
    </div>
  )
}
