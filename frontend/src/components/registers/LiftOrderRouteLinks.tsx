import { Link, useNavigate } from 'react-router-dom'
import type { Lift } from '../../data/mockData'
import { getLiftAllocations, uniqueLiftRefs } from '../../lib/liftAllocations'
import { appPath } from '../../lib/appShellMode'
import { saveRegisterDetailRef } from '../../lib/registerDetailRef'
import { isStockLift, STOCK_LIFT_LABEL } from '../../lib/stockLift'
import { formatPoRef, formatSoRef } from '../../lib/tradeRefs'
import { cn, tableRefCellClass } from '../../lib/utils'

type LiftOrderFields = Pick<Lift, 'poRef' | 'soRef' | 'liftedQty' | 'allocations' | 'stockLift'>

function OrderRefLink({
  side,
  orderRef,
}: {
  side: 'purchase' | 'sale'
  orderRef: string
}) {
  const navigate = useNavigate()
  const register = appPath(side === 'purchase' ? '/purchase-orders' : '/sales-orders')
  const href = `${register}?ref=${encodeURIComponent(orderRef)}`
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

function RefList({
  side,
  refs,
}: {
  side: 'purchase' | 'sale'
  refs: string[]
}) {
  return (
    <>
      {refs.map((orderRef, i) => (
        <span key={`${side}-${orderRef}`}>
          {i > 0 && <span className="text-muted font-normal">, </span>}
          <OrderRefLink side={side} orderRef={orderRef} />
        </span>
      ))}
    </>
  )
}

/** Clickable PO → SO summary for the lift register (each ref opens its own register detail). */
export function LiftOrderRouteLinks({ lift }: { lift: LiftOrderFields }) {
  const pos = uniqueLiftRefs(lift, 'poRef')
  const sos = uniqueLiftRefs(lift, 'soRef')
  const stock = isStockLift(lift) || getLiftAllocations(lift).every(a => !a.soRef) || sos.length === 0

  if (pos.length === 0 && sos.length === 0) {
    return <span className="text-muted">—</span>
  }

  if (stock) {
    return (
      <span className="whitespace-nowrap">
        {pos.length > 0 ? <RefList side="purchase" refs={pos} /> : <span className="text-muted">—</span>}
        <span className="text-muted font-normal"> → </span>
        <span className="text-muted font-medium">{STOCK_LIFT_LABEL}</span>
      </span>
    )
  }

  if (pos.length === 1 && sos.length === 1) {
    return (
      <span className="whitespace-nowrap">
        <OrderRefLink side="purchase" orderRef={pos[0]} />
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
      {pos.length > 0 && <RefList side="purchase" refs={pos} />}
    </span>
  )
}
