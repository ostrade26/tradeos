import type { ReactNode } from 'react'
import { sortRows } from '../../lib/registerSort'
import { Badge } from '../ui/Badge'
import type { OrganisationSeat, PlatformOrganisation, PlatformUser, SeatRequest, SubscriptionPlan } from '../../api/platformApi'
import { accountTypeLabel, formatInrCents, seatRequestStatusLabel, seatTypeLabel } from '../../lib/platformLabels'
import { Button } from '../ui/Button'
import { formatDate, formatDateTime } from '../../lib/utils'

export function platformStatusBadge(status: string) {
  const active = status === 'active'
  return (
    <Badge variant={active ? 'success' : 'default'} className="capitalize">
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
      render: r => <span className="font-mono text-[14px] tabular-nums">{r.org_code ?? '—'}</span>,
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
          {platformStatusBadge(r.status)}
          {r.sandbox_tools ? <Badge variant="info">Sandbox</Badge> : null}
        </div>
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
      render: r => <span className="font-mono text-[14px] tabular-nums">{r.gstin?.trim() || '—'}</span>,
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
      key: 'available_seats',
      header: 'Available',
      sortable: true,
      sortValue: r => r.seats?.available_seats ?? 0,
      render: r => (
        <span className="tabular-nums text-muted">
          {r.seats != null ? String(r.seats.available_seats) : '—'}
        </span>
      ),
      className: 'text-right hidden md:table-cell',
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
            <p className="text-xs text-muted font-mono tabular-nums mt-0.5">{r.org_code}</p>
          )}
        </div>
      ),
    },
    {
      key: 'seat_label',
      header: 'Seat',
      sortable: true,
      sortValue: r => r.seat_label,
      render: r => <span className="font-mono text-[14px] tabular-nums">{r.seat_label}</span>,
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
      render: r => <span className="text-muted max-w-[20rem] truncate block">{r.description?.trim() || '—'}</span>,
      className: 'hidden md:table-cell',
    },
    {
      key: 'included_seats',
      header: 'Seats',
      sortable: true,
      sortValue: r => r.included_seats,
      render: r => <span className="tabular-nums">{r.included_seats}</span>,
      className: 'text-right',
    },
    {
      key: 'monthly_price_cents',
      header: 'Monthly',
      sortable: true,
      sortValue: r => r.monthly_price_cents,
      render: r => <span className="tabular-nums text-muted">{formatInr(r.monthly_price_cents)}</span>,
      className: 'text-right',
    },
    {
      key: 'annual_price_cents',
      header: 'Annual',
      sortable: true,
      sortValue: r => r.annual_price_cents,
      render: r => <span className="tabular-nums text-muted">{formatInr(r.annual_price_cents)}</span>,
      className: 'text-right',
    },
    {
      key: 'additional_seat_monthly_price_cents',
      header: 'Seat / mo',
      sortable: true,
      sortValue: r => r.additional_seat_monthly_price_cents ?? 0,
      render: r => (
        <span className="tabular-nums text-muted">{formatInr(r.additional_seat_monthly_price_cents ?? 0)}</span>
      ),
      className: 'text-right hidden lg:table-cell',
    },
    {
      key: 'additional_seat_annual_price_cents',
      header: 'Seat / yr',
      sortable: true,
      sortValue: r => r.additional_seat_annual_price_cents ?? 0,
      render: r => (
        <span className="tabular-nums text-muted">{formatInr(r.additional_seat_annual_price_cents ?? 0)}</span>
      ),
      className: 'text-right hidden lg:table-cell',
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
        <Badge variant={r.status === 'paid' ? 'info' : r.status === 'pending_payment' ? 'warning' : 'default'} className="capitalize">
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
