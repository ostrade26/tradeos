import { Building2, Mail, Shield } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { Select } from '../ui/Select'
import type { OrgRoleSlug, PlatformUser } from '../../api/platformApi'
import { accountTypeLabel, ORG_ROLE_OPTIONS } from '../../lib/platformLabels'
import {
  DetailGroup,
  DetailHero,
  DetailMetricsSection,
  DetailPanelBody,
  DetailRow,
} from '../registers/DetailPanelSections'

function statusBadge(status: string) {
  const active = status === 'active'
  return (
    <Badge variant={active ? 'success' : 'default'} className="capitalize">
      {status}
    </Badge>
  )
}

function hasText(value: string | null | undefined): value is string {
  return Boolean(value?.trim())
}

export function PlatformUserDetailPanel({
  user,
  onPatchRole,
  updating,
}: {
  user: PlatformUser
  onPatchRole?: (slug: OrgRoleSlug) => void
  updating?: boolean
}) {
  const seatLabel =
    user.membership_status === 'active' && user.seat_id != null
      ? 'Active seat assigned'
      : 'No active seat'

  return (
    <DetailPanelBody>
      <DetailHero>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold text-heading leading-snug">{user.name}</p>
            <p className="text-xs text-muted mt-0.5 leading-snug">{user.username}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5 shrink-0 max-w-[52%]">
            {statusBadge(user.status)}
          </div>
        </div>
      </DetailHero>

      <DetailMetricsSection>
        <div className="flex items-baseline justify-between gap-4 text-sm">
          <p className="min-w-0">
            <span className="text-muted">Role </span>
            <span className="font-semibold text-heading">{user.role_name}</span>
          </p>
          <p className="text-right shrink-0">
            <span className="text-muted">Seat </span>
            <span className="font-medium text-heading">{seatLabel}</span>
          </p>
        </div>
      </DetailMetricsSection>

      <DetailGroup title="Organisation" icon={Building2}>
        <DetailRow
          label="Tenant"
          value={hasText(user.organisation_name) ? user.organisation_name : 'Not assigned'}
        />
        <DetailRow label="Account type" value={accountTypeLabel(user.account_type)} />
      </DetailGroup>

      <DetailGroup title="Contact" icon={Mail}>
        <DetailRow label="Email" value={user.email} />
        <DetailRow label="Phone" value={user.phone} />
      </DetailGroup>

      <DetailGroup title="Access" icon={Shield}>
        {onPatchRole ? (
          <Select
            label="Role"
            options={ORG_ROLE_OPTIONS.map(r => ({ value: r.value, label: r.label }))}
            value={user.role_slug}
            onChange={e => {
              const slug = e.target.value as OrgRoleSlug
              if (slug !== user.role_slug) onPatchRole(slug)
            }}
            searchable={false}
            disabled={updating}
          />
        ) : (
          <>
            <DetailRow label="Role" value={user.role_name} />
            <DetailRow label="Membership" value={<span className="capitalize">{user.membership_status}</span>} />
          </>
        )}
      </DetailGroup>
    </DetailPanelBody>
  )
}
