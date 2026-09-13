import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

type IconTone = 'amber' | 'emerald' | 'blue' | 'gray'

const toneClass: Record<IconTone, string> = {
  amber: 'bg-amber-50 text-warning dark:bg-amber-950/30',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
  blue: 'bg-blue-50 text-accent dark:bg-blue-950/30',
  gray: 'bg-gray-100 text-gray-500 dark:bg-gray-700/50',
}

interface DashboardCardEmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  tone?: IconTone
  className?: string
}

export function DashboardCardEmptyState({
  icon: Icon,
  title,
  description,
  tone = 'gray',
  className,
}: DashboardCardEmptyStateProps) {
  return (
    <div className={cn('flex flex-1 flex-col items-center justify-center text-center px-2 py-8', className)}>
      <div className={cn('mb-3 flex h-10 w-10 items-center justify-center rounded-lg', toneClass[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-heading">{title}</h3>
      <p className="text-xs text-muted mt-1 max-w-[15rem] leading-relaxed">{description}</p>
    </div>
  )
}
