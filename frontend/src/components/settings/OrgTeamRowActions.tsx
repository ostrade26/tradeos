import { useMemo } from 'react'
import { KeyRound, UserX, UserCheck, RotateCcw } from 'lucide-react'
import type { OrganisationMember } from '../../api/organisationApi'
import { DetailPanelMenu, groupMenuItems } from '../ui/DetailPanelMenu'
import { useTableDensity } from '../../hooks/useTableDensity'

export function memberPasswordIsSet(
  member: OrganisationMember,
  configuredIds: ReadonlySet<number>,
): boolean {
  return configuredIds.has(member.id) || member.last_login_at != null
}

export function OrgTeamRowActions({
  member,
  passwordConfiguredIds,
  isSelf,
  active,
  onSetPassword,
  onResetSignIn,
  onToggleStatus,
}: {
  member: OrganisationMember
  passwordConfiguredIds: ReadonlySet<number>
  isSelf: boolean
  active: boolean
  onSetPassword: () => void
  onResetSignIn?: () => void
  onToggleStatus: () => void
}) {
  const { classes: density } = useTableDensity()
  const passwordLabel = memberPasswordIsSet(member, passwordConfiguredIds)
    ? 'Change sign-in'
    : 'Set sign-in'

  const items = useMemo(() => {
    const groups: { items: Parameters<typeof groupMenuItems>[0][number]['items'] }[] = [
      {
        items: [
          {
            type: 'button',
            label: passwordLabel,
            icon: KeyRound,
            onClick: onSetPassword,
          },
          ...(!isSelf && onResetSignIn
            ? [{
                type: 'button' as const,
                label: 'Reset sign-in (temp password)',
                icon: RotateCcw,
                onClick: onResetSignIn,
              }]
            : []),
        ],
      },
    ]
    if (!(isSelf && active)) {
      groups.push({
        items: [
          {
            type: 'button',
            label: active ? 'Deactivate' : 'Activate',
            icon: active ? UserX : UserCheck,
            tone: active ? 'danger' : 'default',
            onClick: onToggleStatus,
          },
        ],
      })
    }
    return groupMenuItems(groups)
  }, [active, isSelf, onResetSignIn, onSetPassword, onToggleStatus, passwordLabel])

  return (
    <div className="flex justify-center" onClick={e => e.stopPropagation()}>
      <DetailPanelMenu items={items} tableTrigger={density.menuTrigger} />
    </div>
  )
}
