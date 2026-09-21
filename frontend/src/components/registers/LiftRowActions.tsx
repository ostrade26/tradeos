import { useMemo } from 'react'
import { Pencil, GitBranch, Share2, Trash2, Undo2 } from 'lucide-react'
import type { Lift } from '../../data/mockData'
import { getLiftAllocations } from '../../lib/liftAllocations'
import { shareLiftOnWhatsApp } from '../../lib/whatsappShare'
import { useTableDensity } from '../../hooks/useTableDensity'
import { usePermissions } from '../../hooks/useAuth'
import { DetailPanelMenu, groupMenuItems, type DetailPanelMenuItem } from '../ui/DetailPanelMenu'
import type { DeleteCheck } from '../ui/DeleteActions'

export function LiftRowActions({
  lift,
  canDelete,
  deletedTab,
  onDelete,
  onRestore,
  onPermanentlyDelete,
  onBlockedDelete,
}: {
  lift: Lift
  canDelete?: DeleteCheck
  deletedTab?: boolean
  onDelete?: () => void
  onRestore?: () => void
  onPermanentlyDelete?: () => void
  onBlockedDelete?: (reason: string) => void
}) {
  const { classes: density } = useTableDensity()
  const { canDeleteLifts } = usePermissions()
  const items = useMemo((): DetailPanelMenuItem[] => {
    const allocations = getLiftAllocations(lift)
    const poRef = allocations[0]?.poRef
    const soRef = allocations[0]?.soRef
    return groupMenuItems([
      ...(!deletedTab
        ? [{
            items: [{
              type: 'link' as const,
              label: 'Edit',
              icon: Pencil,
              href: `/lifts/${lift.liftRef}/edit`,
            }],
          }]
        : []),
      {
        items: [
          ...(poRef
            ? [{ type: 'link' as const, label: 'PO flow', icon: GitBranch, href: `/purchase-orders/${encodeURIComponent(poRef)}/flow` }]
            : []),
          ...(soRef
            ? [{ type: 'link' as const, label: 'SO flow', icon: GitBranch, href: `/sales-orders/${encodeURIComponent(soRef)}/flow` }]
            : []),
        ],
      },
      ...(!deletedTab
        ? [{
            items: [{
              type: 'button' as const,
              label: 'WhatsApp',
              icon: Share2,
              tone: 'whatsapp' as const,
              onClick: () => shareLiftOnWhatsApp(lift),
            }],
          }]
        : []),
      ...(canDeleteLifts
        ? [{
            items: deletedTab
              ? [
                  ...(onRestore
                    ? [{ type: 'button' as const, label: 'Restore', icon: Undo2, onClick: onRestore }]
                    : []),
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
              : onDelete
                ? [{
                    type: 'button' as const,
                    label: 'Delete',
                    icon: Trash2,
                    tone: canDelete?.ok === false ? ('muted' as const) : ('danger' as const),
                    onClick: () => {
                      if (canDelete?.ok !== false) onDelete()
                      else onBlockedDelete?.(canDelete?.reason ?? 'This lift cannot be deleted.')
                    },
                  }]
                : [],
          }]
        : []),
    ])
  }, [canDelete, canDeleteLifts, deletedTab, lift, onBlockedDelete, onDelete, onPermanentlyDelete, onRestore])

  return (
    <div className="flex justify-center" onClick={e => e.stopPropagation()}>
      <DetailPanelMenu items={items} tableTrigger={density.menuTrigger} />
    </div>
  )
}
