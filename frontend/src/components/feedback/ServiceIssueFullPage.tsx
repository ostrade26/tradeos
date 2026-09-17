import { createPortal } from 'react-dom'
import type { ServiceIssueView } from '../../lib/serviceIssue'
import { SERVICE_ISSUE_THEMES } from '../../lib/serviceIssueTheme'
import { ServiceIssueIllustration } from './ServiceIssueIllustrations'
import { ServiceIssueActions } from './ServiceIssueActions'
import { cn } from '../../lib/utils'

type ServiceIssueFullPageProps = {
  issue: ServiceIssueView
  checking?: boolean
  onRefresh: () => void
  onBeforeHome?: () => void
}

export function ServiceIssueFullPage({ issue, checking, onRefresh, onBeforeHome }: ServiceIssueFullPageProps) {
  const theme = SERVICE_ISSUE_THEMES[issue.kind]
  const Icon = theme.icon

  return createPortal(
    <div
      className="fixed inset-0 z-[2500] flex min-h-viewport flex-col bg-body"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="service-issue-title"
    >
      <div
        className={cn(
          'relative flex flex-1 flex-col items-center justify-center px-6 py-12 text-center',
          'bg-gradient-to-b from-accent/12 via-body to-body dark:from-accent/18',
        )}
      >
        <div
          className={cn(
            'mb-8 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest',
            theme.badge,
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
          {theme.label}
        </div>

        <ServiceIssueIllustration kind={issue.kind} className="mx-auto h-48 w-full max-w-xs sm:h-52 sm:max-w-sm" />

        <h1
          id="service-issue-title"
          className={cn('mt-8 max-w-xl text-3xl font-bold tracking-tight sm:text-4xl', theme.title)}
        >
          {issue.title}
        </h1>
        <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted">{issue.message}</p>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted/90">{issue.hint}</p>

        <div className="mt-10 w-full max-w-md">
          <ServiceIssueActions
            theme={theme}
            checking={checking}
            onRefresh={onRefresh}
            onBeforeHome={onBeforeHome}
            layout="stack"
            showHome
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}
