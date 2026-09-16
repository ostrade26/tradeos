import { Building2, CreditCard, FileText, KeyRound, MapPin, User, Users } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import type { OrganisationDetailResponse } from '../../api/platformApi'
import { accountTypeLabel, seatTypeLabel } from '../../lib/platformLabels'
import {
  DetailGroup,
  DetailPanelBody,
  DetailRow,
} from '../registers/DetailPanelSections'

function statusBadge(status: string) {
  const active = status === 'active'
  return (
    <Badge variant={active ? 'success' : 'default'} className="capitalize">
      {status.replace(/_/g, ' ')}
    </Badge>
  )
}

function hasText(value: string | null | undefined): value is string {
  return Boolean(value?.trim())
}

export function OrganisationSubscriptionPanel({
  detail,
  showOrgProfile = true,
  onResetPrimaryAdminSignIn,
  resettingPrimaryAdminSignIn,
}: {
  detail: OrganisationDetailResponse
  /** Org settings plan view — subscription and seats only */
  showOrgProfile?: boolean
  onResetPrimaryAdminSignIn?: () => void
  resettingPrimaryAdminSignIn?: boolean
}) {
  const org = detail.organisation
  const sub = detail.subscription

  const addressParts = [org.business_address, org.city, org.state, org.pincode, org.country].filter(hasText)
  const addressLine = addressParts.length > 0 ? addressParts.join(', ') : null

  return (
    <DetailPanelBody>
      {showOrgProfile && (
        <>
          <DetailGroup title="Organisation" icon={Building2}>
            <DetailRow label="Account type" value={accountTypeLabel(org.account_type)} />
            <DetailRow label="Legal name" value={org.legal_name} />
          </DetailGroup>

          <DetailGroup title="Address" icon={MapPin}>
            <DetailRow label="Location" value={addressLine ?? '—'} />
          </DetailGroup>

          <DetailGroup title="Legal & tax" icon={FileText}>
            <DetailRow label="GSTIN" value={org.gstin} mono />
            <DetailRow label="PAN" value={org.pan} mono />
          </DetailGroup>

          <DetailGroup title="Primary admin" icon={User}>
            <DetailRow label="Name" value={org.primary_contact_name} />
            <DetailRow label="Email" value={org.primary_contact_email} />
            <DetailRow label="Mobile" value={org.primary_contact_mobile} />
            {detail.primary_admin_user && onResetPrimaryAdminSignIn ? (
              <div className="pt-3 mt-1 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-muted leading-relaxed mb-2">
                  Sign-in uses organisation email
                  {detail.primary_admin_user.login_id ? (
                    <> (<span className="font-medium text-heading">{detail.primary_admin_user.login_id}</span>)</>
                  ) : null}
                  . Reset if the admin forgot their password.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={resettingPrimaryAdminSignIn}
                  onClick={onResetPrimaryAdminSignIn}
                >
                  <KeyRound className="h-4 w-4" aria-hidden />
                  Reset sign-in &amp; show password
                </Button>
              </div>
            ) : null}
          </DetailGroup>
        </>
      )}

      <DetailGroup title="Subscription" icon={CreditCard}>
        {sub ? (
          <>
            <DetailRow label="Plan" value={sub.plan_name} highlight />
            <DetailRow label="Billing cycle" value={<span className="capitalize">{sub.billing_cycle}</span>} />
            <DetailRow label="Status" value={statusBadge(sub.status)} />
          </>
        ) : (
          <DetailRow label="Plan" value="No active subscription" />
        )}
      </DetailGroup>

      {(() => {
        const assigned = (detail.seat_inventory ?? []).filter(s => s.assigned_user_id != null)
        const available = detail.seats?.available_seats ?? 0
        if (assigned.length === 0 && available === 0) return null
        return (
          <DetailGroup title="Licensed seats in use" icon={Users}>
            {assigned.length > 0 ? (
              <ul className="space-y-2">
                {assigned.map(seat => (
                  <li
                    key={seat.id}
                    className="flex items-start justify-between gap-3 text-sm py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-heading truncate">
                        {seat.assigned_user_name?.trim() || seat.assigned_user_email || 'Licensed user'}
                      </p>
                      {seat.assigned_user_email && seat.assigned_user_name?.trim() ? (
                        <p className="text-xs text-muted truncate mt-0.5">{seat.assigned_user_email}</p>
                      ) : null}
                      <p className="font-mono text-[11px] text-muted tabular-nums mt-1">{seat.seat_label}</p>
                    </div>
                    <Badge variant="default" className="capitalize shrink-0">
                      {seatTypeLabel(seat.seat_type)}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No seats assigned to users yet.</p>
            )}
            {available > 0 ? (
              <p className="text-xs text-muted mt-3 leading-relaxed">
                {available} unassigned seat{available === 1 ? '' : 's'} available for new team members.
              </p>
            ) : null}
          </DetailGroup>
        )
      })()}
    </DetailPanelBody>
  )
}
