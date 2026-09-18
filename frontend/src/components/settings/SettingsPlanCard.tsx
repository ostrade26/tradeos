import { Fragment, type ReactNode } from 'react'
import type { OrganisationDetailResponse, OrganisationLicence, OrganisationSubscription } from '../../api/platformApi'
import { formatInrCents } from '../../lib/platformLabels'
import { formatDate } from '../../lib/utils'
import { Badge } from '../ui/Badge'

function subscriptionStatusVariant(status: string): 'success' | 'warning' | 'default' {
  if (status === 'active' || status === 'trial') return 'success'
  if (
    status === 'past_due' ||
    status === 'due_soon' ||
    status === 'grace_period' ||
    status === 'suspended' ||
    status === 'cancelled'
  ) {
    return 'warning'
  }
  return 'default'
}

function Fact({ label, value }: { label: string; value: string }) {
  if (!value || value === '—') return null
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-heading leading-snug">{value}</p>
    </div>
  )
}

function seatsLabel(count: number): string {
  return `${count} ${count === 1 ? 'Seat' : 'Seats'}`
}

function planFacts(sub: OrganisationSubscription | null, licence: OrganisationLicence | null) {
  const adminSeats = licence?.included_admin_seats ?? sub?.plan_included_admin_seats ?? 0
  const operatorSeats = licence?.included_operator_seats ?? sub?.plan_included_operator_seats ?? 0
  const duration = licence?.amc_duration_months ?? sub?.plan_amc_duration_months ?? 12
  const graceDays = licence?.amc_grace_days ?? sub?.plan_amc_grace_days ?? 0
  const extraLicence = formatInrCents(licence?.additional_seat_licence_cents ?? sub?.plan_additional_seat_licence_cents)
  const extraAmc = formatInrCents(licence?.additional_seat_amc_cents ?? sub?.plan_additional_seat_amc_cents)
  const amc = formatInrCents(licence?.amc_price_cents ?? sub?.plan_amc_price_cents)

  return {
    name: sub?.plan_name?.trim() || licence?.plan_name?.trim() || 'Plan',
    description: sub?.plan_description?.trim() || '',
    licenceAmount: formatInrCents(licence?.licence_price_cents ?? sub?.plan_licence_price_cents),
    amcDisplay: amc === '—' ? '—' : `${amc} / ${duration} mo`,
    adminSeats,
    operatorSeats,
    totalSeats: adminSeats + operatorSeats,
    extraLicence,
    extraAmc: extraAmc === '—' ? '—' : `${extraAmc} / year`,
    graceDisplay: graceDays > 0 ? `${graceDays} days` : '—',
  }
}

export function SettingsPlanCard({
  detail,
  headerAction,
}: {
  detail: OrganisationDetailResponse
  headerAction?: ReactNode
}) {
  const org = detail.organisation
  const sub = detail.subscription
  const licence = detail.licence ?? null
  const amc = detail.amc ?? null

  if (!sub && !licence) {
    return (
      <div className="rounded-md bg-card p-6 sm:p-7 shadow-[var(--shadow-card)]">
        <p className="text-sm font-medium text-heading">{org.name}</p>
        <p className="text-sm text-muted mt-2">No active plan on this organisation.</p>
      </div>
    )
  }

  const facts = planFacts(sub, licence)
  const memberSince = licence?.activation_date || licence?.purchase_date || sub?.start_date
  const renewal = amc?.renewal_date || amc?.end_date || sub?.renewal_date
  const status = licence?.status || sub?.status || 'active'
  const licenceNumber = licence?.licence_number?.trim() || ''

  return (
    <article className="overflow-hidden rounded-md bg-card shadow-[var(--shadow-card)]">
      <div className="p-6 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight text-heading">{facts.name}</h2>
              <Badge variant={subscriptionStatusVariant(String(status))} className="capitalize">
                {String(status).replace(/_/g, ' ')}
              </Badge>
            </div>
            {licenceNumber ? (
              <p className="mt-1 text-xs font-mono tabular-nums text-muted leading-none">{licenceNumber}</p>
            ) : null}
          </div>
          {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
        </div>

        {facts.description ? (
          <p className="mt-3 text-sm leading-relaxed text-muted line-clamp-2">{facts.description}</p>
        ) : null}

        <div className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-x-12 gap-y-5 sm:grid-cols-4">
            <Fact label="Licence" value={facts.licenceAmount} />
            <Fact label="AMC" value={facts.amcDisplay} />
            <Fact label="Extra seat licence" value={facts.extraLicence} />
            <Fact label="Extra seat AMC" value={facts.extraAmc} />
          </div>

          <div className="flex flex-wrap items-stretch">
            {(
              [
                { label: 'Total', value: seatsLabel(facts.totalSeats) },
                { label: 'Admin', value: seatsLabel(facts.adminSeats) },
                { label: 'Operator', value: seatsLabel(facts.operatorSeats) },
                { label: 'AMC grace', value: facts.graceDisplay },
              ] as const
            ).map((item, index) => (
              <Fragment key={item.label}>
                {index > 0 ? (
                  <span
                    className="mx-10 w-px shrink-0 self-stretch bg-gray-200 dark:bg-gray-700"
                    aria-hidden
                  />
                ) : null}
                <div className="min-w-0 shrink-0">
                  <p className="text-xs text-muted">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-heading leading-snug">
                    {item.value}
                  </p>
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      {(memberSince || renewal) ? (
        <div className="flex flex-wrap gap-x-8 gap-y-2 border-t border-gray-200 bg-gray-100/90 px-6 py-3.5 text-xs tabular-nums sm:px-7 dark:border-gray-700 dark:bg-gray-800/50">
          {memberSince ? (
            <p className="text-muted">
              Active since{' '}
              <span className="font-medium text-heading">{formatDate(memberSince)}</span>
            </p>
          ) : null}
          {renewal ? (
            <p className="text-muted">
              {amc ? 'AMC until' : 'Renewal'}{' '}
              <span className="font-medium text-heading">{formatDate(renewal)}</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
