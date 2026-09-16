import { useMemo } from 'react'
import { History, PanelRight, PanelRightClose, Pencil, Trash2, Armchair, Bell } from 'lucide-react'
import { Drawer, DockedPanel } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { EmptyState } from '../ui/EmptyState'
import { DetailPanelMenu, groupMenuItems } from '../ui/DetailPanelMenu'
import type { OrganisationDetailResponse } from '../../api/platformApi'
import { OrganisationSubscriptionPanel } from './OrganisationSubscriptionPanel'

const actionBtnClass = 'h-auto w-full py-2.5 text-sm'

interface PlatformOrganisationDetailDrawerProps {
  detail: OrganisationDetailResponse | null
  loading: boolean
  open: boolean
  onClose: () => void
  docked?: boolean
  onDockChange?: (docked: boolean) => void
  onAddSeat: () => void
  addingSeat: boolean
  onEdit: () => void
  onDelete: () => void
  onResetPrimaryAdminSignIn?: () => void
  resettingPrimaryAdminSignIn?: boolean
  onNotify?: () => void
}

export function PlatformOrganisationDetailDrawer({
  detail,
  loading,
  open,
  onClose,
  docked = false,
  onDockChange,
  onAddSeat,
  addingSeat,
  onEdit,
  onDelete,
  onResetPrimaryAdminSignIn,
  resettingPrimaryAdminSignIn,
  onNotify,
}: PlatformOrganisationDetailDrawerProps) {
  const org = detail?.organisation
  const title = org?.name ?? 'Organisation'
  const subtitle = org?.org_code?.trim() || undefined
  const canDelete = org && !org.sandbox_tools
  const sub = detail?.subscription

  const headerBadges = org ? (
    <>
      <Badge
        variant={org.status === 'active' ? 'success' : 'default'}
        className="capitalize shrink-0"
      >
        {org.status.replace(/_/g, ' ')}
      </Badge>
      {org.sandbox_tools ? <Badge variant="info" className="shrink-0">Sandbox</Badge> : null}
    </>
  ) : undefined

  const panelMenuItems = useMemo(() => {
    if (!org) return []
    return groupMenuItems([
      {
        items: [{ type: 'button', label: 'Edit', icon: Pencil, onClick: onEdit }],
      },
      {
        items: [
          ...(onNotify
            ? [{ type: 'button' as const, label: 'Send notice', icon: Bell, onClick: onNotify }]
            : []),
          {
            type: 'link',
            label: 'Timeline',
            icon: History,
            href: `/platform-admin/audit?organisation_id=${org.id}`,
          },
        ],
      },
      ...(canDelete
        ? [{
            items: [{
              type: 'button' as const,
              label: 'Delete organisation',
              icon: Trash2,
              tone: 'danger' as const,
              onClick: onDelete,
            }],
          }]
        : []),
    ])
  }, [org, canDelete, onEdit, onDelete, onNotify])

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

  const headerActions = (
    <>
      {dockToggle}
      {panelMenuItems.length > 0 && (
        <DetailPanelMenu onItemSelect={onClose} items={panelMenuItems} />
      )}
    </>
  )

  const footer = detail ? (
      <Button
        variant="secondary"
        size="sm"
        className={actionBtnClass}
        loading={addingSeat}
        disabled={!sub && !detail?.licence}
        onClick={onAddSeat}
      >
        <Armchair className="h-4 w-4" aria-hidden />
        Add seat
      </Button>
  ) : undefined

  const content = loading ? (
    <p className="py-6 text-[14px] text-muted">Loading…</p>
  ) : !detail ? (
    <div className="py-6">
      <EmptyState description="Could not load organisation details." />
    </div>
  ) : (
    <OrganisationSubscriptionPanel
      detail={detail}
      onResetPrimaryAdminSignIn={onResetPrimaryAdminSignIn}
      resettingPrimaryAdminSignIn={resettingPrimaryAdminSignIn}
    />
  )

  const panelProps = {
    title,
    subtitle,
    headerBadges,
    footer,
    onClose,
    headerActions,
    width: 'lg' as const,
  }

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
