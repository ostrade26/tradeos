import { Plus, Truck } from 'lucide-react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import type { TradeOrder } from '../../data/mockData'
import { formatDeliveryPeriod, toBeLifted } from '../../data/mockData'
import { formatCurrency, formatQty } from '../../lib/utils'
import { contractRateFromOrder, formatContractRate, orderLineAmount } from '../../lib/orderRate'
import { formatOrderRef } from '../../lib/tradeRefs'

interface OrderCreatedModalProps {
  order: TradeOrder | null
  open: boolean
  onClose: () => void
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-caption">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-heading mt-0.5 leading-snug">{value}</p>
    </div>
  )
}

function SuccessCheckmark() {
  return (
    <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
      <span
        className="absolute inset-0 rounded-full bg-success/25 animate-success-ring motion-reduce:hidden"
        aria-hidden
      />
      <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-success-muted animate-success-pop">
        <svg
          viewBox="0 0 24 24"
          className="h-8 w-8 text-success"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path
            d="M5 13l4 4L19 7"
            pathLength={1}
            className="animate-success-check-draw motion-reduce:[stroke-dashoffset:0]"
          />
        </svg>
      </span>
    </div>
  )
}

export function OrderCreatedModal({ order, open, onClose }: OrderCreatedModalProps) {
  if (!order) return null

  const isPO = order.side === 'purchase'
  const remaining = toBeLifted(order)
  const contractRate = contractRateFromOrder(order.rate, order.rateBasis, order.ratePerBasis)
  const lineAmount = orderLineAmount(order.orderQty, contractRate, order.rateBasis)
  const liftHref = isPO
    ? `/lifts/new?poRef=${encodeURIComponent(order.ref)}`
    : `/lifts/new?poRef=${encodeURIComponent(order.poRef ?? '')}&soRef=${encodeURIComponent(order.ref)}`
  const canRecordLift = remaining > 0 && (isPO || Boolean(order.poRef))
  const orderLabel = isPO ? 'Purchase order' : 'Sales order'
  const partyLabel = isPO ? 'Seller' : 'Buyer'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${orderLabel} ${formatOrderRef(order.ref, order.side)} created`}
      hideHeader
      size="md"
      footer={
        isPO ? (
          <div className="grid grid-cols-2 gap-3 w-full">
            <Button
              to={`/sales-orders/new?poRef=${encodeURIComponent(order.ref)}`}
              variant="secondary"
              className="w-full min-h-11"
            >
              <Plus className="h-4 w-4" />
              Create SO
            </Button>
            <Button
              to={canRecordLift ? liftHref : undefined}
              className="w-full min-h-11"
              disabled={!canRecordLift}
            >
              <Truck className="h-4 w-4" />
              Lift
            </Button>
          </div>
        ) : canRecordLift ? (
          <Button to={liftHref} className="w-full min-h-11">
            <Truck className="h-4 w-4" />
            Lift
          </Button>
        ) : undefined
      }
    >
      <div className="-mx-6 -mt-8 px-6 pt-8 pb-6 text-center bg-gray-50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-700">
        <SuccessCheckmark />
        <p className="text-sm font-medium text-success mt-5">{orderLabel} created</p>
        <p className="text-xl font-semibold font-mono text-heading mt-1 tracking-tight">{formatOrderRef(order.ref, order.side)}</p>
        <p className="text-sm text-muted mt-1.5">{order.itemName}</p>
      </div>

      <dl className="pt-6 space-y-5">
        <div className="grid grid-cols-3 gap-x-4 gap-y-4">
          <SummaryStat label="Quantity" value={formatQty(order.orderQty)} />
          <SummaryStat label="Rate" value={formatContractRate(order.rate, order.rateBasis, order.ratePerBasis)} />
          <SummaryStat label="Value" value={formatCurrency(lineAmount)} />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 pt-5 border-t border-gray-200 dark:border-gray-700">
          <SummaryStat label="Delivery" value={formatDeliveryPeriod(order)} />
          <SummaryStat label="Spot" value={order.spot || '—'} />
          <SummaryStat label={partyLabel} value={order.partyName || '—'} />
          {!isPO && (
            <SummaryStat label="Linked PO" value={order.poRef || 'Not linked'} />
          )}
          {order.brokerName && (
            <div className={isPO ? 'col-span-2' : undefined}>
              <SummaryStat label="Broker" value={order.brokerName} />
            </div>
          )}
        </div>
        <div className="pt-5 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-caption">Ready to lift</p>
            <p className="text-base font-semibold tabular-nums text-heading">{formatQty(remaining)}</p>
          </div>
          <p className="text-sm text-caption mt-1.5 leading-relaxed">
            {isPO
              ? 'Sell against this PO or record a lift when the tanker is dispatched.'
              : canRecordLift
                ? 'Record a lift when qty is dispatched against this SO.'
                : 'Link this SO to a PO before recording a lift.'}
          </p>
        </div>
      </dl>
    </Modal>
  )
}
