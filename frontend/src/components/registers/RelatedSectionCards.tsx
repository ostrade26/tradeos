import type { ReactNode } from 'react'
import { cn, formatQty } from '../../lib/utils'
import { DetailInlineStatRow } from './DetailPanelSections'

export function RelatedCardsStack({ children }: { children: ReactNode }) {
  return <div className="space-y-2.5">{children}</div>
}

export function RelatedCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden bg-card',
        className,
      )}
    >
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
    <div className="px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-baseline gap-2 flex-wrap">
          <div className="shrink-0">{title}</div>
          {subtitle != null && subtitle !== '' && (
            <p className="text-xs text-muted min-w-0">{subtitle}</p>
          )}
        </div>
        {trailing}
      </div>
      {stats && (
        <div className="mt-2.5">
          {stats}
        </div>
      )}
    </div>
  )
}

/** Allocation SO card: SO + party, then Total/Delivered/Pending, then lift rows. */
export function AllocationSoCard({
  title,
  subtitle,
  totalQty,
  deliveredQty,
  pendingQty,
  totalLabel = 'Total SO',
  children,
}: {
  title: ReactNode
  subtitle?: ReactNode
  totalQty: number
  deliveredQty: number
  pendingQty: number
  totalLabel?: string
  children?: ReactNode
}) {
  return (
    <RelatedCard>
      <div className="bg-gray-50/90 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 p-4">
        <div className="min-w-0">
          <div className="text-[13px]">{title}</div>
          {subtitle != null && subtitle !== '' && (
            <p className="text-[13px] text-heading mt-0.5 leading-snug">{subtitle}</p>
          )}
        </div>
        <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          <RelatedAllocationStats
            totalLabel={totalLabel}
            totalQty={totalQty}
            deliveredQty={deliveredQty}
            pendingQty={pendingQty}
          />
        </div>
      </div>
      {children}
    </RelatedCard>
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
}: {
  deliveredQty: number
  onLiftQty?: number
  pendingQty?: number
}) {
  return (
    <>
      <RelatedStat label="Delivered" value={formatQty(deliveredQty)} tone="success" />
      {onLiftQty > 0 && (
        <RelatedStat label="On lift" value={formatQty(onLiftQty)} />
      )}
      {pendingQty > 0 && (
        <RelatedStat label="Pending" value={formatQty(pendingQty)} tone="warning" />
      )}
    </>
  )
}

/** Allocation card metrics: Total SO | Delivered | Pending (pending green per mockup). */
export function RelatedAllocationStats({
  totalQty,
  deliveredQty,
  pendingQty,
  totalLabel = 'Total SO',
}: {
  totalQty: number
  deliveredQty: number
  pendingQty: number
  totalLabel?: string
}) {
  return (
    <DetailInlineStatRow>
      <AllocationStat label={totalLabel} value={formatQty(totalQty)} />
      <AllocationStat label="Delivered" value={formatQty(deliveredQty)} />
      <AllocationStat label="Pending" value={formatQty(pendingQty)} valueClassName="text-success" />
    </DetailInlineStatRow>
  )
}

function AllocationStat({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: ReactNode
  valueClassName?: string
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-xs text-[#7D7E7E]">{label}</p>
      <p className={cn('text-base font-semibold tabular-nums mt-0.5 text-heading', valueClassName)}>
        {value}
      </p>
    </div>
  )
}
