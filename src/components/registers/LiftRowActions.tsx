import { useMemo } from 'react'
import { Pencil, GitBranch, Share2 } from 'lucide-react'
import type { Lift } from '../../data/mockData'
import { getLiftAllocations } from '../../lib/liftAllocations'
import { shareLiftOnWhatsApp } from '../../lib/whatsappShare'
import { useTableDensity } from '../../hooks/useTableDensity'
import { DetailPanelMenu, groupMenuItems, type DetailPanelMenuItem } from '../ui/DetailPanelMenu'

export function LiftRowActions({ lift }: { lift: Lift }) {
  const { classes: density } = useTableDensity()
  const items = useMemo((): DetailPanelMenuItem[] => {
    const allocations = getLiftAllocations(lift)
    const poRef = allocations[0]?.poRef
    const soRef = allocations[0]?.soRef
    return groupMenuItems([
      {
        items: [{
          type: 'link',
          label: 'Edit',
          icon: Pencil,
          href: `/lifts/${lift.liftRef}/edit`,
        }],
      },
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
      {
        items: [{
          type: 'button',
          label: 'WhatsApp',
          icon: Share2,
          tone: 'whatsapp',
          onClick: () => shareLiftOnWhatsApp(lift),
        }],
      },
    ])
  }, [lift])

  return (
    <div className="flex justify-center" onClick={e => e.stopPropagation()}>
      <DetailPanelMenu items={items} tableTrigger={density.menuTrigger} />
    </div>
  )
}
