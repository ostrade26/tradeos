import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export type InfoNoteItem = {
  label: string
  value: ReactNode
  valueClassName?: string
}

export function InfoNoteCell({
  label,
  value,
  valueClassName,
}: InfoNoteItem) {
  return (
    <div>
      <p className="text-sm text-caption">{label}</p>
      <p className={cn('font-semibold tabular-nums text-gray-800 dark:text-gray-200', valueClassName)}>{value}</p>
    </div>
  )
}

export function InfoNoteRow({
  items,
  className,
}: {
  items: InfoNoteItem[]
  className?: string
}) {
  if (items.length === 0) return null

  return (
    <div className={className}>
      <div className="flex flex-col sm:flex-row items-stretch divide-y sm:divide-y-0 sm:divide-x divide-gray-200 dark:divide-gray-700 text-sm">
        {items.map(item => (
          <div
            key={item.label}
            className="min-w-0 flex-1 py-3 sm:py-0 first:pt-0 last:pb-0 sm:px-6 first:sm:pl-0 last:sm:pr-0"
          >
            <InfoNoteCell {...item} />
          </div>
        ))}
      </div>
    </div>
  )
}
