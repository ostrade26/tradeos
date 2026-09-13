import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

interface CollapsibleRegisterStatsProps {
  children: ReactNode
  className?: string
}

/** Totals stay visible on large screens; phones collapse them so the list comes first. */
export function CollapsibleRegisterStats({ children, className }: CollapsibleRegisterStatsProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mb-6">
      <button
        type="button"
        className="lg:hidden mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-heading attex-focus rounded-md px-1"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        {open ? 'Hide totals' : 'Show totals'}
        <ChevronDown className={cn('h-4 w-4 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      <div className={cn(open ? 'grid' : 'hidden lg:grid', className)}>
        {children}
      </div>
    </div>
  )
}
