import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Check, CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { AnnouncementModalShell } from '../feedback/AnnouncementModalShell'
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
  const appliedOnce = useRef(false)

  useEffect(() => {
    if (!open || !notification || steps.length === 0) return
    appliedOnce.current = false
    setStatuses(steps.map((_, index) => (index === 0 ? 'active' : 'pending')))
    setPercent(0)
    setError('')
    setPhase('running')

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
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [open, notification, steps])

  useEffect(() => {
    if (!open) appliedOnce.current = false
  }, [open])

  const reloadNow = () => {
    window.location.reload()
  }

  const version = notification ? payloadText(notification.payload, 'version') : ''
  const title = phase === 'failed'
    ? 'Update failed'
    : version
      ? `New Tradeal ${version}`
      : 'Product update'

  const dismissible = phase === 'failed' || phase === 'success'

  return (
    <AnnouncementModalShell
      open={open}
      onClose={dismissible ? onClose : () => undefined}
      dismissible={dismissible}
      variant="productUpdate"
      title={title}
      progress={phase === 'running' || phase === 'failed' ? percent : undefined}
      progressTone={phase === 'failed' ? 'danger' : 'accent'}
      status={
        phase === 'success' ? (
          <span className="inline-flex items-center gap-2 text-sm font-medium text-accent">
            <CheckCircle2 className="h-5 w-5" aria-hidden />
            Updates Applied
          </span>
        ) : phase === 'failed' ? (
          <div className="space-y-1 text-center">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-danger">
              <AlertCircle className="h-5 w-5" aria-hidden />
              Could not finish
            </span>
            {error ? (
              <p className="text-xs text-danger" aria-live="polite">{error}</p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm font-medium tabular-nums text-heading/80">
            Updating {percent}%
          </p>
        )
      }
      footer={
        phase === 'failed' ? (
          <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>
            Close
          </Button>
        ) : phase === 'success' ? (
          <Button type="button" className="min-h-11 px-8 font-semibold" onClick={reloadNow}>
            Got it
          </Button>
        ) : (
          <p className="w-full text-center text-sm text-muted sm:text-left">
            Keep this window open until the update finishes.
          </p>
        )
      }
    >
      <div className="space-y-5">
        <div>
          <p className="text-xs font-medium text-muted">Included in this update</p>
          <ul className="relative mt-4 space-y-0">
            {steps.map((step, index) => {
              const status = phase === 'success' ? 'done' : (statuses[index] ?? 'pending')
              const isLast = index === steps.length - 1
              return (
                <li key={step.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {!isLast ? (
                    <span
                      className="absolute left-[9px] top-5 bottom-0 w-px bg-gray-200 dark:bg-gray-700"
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={cn(
                      'relative z-[1] mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full',
                      status === 'done' && 'bg-accent text-white',
                      status === 'active' && 'bg-accent/15 text-accent',
                      status === 'error' && 'bg-danger/15 text-danger',
                      status === 'pending' && 'bg-gray-100 text-muted dark:bg-gray-800',
                    )}
                    aria-hidden
                  >
                    {status === 'done' ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                    {status === 'active' ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    {status === 'error' ? <AlertCircle className="h-3 w-3" /> : null}
                    {status === 'pending' ? <Circle className="h-2.5 w-2.5" /> : null}
                  </span>
                  <div className="min-w-0 pt-px">
                    <p className={cn('text-sm font-semibold text-heading', status === 'pending' && 'text-muted')}>
                      {step.title}
                    </p>
                    {step.detail ? (
                      <p className="mt-0.5 text-sm leading-relaxed text-muted">{step.detail}</p>
                    ) : null}
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
