import { cn } from '../../lib/utils'
import type { ReactNode } from 'react'

/** Stat row — `cols={4}`: equal full-width quarters; default Attex 6/5-col pattern */
export function StatGrid({
  children,
  className,
  cols = 6,
}: {
  children: ReactNode
  className?: string
  /** 4 = equal quarters; 6 = equal six columns on lg+; 7 = single row on lg+ */
  cols?: 4 | 6 | 7
}) {
  return (
    <div className={cn(
      'grid gap-3 mb-4',
      cols === 4
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
        : cols === 6
          ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
          : cols === 7
            ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7'
            : 'md:grid-cols-2 lg:grid-cols-6 2xl:grid-cols-5',
      className,
    )}>
      {children}
    </div>
  )
}

export function StatGridItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('lg:col-span-2 2xl:col-span-1', className)}>
      {children}
    </div>
  )
}

/** Attex content row: `grid lg:grid-cols-3 gap-6` or 2-col variant */
export function ContentGrid({
  children,
  cols = 3,
  className,
}: {
  children: ReactNode
  cols?: 2 | 3
  className?: string
}) {
  return (
    <div className={cn(
      'grid gap-6 mb-6',
      cols === 3 ? 'grid-cols-1 lg:grid-cols-3 [&>*]:min-w-0' : 'grid-cols-1 lg:grid-cols-2 [&>*]:min-w-0',
      className,
    )}>
      {children}
    </div>
  )
}

export function ContentGridSpan({
  children,
  span = 1,
  className,
}: {
  children: ReactNode
  span?: 1 | 2
  className?: string
}) {
  return (
    <div className={cn(span === 2 && 'lg:col-span-2', className)}>
      {children}
    </div>
  )
}
