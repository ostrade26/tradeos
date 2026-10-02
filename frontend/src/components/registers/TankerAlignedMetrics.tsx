import type { ReactNode } from 'react'
import { cn, formatMt } from '../../lib/utils'
import type { TankerQtyLine } from '../../lib/tankerQtyLines'
import { TankerNumberList } from './TankerNumberList'

function stackClassName(align: 'start' | 'end') {
  return cn('flex flex-col gap-1', align === 'end' ? 'items-end' : 'items-start')
}

function formatQtyCell(value: number | null | undefined, emphasize = false): ReactNode {
  if (value == null || value <= 0.0005) return <span className="text-gray-300">—</span>
  return (
    <span className={cn('tabular-nums', emphasize && 'font-medium')}>
      {formatMt(value)}
    </span>
  )
}

function formatBalanceCell(value: number | null | undefined): ReactNode {
  if (value == null || value <= 0.0005) return <span className="text-gray-300">—</span>
  return (
    <span className="tabular-nums font-medium text-amber-700 dark:text-amber-400">
      {formatMt(value)}
    </span>
  )
}

export function TankerPlannedColumn({
  lines,
  singleFallback,
}: {
  lines: TankerQtyLine[]
  singleFallback?: ReactNode
}) {
  if (lines.length <= 1) return <>{singleFallback ?? formatQtyCell(lines[0]?.plannedMt, true)}</>
  return (
    <span className={stackClassName('end')}>
      {lines.map((line, index) => (
        <span key={`${line.tankerNo}-${index}`}>{formatQtyCell(line.plannedMt, true)}</span>
      ))}
    </span>
  )
}

export function TankerActualColumn({
  lines,
  singleFallback,
}: {
  lines: TankerQtyLine[]
  singleFallback?: ReactNode
}) {
  if (lines.length <= 1) return <>{singleFallback ?? formatQtyCell(lines[0]?.actualMt, true)}</>
  return (
    <span className={stackClassName('end')}>
      {lines.map((line, index) => (
        <span key={`${line.tankerNo}-${index}`}>{formatQtyCell(line.actualMt, true)}</span>
      ))}
    </span>
  )
}

export function TankerBalanceColumn({
  lines,
  singleFallback,
}: {
  lines: TankerQtyLine[]
  singleFallback?: ReactNode
}) {
  if (lines.length <= 1) return <>{singleFallback ?? formatBalanceCell(lines[0]?.balanceMt)}</>
  return (
    <span className={stackClassName('end')}>
      {lines.map((line, index) => (
        <span key={`${line.tankerNo}-${index}`}>{formatBalanceCell(line.balanceMt)}</span>
      ))}
    </span>
  )
}

export function TankerNumberColumn({ lines }: { lines: TankerQtyLine[] }) {
  return (
    <TankerNumberList
      tankers={lines.map(line => ({
        number: line.tankerNo,
        changed: line.changed,
        previous: line.previous,
      }))}
    />
  )
}

export function TankerRateColumn({ rateLabel, lineCount }: { rateLabel: string; lineCount: number }) {
  if (lineCount <= 1) return <span className="tabular-nums">{rateLabel || '—'}</span>
  return (
    <span className={stackClassName('end')}>
      {Array.from({ length: lineCount }, (_, index) => (
        <span key={index} className="tabular-nums min-h-[1.25rem] flex items-center">
          {index === 0 ? (rateLabel || '—') : '\u00a0'}
        </span>
      ))}
    </span>
  )
}
