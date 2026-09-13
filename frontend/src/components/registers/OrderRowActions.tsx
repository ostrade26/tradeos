import { useMemo } from 'react'
import { Pencil, Share2, Trash2, Undo2, GitBranch, History, Plus, CircleCheck, RotateCcw } from 'lucide-react'
import { shareOrderOnWhatsApp } from '../../lib/whatsappShare'
import type { TradeOrder } from '../../data/mockData'
import { usePermissions } from '../../hooks/useAuth'
import { useTableDensity } from '../../hooks/useTableDensity'
import { DetailPanelMenu, groupMenuItems, type DetailPanelMenuItem } from '../ui/DetailPanelMenu'

interface OrderRowActionsProps {
  order: TradeOrder
  editHref: string
  canDelete: { ok: boolean; reason?: string }
  canClose?: boolean
  canBuyBack?: boolean
  sellAvailableQty?: number
  onCloseOrder?: () => void
  onBuyBack?: () => void
  onScheduleDelete: () => void
  onCancelDelete: () => void
  onBlockedDelete: (reason: string) => void
}

export function OrderRowActions({
  order,
  editHref,
  canDelete,
  canClose,
  canBuyBack,
  sellAvailableQty,
  onCloseOrder,
  onBuyBack,
  onScheduleDelete,
  onCancelDelete,
  onBlockedDelete,
}: OrderRowActionsProps) {
  const { canEditOrders, isAdmin } = usePermissions()
  const { classes: density } = useTableDensity()
  const isPO = order.side === 'purchase'
  const pathPrefix = isPO ? '/purchase-orders' : '/sales-orders'
  const ref = encodeURIComponent(order.ref)

  const items = useMemo((): DetailPanelMenuItem[] => groupMenuItems([
    {
      items: [
        ...(canEditOrders
          ? [{ type: 'link' as const, label: 'Edit', icon: Pencil, href: editHref }]
          : []),
        ...(isPO
          ? [{
              type: 'link' as const,
              label: (sellAvailableQty ?? 0) > 0 ? 'Sell available' : 'Create SO',
              icon: Plus,
              href: `/sales-orders/new?poRef=${ref}`,
            }]
          : []),
      ],
    },
    ...(canEditOrders
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
    {
      items: [{
        type: 'button',
        label: 'WhatsApp',
        icon: Share2,
        tone: 'whatsapp',
        onClick: () => shareOrderOnWhatsApp(order),
      }],
    },
    ...(isAdmin
      ? [{
          items: [order.deleteScheduledAt
            ? { type: 'button' as const, label: 'Cancel deletion', icon: Undo2, onClick: onCancelDelete }
            : {
                type: 'button' as const,
                label: 'Delete',
                icon: Trash2,
                tone: canDelete.ok ? 'danger' as const : 'muted' as const,
                onClick: () => {
                  if (canDelete.ok) onScheduleDelete()
                  else onBlockedDelete(canDelete.reason ?? 'This order cannot be deleted.')
                },
              },
          ],
        }]
      : []),
  ]), [
    canBuyBack,
    canClose,
    canEditOrders,
    canDelete.ok,
    canDelete.reason,
    editHref,
    isAdmin,
    isPO,
    onBuyBack,
    onBlockedDelete,
    onCancelDelete,
    onCloseOrder,
    onScheduleDelete,
    order,
    pathPrefix,
    ref,
  ])

  return (
    <div className="flex justify-center" onClick={e => e.stopPropagation()}>
      <DetailPanelMenu items={items} tableTrigger={density.menuTrigger} />
    </div>
  )
}
