import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import type { Lift, TradeOrder } from '../../data/mockData'
import { formatOrderRef } from '../../lib/tradeRefs'
import {
  TradeProfitBreakdown,
  TradeProfitLede,
  TradeProfitSummary,
} from './TradeProfitSection'

interface TradeProfitModalProps {
  po: TradeOrder | null
  orders: TradeOrder[]
  lifts: Lift[]
  open: boolean
  onClose: () => void
}

export function TradeProfitModal({ po, orders, lifts, open, onClose }: TradeProfitModalProps) {
  if (!po) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Trade profit"
      subtitle={formatOrderRef(po.ref, po.side)}
      size="md"
      ledeBody={<TradeProfitLede po={po} orders={orders} lifts={lifts} />}
      secondaryBody={<TradeProfitSummary po={po} orders={orders} lifts={lifts} />}
      footer={(
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      )}
    >
      <TradeProfitBreakdown po={po} orders={orders} lifts={lifts} />
    </Modal>
  )
}
