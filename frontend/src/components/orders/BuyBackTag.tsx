import { Badge } from '../ui/Badge'
import { cn } from '../../lib/utils'
import { hasBuyBacks } from '../../lib/buyBack'
import type { TradeOrder } from '../../data/mockData'

export function BuyBackTag({
  order,
  className,
}: {
  order: Pick<TradeOrder, 'buyBacks' | 'side'>
  className?: string
}) {
  if (order.side !== 'purchase' || !hasBuyBacks(order)) return null
  return (
    <Badge variant="warning" className={cn('text-[10px] shrink-0', className)}>
      Buy back
    </Badge>
  )
}
