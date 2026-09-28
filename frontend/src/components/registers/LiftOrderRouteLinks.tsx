import { Link, useNavigate } from 'react-router-dom'
import type { Lift, TradeOrder } from '../../data/mockData'
import { allocationIsInventoryStock, getLiftAllocations, uniqueLiftRefs } from '../../lib/liftAllocations'
import { appPath } from '../../lib/appShellMode'
import { saveRegisterDetailRef } from '../../lib/registerDetailRef'
import { orderRegisterHref, registerModeForOrder } from '../../lib/registerViewMode'
import { isStockLift, STOCK_LIFT_LABEL } from '../../lib/stockLift'
import { formatPoRef, formatSoRef } from '../../lib/tradeRefs'
import { StockPoLink } from './StockPoLink'
import { cn, tableRefCellClass } from '../../lib/utils'
import { useTradeStore } from '../../store/TradeStore'

type LiftOrderFields = Pick<Lift, 'poRef' | 'soRef' | 'liftedQty' | 'allocations' | 'stockLift'>

/** Closed purchase whose goods are already in the godown — show as stock, not as an open PO. */
function closedStockPo(lift: LiftOrderFields, poRef: string, orders: TradeOrder[]): boolean {
  return allocationIsInventoryStock(poRef, getLiftAllocations(lift), orders)
}

function OrderRefLink({
  side,
  orderRef,
}: {
  side: 'purchase' | 'sale'
  orderRef: string
}) {
  const navigate = useNavigate()
  const store = useTradeStore()
  const register = appPath(side === 'purchase' ? '/purchase-orders' : '/sales-orders')
  const order = store.getOrderByRef(orderRef, side)
  const href = orderRegisterHref(side, orderRef, order ? registerModeForOrder(order) : undefined)
  const label = side === 'purchase' ? formatPoRef(orderRef) : formatSoRef(orderRef)

  return (
    <Link
      to={href}
      className={cn(tableRefCellClass, 'hover:underline')}
      onClick={e => {
        e.preventDefault()
        e.stopPropagation()
        // Seed target register detail before nav so a stale persisted ref cannot flash.
        saveRegisterDetailRef(register, orderRef)
        navigate(href)
      }}
    >
      {label}
    </Link>
  )
}

function PoRefLink({ lift, poRef }: { lift: LiftOrderFields; poRef: string }) {
  const { tradeOrders } = useTradeStore()
  if (closedStockPo(lift, poRef, tradeOrders)) return <StockPoLink poRef={poRef} />
  return <OrderRefLink side="purchase" orderRef={poRef} />
}

function RefList({
  side,
  refs,
  lift,
}: {
  side: 'purchase' | 'sale'
  refs: string[]
  lift?: LiftOrderFields
}) {
  return (
    <>
      {refs.map((orderRef, i) => (
        <span key={`${side}-${orderRef}`}>
          {i > 0 && <span className="text-muted font-normal">, </span>}
          {side === 'purchase' && lift
            ? <PoRefLink lift={lift} poRef={orderRef} />
            : <OrderRefLink side={side} orderRef={orderRef} />}
        </span>
      ))}
    </>
  )
}

/** Clickable PO → SO summary for the lift register (each ref opens its own register detail). */
export function LiftOrderRouteLinks({ lift }: { lift: LiftOrderFields }) {
  const { tradeOrders } = useTradeStore()
  const pos = uniqueLiftRefs(lift, 'poRef')
  const sos = uniqueLiftRefs(lift, 'soRef')
  const stock = isStockLift(lift) || getLiftAllocations(lift).every(a => !a.soRef) || sos.length === 0
  const stockOnly = stock && pos.length > 0 && pos.every(poRef => closedStockPo(lift, poRef, tradeOrders))

  if (pos.length === 0 && sos.length === 0) {
    return <span className="text-muted">—</span>
  }

  if (stockOnly) {
    return (
      <span className="whitespace-nowrap">
        <RefList side="purchase" refs={pos} lift={lift} />
      </span>
    )
  }

  if (stock) {
    return (
      <span className="whitespace-nowrap">
        {pos.length > 0 ? <RefList side="purchase" refs={pos} lift={lift} /> : <span className="text-muted">—</span>}
        <span className="text-muted font-normal"> → </span>
        <span className="text-muted font-medium">{STOCK_LIFT_LABEL}</span>
      </span>
    )
  }

  if (pos.length === 1 && sos.length === 1) {
    return (
      <span className="whitespace-nowrap">
        <PoRefLink lift={lift} poRef={pos[0]} />
        <span className="text-muted font-normal"> → </span>
        <OrderRefLink side="sale" orderRef={sos[0]} />
      </span>
    )
  }

  // Multi-allocation: same layout as formatAllocationsSummary (SOs · POs)
  return (
    <span className="whitespace-nowrap">
      {sos.length > 0 && <RefList side="sale" refs={sos} />}
      {sos.length > 0 && pos.length > 0 && <span className="text-muted font-normal"> · </span>}
      {pos.length > 0 && <RefList side="purchase" refs={pos} lift={lift} />}
    </span>
  )
}
