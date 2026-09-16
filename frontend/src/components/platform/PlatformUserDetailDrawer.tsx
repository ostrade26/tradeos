import { useMemo } from 'react'
import { History, PanelRight, PanelRightClose, Pencil, Trash2, UserX } from 'lucide-react'
import { Drawer, DockedPanel } from '../ui/Drawer'
import { DetailPanelMenu, groupMenuItems } from '../ui/DetailPanelMenu'
import type { OrgRoleSlug, PlatformUser } from '../../api/platformApi'
import { PlatformUserDetailPanel } from './PlatformUserDetailPanel'

interface PlatformUserDetailDrawerProps {
  user: PlatformUser | null
  open: boolean
  onClose: () => void
  docked?: boolean
  onDockChange?: (docked: boolean) => void
  onPatchRole: (slug: OrgRoleSlug) => void
  onEdit: () => void
  onToggleStatus: () => void
  onDelete: () => void
  updating: boolean
}

export function PlatformUserDetailDrawer({
  user,
  open,
  onClose,
  docked = false,
  onDockChange,
  onPatchRole,
  onEdit,
  onToggleStatus,
  onDelete,
  updating,
}: PlatformUserDetailDrawerProps) {
  if (!user) return null

  const panelMenuItems = useMemo(() => {
    return groupMenuItems([
      {
        items: [{ type: 'button', label: 'Edit', icon: Pencil, onClick: onEdit }],
      },
      {
        items: [
          {
            type: 'link',
            label: 'Timeline',
            icon: History,
            href: `/platform-admin/audit?user_id=${user.id}`,
          },
        ],
      },
      {
        items: [{
          type: 'button',
          label: user.status === 'active' ? 'Disable user' : 'Enable user',
          icon: UserX,
          onClick: onToggleStatus,
        }],
      },
      {
        items: [{
          type: 'button',
          label: 'Delete user',
          icon: Trash2,
          tone: 'danger',
          onClick: onDelete,
        }],
      },
    ])
  }, [user.id, user.status, onEdit, onToggleStatus, onDelete])

  const dockToggle = onDockChange && (
    <button
      type="button"
      onClick={() => onDockChange(!docked)}
      className="hidden lg:inline-flex rounded-lg p-1.5 text-muted hover:bg-gray-100 hover:text-heading dark:hover:bg-zinc-800 cursor-pointer attex-focus"
      aria-label={docked ? 'Undock panel' : 'Dock panel to the right'}
      title={docked ? 'Undock panel' : 'Dock to right'}
    >
      {docked ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
    </button>
  )

  const panelProps = {
    title: user.name,
    subtitle: user.username,
    onClose,
    headerActions: (
      <>
        {dockToggle}
        <DetailPanelMenu onItemSelect={onClose} items={panelMenuItems} />
      </>
    ),
    width: 'lg' as const,
  }

  const content = (
    <PlatformUserDetailPanel user={user} updating={updating} onPatchRole={onPatchRole} />
  )

  if (docked) {
    if (!open) return null
    return <DockedPanel {...panelProps}>{content}</DockedPanel>
  }

  return (
    <Drawer open={open} {...panelProps}>
      {content}
    </Drawer>
  )
}
