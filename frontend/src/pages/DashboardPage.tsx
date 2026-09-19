import {
  Package, FileText, Truck, Send
} from 'lucide-react'
import { StatCard } from '../components/ui/Card'
import { formatCurrency, formatQty, formatDateHeading } from '../lib/utils'
import { useTradeStore } from '../store/TradeStore'
import { toBeLifted } from '../data/mockData'
import { ActionInbox } from '../components/dashboard/ActionInbox'
import { TradeGlossaryTip } from '../components/dashboard/TradeGlossaryTip'
import { DashboardQuickActions } from '../components/dashboard/DashboardQuickActions'
import { DashboardInTransitLifts } from '../components/dashboard/DashboardInTransitLifts'
import { DashboardRecentActivity } from '../components/dashboard/DashboardRecentActivity'
import { DashboardExceptionsSnapshot } from '../components/dashboard/DashboardExceptionsSnapshot'
import { DashboardInventorySnapshot } from '../components/dashboard/DashboardInventorySnapshot'
import { buildActionInbox } from '../lib/actionInbox'
import { appPath } from '../lib/appShellMode'

export function DashboardPage() {
  const store = useTradeStore()
  const { lots } = store

  const poPending = store.getPOPending()
  const soPending = store.getSOPending()
  const lowStockLots = lots.filter(l => l.available < 20)
  const inventoryValue = lots.reduce((sum, l) => sum + l.remaining * l.purchasePrice, 0)
  const totalStockMt = lots.reduce((sum, l) => sum + l.remaining, 0)
  const availableMt = lots.reduce((sum, l) => sum + l.available, 0)
  const poToLiftMt = poPending.reduce((s, o) => s + toBeLifted(o), 0)
  const soToLiftMt = soPending.reduce((s, o) => s + toBeLifted(o), 0)
  const poPartial = poPending.filter(o => o.status === 'partial').length
  const soPartial = soPending.filter(o => o.status === 'partial').length
  const purchaseOrders = store.tradeOrders.filter(o => o.side === 'purchase')
  const salesOrders = store.tradeOrders.filter(o => o.side === 'sale')
  const pendingLifts = store.lifts.filter(l => l.status === 'pending')
  const inboxCount = buildActionInbox(store).length
  const todayLabel = formatDateHeading()

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-semibold text-heading tracking-tight">Today</h1>
            <TradeGlossaryTip />
          </div>
          <p className="text-sm text-muted mt-0.5">
            {todayLabel}
            {' · '}
            {inboxCount === 0
              ? 'No items need attention — start by creating a purchase order'
              : `${inboxCount} item${inboxCount === 1 ? '' : 's'} need attention`}
          </p>
        </div>
        <DashboardQuickActions />
      </div>

      <div className="grid grid-cols-1 min-[520px]:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          to={appPath('/inventory')}
          label="Inventory Value"
          value={formatCurrency(inventoryValue)}
          change={lots.length ? `${formatQty(totalStockMt)} on hand` : 'No lots yet'}
          changeType="neutral"
          details={lots.length ? [
            `${lots.length} active lot${lots.length === 1 ? '' : 's'}`,
            formatQty(availableMt) + ' available to sell',
            lowStockLots.length ? `${lowStockLots.length} low-stock alert${lowStockLots.length === 1 ? '' : 's'}` : 'Stock levels healthy',
          ] : undefined}
          icon={<Package className="h-4 w-4" />}
        />
        <StatCard
          to={appPath('/purchase-orders')}
          label="Open POs"
          value={String(poPending.length)}
          change={poPending.length ? `${formatQty(poToLiftMt)} to lift` : 'None open'}
          changeType="neutral"
          details={poPending.length ? [
            `${purchaseOrders.length} total purchase orders`,
            poPartial ? `${poPartial} partially lifted` : 'No partial lifts yet',
          ] : ['Create a PO to start buying']}
          icon={<FileText className="h-4 w-4" />}
        />
        <StatCard
          to={appPath('/sales-orders')}
          label="Open SOs"
          value={String(soPending.length)}
          change={soPending.length ? `${formatQty(soToLiftMt)} to lift` : 'None open'}
          changeType="neutral"
          details={soPending.length ? [
            `${salesOrders.length} total sales orders`,
            soPartial ? `${soPartial} partially lifted` : 'No partial lifts yet',
          ] : ['Create an SO to start selling']}
          icon={<Send className="h-4 w-4" />}
        />
        <StatCard
          to={appPath('/lifts')}
          label="Lifts"
          value={String(store.lifts.length)}
          change={pendingLifts.length ? `${pendingLifts.length} in transit` : 'None in transit'}
          changeType="neutral"
          details={[
            `${formatQty(store.lifts.reduce((s, l) => s + l.liftedQty, 0))} lifted overall`,
            `${purchaseOrders.length} PO · ${salesOrders.length} SO`,
          ]}
          icon={<Truck className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <ActionInbox className="h-full" />
        <DashboardRecentActivity className="h-full" />
        <DashboardInTransitLifts className="h-full" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <DashboardExceptionsSnapshot className="h-full" />
        <DashboardInventorySnapshot className="h-full" />
      </div>
    </div>
  )
}
