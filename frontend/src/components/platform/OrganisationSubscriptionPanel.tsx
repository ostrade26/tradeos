import { useState } from 'react'
import { Building2, Check, Copy, CreditCard, Shield, User, Users, Wallet } from 'lucide-react'
import type { OrganisationDetailResponse } from '../../api/platformApi'
import { useToast } from '../../hooks/useToast'
import { accountTypeLabel, formatInrCents, seatTypeLabel } from '../../lib/platformLabels'
import { formatDate } from '../../lib/utils'
import { platformStatusBadge } from './platformAdminRegisterColumns'
import {
  DetailGroup,
  DetailInlineStat,
  DetailInlineStatRow,
  DetailPanelBody,
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
}: {
  detail: OrganisationDetailResponse
  showOrgProfile?: boolean
}) {
  const toast = useToast()
  const [copiedSeatId, setCopiedSeatId] = useState<number | null>(null)
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
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-heading leading-snug min-w-0 truncate">
                {org.primary_contact_name?.trim() || '—'}
              </p>
              {hasText(org.primary_contact_email) ? (
                <p className="text-sm text-muted text-right shrink-0 max-w-[65%] truncate">
                  {org.primary_contact_email}
                </p>
              ) : null}
            </div>
            {hasText(org.primary_contact_mobile) ? (
              <p className="text-sm text-muted mt-1 leading-snug">{org.primary_contact_mobile}</p>
            ) : null}
          </DetailGroup>
        </>
      )}

      <DetailGroup title="Licence" icon={Shield} surface="muted">
        {licence ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-heading leading-snug">{licence.plan_name}</p>
                <p className="font-mono text-xs text-muted tabular-nums mt-1">{licence.licence_number}</p>
              </div>
              {platformStatusBadge(String(licence.status))}
            </div>
            <DetailInlineStatRow>
              <DetailInlineStat label="Amount" value={money(licence.licence_price_cents)} />
              <DetailInlineStat label="Purchased" value={formatDate(licence.purchase_date)} />
              <DetailInlineStat
                label="Activated"
                value={licence.activation_date ? formatDate(licence.activation_date) : '—'}
              />
            </DetailInlineStatRow>
          </div>
        ) : (
          <p className="text-sm text-muted">No licence issued.</p>
        )}
      </DetailGroup>

      <DetailGroup title="Seats" icon={Users}>
        <DetailInlineStatRow>
          <DetailInlineStat label="Total" value={String(totalSeats)} />
          <DetailInlineStat label="Assigned" value={String(assignedCount)} />
          <DetailInlineStat
            label="Available"
            value={String(availableCount)}
            valueClassName={availableCount > 0 ? 'text-success' : undefined}
          />
        </DetailInlineStatRow>
        {assignedSeats.length > 0 ? (
          <ul className="mt-4 space-y-0 divide-y divide-gray-100 dark:divide-gray-800">
            {assignedSeats.map(seat => (
              <li key={seat.id} className="flex items-end justify-between gap-3 py-2.5 first:pt-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-heading truncate">
                    {seat.assigned_user_name?.trim() || seat.assigned_user_email || 'Licensed user'}
                  </p>
                  <p className="text-xs text-muted mt-0.5">{seatTypeLabel(seat.seat_type)}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 max-w-[55%]">
                  <p className="text-xs text-muted font-mono tabular-nums text-right break-all">
                    {seat.seat_label}
                  </p>
                  <button
                    type="button"
                    onClick={() => void copySeatLabel(seat.id, seat.seat_label)}
                    className="inline-flex items-center text-muted hover:text-heading shrink-0"
                    aria-label={`Copy ${seat.seat_label}`}
                  >
                    {copiedSeatId === seat.id ? (
                      <Check className="h-3.5 w-3.5 text-success" aria-hidden />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted mt-3">No one assigned yet.</p>
        )}
      </DetailGroup>

      <DetailGroup title="AMC" icon={CreditCard} surface="muted">
        {amc ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-heading leading-snug">
                  {amc.included ? 'First year included' : 'Annual maintenance'}
                </p>
                {nextRenewal ? (
                  <p className="text-xs text-muted mt-1">Renews {formatDate(nextRenewal)}</p>
                ) : null}
              </div>
              {platformStatusBadge(String(amc.status))}
            </div>
            <DetailInlineStatRow>
              <DetailInlineStat label="Amount" value={amcAmount} />
              <DetailInlineStat label="Started" value={formatDate(amc.start_date)} />
              <DetailInlineStat label="Ends" value={formatDate(amc.end_date)} />
            </DetailInlineStatRow>
            <p className="text-xs text-muted leading-relaxed">
              Grace until {amc.grace_until ? formatDate(amc.grace_until) : '—'}
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

      <DetailGroup
        title="Payment"
        icon={Wallet}
        trailing={
          billing?.payment_status && billing.payment_status !== 'none'
            ? platformStatusBadge(billing.payment_status)
            : undefined
        }
      >
        <DetailInlineStatRow>
          <DetailInlineStat label="Paid" value={money(billing?.total_paid_cents ?? 0)} />
          <DetailInlineStat
            label="Pending"
            value={money(billing?.pending_cents ?? 0)}
            valueClassName={(billing?.pending_cents ?? 0) > 0 ? 'text-warning' : undefined}
          />
          <DetailInlineStat
            label="Last payment"
            value={billing?.last_payment_date ? formatDate(billing.last_payment_date) : '—'}
          />
        </DetailInlineStatRow>
      </DetailGroup>
    </DetailPanelBody>
  )
}
