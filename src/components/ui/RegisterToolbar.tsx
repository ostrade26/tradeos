import { Download, Printer, RefreshCw, User } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'
import { cn } from '../../lib/utils'

interface RegisterToolbarProps {
  dateRange: 'month' | 'year' | 'all'
  onDateRangeChange: (range: 'month' | 'year' | 'all') => void
  singleParty: boolean
  onSinglePartyToggle: () => void
  onExport: () => void
  onRefresh?: () => void
  legend?: ReactNode
  className?: string
}

export function RegisterToolbar({
  dateRange,
  onDateRangeChange,
  singleParty,
  onSinglePartyToggle,
  onExport,
  onRefresh,
  legend,
  className,
}: RegisterToolbarProps) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between', className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
        <span className="text-xs text-muted shrink-0">Period:</span>
        <div className="flex flex-wrap items-center gap-2">
          {([
            { id: 'month' as const, label: 'Last 1 Month' },
            { id: 'year' as const, label: 'Full Year' },
            { id: 'all' as const, label: 'All' },
          ]).map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onDateRangeChange(opt.id)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
                dateRange === opt.id
                  ? 'bg-zinc-900 text-white dark:bg-gray-100 dark:text-heading'
                  : 'bg-gray-100 text-gray-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-muted'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {legend}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        )}
        <Button
          variant={singleParty ? 'secondary' : 'outline'}
          size="sm"
          onClick={onSinglePartyToggle}
        >
          <User className="h-3.5 w-3.5" />
          {singleParty ? 'Single Party' : 'Show All'}
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" /> Print
        </Button>
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="h-3.5 w-3.5" /> Export Excel
        </Button>
      </div>
    </div>
  )
}
