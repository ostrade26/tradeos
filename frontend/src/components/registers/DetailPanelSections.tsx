import type { LucideIcon } from 'lucide-react'
import { Children, Fragment, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

const sectionPad = 'py-6'

export function DetailPanelBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('divide-y divide-gray-100 dark:divide-gray-800', className)}>
      {children}
    </div>
  )
}

export function DetailHero({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-3', sectionPad, className)}>
      {children}
    </div>
  )
}

export function DetailGroup({
  title,
  icon: Icon,
  children,
  className,
  surface = 'plain',
  trailing,
}: {
  title: string
  icon: LucideIcon
  children: ReactNode
  className?: string
  surface?: 'plain' | 'muted'
  trailing?: ReactNode
}) {
  return (
    <section className={cn(sectionPad, className)}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon className="h-4 w-4 text-muted shrink-0" />
          <h4 className="text-sm font-semibold text-heading">{title}</h4>
        </div>
        {trailing}
      </div>
      <div
        className={cn(
          surface === 'muted' && 'rounded-md bg-gray-50 dark:bg-gray-800/50 px-4 py-4',
        )}
      >
        {children}
      </div>
    </section>
  )
}

export function DetailRow({
  label,
  value,
  mono,
  highlight,
}: {
  label: string
  value: ReactNode
  mono?: boolean
  highlight?: boolean
}) {
  if (value == null || value === '') return null
  return (
    <div className="flex items-start justify-between gap-6 py-0">
      <span className="text-[14px] text-muted shrink-0">{label}</span>
      <span className={cn(
        'text-[14px] text-right min-w-0',
        mono && 'font-mono font-medium',
        highlight && 'font-semibold text-heading tabular-nums',
        !highlight && !mono && 'text-heading',
      )}>
        {value}
      </span>
    </div>
  )
}

export function PartyBlock({
  role,
  name,
  align = 'left',
}: {
  role: string
  name: string
  align?: 'left' | 'right'
}) {
  return (
    <div className={cn(align === 'right' && 'text-right ml-auto')}>
      <p className="text-[14px] text-muted">{role}</p>
      <p className="text-[14px] font-medium text-heading">{name}</p>
    </div>
  )
}

export function PartyRow({ seller, buyer }: { seller: string; buyer: string }) {
  return (
    <div className="flex justify-between items-start gap-6">
      <PartyBlock role="Buyer" name={buyer} />
      <PartyBlock role="Seller" name={seller} align="right" />
    </div>
  )
}

export function DetailStatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-3 gap-3', className)}>
      {children}
    </div>
  )
}

export function DetailStat({
  label,
  value,
  valueClassName,
  variant = 'default',
}: {
  label: string
  value: ReactNode
  valueClassName?: string
  variant?: 'default' | 'success' | 'warning'
}) {
  return (
    <div className={cn(
      'text-center rounded-md px-2 py-2',
      variant === 'success' && 'bg-success-muted/50',
      variant === 'warning' && 'bg-warning-muted/50',
      variant === 'default' && 'bg-gray-50 dark:bg-gray-800/50',
    )}>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={cn('text-[14px] font-semibold tabular-nums mt-0.5', valueClassName)}>{value}</p>
    </div>
  )
}

/** Stacked label + value cell in a horizontal stat row. */
export function DetailInlineStat({
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
      <p className="text-xs text-muted">{label}</p>
      <p className={cn('text-sm font-semibold tabular-nums mt-0.5 text-heading', valueClassName)}>{value}</p>
    </div>
  )
}

export function DetailInlineStatRow({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(Boolean)
  return (
    <div className="flex items-start gap-x-4">
      {items.map((child, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <span
              className="w-px self-stretch bg-gray-200 dark:bg-gray-700 shrink-0"
              aria-hidden
            />
          )}
          {child}
        </Fragment>
      ))}
    </div>
  )
}

export function DetailMetricsSection({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-3', sectionPad, className)}>
      {children}
    </section>
  )
}
