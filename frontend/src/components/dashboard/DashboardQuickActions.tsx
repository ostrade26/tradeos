import { FileText, Send, Truck } from 'lucide-react'
import { Button } from '../ui/Button'
import { useTradeStore } from '../../store/TradeStore'
import { formatPoRef } from '../../lib/tradeRefs'
import { appPath } from '../../lib/appShellMode'

export function DashboardQuickActions() {
  const store = useTradeStore()
  const sellablePo = store.getPOPending().find(po => store.getRemainingSellQty(po.ref) > 0)

  return (
    <div className="flex flex-wrap gap-2">
      <Button to={appPath('/purchase-orders/new')} variant="secondary" size="sm">
        <FileText className="h-4 w-4" />
        New PO
      </Button>
      <Button
        to={sellablePo
          ? appPath(`/sales-orders/new?poRef=${encodeURIComponent(sellablePo.ref)}`)
          : appPath('/sales-orders/new')}
        variant="secondary"
        size="sm"
      >
        <Send className="h-4 w-4" />
        {sellablePo ? `Create SO · ${formatPoRef(sellablePo.ref)}` : 'New SO'}
      </Button>
      <Button to={appPath('/lifts/new')} variant="secondary" size="sm">
        <Truck className="h-4 w-4" />
        Record lift
      </Button>
    </div>
  )
}
