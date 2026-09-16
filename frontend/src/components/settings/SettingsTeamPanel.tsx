import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { UserPlus } from 'lucide-react'
import type { OrganisationDetailResponse } from '../../api/platformApi'
import { organisationApi, type OrganisationMember } from '../../api/organisationApi'
import { ApiError } from '../../api/client'
import { orgRoleLabel } from '../../lib/platformLabels'
import { formatDateTime } from '../../lib/utils'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../hooks/useAuth'
import { Badge } from '../ui/Badge'
import { PageHeader } from '../ui/CommandPalette'
import { Button } from '../ui/Button'
import { DataTable } from '../ui/DataTable'
import { OrgTeamCreateUserModal } from './OrgTeamCreateUserModal'
import { OrgTeamPasswordModal } from './OrgTeamPasswordModal'
import { SettingsTeamRedirectSuccessModal } from './SettingsTeamRedirectSuccessModal'
import { memberPasswordIsSet, OrgTeamRowActions } from './OrgTeamRowActions'
import {
  PlatformSignInCredentialsModal,
  type SignInCredentialsPayload,
} from '../platform/PlatformSignInCredentialsModal'
import { cn } from '../../lib/utils'

function memberIsActive(m: OrganisationMember): boolean {
  return m.user_status === 'active' && m.membership_status === 'active'
}

export function SettingsTeamPanel({
  canManage,
  onMembersChanged,
  billing,
  billingLoading,
  canRequestSeats,
  createOpen: createOpenProp,
  onCreateOpenChange,
}: {
  canManage: boolean
  onMembersChanged?: () => void
  billing: OrganisationDetailResponse | null
  billingLoading: boolean
  canRequestSeats: boolean
  createOpen?: boolean
  onCreateOpenChange?: (open: boolean) => void
}) {
  const toast = useToast()
  const { session } = useAuth()
  const [members, setMembers] = useState<OrganisationMember[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpenInternal, setCreateOpenInternal] = useState(false)
  const createOpen = createOpenProp ?? createOpenInternal
  const setCreateOpen = onCreateOpenChange ?? setCreateOpenInternal
  const [createSuccessOpen, setCreateSuccessOpen] = useState(false)
  const [passwordUser, setPasswordUser] = useState<OrganisationMember | null>(null)
  const [passwordChangeMode, setPasswordChangeMode] = useState(false)
  const [passwordConfiguredIds, setPasswordConfiguredIds] = useState<Set<number>>(() => new Set())
  const [signInCredentials, setSignInCredentials] = useState<SignInCredentialsPayload | null>(null)
  const [resettingSignInId, setResettingSignInId] = useState<number | null>(null)

  const markPasswordConfigured = useCallback((userId: number) => {
    setPasswordConfiguredIds(prev => {
      if (prev.has(userId)) return prev
      const next = new Set(prev)
      next.add(userId)
      return next
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await organisationApi.listMembers()
      setMembers(data.members)
    } catch (err) {
      setMembers([])
      toast.error(err instanceof ApiError ? err.message : 'Could not load team members')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const toggleStatus = useCallback(
    async (member: OrganisationMember) => {
      const next = memberIsActive(member) ? 'inactive' : 'active'
      try {
        await organisationApi.updateMemberStatus(member.id, next)
        toast.success(next === 'active' ? 'User activated' : 'User deactivated')
        await load()
        onMembersChanged?.()
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Could not update user')
      }
    },
    [load, onMembersChanged, toast],
  )

  const openPasswordModal = useCallback(
    (member: OrganisationMember) => {
      setPasswordChangeMode(memberPasswordIsSet(member, passwordConfiguredIds))
      setPasswordUser(member)
    },
    [passwordConfiguredIds],
  )

  const resetMemberSignIn = useCallback(
    async (member: OrganisationMember) => {
      if (resettingSignInId != null) return
      setResettingSignInId(member.id)
      try {
        const result = await organisationApi.resetMemberSignIn(member.id)
        markPasswordConfigured(member.id)
        setSignInCredentials({
          name: result.name,
          login_id: result.login_id,
          temporary_password: result.temporary_password,
        })
        toast.success('Temporary password issued — share it with the user')
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Could not reset sign-in')
      } finally {
        setResettingSignInId(null)
      }
    },
    [markPasswordConfigured, resettingSignInId, toast],
  )

  const sessionLogin = session?.username?.trim().toLowerCase()

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        sortable: true,
        sortValue: (r: OrganisationMember) => r.name,
        render: (r: OrganisationMember) => (
          <div className="min-w-[8rem]">
            <p className="font-medium text-heading">{r.name?.trim() || '—'}</p>
            <p className="text-xs text-muted font-mono truncate max-w-[14rem]">{r.email || r.username}</p>
          </div>
        ),
      },
      {
        key: 'role',
        header: 'Role',
        sortable: true,
        sortValue: (r: OrganisationMember) => r.role_slug,
        render: (r: OrganisationMember) => orgRoleLabel(r.role_slug),
        className: 'whitespace-nowrap',
      },
      {
        key: 'seat',
        header: 'Seat',
        sortable: true,
        sortValue: (r: OrganisationMember) => r.seat_label ?? '',
        render: (r: OrganisationMember) => (
          <span className="font-mono text-xs tabular-nums text-muted">{r.seat_label ?? '—'}</span>
        ),
        className: 'hidden md:table-cell',
      },
      {
        key: 'signed_in',
        header: 'Signed in',
        sortable: true,
        sortValue: (r: OrganisationMember) => (r.signed_in ? 1 : 0),
        render: (r: OrganisationMember) =>
          r.signed_in ? (
            <Badge variant="success" dot>
              Online
            </Badge>
          ) : (
            <span className="text-muted text-sm">—</span>
          ),
        className: 'whitespace-nowrap',
      },
      {
        key: 'last_login_at',
        header: 'Last login',
        sortable: true,
        sortValue: (r: OrganisationMember) => r.last_login_at ?? '',
        render: (r: OrganisationMember) => (
          <span className="text-sm tabular-nums text-muted whitespace-nowrap">
            {r.last_login_at ? formatDateTime(r.last_login_at) : '—'}
          </span>
        ),
        className: 'hidden lg:table-cell',
      },
      {
        key: 'last_activity_at',
        header: 'Last activity',
        sortable: true,
        sortValue: (r: OrganisationMember) => r.last_activity_at ?? '',
        render: (r: OrganisationMember) => (
          <span className="text-sm tabular-nums text-muted whitespace-nowrap">
            {r.last_activity_at ? formatDateTime(r.last_activity_at) : '—'}
          </span>
        ),
        className: 'hidden xl:table-cell',
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        sortValue: (r: OrganisationMember) => (memberIsActive(r) ? 1 : 0),
        render: (r: OrganisationMember) => (
          <Badge variant={memberIsActive(r) ? 'success' : 'default'} className="capitalize">
            {memberIsActive(r) ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      ...(canManage
        ? [
            {
              key: 'actions',
              header: '',
              render: (r: OrganisationMember) => {
                const login = (r.email || r.username).trim().toLowerCase()
                const isSelf = sessionLogin != null && sessionLogin === login
                const active = memberIsActive(r)
                return (
                  <OrgTeamRowActions
                    member={r}
                    passwordConfiguredIds={passwordConfiguredIds}
                    isSelf={isSelf}
                    active={active}
                    onSetPassword={() => openPasswordModal(r)}
                    onResetSignIn={() => void resetMemberSignIn(r)}
                    onToggleStatus={() => void toggleStatus(r)}
                  />
                )
              },
            },
          ]
        : []),
    ],
    [canManage, sessionLogin, toggleStatus, passwordConfiguredIds, openPasswordModal, resetMemberSignIn],
  )

  return (
    <>
      <div className={cn(loading && 'opacity-60')}>
          <DataTable
            columns={columns}
            data={members}
            getRowId={r => String(r.id)}
            emptyMessage="No team members yet."
            paginate
            defaultPageSize={10}
            stickyLastColumn={canManage}
            fullWidth
          />
        </div>

      <OrgTeamCreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        billing={billing}
        billingLoading={billingLoading}
        canRequestSeats={canRequestSeats}
        onCreated={async userId => {
          markPasswordConfigured(userId)
          await load()
          onMembersChanged?.()
          setCreateSuccessOpen(true)
        }}
      />
      <SettingsTeamRedirectSuccessModal
        open={createSuccessOpen}
        onClose={() => setCreateSuccessOpen(false)}
        title="User created"
        description="The user is on a licensed seat. Share their email and password securely so they can sign in."
      />
      <OrgTeamPasswordModal
        member={passwordUser}
        changeMode={passwordChangeMode}
        onClose={() => setPasswordUser(null)}
        onSaved={userId => markPasswordConfigured(userId)}
      />
      <PlatformSignInCredentialsModal
        open={signInCredentials != null}
        onClose={() => setSignInCredentials(null)}
        payload={signInCredentials}
      />
    </>
  )
}

export function SettingsTeamSection({
  title,
  subtitle,
  breadcrumb,
  canManage,
  billing,
  billingLoading,
  canRequestSeats,
  onMembersChanged,
}: {
  title: string
  subtitle?: string
  breadcrumb: ReactNode
  canManage: boolean
  billing: OrganisationDetailResponse | null
  billingLoading: boolean
  canRequestSeats: boolean
  onMembersChanged?: () => void
}) {
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumb={breadcrumb}
        actionsAlign="end"
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <UserPlus className="h-4 w-4" aria-hidden />
              Add user
            </Button>
          ) : undefined
        }
      />
      <SettingsTeamPanel
        canManage={canManage}
        billing={billing}
        billingLoading={billingLoading}
        canRequestSeats={canRequestSeats}
        onMembersChanged={onMembersChanged}
        createOpen={createOpen}
        onCreateOpenChange={setCreateOpen}
      />
    </>
  )
}
