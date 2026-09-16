import { Building2, CreditCard, KeyRound, Shield, User, Users, Wallet } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import type { OrganisationDetailResponse } from '../../api/platformApi'
import { accountTypeLabel, formatInrCents, seatTypeLabel } from '../../lib/platformLabels'
import { formatDate, formatDateRange } from '../../lib/utils'
import { platformStatusBadge } from './platformAdminRegisterColumns'
import {
  DetailGroup,
  DetailInlineStat,
  DetailInlineStatRow,
  DetailPanelBody,
  DetailRow,
  DetailStat,
  DetailStatGrid,
} from '../registers/DetailPanelSections'

function hasText(value: string | null | undefined): value is string {
  return Boolean(value?.trim())
}

function money(cents: number | null | undefined): string {
  if (cents == null) return '—'
  if (cents === 0) return '₹0'
  return formatInrCents(cents)
}

export function OrganisationSubscriptionPanel({
  detail,
  showOrgProfile = true,
  onResetPrimaryAdminSignIn,
  resettingPrimaryAdminSignIn,
}: {
  detail: OrganisationDetailResponse
  showOrgProfile?: boolean
  onResetPrimaryAdminSignIn?: () => void
  resettingPrimaryAdminSignIn?: boolean
}) {
  const org = detail.organisation
  const licence = detail.licence
  const amc = detail.amc
  const seats = detail.seats
  const billing = detail.billing

  const addressParts = [org.business_address, org.city, org.state, org.pincode].filter(hasText)
  const addressLine = addressParts.length > 0 ? addressParts.join(', ') : null

  const included = seats?.included_seats ?? licence?.included_seats ?? 0
  const additional = seats?.purchased_additional_seats ?? licence?.purchased_additional_seats ?? 0
  const totalSeats = seats?.total_entitled_seats ?? included + additional
  const assignedCount = seats?.active_assigned_seats ?? 0
  const availableCount = seats?.available_seats ?? 0
  const assignedSeats = (detail.seat_inventory ?? []).filter(s => s.assigned_user_id != null)

  const amcAmount = amc?.included ? 'Included' : money(amc?.amc_price_cents)
  const nextRenewal = amc?.renewal_date || amc?.end_date

  return (
    <DetailPanelBody>
      {showOrgProfile && (
        <>
          <DetailGroup title="Organisation" icon={Building2}>
            <p className="text-sm font-semibold text-heading leading-snug">
              {hasText(org.legal_name) && org.legal_name !== org.name ? org.legal_name : org.name}
            </p>
            <p className="text-xs text-muted mt-1">{accountTypeLabel(org.account_type)}</p>
            {addressLine ? (
              <p className="text-sm text-heading mt-3 leading-snug">{addressLine}</p>
            ) : null}
            {hasText(org.country) && org.country !== 'India' ? (
              <p className="text-xs text-muted mt-1">{org.country}</p>
            ) : null}
            {(hasText(org.gstin) || hasText(org.pan)) && (
              <div className="mt-4">
                <DetailInlineStatRow>
                  {hasText(org.gstin) ? <DetailInlineStat label="GSTIN" value={org.gstin} /> : null}
                  {hasText(org.pan) ? <DetailInlineStat label="PAN" value={org.pan} /> : null}
                </DetailInlineStatRow>
              </div>
            )}
          </DetailGroup>

          <DetailGroup title="Primary admin" icon={User}>
            <p className="text-sm font-semibold text-heading leading-snug">
              {org.primary_contact_name?.trim() || '—'}
            </p>
            <p className="text-sm text-muted mt-1 leading-snug">
              {[org.primary_contact_email, org.primary_contact_mobile].filter(hasText).join(' · ') || '—'}
            </p>
            {detail.primary_admin_user && onResetPrimaryAdminSignIn ? (
              <div className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={resettingPrimaryAdminSignIn}
                  onClick={onResetPrimaryAdminSignIn}
                >
                  <KeyRound className="h-4 w-4" aria-hidden />
                  Reset sign-in
                </Button>
              </div>
            ) : null}
          </DetailGroup>
        </>
      )}

      <DetailGroup title="Licence" icon={Shield}>
        {licence ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-heading leading-snug">{licence.plan_name}</p>
                <p className="font-mono text-xs text-muted tabular-nums mt-1">{licence.licence_number}</p>
              </div>
              {platformStatusBadge(String(licence.status))}
            </div>
            <DetailStatGrid>
              <DetailStat label="Amount" value={money(licence.licence_price_cents)} />
              <DetailStat label="Purchased" value={formatDate(licence.purchase_date)} />
              <DetailStat
                label="Activated"
                value={licence.activation_date ? formatDate(licence.activation_date) : '—'}
              />
            </DetailStatGrid>
          </div>
        ) : (
          <p className="text-sm text-muted">No licence issued.</p>
        )}
      </DetailGroup>

      <DetailGroup title="Seats" icon={Users}>
        <DetailStatGrid>
          <DetailStat label="Total" value={String(totalSeats)} />
          <DetailStat label="Assigned" value={String(assignedCount)} />
          <DetailStat
            label="Available"
            value={String(availableCount)}
            variant={availableCount > 0 ? 'success' : 'default'}
          />
        </DetailStatGrid>
        <p className="text-xs text-muted mt-3">
          {included} included
          {additional > 0 ? ` · ${additional} additional` : ''}
        </p>
        {assignedSeats.length > 0 ? (
          <ul className="mt-4 space-y-0 divide-y divide-gray-100 dark:divide-gray-800">
            {assignedSeats.map(seat => (
              <li key={seat.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-heading truncate">
                    {seat.assigned_user_name?.trim() || seat.assigned_user_email || 'Licensed user'}
                  </p>
                  <p className="text-xs text-muted font-mono tabular-nums mt-0.5">{seat.seat_label}</p>
                </div>
                <Badge variant="default" className="capitalize shrink-0">
                  {seatTypeLabel(seat.seat_type)}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted mt-3">No one assigned yet.</p>
        )}
      </DetailGroup>

      <DetailGroup title="AMC" icon={CreditCard}>
        {amc ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold tabular-nums text-heading">{amcAmount}</p>
                <p className="text-xs text-muted mt-1">
                  {amc.included ? 'First year included' : 'Annual maintenance'}
                </p>
              </div>
              {platformStatusBadge(String(amc.status))}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Period</p>
              <p className="text-sm font-semibold tabular-nums text-heading mt-1">
                {formatDateRange(amc.start_date, amc.end_date)}
              </p>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Grace until {amc.grace_until ? formatDate(amc.grace_until) : '—'}
              {nextRenewal ? ` · Renews ${formatDate(nextRenewal)}` : ''}
            </p>
            {String(amc.status) === 'expired' ? (
              <p className="text-xs text-muted leading-relaxed">
                Data stays available. Updates, support, and maintenance pause until renewal.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted">No AMC period.</p>
        )}
      </DetailGroup>

      <DetailGroup title="Payment" icon={Wallet}>
        <DetailStatGrid>
          <DetailStat label="Paid" value={money(billing?.total_paid_cents ?? 0)} />
          <DetailStat
            label="Pending"
            value={money(billing?.pending_cents ?? 0)}
            variant={(billing?.pending_cents ?? 0) > 0 ? 'warning' : 'default'}
          />
          <DetailStat
            label="Last payment"
            value={billing?.last_payment_date ? formatDate(billing.last_payment_date) : '—'}
          />
        </DetailStatGrid>
        {billing?.payment_status && billing.payment_status !== 'none' ? (
          <div className="mt-3">
            <DetailRow label="Status" value={platformStatusBadge(billing.payment_status)} />
          </div>
        ) : null}
      </DetailGroup>
    </DetailPanelBody>
  )
}
