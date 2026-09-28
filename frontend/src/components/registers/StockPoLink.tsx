import { Link, useNavigate } from 'react-router-dom'
import { appPath } from '../../lib/appShellMode'
import { inventoryStockRef, purchaseIsClosed } from '../../lib/stockPo'
import { formatLotRef, refsMatch } from '../../lib/tradeRefs'
import { cn, tableRefCellClass } from '../../lib/utils'
import { useTradeStore } from '../../store/TradeStore'

export { inventoryStockRef, purchaseIsClosed }

/** Closed purchase held as godown stock. Opens the inventory lot. */
export function StockPoLink({
  poRef,
  lotId,
  className,
  onNavigate,
}: {
  poRef: string
  lotId?: string
  className?: string
  onNavigate?: () => void
}) {
  const navigate = useNavigate()
  const store = useTradeStore()
  const po = store.getOrderByRef(poRef, 'purchase')
  const lot = (lotId ? store.lots.find(l => l.id === lotId) : undefined)
    ?? store.lots.find(l => {
      const core = l.lotNumber.replace(/^LOT-/, '')
      return po ? refsMatch(core, po.ref, 'purchase') : refsMatch(core, poRef, 'purchase')
    })
  const href = lot ? appPath(`/inventory/${lot.id}`) : appPath('/inventory')

  return (
    <Link
      to={href}
      className={cn(tableRefCellClass, 'hover:underline', className)}
      onClick={e => {
        e.preventDefault()
        e.stopPropagation()
        onNavigate?.()
        navigate(href)
      }}
    >
      {formatLotRef(poRef)}
    </Link>
  )
}
