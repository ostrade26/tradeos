import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Building2,
  Check,
  Loader2,
  Moon,
  Sun,
} from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { cn } from '../../lib/utils'
import type { AuthSession } from '../../lib/auth'
import { roleLabel } from '../../lib/auth'
import { accountTypeLabel } from '../../lib/platformLabels'
import { lockBodyScroll, unlockBodyScroll } from '../../lib/bodyScrollLock'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../hooks/useAuth'
import { ACCENT_PRESETS } from '../../lib/accentColor'
import { authApi } from '../../api/tradeApi'
import { sessionFromApi } from '../../lib/authSession'
import { flushPersistPreferences } from '../../hooks/usePersistUserPreferences'

const PROVISION_MIN_MS = 5000

type Phase = 'steps' | 'provisioning'
type StepId = 'profile' | 'appearance' | 'review'

const STEPS: { id: StepId; label: string; description: string }[] = [
  { id: 'profile', label: 'Your profile', description: 'How you appear in the workspace' },
  { id: 'appearance', label: 'Look & feel', description: 'Theme and brand colour' },
  { id: 'review', label: 'Review', description: 'Confirm and finish' },
]

interface Props {
  open: boolean
  session: AuthSession
  onComplete: () => void
}

function SetupStepper({
  stepIndex,
  orgName,
  phase,
}: {
  stepIndex: number
  orgName: string
  phase: Phase
}) {
  const activeIndex = phase === 'provisioning' ? STEPS.length : stepIndex

  return (
    <div className="flex w-full max-w-md flex-col items-center text-center lg:items-stretch lg:text-left">
      <div className="flex flex-col items-center lg:items-start">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white shadow-sm">
          T
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted">Account setup</p>
        <h2 className="text-lg font-semibold text-heading mt-1 leading-snug">{orgName}</h2>
        <p className="text-sm text-muted mt-2 leading-relaxed max-w-sm">
          A few choices now so your desk feels right from day one.
        </p>
      </div>
      <nav className="mt-10 w-full" aria-label="Setup progress">
        <ol className="space-y-2">
          {STEPS.map((step, i) => {
            const done = i < activeIndex
            const active = i === activeIndex && phase === 'steps'
            return (
              <li key={step.id}>
                <div
                  className={cn(
                    'flex gap-3 rounded-lg px-4 py-3 transition-colors',
                    active && 'bg-white/90 shadow-sm ring-1 ring-accent/15 dark:bg-gray-900/50 dark:ring-accent/25',
                    !active && !done && 'opacity-80',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                      done && 'bg-accent text-white',
                      active && !done && 'border-2 border-accent text-accent',
                      !active && !done && 'border border-gray-300 text-muted dark:border-gray-600',
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
                  </div>
                  <div className="min-w-0 pt-0.5 text-left">
                    <p className={cn('text-sm font-medium', active || done ? 'text-heading' : 'text-muted')}>
                      {step.label}
                    </p>
                    <p className="text-xs text-muted mt-0.5 leading-snug">{step.description}</p>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </nav>
    </div>
  )
}

export function AccountSetupWelcome({ open, session, onComplete }: Props) {
  const { applySession } = useAuth()
  const { theme, setTheme, accentId, setAccentId, accentPreset, customHex } = useTheme()

  const orgName = session.organisationName?.trim() || 'Your organisation'
  const account = accountTypeLabel(session.accountType)
  const role = roleLabel(session)

  const [stepIndex, setStepIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('steps')
  const [displayName, setDisplayName] = useState(session.name?.trim() || '')
  const [phone, setPhone] = useState(session.phone?.trim() || '')
  const [provisionPct, setProvisionPct] = useState(0)
  const [provisionLabel, setProvisionLabel] = useState('Saving your profile…')

  useEffect(() => {
    if (!open) {
      setStepIndex(0)
      setPhase('steps')
      setProvisionPct(0)
      setDisplayName(session.name?.trim() || '')
      setPhone(session.phone?.trim() || '')
      return
    }
    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [open, session.name, session.phone])

  const stepId = STEPS[stepIndex]?.id
  const canContinueProfile = displayName.trim().length >= 2

  const runProvisioning = useCallback(async () => {
    const start = performance.now()
    const bump = (label: string, pct: number) => {
      setProvisionLabel(label)
      setProvisionPct(pct)
    }

    bump('Saving your profile…', 12)
    await flushPersistPreferences()
    try {
      const profileMe = await authApi.updateProfile({
        name: displayName.trim(),
        phone: phone.trim() || undefined,
      })
      if (session.token) {
        applySession(sessionFromApi(profileMe, session.token))
      }
    } catch {
      /* still apply appearance prefs */
    }

    bump('Applying theme…', 45)
    try {
      const prefsMe = await authApi.updatePreferences({
        theme,
        accentId,
        customHex,
      })
      if (session.token) {
        applySession(sessionFromApi(prefsMe, session.token))
      }
    } catch {
      /* local prefs remain; completion still marks welcome done */
    }

    bump('Preparing your account…', 78)
    while (performance.now() - start < PROVISION_MIN_MS) {
      await new Promise(r => setTimeout(r, 120))
    }
    bump('Ready', 100)
    await new Promise(r => setTimeout(r, 280))
    onComplete()
  }, [
    accentId,
    applySession,
    customHex,
    displayName,
    onComplete,
    phone,
    session.token,
    theme,
  ])

  const provisionStartedRef = useRef(false)
  useEffect(() => {
    if (!open || phase !== 'provisioning') {
      provisionStartedRef.current = false
      return
    }
    if (provisionStartedRef.current) return
    provisionStartedRef.current = true
    void runProvisioning()
  }, [open, phase, runProvisioning])

  if (!open) return null

  const goNext = () => {
    if (stepIndex >= STEPS.length - 1) {
      setPhase('provisioning')
      return
    }
    setStepIndex(i => i + 1)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[5000] flex flex-col bg-body"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-setup-title"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20"
        aria-hidden
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, var(--color-accent-muted, rgba(62,96,213,0.12)) 0%, transparent 45%), radial-gradient(circle at 80% 0%, rgba(148,163,184,0.15) 0%, transparent 40%)',
        }}
      />

      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="account-setup-panel-left flex flex-1 min-h-0 items-center justify-center border-b border-gray-200/90 px-6 py-8 dark:border-gray-800 lg:border-b-0 lg:border-r lg:w-1/2">
          <SetupStepper stepIndex={stepIndex} orgName={orgName} phase={phase} />
        </aside>

        <div className="flex flex-1 min-h-0 lg:w-1/2 items-center justify-center overflow-y-auto bg-white px-6 py-8 sm:px-10 dark:bg-gray-950">
          <div className="w-full max-w-lg">
            {phase === 'steps' ? (
              <div className="w-full">
                {stepId === 'profile' ? (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wider text-accent">Step 1</p>
                    <h1 id="account-setup-title" className="text-2xl font-semibold text-heading mt-2 tracking-tight">
                      Introduce yourself
                    </h1>
                    <p className="text-sm text-muted mt-2 leading-relaxed">
                      You are joining <span className="font-medium text-heading">{orgName}</span> as{' '}
                      <span className="font-medium text-heading">{role}</span> ({account}).
                    </p>
                    <div className="mt-8 space-y-4">
                      <Input
                        label="Display name"
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        placeholder="Your full name"
                        autoFocus
                      />
                      <Input
                        label="Phone (optional)"
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="For delivery coordination"
                      />
                      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50/80 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/40">
                        <Building2 className="h-4 w-4 text-accent shrink-0" aria-hidden />
                        <div className="min-w-0 text-sm">
                          <p className="text-muted">Sign-in ID</p>
                          <p className="font-medium text-heading truncate">{session.username}</p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}

                {stepId === 'appearance' ? (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wider text-accent">Step 2</p>
                    <h1 className="text-2xl font-semibold text-heading mt-2 tracking-tight">Make Tradeal yours</h1>
                    <p className="text-sm text-muted mt-2 leading-relaxed">
                      Choose a theme and primary colour — applied instantly across the app.
                    </p>
                    <div className="mt-8 space-y-6">
                      <div>
                        <p className="text-sm font-medium text-heading mb-3">Theme</p>
                        <div className="grid grid-cols-2 gap-3">
                          {(
                            [
                              { id: 'light' as const, label: 'Light', icon: Sun, preview: 'bg-white border-gray-200' },
                              { id: 'dark' as const, label: 'Dark', icon: Moon, preview: 'bg-gray-900 border-gray-700' },
                            ] as const
                          ).map(opt => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setTheme(opt.id)}
                              className={cn(
                                'rounded-lg border p-4 text-left transition-all cursor-pointer attex-focus',
                                theme === opt.id
                                  ? 'border-accent ring-2 ring-accent/30'
                                  : 'border-gray-200 hover:border-gray-300 dark:border-gray-700',
                              )}
                            >
                              <div
                                className={cn(
                                  'mb-3 h-14 rounded-md border flex items-end p-2 gap-1',
                                  opt.preview,
                                )}
                              >
                                <div className="h-2 w-8 rounded bg-accent/80" />
                                <div className="h-2 flex-1 rounded bg-gray-200 dark:bg-gray-600" />
                              </div>
                              <div className="flex items-center gap-2">
                                <opt.icon className="h-4 w-4 text-muted" aria-hidden />
                                <span className="text-sm font-medium text-heading">{opt.label}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-heading mb-3">Primary colour</p>
                        <div className="flex flex-wrap gap-2">
                          {ACCENT_PRESETS.map(preset => (
                            <button
                              key={preset.id}
                              type="button"
                              title={preset.label}
                              onClick={() => setAccentId(preset.id)}
                              className={cn(
                                'h-10 w-10 rounded-full border-2 transition-transform cursor-pointer attex-focus',
                                accentId === preset.id
                                  ? 'border-heading scale-110'
                                  : 'border-transparent hover:scale-105',
                              )}
                              style={{ backgroundColor: preset.accent }}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-muted mt-2">Selected · {accentPreset.label}</p>
                      </div>
                    </div>
                  </>
                ) : null}

                {stepId === 'review' ? (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wider text-accent">Step 3</p>
                    <h1 className="text-2xl font-semibold text-heading mt-2 tracking-tight">Review & finish</h1>
                    <p className="text-sm text-muted mt-2 leading-relaxed">
                      We will save these settings and prepare your account.
                    </p>
                    <dl className="mt-8 divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
                      {[
                        { label: 'Profile', value: `${displayName.trim()}${phone.trim() ? ` · ${phone.trim()}` : ''}` },
                        { label: 'Organisation', value: `${orgName} · ${role}` },
                        { label: 'Appearance', value: `${theme === 'dark' ? 'Dark' : 'Light'} theme · ${accentPreset.label}` },
                      ].map(row => (
                        <div key={row.label} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <dt className="text-xs font-medium uppercase tracking-wide text-muted">{row.label}</dt>
                          <dd className="text-sm font-medium text-heading text-left sm:text-right">{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                ) : null}

                <div className="mt-10 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-gray-200 pt-6 dark:border-gray-800">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(stepIndex === 0 && 'invisible pointer-events-none')}
                    onClick={() => setStepIndex(i => Math.max(0, i - 1))}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    size="md"
                    className="w-full sm:w-auto min-w-[10rem]"
                    disabled={stepId === 'profile' && !canContinueProfile}
                    onClick={goNext}
                  >
                    {stepId === 'review' ? 'Set up my account' : 'Continue'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="w-full text-center">
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-accent" aria-hidden />
                <h2 className="text-xl font-semibold text-heading mt-6">Setting up your account</h2>
                <p className="text-sm text-muted mt-2">{provisionLabel}</p>
                <div className="mt-8 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
                    style={{ width: `${provisionPct}%` }}
                  />
                </div>
                <p className="text-xs text-muted mt-3 tabular-nums">{Math.round(provisionPct)}%</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`
        /* Subtle primary tint: accent mixed into white (readable, works with any user primary). */
        .account-setup-panel-left {
          background: linear-gradient(
            165deg,
            #ffffff 0%,
            color-mix(in srgb, var(--color-accent) 7%, white) 42%,
            color-mix(in srgb, var(--color-accent) 14%, white) 100%
          );
        }
        html.dark .account-setup-panel-left {
          background: linear-gradient(
            165deg,
            color-mix(in srgb, var(--color-accent) 4%, #0f172a) 0%,
            color-mix(in srgb, var(--color-accent) 10%, #111827) 55%,
            color-mix(in srgb, var(--color-accent) 16%, #0f172a) 100%
          );
        }
      `}</style>
    </div>,
    document.body,
  )
}
