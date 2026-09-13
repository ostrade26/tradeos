import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useApiHealth } from '../../hooks/useApiHealth'
import { cn } from '../../lib/utils'

export function ApiStatusBanner() {
  const { online, checking, retry } = useApiHealth()

  if (online !== false) return null

  return (
    <div
      role="alert"
      className="flex shrink-0 items-center justify-between gap-3 border-b border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger"
    >
      <div className="flex min-w-0 items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        <p className="min-w-0">
          Python API is offline. Start it with{' '}
          <code className="rounded bg-danger/10 px-1 font-mono text-xs">npm run dev:backend</code>
          {' '}or{' '}
          <code className="rounded bg-danger/10 px-1 font-mono text-xs">npm run dev:all</code>
        </p>
      </div>
      <button
        type="button"
        onClick={() => void retry()}
        disabled={checking}
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 rounded-md border border-danger/30 px-2.5 py-1 text-xs font-medium',
          'hover:bg-danger/10 cursor-pointer disabled:opacity-50',
        )}
      >
        <RefreshCw className={cn('h-3.5 w-3.5', checking && 'animate-spin')} aria-hidden />
        Retry
      </button>
    </div>
  )
}
