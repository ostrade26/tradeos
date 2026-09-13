import { cn } from '../../lib/utils'

const variants = {
  default: 'bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-300',
  accent: 'bg-accent-muted text-accent',
  success: 'bg-success-muted text-success',
  warning: 'bg-warning-muted text-warning',
  danger: 'bg-danger-muted text-danger',
  info: 'bg-info-muted text-info',
}

interface BadgeProps {
  children: React.ReactNode
  variant?: keyof typeof variants
  dot?: boolean
  className?: string
}

export function Badge({ children, variant = 'default', dot, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        variants[variant],
        className
      )}
    >
      {dot && (
        <span className={cn(
          'h-1.5 w-1.5 rounded-full',
          variant === 'success' && 'bg-success',
          variant === 'warning' && 'bg-warning',
          variant === 'danger' && 'bg-danger',
          variant === 'info' && 'bg-info',
          variant === 'accent' && 'bg-accent',
          variant === 'default' && 'bg-gray-400',
        )} />
      )}
      {children}
    </span>
  )
}

export function StatusBadge({ status, context }: { status: string; context?: 'lift' }) {
  const map: Record<string, { variant: keyof typeof variants; label: string }> = {
    draft: { variant: 'default', label: 'Draft' },
    pending: { variant: 'warning', label: context === 'lift' ? 'In transit' : 'Pending' },
    confirmed: { variant: 'accent', label: 'Confirmed' },
    active: { variant: 'info', label: 'Active' },
    completed: { variant: 'success', label: 'Completed' },
    cancelled: { variant: 'danger', label: 'Cancelled' },
    outstanding: { variant: 'danger', label: 'Outstanding' },
    advance: { variant: 'warning', label: 'Advance Paid' },
    partial: { variant: 'info', label: 'Partial' },
    upcoming: { variant: 'default', label: 'Upcoming' },
    in_transit: { variant: 'accent', label: 'In Transit' },
    delivered: { variant: 'success', label: 'Delivered' },
    delayed: { variant: 'danger', label: 'Delayed' },
  }
  const config = map[status] || { variant: 'default' as const, label: status }
  return <Badge variant={config.variant} dot>{config.label}</Badge>
}
