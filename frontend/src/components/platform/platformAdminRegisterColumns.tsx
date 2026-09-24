import type { ReactNode } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { sortRows } from '../../lib/registerSort'
import { Badge } from '../ui/Badge'
import type {
  OrganisationAmc,
  OrganisationLicence,
  OrganisationPayment,
  OrganisationSeat,
  PlatformOrganisation,
  PlatformUser,
  SeatRequest,
  SubscriptionPlan,
  PlatformRelease,
} from '../../api/platformApi'
import { accountTypeLabel, formatInrCents, seatRequestStatusLabel, seatTypeLabel } from '../../lib/platformLabels'
import { Button } from '../ui/Button'
import { formatDate, formatDateTime } from '../../lib/utils'
import { releaseCategoryLabel } from '../../lib/releaseVersion'

export function platformStatusBadge(status: string) {
  const variant =
    status === 'active' || status === 'paid' || status === 'included' || status === 'assigned'
      ? 'success'
      : status === 'due_soon' || status === 'pending' || status === 'available'
        ? 'info'
        : status === 'grace_period' || status === 'suspended' || status === 'failed'
          ? 'warning'
          : status === 'expired' || status === 'cancelled' || status === 'refunded'
            ? 'default'
            : 'default'
  return (
    <Badge variant={variant} className="capitalize">
      {status.replace(/_/g, ' ')}
    </Badge>
  )
}

function orgLocation(org: PlatformOrganisation): string {
  const parts = [org.city, org.state].filter(Boolean)
  return parts.length ? parts.join(', ') : '—'
}

function formatInr(cents: number | null | undefined): string {
  if (!cents) return '—'
  return `₹${(cents / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

type Column<T> = {
  key: string
  header: string
  render?: (row: T) => ReactNode
  className?: string
  sortable?: boolean
  sortValue?: (row: T) => string | number
  actionsWide?: boolean | 'compact'
}

function organisationStatusLabel(status: string): string {
  if (status === 'inactive' || status === 'disabled') return 'deactivated'
  return status.replace(/_/g, ' ')
}

export function organisationIsActive(org: PlatformOrganisation): boolean {
  return org.status === 'active'
}

export function organisationIsTest(org: PlatformOrganisation): boolean {
  return Boolean(org.is_test)
}

export function organisationColumns(): Column<PlatformOrganisation>[] {
  return [
    {
      key: 'name',
      header: 'Organisation',
      sortable: true,
      sortValue: r => r.name,
      render: r => (
        <div className="min-w-[10rem] max-w-[16rem]">
          <p className="font-medium text-heading truncate">{r.name}</p>
          {r.legal_name?.trim() && r.legal_name !== r.name && (
            <p className="text-xs text-muted truncate mt-0.5">{r.legal_name}</p>
          )}
        </div>
      ),
    },
    {
      key: 'org_code',
      header: 'Code',
      sortable: true,
      sortValue: r => r.org_code ?? '',
      render: r => <span className="text-[14px] tabular-nums">{r.org_code ?? '—'}</span>,
    },
    {
      key: 'account_type',
      header: 'Type',
      sortable: true,
      sortValue: r => r.account_type,
      render: r => accountTypeLabel(r.account_type),
      className: 'whitespace-nowrap',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: r => r.status,
      render: r => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant={r.status === 'active' ? 'success' : 'default'}
            className="capitalize"
          >
            {organisationStatusLabel(r.status)}
          </Badge>
          {organisationIsTest(r) ? <Badge variant="warning">Test</Badge> : null}
          {r.sandbox_tools ? <Badge variant="info">Sandbox</Badge> : null}
        </div>
      ),
    },
    {
      key: 'plan_name',
      header: 'Plan',
      sortable: true,
      sortValue: r => r.plan_name ?? '',
      render: r => (
        <span className="text-heading max-w-[10rem] truncate block">
          {r.plan_name?.trim() || '—'}
        </span>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      sortable: true,
      sortValue: r => orgLocation(r),
      render: r => <span className="text-muted max-w-[10rem] truncate block">{orgLocation(r)}</span>,
      className: 'hidden lg:table-cell',
    },
    {
      key: 'gstin',
      header: 'GSTIN',
      sortable: true,
      sortValue: r => r.gstin ?? '',
      render: r => <span className="text-[14px] tabular-nums">{r.gstin?.trim() || '—'}</span>,
      className: 'hidden xl:table-cell',
    },
    {
      key: 'primary_contact_email',
      header: 'Primary contact',
      sortable: true,
      sortValue: r => r.primary_contact_email ?? '',
      render: r => (
        <span className="text-muted max-w-[12rem] truncate block">{r.primary_contact_email?.trim() || '—'}</span>
      ),
      className: 'hidden xl:table-cell',
    },
    {
      key: 'seats',
      header: 'Seats',
      sortable: true,
      sortValue: r => r.seats?.active_assigned_seats ?? 0,
      render: r =>
        r.seats && r.seats.total_entitled_seats > 0 ? (
          <span className="tabular-nums font-medium text-heading">
            {r.seats.active_assigned_seats}/{r.seats.total_entitled_seats}
          </span>
        ) : (
          '—'
        ),
      className: 'text-right',
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      sortValue: r => r.created_at,
      render: r => <span className="tabular-nums text-muted whitespace-nowrap">{formatDate(r.created_at)}</span>,
      className: 'hidden md:table-cell',
    },
  ]
}

export function platformSeatColumns(): Column<OrganisationSeat>[] {
  return [
    {
      key: 'organisation_name',
      header: 'Organisation',
      sortable: true,
      sortValue: r => r.organisation_name ?? '',
      render: r => (
        <div className="min-w-[10rem]">
          <p className="font-medium text-heading truncate">{r.organisation_name ?? '—'}</p>
          {r.org_code?.trim() && (
            <p className="text-xs text-muted tabular-nums mt-0.5">{r.org_code}</p>
          )}
        </div>
      ),
    },
    {
      key: 'seat_label',
      header: 'Seat',
      sortable: true,
      sortValue: r => r.seat_label,
      render: r => <span className="text-[14px] tabular-nums">{r.seat_label}</span>,
    },
    {
      key: 'seat_type',
      header: 'Type',
      sortable: true,
      sortValue: r => r.seat_type,
      render: r => <span className="text-sm">{seatTypeLabel(r.seat_type)}</span>,
    },
    {
      key: 'source',
      header: 'Source',
      sortable: true,
      sortValue: r => r.source,
      render: r => <span className="capitalize text-muted">{r.source}</span>,
      className: 'hidden md:table-cell',
    },
  ]
}

export function platformUserColumns(): Column<PlatformUser>[] {
  return [
    {
      key: 'name',
      header: 'User',
      sortable: true,
      sortValue: r => r.name,
      render: r => (
        <div className="min-w-[9rem] max-w-[14rem]">
          <p className="font-medium text-heading truncate">{r.name}</p>
          <p className="text-xs text-muted truncate mt-0.5">{r.username}</p>
        </div>
      ),
    },
    {
      key: 'organisation_name',
      header: 'Organisation',
      sortable: true,
      sortValue: r => r.organisation_name ?? '',
      render: r => (
        <span className="text-muted max-w-[12rem] truncate block">{r.organisation_name ?? '—'}</span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      sortValue: r => r.email,
      render: r => <span className="max-w-[14rem] truncate block">{r.email?.trim() || '—'}</span>,
      className: 'hidden lg:table-cell',
    },
    {
      key: 'phone',
      header: 'Phone',
      sortable: true,
      sortValue: r => r.phone ?? '',
      render: r => <span className="tabular-nums text-muted">{r.phone?.trim() || '—'}</span>,
      className: 'hidden xl:table-cell',
    },
    {
      key: 'role_name',
      header: 'Role',
      sortable: true,
      sortValue: r => r.role_name,
      render: r => r.role_name,
      className: 'whitespace-nowrap',
    },
    {
      key: 'account_type',
      header: 'Account type',
      sortable: true,
      sortValue: r => r.account_type,
      render: r => accountTypeLabel(r.account_type),
      className: 'hidden lg:table-cell whitespace-nowrap',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: r => r.status,
      render: r => platformStatusBadge(r.status),
    },
    {
      key: 'seat',
      header: 'Seat',
      sortable: true,
      sortValue: r => (r.membership_status === 'active' && r.seat_id != null ? 1 : 0),
      render: r =>
        r.membership_status === 'active' && r.seat_id != null ? (
          <span className="text-success text-[14px] font-medium">Assigned</span>
        ) : (
          <span className="text-muted">—</span>
        ),
      className: 'hidden md:table-cell',
    },
  ]
}

export function subscriptionPlanColumns(): Column<SubscriptionPlan>[] {
  return [
    {
      key: 'name',
      header: 'Plan',
      sortable: true,
      sortValue: r => r.name,
      render: r => (
        <div className="min-w-[8rem] max-w-[14rem]">
          <p className="font-medium text-heading truncate">{r.name}</p>
          <p className="text-xs text-muted truncate mt-0.5">{r.slug}</p>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      sortable: true,
      sortValue: r => r.description,
      render: r => (
        <span className="text-muted whitespace-normal leading-snug block min-w-[14rem] max-w-[36rem]">
          {r.description?.trim() || '—'}
        </span>
      ),
      className: 'hidden md:table-cell',
    },
    {
      key: 'licence_type',
      header: 'Type',
      sortable: true,
      sortValue: r => r.licence_type ?? '',
      render: r => <span className="capitalize">{r.licence_type ?? '—'}</span>,
      className: 'hidden sm:table-cell',
    },
    {
      key: 'licence_price_cents',
      header: 'Licence',
      sortable: true,
      sortValue: r => r.licence_price_cents ?? 0,
      render: r => <span className="tabular-nums text-muted">{formatInr(r.licence_price_cents)}</span>,
      className: 'text-right',
    },
    {
      key: 'amc_price_cents',
      header: 'AMC / yr',
      sortable: true,
      sortValue: r => r.amc_price_cents ?? 0,
      render: r => <span className="tabular-nums text-muted">{formatInr(r.amc_price_cents)}</span>,
      className: 'text-right',
    },
    {
      key: 'included_seats',
      header: 'Seats',
      sortable: true,
      sortValue: r => (r.included_admin_seats ?? 0) + (r.included_operator_seats ?? 0) || r.included_seats,
      render: r => {
        const admin = r.included_admin_seats ?? 0
        const operator = r.included_operator_seats ?? 0
        const total = admin + operator || r.included_seats
        return (
          <span className="tabular-nums">
            {total}
            <span className="text-muted text-xs">
              {' '}
              ({admin}A / {operator}O)
            </span>
          </span>
        )
      },
      className: 'text-right',
    },
    {
      key: 'additional_seat_licence_cents',
      header: 'Add-on seat',
      sortable: true,
      sortValue: r => r.additional_seat_licence_cents ?? 0,
      render: r => <span className="tabular-nums text-muted">{formatInr(r.additional_seat_licence_cents)}</span>,
      className: 'text-right hidden lg:table-cell',
    },
    {
      key: 'amc_grace_days',
      header: 'Grace',
      sortable: true,
      sortValue: r => r.amc_grace_days ?? 0,
      render: r => <span className="tabular-nums text-muted">{r.amc_grace_days ?? 0}d</span>,
      className: 'text-right hidden md:table-cell',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: r => r.status,
      render: r => platformStatusBadge(r.status),
    },
  ]
}

export function licenceColumns(handlers: {
  busyId: number | null
  onActivate: (row: OrganisationLicence) => void
  onSuspend: (row: OrganisationLicence) => void
}): Column<OrganisationLicence>[] {
  return [
    {
      key: 'organisation_name',
      header: 'Organisation',
      sortable: true,
      sortValue: r => r.organisation_name ?? '',
      render: r => (
        <div className="min-w-[10rem]">
          <p className="font-medium text-heading truncate">{r.organisation_name ?? '—'}</p>
          <p className="text-xs text-muted tabular-nums mt-0.5">{r.org_code ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'licence_number',
      header: 'Licence',
      sortable: true,
      sortValue: r => r.licence_number,
      render: r => <span className="text-[14px] tabular-nums">{r.licence_number}</span>,
    },
    {
      key: 'plan_name',
      header: 'Plan',
      sortable: true,
      sortValue: r => r.plan_name,
      render: r => <span className="truncate block max-w-[10rem]">{r.plan_name}</span>,
    },
    {
      key: 'licence_price_cents',
      header: 'Amount',
      sortable: true,
      sortValue: r => r.licence_price_cents,
      render: r => <span className="tabular-nums">{formatInr(r.licence_price_cents)}</span>,
      className: 'text-right',
    },
    {
      key: 'included_seats',
      header: 'Seats',
      sortable: true,
      sortValue: r => r.included_seats + r.purchased_additional_seats,
      render: r => (
        <span className="tabular-nums">
          {r.included_seats}+{r.purchased_additional_seats}
        </span>
      ),
      className: 'text-right',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: r => r.status,
      render: r => platformStatusBadge(String(r.status)),
    },
    {
      key: 'purchase_date',
      header: 'Purchased',
      sortable: true,
      sortValue: r => r.purchase_date,
      render: r => <span className="tabular-nums text-muted whitespace-nowrap">{formatDate(r.purchase_date)}</span>,
      className: 'hidden md:table-cell',
    },
    {
      key: 'actions',
      header: '',
      actionsWide: 'compact',
      render: r => {
        const busy = handlers.busyId === r.id
        return (
          <div className="flex flex-nowrap justify-center">
            {r.status !== 'active' ? (
              <Button
                size="sm"
                disabled={busy}
                onClick={e => {
                  e.stopPropagation()
                  handlers.onActivate(r)
                }}
              >
                Activate
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={e => {
                  e.stopPropagation()
                  handlers.onSuspend(r)
                }}
              >
                Suspend
              </Button>
            )}
          </div>
        )
      },
      className: 'text-center',
    },
  ]
}

export function amcColumns(handlers: {
  busyId: number | null
  onRenew: (row: OrganisationAmc) => void
}): Column<OrganisationAmc>[] {
  return [
    {
      key: 'organisation_name',
      header: 'Organisation',
      sortable: true,
      sortValue: r => r.organisation_name ?? '',
      render: r => (
        <div className="min-w-[10rem]">
          <p className="font-medium text-heading truncate">{r.organisation_name ?? '—'}</p>
          <p className="text-xs text-muted tabular-nums mt-0.5">{r.licence_number ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'plan_name',
      header: 'Plan',
      sortable: true,
      sortValue: r => r.plan_name ?? '',
      render: r => <span className="truncate block max-w-[10rem]">{r.plan_name ?? '—'}</span>,
    },
    {
      key: 'amc_price_cents',
      header: 'AMC amount',
      sortable: true,
      sortValue: r => r.amc_price_cents,
      render: r => (
        <span className="tabular-nums">
          {r.included ? 'Included' : formatInr(r.amc_price_cents)}
        </span>
      ),
      className: 'text-right',
    },
    {
      key: 'end_date',
      header: 'Period end',
      sortable: true,
      sortValue: r => r.end_date,
      render: r => <span className="tabular-nums text-muted whitespace-nowrap">{formatDate(r.end_date)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: r => r.status,
      render: r => platformStatusBadge(String(r.status)),
    },
    {
      key: 'payment_status',
      header: 'Payment',
      sortable: true,
      sortValue: r => r.payment_status,
      render: r => platformStatusBadge(r.payment_status),
      className: 'hidden md:table-cell',
    },
    {
      key: 'actions',
      header: '',
      actionsWide: 'compact',
      render: r => (
        <div className="flex justify-center">
          <Button
            size="sm"
            variant="secondary"
            disabled={handlers.busyId === r.id}
            onClick={e => {
              e.stopPropagation()
              handlers.onRenew(r)
            }}
          >
            Renew
          </Button>
        </div>
      ),
      className: 'text-center',
    },
  ]
}

export function paymentColumns(handlers?: {
  onEdit?: (row: OrganisationPayment) => void
  onDelete?: (row: OrganisationPayment) => void
  busyId?: number | null
}): Column<OrganisationPayment>[] {
  return [
    {
      key: 'organisation_name',
      header: 'Organisation',
      sortable: true,
      sortValue: r => r.organisation_name ?? '',
      render: r => <span className="font-medium text-heading truncate block">{r.organisation_name ?? '—'}</span>,
    },
    {
      key: 'payment_type',
      header: 'Type',
      sortable: true,
      sortValue: r => r.payment_type,
      render: r => <span className="capitalize">{String(r.payment_type).replace(/_/g, ' ')}</span>,
    },
    {
      key: 'amount_cents',
      header: 'Amount',
      sortable: true,
      sortValue: r => r.amount_cents,
      render: r => <span className="tabular-nums font-medium">{formatInrCents(r.amount_cents)}</span>,
      className: 'text-right',
    },
    {
      key: 'payment_date',
      header: 'Date',
      sortable: true,
      sortValue: r => r.payment_date,
      render: r => <span className="tabular-nums text-muted whitespace-nowrap">{formatDate(r.payment_date)}</span>,
    },
    {
      key: 'payment_reference',
      header: 'Reference',
      sortable: true,
      sortValue: r => r.payment_reference,
      render: r => <span className="text-[13px]">{r.payment_reference?.trim() || '—'}</span>,
      className: 'hidden md:table-cell',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: r => r.status,
      render: r => platformStatusBadge(String(r.status)),
    },
    ...(handlers?.onEdit || handlers?.onDelete
      ? [
          {
            key: 'actions',
            header: '',
            render: (r: OrganisationPayment) => (
              <div className="flex items-center justify-end gap-2">
                {handlers.onEdit ? (
                  <button
                    type="button"
                    disabled={handlers.busyId === r.id}
                    onClick={e => {
                      e.stopPropagation()
                      handlers.onEdit?.(r)
                    }}
                    className="inline-flex items-center text-muted hover:text-heading disabled:opacity-50"
                    aria-label="Edit payment"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
                {handlers.onDelete ? (
                  <button
                    type="button"
                    disabled={handlers.busyId === r.id}
                    onClick={e => {
                      e.stopPropagation()
                      handlers.onDelete?.(r)
                    }}
                    className="inline-flex items-center text-muted hover:text-danger disabled:opacity-50"
                    aria-label="Remove payment"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </div>
            ),
            className: 'w-16 text-right',
          } satisfies Column<OrganisationPayment>,
        ]
      : []),
  ]
}

export function seatRequestColumns(handlers: {
  busyId: number | null
  onApprove: (row: SeatRequest) => void
  onReject: (row: SeatRequest) => void
}): Column<SeatRequest>[] {
  return [
    {
      key: 'organisation_name',
      header: 'Organisation',
      sortable: true,
      sortValue: r => r.organisation_name ?? String(r.organisation_id),
      render: r => (
        <div className="min-w-[8rem]">
          <p className="font-medium text-heading truncate">{r.organisation_name ?? `Org #${r.organisation_id}`}</p>
          <p className="text-xs text-muted tabular-nums">#{r.organisation_id}</p>
        </div>
      ),
    },
    {
      key: 'requested_seats',
      header: 'Seats',
      sortable: true,
      sortValue: r => r.requested_seats,
      render: r => <span className="tabular-nums font-medium">{r.requested_seats}</span>,
      className: 'text-right',
    },
    {
      key: 'seat_type',
      header: 'Type',
      sortable: true,
      sortValue: r => r.seat_type ?? 'operator',
      render: r => <span className="text-sm">{seatTypeLabel(r.seat_type ?? 'operator')}</span>,
      className: 'hidden sm:table-cell',
    },
    {
      key: 'amount_cents',
      header: 'Amount',
      sortable: true,
      sortValue: r => r.amount_cents,
      render: r => <span className="tabular-nums text-muted">{formatInrCents(r.amount_cents)}</span>,
      className: 'text-right',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: r => r.status,
      render: r => (
        <Badge
          variant={
            r.status === 'approved'
              ? 'success'
              : r.status === 'rejected'
                ? 'danger'
                : r.status === 'paid'
                  ? 'info'
                  : r.status === 'pending_payment'
                    ? 'warning'
                    : 'default'
          }
          className="capitalize"
        >
          {seatRequestStatusLabel(r.status, 'platform')}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Requested',
      sortable: true,
      sortValue: r => r.created_at,
      render: r => <span className="tabular-nums text-muted whitespace-nowrap">{formatDateTime(r.created_at)}</span>,
      className: 'hidden md:table-cell',
    },
    {
      key: 'actions',
      header: '',
      actionsWide: true,
      render: r => {
        const busy = handlers.busyId === r.id
        if (r.status === 'pending_payment' || r.status === 'paid') {
          return (
            <div className="flex flex-nowrap justify-end gap-1.5">
              <Button size="sm" disabled={busy} onClick={() => handlers.onApprove(r)}>
                Approve
              </Button>
              <Button size="sm" variant="outlineDanger" disabled={busy} onClick={() => handlers.onReject(r)}>
                Reject
              </Button>
            </div>
          )
        }
        return null
      },
      className: 'text-right',
    },
  ]
}

export interface AuditLogRow {
  id: string
  action: string
  created_at: string
  entity_type: string
  entity_id: string
  organisation_id: string
  actor_user_id: string
}

export function auditLogColumns(): Column<AuditLogRow>[] {
  return [
    {
      key: 'action',
      header: 'Action',
      sortable: true,
      sortValue: r => r.action,
      render: r => <span className="font-medium text-heading">{r.action}</span>,
    },
    {
      key: 'created_at',
      header: 'When',
      sortable: true,
      sortValue: r => r.created_at,
      render: r => <span className="tabular-nums text-muted whitespace-nowrap">{formatDateTime(r.created_at)}</span>,
    },
    {
      key: 'entity_type',
      header: 'Entity',
      sortable: true,
      sortValue: r => r.entity_type,
      render: r => (
        <span className="text-muted">
          {r.entity_type}
          {r.entity_id ? ` · ${r.entity_id}` : ''}
        </span>
      ),
    },
    {
      key: 'organisation_id',
      header: 'Org',
      sortable: true,
      sortValue: r => r.organisation_id,
      render: r => <span className="tabular-nums text-muted">{r.organisation_id || '—'}</span>,
      className: 'hidden md:table-cell',
    },
    {
      key: 'actor_user_id',
      header: 'Actor',
      sortable: true,
      sortValue: r => r.actor_user_id,
      render: r => <span className="tabular-nums text-muted">{r.actor_user_id || '—'}</span>,
      className: 'hidden lg:table-cell',
    },
  ]
}

export function mapAuditLogs(logs: Record<string, unknown>[]): AuditLogRow[] {
  return logs.map(log => ({
    id: String(log.id ?? `${log.action}-${log.created_at}`),
    action: String(log.action ?? ''),
    created_at: String(log.created_at ?? ''),
    entity_type: String(log.entity_type ?? ''),
    entity_id: String(log.entity_id ?? ''),
    organisation_id: log.organisation_id != null ? String(log.organisation_id) : '',
    actor_user_id: log.actor_user_id != null ? String(log.actor_user_id) : '',
  }))
}


export function releaseColumns(handlers: {
  /** Newest release (usually the latest deploy draft). */
  latestReleaseId?: number | null
}): Column<PlatformRelease>[] {
  return [
    {
      key: 'version',
      header: 'Version',
      sortable: true,
      sortValue: r => r.version,
      render: r => (
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[14px] tabular-nums">{r.version}</span>
          {handlers.latestReleaseId != null && handlers.latestReleaseId === r.id ? (
            <Badge variant="accent">
              {r.status === 'published' ? 'Last update' : 'Latest'}
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: 'title',
      header: 'Release',
      sortable: true,
      sortValue: r => r.title,
      render: r => (
        <div className="min-w-[12rem] max-w-[20rem]">
          <p className="font-medium text-heading truncate">{r.title}</p>
          <p className="text-xs text-muted mt-0.5 truncate">
            {r.items.map(i => releaseCategoryLabel(i.category)).join(' · ') || 'No items'}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: r => r.status,
      render: r => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={r.status === 'published' ? 'success' : 'info'}>
            {r.status === 'published' ? 'Published' : 'Draft'}
          </Badge>
          {r.source === 'deploy' ? (
            <Badge variant="default">Deploy</Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: 'gated',
      header: 'Apply',
      sortable: true,
      sortValue: r => (r.gated ? 1 : 0),
      render: r => (
        <span className="text-[14px] text-muted">
          {r.gated ? 'Features → catalog' : 'Notify only'}
        </span>
      ),
    },
    {
      key: 'published_at',
      header: 'Published',
      sortable: true,
      sortValue: r => r.published_at ?? '',
      render: r => (
        <span className="tabular-nums text-[14px]">{r.published_at ? formatDateTime(r.published_at) : '—'}</span>
      ),
    },
  ]
}

export function sortPlatformRows<T>(
  rows: T[],
  sort: { key: string; direction: 'asc' | 'desc' },
  columns: Column<T>[],
): T[] {
  const col = columns.find(c => c.key === sort.key)
  const getValue = (row: T, key: string) => {
    const c = columns.find(x => x.key === key)
    if (c?.sortValue) return c.sortValue(row)
    return ''
  }
  if (col?.sortValue) {
    return sortRows(rows, sort, getValue)
  }
  return rows
}
