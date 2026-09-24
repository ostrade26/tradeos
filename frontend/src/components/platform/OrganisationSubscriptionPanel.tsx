import { useState } from 'react'
import { Building2, Check, Copy, CreditCard, Pencil, Shield, Trash2, User, Users, Wallet } from 'lucide-react'
import type {
  OrganisationDetailResponse,
  OrganisationPayment,
  OrganisationSeat,
} from '../../api/platformApi'
import { useToast } from '../../hooks/useToast'
import { accountTypeLabel, formatInrCents, seatTypeLabel } from '../../lib/platformLabels'
import { formatDate } from '../../lib/utils'
import { platformStatusBadge } from './platformAdminRegisterColumns'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Drawer'
import {
  DetailGroup,
  DetailInlineStat,
  DetailInlineStatRow,
  DetailPanelBody,
  DetailRow,
} from '../registers/DetailPanelSections'

const SEATS_PREVIEW_COUNT = 2

function hasText(value: string | null | undefined): value is string {
  return Boolean(value?.trim())
}

function money(cents: number | null | undefined): string {
  if (cents == null) return '—'
  if (cents === 0) return '₹0'
  return formatInrCents(cents)
}

function paymentTypeLabel(type: string): string {
  return String(type).replace(/_/g, ' ')
}

function SeatCard({
  seat,
  copiedSeatId,
  onCopy,
}: {
  seat: OrganisationSeat
  copiedSeatId: number | null
  onCopy: (seatId: number, label: string) => void
}) {
  const assignee =
    seat.assigned_user_name?.trim() || seat.assigned_user_email?.trim() || null
  const assigned = seat.assigned_user_id != null
  return (
    <div className="rounded-md bg-gray-50 dark:bg-gray-800/50 px-4 py-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-heading leading-snug truncate">
            {assignee || (assigned ? 'Licensed user' : 'Unassigned')}
          </p>
          <div className="flex items-center gap-1.5 mt-1 min-w-0">
            <p className="text-xs text-muted tabular-nums break-all">{seat.seat_label}</p>
            <button
              type="button"
              onClick={() => onCopy(seat.id, seat.seat_label)}
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
        </div>
        {platformStatusBadge(assigned ? 'assigned' : String(seat.status || 'available'))}
      </div>
      <DetailInlineStatRow>
        <DetailInlineStat label="Type" value={seatTypeLabel(seat.seat_type)} />
        <DetailInlineStat
          label="Source"
          value={seat.source === 'purchased' ? 'Purchased' : 'Included'}
        />
        <DetailInlineStat label="User" value={assignee || '—'} />
      </DetailInlineStatRow>
    </div>
  )
}

export function OrganisationSubscriptionPanel({
  detail,
  showOrgProfile = true,
  payments = [],
  onRecordPayment,
  onEditPayment,
  onDeletePayment,
}: {
  detail: OrganisationDetailResponse
  showOrgProfile?: boolean
  payments?: OrganisationPayment[]
  onRecordPayment?: () => void
  onEditPayment?: (payment: OrganisationPayment) => void
  onDeletePayment?: (payment: OrganisationPayment) => void
}) {
  const toast = useToast()
  const [copiedSeatId, setCopiedSeatId] = useState<number | null>(null)
  const [copiedContact, setCopiedContact] = useState<'email' | 'mobile' | null>(null)
  const [seatsModalOpen, setSeatsModalOpen] = useState(false)
  const org = detail.organisation
  const licence = detail.licence
  const amc = detail.amc
  const seats = detail.seats
  const billing = detail.billing

  const addressParts = [org.business_address, org.city, org.state, org.pincode].filter(hasText)
  const addressLine = addressParts.length > 0 ? addressParts.join(', ') : null
  const primaryEmail = org.primary_contact_email?.trim() || ''
  const primaryMobile = org.primary_contact_mobile?.trim() || ''

  const included = seats?.included_seats ?? licence?.included_seats ?? 0
  const additional = seats?.purchased_additional_seats ?? licence?.purchased_additional_seats ?? 0
  const totalSeats = seats?.total_entitled_seats ?? included + additional
  const assignedCount = seats?.active_assigned_seats ?? 0
  const availableCount = seats?.available_seats ?? 0
  const seatInventory = detail.seat_inventory ?? []

  const amcAmount = amc?.included ? 'Included' : money(amc?.amc_price_cents)
  const nextRenewal = amc?.renewal_date || amc?.end_date

  const copyValue = async (
    value: string,
    field: 'email' | 'mobile' | number,
    successLabel: string,
  ) => {
    try {
      await navigator.clipboard.writeText(value)
      if (typeof field === 'number') {
        setCopiedSeatId(field)
        window.setTimeout(() => setCopiedSeatId(current => (current === field ? null : current)), 2000)
      } else {
        setCopiedContact(field)
        window.setTimeout(() => setCopiedContact(current => (current === field ? null : current)), 2000)
      }
      toast.success(successLabel)
    } catch {
      toast.error(`Could not copy ${successLabel.replace(/ copied$/i, '').toLowerCase()}`)
    }
  }

  const copySeatLabel = (seatId: number, label: string) =>
    void copyValue(label, seatId, 'Seat ID copied')

  return (
    <>
    <DetailPanelBody>
      {showOrgProfile && (
        <>
          <DetailGroup title="Organisation" icon={Building2}>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-heading leading-snug min-w-0 truncate">
                {hasText(org.legal_name) && org.legal_name !== org.name ? org.legal_name : org.name}
              </p>
              <p className="text-sm text-muted text-right shrink-0">
                {accountTypeLabel(org.account_type)}
              </p>
            </div>
            {addressLine ? (
              <p className="text-xs text-muted mt-1 leading-snug">{addressLine}</p>
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
            <div className="space-y-2">
              <DetailRow
                label="Name"
                value={org.primary_contact_name?.trim() || '—'}
              />
              {primaryEmail ? (
                <DetailRow
                  label="Email"
                  value={
                    <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
                      <span className="truncate min-w-0">{primaryEmail}</span>
                      <button
                        type="button"
                        onClick={() => void copyValue(primaryEmail, 'email', 'Email copied')}
                        className="inline-flex items-center text-muted hover:text-heading shrink-0"
                        aria-label={
                          copiedContact === 'email' ? 'Email copied' : 'Copy email'
                        }
                      >
                        {copiedContact === 'email' ? (
                          <Check className="h-3.5 w-3.5 text-success" aria-hidden />
                        ) : (
                          <Copy className="h-3.5 w-3.5" aria-hidden />
                        )}
                      </button>
                    </span>
                  }
                />
              ) : null}
              {primaryMobile ? (
                <DetailRow
                  label="Mobile"
                  value={
                    <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
                      <span className="tabular-nums truncate min-w-0">{primaryMobile}</span>
                      <button
                        type="button"
                        onClick={() => void copyValue(primaryMobile, 'mobile', 'Phone copied')}
                        className="inline-flex items-center text-muted hover:text-heading shrink-0"
                        aria-label={
                          copiedContact === 'mobile' ? 'Phone copied' : 'Copy phone'
                        }
                      >
                        {copiedContact === 'mobile' ? (
                          <Check className="h-3.5 w-3.5 text-success" aria-hidden />
                        ) : (
                          <Copy className="h-3.5 w-3.5" aria-hidden />
                        )}
                      </button>
                    </span>
                  }
                />
              ) : null}
            </div>
          </DetailGroup>
        </>
      )}

      <DetailGroup title="Licence" icon={Shield} surface="muted">
        {licence ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-heading leading-snug">{licence.plan_name}</p>
                <p className="text-xs text-muted tabular-nums mt-1">{licence.licence_number}</p>
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
        {seatInventory.length > 0 ? (
          <div className="mt-4 space-y-3">
            {seatInventory.slice(0, SEATS_PREVIEW_COUNT).map(seat => (
              <SeatCard
                key={seat.id}
                seat={seat}
                copiedSeatId={copiedSeatId}
                onCopy={copySeatLabel}
              />
            ))}
            {seatInventory.length > SEATS_PREVIEW_COUNT ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => setSeatsModalOpen(true)}
              >
                See more ({seatInventory.length - SEATS_PREVIEW_COUNT} more)
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted mt-3">No seats issued yet.</p>
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
          onRecordPayment ? (
            <Button type="button" size="sm" variant="outline" onClick={onRecordPayment}>
              Record payment
            </Button>
          ) : undefined
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
        {payments.length > 0 ? (
          <div className="mt-4 space-y-3">
            {payments.slice(0, 8).map(payment => (
              <div
                key={payment.id}
                className="rounded-md bg-gray-50 dark:bg-gray-800/50 px-4 py-4 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-heading leading-snug capitalize">
                      {paymentTypeLabel(String(payment.payment_type))}
                    </p>
                    {hasText(payment.payment_reference) ? (
                      <p className="text-xs text-muted tabular-nums mt-1 truncate">
                        {payment.payment_reference}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {platformStatusBadge(String(payment.status))}
                    {onEditPayment ? (
                      <button
                        type="button"
                        onClick={() => onEditPayment(payment)}
                        className="inline-flex items-center text-muted hover:text-heading"
                        aria-label="Edit payment"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    ) : null}
                    {onDeletePayment ? (
                      <button
                        type="button"
                        onClick={() => onDeletePayment(payment)}
                        className="inline-flex items-center text-muted hover:text-danger"
                        aria-label="Remove payment"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                </div>
                <DetailInlineStatRow>
                  <DetailInlineStat label="Amount" value={money(payment.amount_cents)} />
                  <DetailInlineStat label="Date" value={formatDate(payment.payment_date)} />
                </DetailInlineStatRow>
                {hasText(payment.notes) ? (
                  <p className="text-xs text-muted leading-relaxed">{payment.notes}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted mt-3">No payments recorded yet.</p>
        )}
      </DetailGroup>
    </DetailPanelBody>

    <Modal
      open={seatsModalOpen}
      onClose={() => setSeatsModalOpen(false)}
      title="Seats"
      subtitle={org.name}
      size="md"
      footer={
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setSeatsModalOpen(false)}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {seatInventory.map(seat => (
          <SeatCard
            key={seat.id}
            seat={seat}
            copiedSeatId={copiedSeatId}
            onCopy={copySeatLabel}
          />
        ))}
      </div>
    </Modal>
    </>
  )
}
