import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Check, CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { AnnouncementModalShell } from '../feedback/AnnouncementModalShell'
import { announcementVariantFromKind } from '../../lib/announcementTheme'
import { cn } from '../../lib/utils'
import { releaseCategoryLabel } from '../../lib/releaseVersion'
import type { UserNotification } from '../../api/platformApi'

type StepStatus = 'pending' | 'active' | 'done' | 'error'

interface UpdateStep {
  id: string
  title: string
  detail: string
  kind: 'feature' | 'apply' | 'reload'
}

function payloadText(payload: Record<string, string>, key: string): string {
  return String(payload[key] ?? '').trim()
}

function changelogFromNotice(item: UserNotification): { category: string; title: string; detail: string }[] {
  const raw = payloadText(item.payload, 'changelog')
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { category?: string; title?: string; detail?: string }[]
      if (Array.isArray(parsed) && parsed.length) {
        return parsed
          .map(entry => ({
            category: String(entry.category || ''),
            title: String(entry.title || '').trim(),
            detail: String(entry.detail || '').trim(),
          }))
          .filter(entry => entry.title)
      }
    } catch {
      /* fall through */
    }
  }
  return updateItemsFromNotice(item).map(title => ({ category: '', title, detail: '' }))
}

export function updateItemsFromNotice(item: UserNotification): string[] {
  const listed = payloadText(item.payload, 'items')
  if (listed) {
    return listed
      .split('\n')
      .map(line => line.replace(/^[-*•]\s*/, '').replace(/^\d+[.)]\s*/, '').trim())
      .filter(Boolean)
  }
  const bodyLines = item.body
    .split('\n')
    .map(line => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
  if (bodyLines.length > 1) return bodyLines
  return []
}

function buildSteps(item: UserNotification): UpdateStep[] {
  const changelog = changelogFromNotice(item)
  const featureSteps: UpdateStep[] = (changelog.length ? changelog : [{ category: '', title: item.title, detail: '' }]).map((entry, index) => ({
    id: `feature-${index}`,
    title: entry.title,
    detail: [entry.category ? releaseCategoryLabel(entry.category) : '', entry.detail]
      .filter(Boolean)
      .join(' · ') || (item.kind === 'feature_launch' ? 'New feature for this workspace' : 'Included in this version'),
    kind: 'feature',
  }))
  const key = item.feature_key || payloadText(item.payload, 'feature_key')
  const version = payloadText(item.payload, 'version')
  const applyScope = payloadText(item.payload, 'apply_scope')
  return [
    ...featureSteps,
    {
      id: 'apply',
      title: applyScope === 'org' ? 'Enable for this organisation' : 'Enable on this account',
      detail: version
        ? `Applies version ${version}${key ? ` (${key})` : ''} to this licence.`
        : key
          ? `Applies ${key} to your Tradeal login.`
          : 'Records this update against your account.',
      kind: 'apply',
    },
    {
      id: 'reload',
      title: 'Prepare workspace',
      detail: 'Gets this session ready to use the update.',
      kind: 'reload',
    },
  ]
}

function wait(ms: number) {
  const reduce = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return new Promise<void>(resolve => {
    window.setTimeout(resolve, reduce ? 0 : ms)
  })
}

export function SystemUpdateModal({
  open,
  notification,
  onClose,
  onApply,
}: {
  open: boolean
  notification: UserNotification | null
  onClose: () => void
  onApply: (notificationId: number) => Promise<void>
}) {
  const steps = useMemo(
    () => (notification ? buildSteps(notification) : []),
    [notification],
  )
  const onApplyRef = useRef(onApply)
  onApplyRef.current = onApply
  const [statuses, setStatuses] = useState<StepStatus[]>([])
  const [percent, setPercent] = useState(0)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<'running' | 'failed' | 'success'>('running')
  const [reloadIn, setReloadIn] = useState<number | null>(null)
  const appliedOnce = useRef(false)

  useEffect(() => {
    if (!open || !notification || steps.length === 0) return
    appliedOnce.current = false
    setStatuses(steps.map((_, index) => (index === 0 ? 'active' : 'pending')))
    setPercent(0)
    setError('')
    setPhase('running')
    setReloadIn(null)

    let cancelled = false
    const run = async () => {
      for (let index = 0; index < steps.length; index += 1) {
        if (cancelled) return
        setStatuses(prev => prev.map((_, i) => (
          i === index ? 'active' : i < index ? 'done' : 'pending'
        )))
        setPercent(Math.round((index / steps.length) * 100))
        const step = steps[index]
        try {
          if (step.kind === 'apply') {
            if (!appliedOnce.current) {
              appliedOnce.current = true
              await onApplyRef.current(notification.id)
            }
          } else {
            await wait(index === 0 ? 500 : 650)
          }
        } catch (err) {
          if (cancelled) return
          setStatuses(prev => prev.map((_, i) => (
            i === index ? 'error' : i < index ? 'done' : 'pending'
          )))
          setError(err instanceof Error ? err.message : 'Could not apply this update')
          setPhase('failed')
          return
        }
        if (cancelled) return
        setStatuses(prev => prev.map((_, i) => (i <= index ? 'done' : 'pending')))
        setPercent(Math.round(((index + 1) / steps.length) * 100))
      }
      if (cancelled) return
      setPercent(100)
      setPhase('success')
      setReloadIn(4)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [open, notification, steps])

  useEffect(() => {
    if (!open) {
      appliedOnce.current = false
      setReloadIn(null)
    }
  }, [open])

  useEffect(() => {
    if (phase !== 'success' || reloadIn == null) return
    if (reloadIn <= 0) {
      window.location.reload()
      return
    }
    const timer = window.setTimeout(() => setReloadIn(value => (value == null ? value : value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [phase, reloadIn])

  const reloadNow = () => {
    setReloadIn(null)
    window.location.reload()
  }

  const activeIndex = statuses.findIndex(status => status === 'active' || status === 'error')
  const activeStep = activeIndex >= 0 ? steps[activeIndex] : steps[steps.length - 1]
  const dismissible = phase === 'failed'
  const featureCount = steps.filter(step => step.kind === 'feature').length
  const version = notification ? payloadText(notification.payload, 'version') : ''
  const title = phase === 'success'
    ? version ? `Version ${version} applied` : 'Update complete'
    : phase === 'failed'
      ? 'Update failed'
      : version ? `Updating to ${version}` : 'Updating Tradeal'
  const subtitle = phase === 'success'
    ? `${featureCount} ${featureCount === 1 ? 'item' : 'items'} applied to this account`
    : notification?.title || 'Applying this update to your workspace'

  const variant = notification ? announcementVariantFromKind(notification.kind) : 'update'

  return (
    <AnnouncementModalShell
      open={open}
      onClose={dismissible ? onClose : () => undefined}
      dismissible={dismissible}
      variant={variant}
      title={title}
      subtitle={subtitle}
      version={version || undefined}
      maxWidthClass="max-w-2xl"
      footer={
        phase === 'failed' ? (
          <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>
            Close
          </Button>
        ) : phase === 'success' ? (
          <>
            <p className="text-sm text-muted tabular-nums sm:mr-auto">
              {reloadIn == null ? 'Reloading…' : `Reloading in ${reloadIn}s`}
            </p>
            <Button type="button" className="min-h-11 px-8 font-semibold" onClick={reloadNow}>
              Reload now
            </Button>
          </>
        ) : (
          <p className="w-full text-center text-sm text-muted sm:text-left">
            Keep this window open until the update finishes.
          </p>
        )
      }
      footerClassName={phase === 'success' ? 'items-center sm:justify-between' : undefined}
    >
      <div className="space-y-5">
        {phase === 'success' ? (
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-accent" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-heading">All updates applied</p>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                This account now has the features below. Reload Tradeal to start using them.
              </p>
            </div>
          </div>
        ) : null}
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Progress</p>
            <p className="text-sm font-semibold tabular-nums text-heading">{percent}%</p>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="Update progress"
          >
            <div
              className="h-full bg-accent transition-[width] duration-300 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-xs text-muted mt-2" aria-live="polite">
            {phase === 'failed'
              ? error
              : phase === 'success'
                ? 'Finished'
                : activeStep
                  ? `Now: ${activeStep.title}`
                  : 'Preparing update'}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Included in this update</p>
          <ul className="mt-3 space-y-3">
            {steps.map((step, index) => {
              const status = statuses[index] ?? 'pending'
              return (
                <li key={step.id} className="flex items-start gap-3">
                  <span
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                      status === 'done' && 'bg-accent text-white',
                      status === 'active' && 'text-accent',
                      status === 'error' && 'text-danger',
                      status === 'pending' && 'text-muted',
                    )}
                    aria-hidden
                  >
                    {status === 'done' ? <Check className="h-3.5 w-3.5" /> : null}
                    {status === 'active' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {status === 'error' ? <AlertCircle className="h-4 w-4" /> : null}
                    {status === 'pending' ? <Circle className="h-3.5 w-3.5" /> : null}
                  </span>
                  <div className="min-w-0">
                    <p className={cn(
                      'text-sm font-medium text-heading',
                      status === 'pending' && 'text-muted',
                    )}>
                      {step.title}
                    </p>
                    <p className="text-xs text-muted mt-0.5 leading-relaxed">{step.detail}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </AnnouncementModalShell>
  )
}
