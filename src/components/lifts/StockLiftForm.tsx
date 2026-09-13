import { QtyInput } from '../ui/QtyInput'
import { Select } from '../ui/Select'
import { formatQty } from '../../lib/utils'
import { orderDropdownOption } from '../../lib/orderSelectOptions'
import { remainingOnOrder } from '../../lib/liftAllocations'
import { STOCK_LIFT_LABEL } from '../../lib/stockLift'
import type { Lift, TradeOrder } from '../../data/mockData'
import { toBeLifted } from '../../data/mockData'

export type StockLiftDraft = {
  poRef: string
  qty: string
}

interface StockLiftFormProps {
  value: StockLiftDraft
  onChange: (value: StockLiftDraft) => void
  orders: TradeOrder[]
  lifts: Lift[]
  itemFilter: string
  sellerFilter?: string
  excludeLiftId?: string
  disabled?: boolean
}

export function StockLiftForm({
  value,
  onChange,
  orders,
  lifts,
  itemFilter,
  sellerFilter,
  excludeLiftId,
  disabled,
}: StockLiftFormProps) {
  const pendingPOs = orders.filter(o =>
    o.side === 'purchase'
    && o.status !== 'completed'
    && o.status !== 'cancelled'
    && toBeLifted(o) > 0
    && (!itemFilter || o.itemName === itemFilter)
    && (!sellerFilter || (o.sellerName || o.partyName) === sellerFilter),
  )

  const po = orders.find(o => o.ref === value.poRef && o.side === 'purchase')
  const poLeft = po ? remainingOnOrder(po, lifts, excludeLiftId) : 0
  const rowQty = parseFloat(value.qty) || 0

  const setPo = (poRef: string) => {
    const nextPo = orders.find(o => o.ref === poRef && o.side === 'purchase')
    const left = nextPo ? remainingOnOrder(nextPo, lifts, excludeLiftId) : 0
    onChange({
      poRef,
      qty: left > 0 ? String(left) : '',
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-1">Stock this lift</h3>
        <p className="text-xs text-muted">
          Receive goods from a PO into {STOCK_LIFT_LABEL.toLowerCase()} — no sales order needed yet.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Purchase order"
          searchable
          disabled={disabled}
          options={[
            { value: '', label: 'Select PO…' },
            ...pendingPOs.map(o => orderDropdownOption(o, remainingOnOrder(o, lifts, excludeLiftId))),
          ]}
          value={value.poRef}
          onChange={e => setPo(e.target.value)}
        />

        {po && (
          <QtyInput
            label="Quantity to stock (MT)"
            value={value.qty}
            disabled={disabled}
            maxQty={poLeft > 0 ? poLeft : undefined}
            maxQtyMessage={`${po.ref} only has ${formatQty(poLeft)} left to lift`}
            onChange={e => onChange({ ...value, qty: e.target.value })}
          />
        )}

        {po && rowQty > 0 && (
          <p className="text-xs text-muted sm:col-span-2">
            {po.itemName} from {po.partyName} · {formatQty(rowQty)} MT → your inventory
          </p>
        )}
      </div>
    </div>
  )
}
