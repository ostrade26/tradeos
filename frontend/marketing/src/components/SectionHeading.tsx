import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

export function SectionHeading({
  eyebrow,
  title,
  children,
  light = false,
  className,
}: {
  eyebrow: string
  title: string
  children?: ReactNode
  light?: boolean
  className?: string
}) {
  return (
    <div className={cn('max-w-2xl', className)}>
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">{eyebrow}</p>
      <h2
        className={cn(
          'mt-3 text-3xl font-semibold tracking-tight sm:text-4xl',
          light ? 'text-white' : 'text-heading',
        )}
      >
        {title}
      </h2>
      {children ? (
        <div className={cn('mt-4 leading-relaxed', light ? 'text-white/70' : 'text-muted')}>{children}</div>
      ) : null}
    </div>
  )
}
