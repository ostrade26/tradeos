import type { ReactNode } from 'react'
import { cn, formatQty } from '../../lib/utils'

export function RelatedCardsStack({ children }: { children: ReactNode }) {
  return <div className="space-y-3">{children}</div>
}

export function RelatedCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
      {children}
    </div>
  )
}

export function RelatedCardHeader({
  title,
  subtitle,
  trailing,
  stats,
}: {
  title: ReactNode
  subtitle?: ReactNode
  trailing?: ReactNode
  stats?: ReactNode
}) {
  return (
    <div className="px-3 py-2.5 bg-gray-50/90 dark:bg-gray-800/50">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">{title}</div>
        {trailing}
      </div>
      {subtitle != null && subtitle !== '' && (
        <p className="text-xs text-muted mt-0.5 truncate">{subtitle}</p>
      )}
      {stats && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs">
          {stats}
        </div>
      )}
    </div>
  )
}

export function RelatedCardBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('border-t border-gray-100 dark:border-gray-800 px-3 py-2.5 space-y-2', className)}>
      {children}
    </div>
  )
}

export function RelatedDetailRow({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  if (value == null || value === '') return null
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted shrink-0">{label}</span>
      <span className="text-right text-heading min-w-0">{value}</span>
    </div>
  )
}

export function RelatedStat({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  tone?: 'default' | 'success' | 'warning'
}) {
  return (
    <span className="tabular-nums">
      <span className="text-muted">{label} </span>
      <span className={cn(
        'font-medium',
        tone === 'success' && 'text-success',
        tone === 'warning' && 'text-warning',
        tone === 'default' && 'text-heading',
      )}>
        {value}
      </span>
    </span>
  )
}

export function RelatedOrderStats({
  deliveredQty,
  onLiftQty = 0,
  pendingQty = 0,
  toScheduleQty,
}: {
  deliveredQty: number
  onLiftQty?: number
  pendingQty?: number
  toScheduleQty?: number
}) {
  const toSchedule = toScheduleQty ?? 0
  return (
    <>
      <RelatedStat label="Delivered" value={formatQty(deliveredQty)} tone="success" />
      {onLiftQty > 0 && (
        <RelatedStat label="On lift" value={formatQty(onLiftQty)} />
      )}
      {pendingQty > 0 && (
        <RelatedStat label="Pending" value={formatQty(pendingQty)} tone="warning" />
      )}
      {toSchedule > 0 && toSchedule !== pendingQty && (
        <RelatedStat label="To schedule" value={formatQty(toSchedule)} tone="warning" />
      )}
    </>
  )
}
