import { Truck, Plus } from 'lucide-react'
import { Button } from '../ui/Button'
import type { TradeOrder } from '../../data/mockData'

const actionBtnClass = 'h-auto w-full py-2.5 text-sm'

interface OrderDetailFooterProps {
  order: TradeOrder
  isPO: boolean
  remaining: number
  linkedSoCount: number
  onPanelClose: () => void
}

export function OrderDetailFooter({
  order,
  isPO,
  remaining,
  linkedSoCount,
  onPanelClose,
}: OrderDetailFooterProps) {
  const liftLabel = isPO && linkedSoCount === 0 ? 'Stock lift' : 'Record lift'
  const liftHref = isPO
    ? `/lifts/new?poRef=${encodeURIComponent(order.ref)}${linkedSoCount === 0 ? '&stock=1' : ''}`
    : `/lifts/new?poRef=${encodeURIComponent(order.poRef ?? '')}&soRef=${encodeURIComponent(order.ref)}`
  const canLift = remaining > 0

  if (isPO) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Button
          to={`/sales-orders/new?poRef=${encodeURIComponent(order.ref)}`}
          variant="secondary"
          size="sm"
          className={actionBtnClass}
          onClick={onPanelClose}
        >
          <Plus className="h-4 w-4" /> Create SO
        </Button>
        <Button
          to={canLift ? liftHref : undefined}
          size="sm"
          className={actionBtnClass}
          disabled={!canLift}
          onClick={canLift ? onPanelClose : undefined}
        >
          <Truck className="h-4 w-4" /> {liftLabel}
        </Button>
      </div>
    )
  }

  return (
    <Button
      to={canLift ? liftHref : undefined}
      size="sm"
      className={actionBtnClass}
      disabled={!canLift}
      onClick={canLift ? onPanelClose : undefined}
    >
      <Truck className="h-4 w-4" /> {liftLabel}
    </Button>
  )
}
