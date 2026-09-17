import { useState } from 'react'
import { CalendarDays, UserPlus } from 'lucide-react'
import type { OrganisationDetailResponse, OrganisationLicence, OrganisationSubscription } from '../../api/platformApi'
import type { OrganisationSeatRequestContext } from '../../api/organisationApi'
import { LicensedSeatTag } from './LicensedSeatTag'
import { SettingsAddSeatsModal } from './SettingsAddSeatsModal'
import { SettingsTeamRedirectSuccessModal } from './SettingsTeamRedirectSuccessModal'
import { formatInrCents } from '../../lib/platformLabels'
import { formatDate } from '../../lib/utils'
import { useToast } from '../../hooks/useToast'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'

function subscriptionStatusVariant(status: string): 'success' | 'warning' | 'default' {
  if (status === 'active' || status === 'trial') return 'success'
  if (status === 'past_due' || status === 'due_soon' || status === 'grace_period') return 'warning'
  return 'default'
}

function licenceTypeLabel(type: string | undefined): string {
  if (type === 'term') return 'Term'
  return 'Perpetual'
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-heading leading-snug">{value}</p>
    </div>
  )
}

function planFacts(sub: OrganisationSubscription | null, licence: OrganisationLicence | null) {
  const adminSeats = licence?.included_admin_seats ?? sub?.plan_included_admin_seats ?? 0
  const operatorSeats = licence?.included_operator_seats ?? sub?.plan_included_operator_seats ?? 0
  const includedSeats = adminSeats + operatorSeats
  const duration = licence?.amc_duration_months ?? sub?.plan_amc_duration_months ?? 12
  const grace = licence?.amc_grace_days ?? sub?.plan_amc_grace_days ?? 0
  const extraLicence = formatInrCents(licence?.additional_seat_licence_cents ?? sub?.plan_additional_seat_licence_cents)
  const extraAmc = formatInrCents(licence?.additional_seat_amc_cents ?? sub?.plan_additional_seat_amc_cents)
  const amc = formatInrCents(licence?.amc_price_cents ?? sub?.plan_amc_price_cents)

  return {
    name: sub?.plan_name?.trim() || licence?.plan_name?.trim() || 'Plan',
    description: sub?.plan_description?.trim() || '',
    type: licenceTypeLabel(licence?.licence_type ?? sub?.plan_licence_type),
    licenceAmount: formatInrCents(licence?.licence_price_cents ?? sub?.plan_licence_price_cents),
    amc: amc === '—' ? '—' : `${amc} / ${duration} mo`,
    seats: `${includedSeats} total · ${adminSeats} admin · ${operatorSeats} operator`,
    extraLicence,
    extraAmc: extraAmc === '—' ? '—' : `${extraAmc} / year`,
    grace: `${grace} days`,
  }
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
  const licence = detail.licence ?? null
  const amc = detail.amc ?? null
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

  if (!sub && !licence) {
    return (
      <div className="rounded-xl border border-gray-200 bg-card p-6 shadow-[var(--shadow-card)] dark:border-gray-700">
        <p className="text-sm font-medium text-heading">{org.name}</p>
        <p className="text-sm text-muted mt-2">No active plan on this organisation.</p>
      </div>
    )
  }

  const facts = planFacts(sub, licence)
  const memberSince = licence?.activation_date || licence?.purchase_date || sub?.start_date
  const renewal = amc?.renewal_date || amc?.end_date || sub?.renewal_date
  const status = licence?.status || sub?.status || 'active'

  return (
    <>
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-card shadow-[var(--shadow-card)] dark:border-gray-700">
      <header className="border-b border-gray-200/90 dark:border-gray-700/80 px-6 py-4 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-tight text-heading">{facts.name}</h2>
            {licence?.licence_number ? (
              <p className="text-xs font-mono tabular-nums text-muted mt-0.5">{licence.licence_number}</p>
            ) : null}
            {facts.description ? (
              <p className="max-w-xl text-sm leading-relaxed text-muted mt-2">{facts.description}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Badge variant="default">{facts.type}</Badge>
            <Badge variant={subscriptionStatusVariant(String(status))} className="capitalize">
              {String(status).replace(/_/g, ' ')}
            </Badge>
          </div>
        </div>
      </header>

      <div className="px-6 py-6 sm:px-7 sm:py-7 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          <Fact label="One-time licence" value={facts.licenceAmount} />
          <Fact label="AMC" value={facts.amc} />
          <Fact label="Included seats" value={facts.seats} />
          <Fact label="Extra seat licence" value={facts.extraLicence} />
          <Fact label="Extra seat AMC" value={facts.extraAmc} />
          <Fact label="AMC grace" value={facts.grace} />
        </div>

        {(memberSince || renewal) && (
          <div className="flex flex-wrap gap-6 sm:gap-10">
            {memberSince && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Active since</p>
                <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold tabular-nums text-heading">
                  <CalendarDays className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                  {formatDate(memberSince)}
                </p>
              </div>
            )}
            {renewal && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  {amc ? 'AMC until' : 'Renewal'}
                </p>
                <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold tabular-nums text-heading">
                  <CalendarDays className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                  {formatDate(renewal)}
                </p>
              </div>
            )}
          </div>
        )}

        {(planLicensedSeats.length > 0 || teamSeats.length > 0 || availableSeats > 0 || showAddSeatCta) && (
          <section>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted mb-2">Licensed seats in use</h3>
            <div className="flex flex-wrap items-center gap-2">
              {[...planLicensedSeats, ...teamSeats].map(seat => (
                <LicensedSeatTag
                  key={seat.id}
                  seat={seat}
                  copied={copiedSeatId === seat.id}
                  onCopy={() => void copySeatLabel(seat.id, seat.seat_label)}
                />
              ))}
              {showAddSeatCta && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="ml-auto shrink-0 text-sm"
                  onClick={() => setAddSeatOpen(true)}
                >
                  <UserPlus className="h-4 w-4" aria-hidden />
                  Add seat
                </Button>
              )}
            </div>
            {availableSeats > 0 && (
              <p className="text-xs text-muted mt-3 leading-relaxed">
                {availableSeats} unassigned seat{availableSeats === 1 ? '' : 's'} in your pool — assign them when you add team members.
              </p>
            )}
          </section>
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
