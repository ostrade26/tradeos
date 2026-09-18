import { useMemo } from 'react'
import {
  History, PanelRight, PanelRightClose, Pencil, Armchair, Bell, KeyRound, Ban, RotateCcw,
} from 'lucide-react'
import { Drawer, DockedPanel } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { EmptyState } from '../ui/EmptyState'
import { DetailPanelMenu, groupMenuItems } from '../ui/DetailPanelMenu'
import type { OrganisationDetailResponse } from '../../api/platformApi'
import { OrganisationSubscriptionPanel } from './OrganisationSubscriptionPanel'

const actionBtnClass = 'h-auto w-full py-2.5 text-sm'

function organisationStatusLabel(status: string): string {
  if (status === 'inactive' || status === 'disabled') return 'deactivated'
  return status.replace(/_/g, ' ')
}

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
  onDeactivate: () => void
  onReactivate: () => void
  onResetPrimaryAdminSignIn?: () => void
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
  onDeactivate,
  onReactivate,
  onResetPrimaryAdminSignIn,
  onNotify,
}: PlatformOrganisationDetailDrawerProps) {
  const org = detail?.organisation
  const title = org?.name ?? 'Organisation'
  const subtitle = org?.org_code?.trim() || undefined
  const sub = detail?.subscription
  const isActive = org?.status === 'active'
  const statusLabel = org ? organisationStatusLabel(org.status) : ''

  const headerBadges = org ? (
    <>
      <Badge
        variant={isActive ? 'success' : 'default'}
        className="capitalize shrink-0"
      >
        {statusLabel}
      </Badge>
      {org.sandbox_tools ? <Badge variant="info" className="shrink-0">Sandbox</Badge> : null}
    </>
  ) : undefined

  const panelMenuItems = useMemo(() => {
    if (!org) return []
    return groupMenuItems([
      {
        items: [
          { type: 'button', label: 'Edit', icon: Pencil, onClick: onEdit },
          ...(detail?.primary_admin_user && onResetPrimaryAdminSignIn
            ? [{
                type: 'button' as const,
                label: 'Reset login',
                icon: KeyRound,
                onClick: onResetPrimaryAdminSignIn,
              }]
            : []),
        ],
      },
      {
        items: [
          {
            type: 'link',
            label: 'Timeline',
            icon: History,
            href: `/platform-admin/audit?organisation_id=${org.id}`,
          },
        ],
      },
      {
        items: [
          isActive
            ? {
                type: 'button' as const,
                label: 'Deactivate organisation',
                icon: Ban,
                tone: 'danger' as const,
                onClick: onDeactivate,
              }
            : {
                type: 'button' as const,
                label: 'Reactivate organisation',
                icon: RotateCcw,
                onClick: onReactivate,
              },
        ],
      },
    ])
  }, [
    org,
    detail?.primary_admin_user,
    isActive,
    onEdit,
    onDeactivate,
    onReactivate,
    onResetPrimaryAdminSignIn,
  ])

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
    <div className="flex gap-2">
      {onNotify ? (
        <Button
          variant="secondary"
          size="sm"
          className={actionBtnClass}
          onClick={onNotify}
        >
          <Bell className="h-4 w-4" aria-hidden />
          Send update to customers
        </Button>
      ) : null}
      <Button
        size="sm"
        className={actionBtnClass}
        loading={addingSeat}
        disabled={!sub && !detail?.licence}
        onClick={onAddSeat}
      >
        <Armchair className="h-4 w-4" aria-hidden />
        Add seat
      </Button>
    </div>
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
