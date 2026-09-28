import { useMemo } from 'react'
import { Pencil, Share2, Trash2, Undo2, GitBranch, History, Plus, CircleCheck, RotateCcw } from 'lucide-react'
import { shareOrderOnWhatsApp } from '../../lib/whatsappShare'
import type { TradeOrder } from '../../data/mockData'
import { usePermissions } from '../../hooks/useAuth'
import { useTableDensity } from '../../hooks/useTableDensity'
import { DetailPanelMenu, groupMenuItems, type DetailPanelMenuItem } from '../ui/DetailPanelMenu'
import { appPath } from '../../lib/appShellMode'

interface OrderRowActionsProps {
  order: TradeOrder
  editHref: string
  canDelete: { ok: boolean; reason?: string }
  canClose?: boolean
  canBuyBack?: boolean
  sellAvailableQty?: number
  /** When true, show restore + permanent delete instead of schedule delete. */
  deletedTab?: boolean
  onCloseOrder?: () => void
  onBuyBack?: () => void
  onScheduleDelete: () => void
  onCancelDelete: () => void
  onPermanentlyDelete?: () => void
  onBlockedDelete: (reason: string) => void
}

export function OrderRowActions({
  order,
  editHref,
  canDelete,
  canClose,
  canBuyBack,
  sellAvailableQty,
  deletedTab,
  onCloseOrder,
  onBuyBack,
  onScheduleDelete,
  onCancelDelete,
  onPermanentlyDelete,
  onBlockedDelete,
}: OrderRowActionsProps) {
  const { canEditOrders, canCreateOrders, canDeleteOrders } = usePermissions()
  const { classes: density } = useTableDensity()
  const isPO = order.side === 'purchase'
  const pathPrefix = isPO ? appPath('/purchase-orders') : appPath('/sales-orders')
  const ref = encodeURIComponent(order.ref)

  const items = useMemo((): DetailPanelMenuItem[] => groupMenuItems([
    ...(!deletedTab
      ? [{
          items: [
            ...(canEditOrders
              ? [{ type: 'link' as const, label: 'Edit', icon: Pencil, href: editHref }]
              : []),
            ...(isPO && canCreateOrders
              ? [{
                  type: 'link' as const,
                  label: (sellAvailableQty ?? 0) > 0 ? 'Sell available' : 'Create SO',
                  icon: Plus,
                  href: appPath(`/sales-orders/new?poRef=${ref}`),
                }]
              : []),
          ],
        }]
      : []),
    ...(!deletedTab && canEditOrders
      ? [{
          items: [
            ...(canClose && onCloseOrder
              ? [{ type: 'button' as const, label: 'Close order…', icon: CircleCheck, onClick: onCloseOrder }]
              : []),
            ...(canBuyBack && onBuyBack
              ? [{ type: 'button' as const, label: 'Buy back', icon: RotateCcw, onClick: onBuyBack }]
              : []),
          ],
        }]
      : []),
    {
      items: [
        { type: 'link', label: 'Flow', icon: GitBranch, href: `${pathPrefix}/${ref}/flow` },
        { type: 'link', label: 'Timeline', icon: History, href: `${pathPrefix}/${ref}/timeline` },
      ],
    },
    ...(!deletedTab
      ? [{
          items: [{
            type: 'button' as const,
            label: 'WhatsApp',
            icon: Share2,
            tone: 'whatsapp' as const,
            onClick: () => shareOrderOnWhatsApp(order),
          }],
        }]
      : []),
    ...(canDeleteOrders
      ? [{
          items: deletedTab || order.deleteScheduledAt
            ? [
                { type: 'button' as const, label: 'Restore', icon: Undo2, onClick: onCancelDelete },
                ...(onPermanentlyDelete
                  ? [{
                      type: 'button' as const,
                      label: 'Delete permanently',
                      icon: Trash2,
                      tone: 'danger' as const,
                      onClick: onPermanentlyDelete,
                    }]
                  : []),
              ]
            : [{
                type: 'button' as const,
                label: 'Delete',
                icon: Trash2,
                tone: canDelete.ok ? 'danger' as const : 'muted' as const,
                onClick: () => {
                  if (canDelete.ok) onScheduleDelete()
                  else onBlockedDelete(canDelete.reason ?? 'This order cannot be deleted.')
                },
              }],
        }]
      : []),
  ]), [
    canBuyBack,
    canClose,
    canEditOrders,
    canDelete.ok,
    canDelete.reason,
    deletedTab,
    editHref,
    canCreateOrders,
    canDeleteOrders,
    isPO,
    onBuyBack,
    onBlockedDelete,
    onCancelDelete,
    onCloseOrder,
    onPermanentlyDelete,
    onScheduleDelete,
    order,
    pathPrefix,
    ref,
    sellAvailableQty,
  ])

  return (
    <div className="flex justify-center" onClick={e => e.stopPropagation()}>
      <DetailPanelMenu items={items} tableTrigger={density.menuTrigger} />
    </div>
  )
}
