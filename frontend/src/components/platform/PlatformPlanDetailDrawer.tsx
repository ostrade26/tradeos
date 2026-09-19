import { useMemo } from 'react'
import {
  ClipboardList,
  CreditCard,
  FileText,
  PanelRight,
  PanelRightClose,
  Pencil,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react'
import { Drawer, DockedPanel } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { DetailPanelMenu, groupMenuItems } from '../ui/DetailPanelMenu'
import {
  DetailGroup,
  DetailPanelBody,
  DetailRow,
} from '../registers/DetailPanelSections'
import type { SubscriptionPlan } from '../../api/platformApi'
import { formatInrCents } from '../../lib/platformLabels'
import { formatDateTime } from '../../lib/utils'

const actionBtnClass = 'h-auto w-full py-2.5 text-sm'

export function PlatformPlanDetailDrawer({
  plan,
  open,
  onClose,
  docked = false,
  onDockChange,
  onEdit,
  onDelete,
}: {
  plan: SubscriptionPlan | null
  open: boolean
  onClose: () => void
  docked?: boolean
  onDockChange?: (docked: boolean) => void
  onEdit: () => void
  onDelete?: () => void
}) {
  const isActive = plan?.status === 'active'
  const canDelete = Boolean(plan && plan.status === 'inactive' && onDelete)
  const adminSeats = plan?.included_admin_seats ?? 0
  const operatorSeats = plan?.included_operator_seats ?? 0
  const totalSeats = adminSeats + operatorSeats || plan?.included_seats || 0

  const panelMenuItems = useMemo(() => {
    if (!plan) return []
    return groupMenuItems([
      {
        items: [
          { type: 'button', label: 'Edit', icon: Pencil, onClick: onEdit },
        ],
      },
      ...(canDelete
        ? [
            {
              items: [
                {
                  type: 'button' as const,
                  label: 'Delete plan',
                  icon: Trash2,
                  tone: 'danger' as const,
                  onClick: onDelete!,
                },
              ],
            },
          ]
        : []),
    ])
  }, [plan, canDelete, onEdit, onDelete])

  if (!plan) return null

  const headerBadges = (
    <Badge variant={isActive ? 'success' : 'default'} className="capitalize shrink-0">
      {plan.status.replace(/_/g, ' ')}
    </Badge>
  )

  const dockToggle = onDockChange ? (
    <button
      type="button"
      onClick={() => onDockChange(!docked)}
      className="hidden lg:inline-flex rounded-lg p-1.5 text-muted hover:bg-gray-100 hover:text-heading dark:hover:bg-zinc-800 cursor-pointer attex-focus"
      aria-label={docked ? 'Undock panel' : 'Dock panel to the right'}
      title={docked ? 'Undock panel' : 'Dock to right'}
    >
      {docked ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
    </button>
  ) : null

  const headerActions = (
    <>
      {dockToggle}
      {panelMenuItems.length > 0 ? (
        <DetailPanelMenu onItemSelect={onClose} items={panelMenuItems} />
      ) : null}
    </>
  )

  const footer = (
    <Button size="sm" className={actionBtnClass} onClick={onEdit}>
      <Pencil className="h-4 w-4" aria-hidden />
      Edit plan
    </Button>
  )

  const content = (
    <DetailPanelBody>
      <DetailGroup title="Overview" icon={ClipboardList}>
        <div className="space-y-2.5">
          <DetailRow label="Slug" value={plan.slug} mono />
          <DetailRow
            label="Type"
            value={(plan.licence_type ?? 'perpetual').replace(/_/g, ' ')}
          />
          <DetailRow label="Created" value={formatDateTime(plan.created_at)} />
          {plan.updated_at && plan.updated_at !== plan.created_at ? (
            <DetailRow label="Updated" value={formatDateTime(plan.updated_at)} />
          ) : null}
        </div>
      </DetailGroup>

      {plan.description?.trim() ? (
        <DetailGroup title="Description" icon={FileText} surface="muted">
          <p className="text-sm text-heading whitespace-pre-wrap leading-relaxed">
            {plan.description.trim()}
          </p>
        </DetailGroup>
      ) : null}

      <DetailGroup title="Pricing" icon={Wallet} surface="muted">
        <div className="space-y-2.5">
          <DetailRow label="Licence" value={formatInrCents(plan.licence_price_cents)} highlight />
          <DetailRow label="AMC / year" value={formatInrCents(plan.amc_price_cents)} />
          <DetailRow
            label="Add-on seat licence"
            value={formatInrCents(plan.additional_seat_licence_cents)}
          />
          <DetailRow
            label="Add-on seat AMC"
            value={formatInrCents(plan.additional_seat_amc_cents)}
          />
        </div>
      </DetailGroup>

      <DetailGroup title="Seats & AMC terms" icon={Users} surface="muted">
        <div className="space-y-2.5">
          <DetailRow
            label="Included seats"
            value={`${totalSeats} (${adminSeats} admin / ${operatorSeats} operator)`}
          />
          <DetailRow
            label="AMC duration"
            value={`${plan.amc_duration_months ?? 12} months`}
          />
          <DetailRow label="Grace period" value={`${plan.amc_grace_days ?? 0} days`} />
        </div>
      </DetailGroup>
    </DetailPanelBody>
  )

  const panelProps = {
    title: plan.name,
    headerBadges,
    headerIcon: CreditCard,
    footer,
    onClose,
    headerActions,
    width: 'md' as const,
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
