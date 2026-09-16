import { useState, type ReactNode } from 'react'
import { CalendarDays, Check, UserPlus } from 'lucide-react'
import type { OrganisationDetailResponse } from '../../api/platformApi'
import type { OrganisationSeatRequestContext } from '../../api/organisationApi'
import { LicensedSeatTag } from './LicensedSeatTag'
import { SettingsAddSeatsModal } from './SettingsAddSeatsModal'
import { SettingsTeamRedirectSuccessModal } from './SettingsTeamRedirectSuccessModal'
import { planFeaturesForSlug } from '../../lib/planFeatures'
import { formatDate } from '../../lib/utils'
import { useToast } from '../../hooks/useToast'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'

function isStarterSubscription(planSlug: string | undefined, planName: string | undefined): boolean {
  const slug = planSlug?.trim().toLowerCase()
  const name = planName?.trim().toLowerCase()
  return slug === 'starter' || name === 'starter'
}

function subscriptionStatusVariant(status: string): 'success' | 'warning' | 'default' {
  if (status === 'active' || status === 'trial') return 'success'
  if (status === 'past_due') return 'warning'
  return 'default'
}

function PlanSection({
  title,
  children,
  className,
  onBlueCard,
}: {
  title: string
  children: ReactNode
  className?: string
  onBlueCard?: boolean
}) {
  return (
    <section className={className}>
      <h3
        className={cn(
          'text-xs font-medium uppercase tracking-wide mb-2',
          onBlueCard ? 'text-white/65' : 'text-muted',
        )}
      >
        {title}
      </h3>
      {children}
    </section>
  )
}

export function SettingsPlanCard({
  detail,
  canRequestSeats = false,
  seatRequestCtx = null,
  seatRequestLoading = false,
  onSeatsChanged,
}: {
  detail: OrganisationDetailResponse
  canRequestSeats?: boolean
  seatRequestCtx?: OrganisationSeatRequestContext | null
  seatRequestLoading?: boolean
  onSeatsChanged?: () => void
}) {
  const toast = useToast()
  const [copiedSeatId, setCopiedSeatId] = useState<number | null>(null)
  const [addSeatOpen, setAddSeatOpen] = useState(false)
  const [seatRequestSuccessOpen, setSeatRequestSuccessOpen] = useState(false)
  const org = detail.organisation
  const sub = detail.subscription
  const inventory = (detail.seat_inventory ?? []).filter(seat => seat.assigned_user_id != null)
  const planLicensedSeats = inventory.filter(seat => seat.seat_type === 'organisation_admin')
  const teamSeats = inventory.filter(
    seat => seat.seat_type === 'operator' || seat.seat_type === 'view_only',
  )
  const availableSeats = detail.seats?.available_seats ?? 0
  const addonUnitPrice = seatRequestCtx?.addon_seat_unit_price_cents ?? 0
  const showAddSeatCta =
    canRequestSeats &&
    !seatRequestLoading &&
    Boolean(seatRequestCtx?.subscription) &&
    addonUnitPrice > 0

  const copySeatLabel = async (seatId: number, label: string) => {
    try {
      await navigator.clipboard.writeText(label)
      setCopiedSeatId(seatId)
      toast.success('Seat ID copied')
      window.setTimeout(() => setCopiedSeatId(current => (current === seatId ? null : current)), 2000)
    } catch {
      toast.error('Could not copy seat ID')
    }
  }

  if (!sub) {
    return (
      <div className="rounded-xl border border-gray-200 bg-card p-6 shadow-[var(--shadow-card)] dark:border-gray-700">
        <p className="text-sm font-medium text-heading">{org.name}</p>
        <p className="text-sm text-muted mt-2">No active subscription on this organisation.</p>
      </div>
    )
  }

  const cycleLabel = sub.billing_cycle === 'monthly' ? 'Monthly' : 'Yearly'
  const memberSince = sub.start_date ? formatDate(sub.start_date) : null
  const renewal = sub.renewal_date ? formatDate(sub.renewal_date) : null
  const description = sub.plan_description?.trim() ?? ''
  const features = planFeaturesForSlug(sub.plan_slug)
  const isStarterPlan = isStarterSubscription(sub.plan_slug, sub.plan_name)

  return (
    <>
    <article
      className={cn(
        'overflow-hidden rounded-xl border shadow-[var(--shadow-card)]',
        isStarterPlan
          ? 'border-accent/35 bg-accent text-white dark:border-accent/45 dark:bg-[#3553b8]'
          : 'border-gray-200 bg-card dark:border-gray-700',
      )}
    >
      <header
        className={cn(
          'border-b px-6 py-4 sm:px-7',
          isStarterPlan ? 'border-white/15' : 'border-gray-200/90 dark:border-gray-700/80',
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0 flex-1">
            <h2
              className={cn(
                'text-lg font-semibold tracking-tight',
                isStarterPlan ? 'text-white' : 'text-heading',
              )}
            >
              {sub.plan_name}
            </h2>
            {description && (
              <p
                className={cn(
                  'max-w-xl text-sm leading-snug',
                  isStarterPlan ? 'text-white/80' : 'text-muted',
                )}
              >
                {description}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Badge
              variant="default"
              className={cn(
                isStarterPlan &&
                  '!border !border-white/35 !bg-white/22 !text-white dark:!bg-white/18 dark:!text-white',
              )}
            >
              {cycleLabel}
            </Badge>
            <Badge
              variant={subscriptionStatusVariant(sub.status)}
              className={cn(
                'capitalize',
                isStarterPlan &&
                  '!border !border-white/35 !bg-white/22 !text-white dark:!bg-white/18 dark:!text-white',
              )}
            >
              {sub.status.replace(/_/g, ' ')}
            </Badge>
          </div>
        </div>
      </header>

      <div className="px-6 py-6 sm:px-7 sm:py-7 space-y-5">
        {(memberSince || renewal) && (
          <div className="flex flex-wrap gap-6 sm:gap-10">
            {memberSince && (
              <div>
                <p
                  className={cn(
                    'text-xs font-medium uppercase tracking-wide',
                    isStarterPlan ? 'text-white/65' : 'text-muted',
                  )}
                >
                  Active since
                </p>
                <p
                  className={cn(
                    'mt-1 inline-flex items-center gap-2 text-sm font-semibold tabular-nums',
                    isStarterPlan ? 'text-white' : 'text-heading',
                  )}
                >
                  <CalendarDays
                    className={cn('h-4 w-4 shrink-0', isStarterPlan ? 'text-white/85' : 'text-accent')}
                    aria-hidden
                  />
                  {memberSince}
                </p>
              </div>
            )}
            {renewal && (
              <div>
                <p
                  className={cn(
                    'text-xs font-medium uppercase tracking-wide',
                    isStarterPlan ? 'text-white/65' : 'text-muted',
                  )}
                >
                  Renewal
                </p>
                <p
                  className={cn(
                    'mt-1 inline-flex items-center gap-2 text-sm font-semibold tabular-nums',
                    isStarterPlan ? 'text-white' : 'text-heading',
                  )}
                >
                  <CalendarDays
                    className={cn('h-4 w-4 shrink-0', isStarterPlan ? 'text-white/85' : 'text-accent')}
                    aria-hidden
                  />
                  {renewal}
                </p>
              </div>
            )}
          </div>
        )}

        {features.length > 0 && (
          <PlanSection title="Features" onBlueCard={isStarterPlan}>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {features.map(line => (
                <li
                  key={line}
                  className={cn('flex items-start gap-2.5 text-sm', isStarterPlan ? 'text-white' : 'text-heading')}
                >
                  <Check
                    className={cn('h-4 w-4 shrink-0 mt-0.5', isStarterPlan ? 'text-white/90' : 'text-accent')}
                    aria-hidden
                  />
                  <span className="leading-snug">{line}</span>
                </li>
              ))}
            </ul>
          </PlanSection>
        )}

        {(planLicensedSeats.length > 0 || teamSeats.length > 0 || availableSeats > 0 || showAddSeatCta) && (
          <PlanSection title="Licensed seats in use" onBlueCard={isStarterPlan}>
            <div className="flex flex-wrap items-center gap-2">
              {[...planLicensedSeats, ...teamSeats].map(seat => (
                <LicensedSeatTag
                  key={seat.id}
                  seat={seat}
                  copied={copiedSeatId === seat.id}
                  tone={isStarterPlan ? 'onBlue' : 'default'}
                  onCopy={() => void copySeatLabel(seat.id, seat.seat_label)}
                />
              ))}
              {showAddSeatCta && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn(
                    'ml-auto shrink-0 text-sm border-white bg-white text-accent shadow-sm',
                    'hover:bg-white hover:text-accent hover:border-white',
                    'dark:border-white dark:bg-white dark:text-accent dark:hover:bg-white/95',
                  )}
                  onClick={() => setAddSeatOpen(true)}
                >
                  <UserPlus className="h-4 w-4" aria-hidden />
                  Add seat
                </Button>
              )}
            </div>
            {availableSeats > 0 && (
              <p
                className={cn(
                  'text-xs mt-3 leading-relaxed',
                  isStarterPlan ? 'text-white/75' : 'text-muted',
                )}
              >
                {availableSeats} unassigned seat{availableSeats === 1 ? '' : 's'} in your pool — assign them when you add team members.
              </p>
            )}
          </PlanSection>
        )}
      </div>
    </article>

    <SettingsAddSeatsModal
      open={addSeatOpen}
      onClose={() => setAddSeatOpen(false)}
      canRequest={canRequestSeats}
      ctx={seatRequestCtx}
      loading={seatRequestLoading}
      onSeatsChanged={onSeatsChanged}
      onRequestSuccess={() => setSeatRequestSuccessOpen(true)}
    />
    <SettingsTeamRedirectSuccessModal
      open={seatRequestSuccessOpen}
      onClose={() => setSeatRequestSuccessOpen(false)}
      title="Seat request sent"
      description="After Tradeal approves your request and the seat is active, add licensed users on Team and share their sign-in details."
    />
    </>
  )
}
