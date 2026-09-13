import { cn } from '../../lib/utils'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: boolean
  hover?: boolean
  onClick?: () => void
}

export function Card({ children, className, padding = true, hover, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-md bg-card shadow-[var(--shadow-card)]',
        'dark:bg-card',
        padding && 'p-6',
        hover && 'transition-shadow duration-200 hover:shadow-md cursor-pointer',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-4 pb-0">
      <div>
        <h3 className="text-base font-semibold text-heading">{title}</h3>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatCard({ label, value, change, changeType, icon, to, onClick, details, compact, className }: {
  label: string
  value: string
  change?: string
  changeType?: 'up' | 'down' | 'neutral'
  icon?: ReactNode
  to?: string
  onClick?: () => void
  details?: string[]
  compact?: boolean
  className?: string
}) {
  const dense = compact && !change && !details?.length
  const body = (
    <Card hover={!!to || !!onClick} onClick={onClick} padding={false} className={cn('h-full min-w-0 overflow-hidden', compact ? 'p-3' : 'p-4 sm:p-6', className)}>
      <div className={cn('flex h-full min-h-0', dense ? 'flex-row items-start justify-between gap-2' : 'flex-col gap-3')}>
        <div className="flex items-start justify-between gap-2 min-w-0 flex-1">
          <div className="min-w-0 flex-1">
            <h5 className={cn('font-medium text-muted leading-snug text-pretty', compact ? 'text-xs' : 'text-sm')}>{label}</h5>
            <h3 className={cn(
              'font-semibold text-heading tabular-nums leading-tight break-words',
              compact ? 'text-lg mt-1' : 'text-xl sm:text-2xl mt-1.5',
            )}>{value}</h3>
          </div>
          {icon && (
            <div className={cn(
              'shrink-0 flex items-center justify-center rounded-md bg-accent-muted text-accent',
              compact ? 'h-8 w-8' : 'h-9 w-9 sm:h-10 sm:w-10',
            )}>
              {icon}
            </div>
          )}
          {dense && to && (
            <ArrowUpRight className="h-4 w-4 shrink-0 text-gray-300 transition-colors group-hover:text-accent mt-0.5" />
          )}
        </div>
        {!dense && (
          <div className="mt-auto flex items-end justify-between gap-3 min-w-0">
            <div className="min-w-0 flex-1 space-y-1">
              {change && (
                <p className={cn(
                  'leading-snug text-pretty break-words',
                  compact ? 'text-xs' : 'text-sm',
                  changeType === 'up' && 'text-success',
                  changeType === 'down' && 'text-danger',
                  changeType === 'neutral' && 'text-muted',
                )}>{change}</p>
              )}
              {details?.map(line => (
                <p key={line} className="text-xs text-muted leading-relaxed text-pretty break-words">{line}</p>
              ))}
            </div>
            {to && (
              <ArrowUpRight className="h-4 w-4 shrink-0 text-gray-300 transition-colors group-hover:text-accent" />
            )}
          </div>
        )}
      </div>
    </Card>
  )

  if (to) {
    return (
      <Link to={to} className="group block h-full min-h-0">
        {body}
      </Link>
    )
  }

  return body
}
