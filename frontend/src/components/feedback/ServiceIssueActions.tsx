import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'
import { APP_HOME } from '../../lib/appShellMode'
import type { ServiceIssueTheme } from '../../lib/serviceIssueTheme'
import { cn } from '../../lib/utils'
import type { ServiceIssueView } from '../../lib/serviceIssue'
import { ServiceIssueCopyButton } from './ServiceIssueCopyButton'

type ServiceIssueActionsProps = {
  issue: ServiceIssueView
  theme: ServiceIssueTheme
  checking?: boolean
  onRefresh: () => void
  onClose?: () => void
  onBeforeHome?: () => void
  layout?: 'row' | 'stack'
  showHome?: boolean
}

export function ServiceIssueActions({
  issue,
  theme,
  checking = false,
  onRefresh,
  onClose,
  onBeforeHome,
  layout = 'row',
  showHome = true,
}: ServiceIssueActionsProps) {
  const navigate = useNavigate()

  return (
    <div
      className={cn(
        'flex w-full gap-3',
        layout === 'stack' ? 'flex-col items-stretch' : 'flex-col sm:flex-row sm:justify-center',
      )}
    >
      <Button
        type="button"
        disabled={checking}
        onClick={onRefresh}
        className={cn('min-h-11 px-8 text-base font-semibold shadow-md', theme.primaryButton)}
      >
        {checking ? 'Refreshing…' : 'Refresh page'}
      </Button>
      {showHome ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 px-8 text-base font-semibold bg-white/80 dark:bg-zinc-900/80"
          onClick={() => {
            onBeforeHome?.()
            navigate(APP_HOME)
          }}
        >
          Back to dashboard
        </Button>
      ) : null}
      {onClose ? (
        <Button type="button" variant="ghost" className="min-h-11" onClick={onClose} disabled={checking}>
          Dismiss
        </Button>
      ) : null}
      <ServiceIssueCopyButton issue={issue} />
    </div>
  )
}
