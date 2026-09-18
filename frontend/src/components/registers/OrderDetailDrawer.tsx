import { useEffect, useMemo, useState } from 'react'
import {
  Users,
  Package,
  IndianRupee,
  FileText,
  PanelRight,
  PanelRightClose,
  RotateCcw,
  Pencil,
  GitBranch,
  History,
  MessageCircle,
  CircleCheck,
  Plus,
  Trash2,
  Undo2,
} from 'lucide-react'
import { Drawer, DockedPanel } from '../ui/Drawer'
import { DetailPanelMenu, groupMenuItems, type DetailPanelMenuItem } from '../ui/DetailPanelMenu'
import { Badge, StatusBadge } from '../ui/Badge'
import { VerifiedPeriod } from '../ui/GroupedDataTable'
import { formatDate, formatCurrency, formatQty } from '../../lib/utils'
import { formatDeletionDate } from '../../lib/orderDeletion'
import { formatContractRate, orderLineAmount, contractRateFromOrder } from '../../lib/orderRate'
import { formatOrderRef } from '../../lib/tradeRefs'
import { usePermissions } from '../../hooks/useAuth'
import { useAccountTrader } from '../../lib/useAccountTrader'
import {
  type TradeOrder,
  type OrderSide,
  toBeLifted,
} from '../../data/mockData'
import { canBuyBackPO, totalBuyBackQty } from '../../lib/buyBack'
import { BuyBackModal } from '../orders/BuyBackModal'
import { CloseOrderModal } from '../orders/CloseOrderModal'
import { canCloseOrder, completionTypeLabel } from '../../lib/orderClosure'
import { BuyBackTag } from '../orders/BuyBackTag'
import { useTradeStore } from '../../store/TradeStore'
import {
  DetailGroup,
  DetailHero,
  DetailPanelBody,
  DetailRow,
  DetailInlineStat,
  DetailInlineStatRow,
  DetailMetricsSection,
  PartyRow,
} from './DetailPanelSections'
import { OrderDetailFooter } from './OrderDetailFooter'
import { OrderRelatedSection } from './OrderRelatedSection'
import { TradeProfitSection } from '../orders/TradeProfitSection'
import { shareOrderOnWhatsApp } from '../../lib/whatsappShare'
import { appPath } from '../../lib/appShellMode'

function formatBrokerage(order: TradeOrder): string {
  if (order.brokeragePerTon != null && order.brokeragePerTon > 0) {
    return `₹${order.brokeragePerTon.toLocaleString('en-IN')}/MT`
  }
  if (order.brokeragePct > 0) return `${order.brokeragePct}%`
  return '—'
}

interface OrderDetailDrawerProps {
  order: TradeOrder | null
  open: boolean
  onClose: () => void
  docked?: boolean
  onDockChange?: (docked: boolean) => void
  onScheduleDelete?: () => void
  onCancelDelete?: () => void
  onBlockedDelete?: (reason: string) => void
}

export function OrderDetailDrawer({
  order, open, onClose, docked = false, onDockChange,
  onScheduleDelete, onCancelDelete, onBlockedDelete,
}: OrderDetailDrawerProps) {
  const store = useTradeStore()
  const { canEditOrders, canCreateOrders, canDeleteOrders } = usePermissions()
  const { name: accountTrader } = useAccountTrader()
  const [buyBackOpen, setBuyBackOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)

  useEffect(() => {
    setBuyBackOpen(false)
    setCloseOpen(false)
  }, [order?.ref])

  const closeCheck = useMemo(
    () => (order ? canCloseOrder(order, store.lifts, store.balanceSettlements ?? [], store.tradeOrders) : null),
    [order, store.lifts, store.balanceSettlements, store.tradeOrders],
  )

  const buyBackCheck = useMemo(
    () => (order?.side === 'purchase'
      ? canBuyBackPO(order, store.lifts, store.getSOsForPO(order.ref))
      : { ok: false }),
    [order, store.lifts, store.tradeOrders],
  )

  const panelMenuItems = useMemo((): DetailPanelMenuItem[] => {
    if (!order) return []
    const isPO = order.side === 'purchase'
    const pathPrefix = isPO ? appPath('/purchase-orders') : appPath('/sales-orders')
    const ref = encodeURIComponent(order.ref)

    return groupMenuItems([
      {
        items: [
          ...(canEditOrders
            ? [{
                type: 'link' as const,
                label: 'Edit',
                icon: Pencil,
                href: `${pathPrefix}/${ref}/edit`,
              }]
            : []),
          ...(isPO && canCreateOrders
            ? [{
                type: 'link' as const,
                label: store.getRemainingSellQty(order.ref) > 0 ? 'Sell available' : 'Create SO',
                icon: Plus,
                href: appPath(`/sales-orders/new?poRef=${ref}`),
              }]
            : []),
        ],
      },
      {
        items: [
          { type: 'link', label: 'Flow', icon: GitBranch, href: `${pathPrefix}/${ref}/flow` },
          { type: 'link', label: 'Timeline', icon: History, href: `${pathPrefix}/${ref}/timeline` },
        ],
      },
      ...(canEditOrders
        ? [{
            items: [
              ...(closeCheck?.ok
                ? [{ type: 'button' as const, label: 'Close order…', icon: CircleCheck, onClick: () => setCloseOpen(true) }]
                : []),
              ...(isPO && buyBackCheck.ok
                ? [{ type: 'button' as const, label: 'Buy back', icon: RotateCcw, onClick: () => setBuyBackOpen(true) }]
                : []),
            ],
          }]
        : []),
      {
        items: [{
          type: 'button',
          label: 'WhatsApp',
          icon: MessageCircle,
          tone: 'whatsapp',
          onClick: () => shareOrderOnWhatsApp(order),
        }],
      },
      ...(canDeleteOrders && (onScheduleDelete || onCancelDelete) ? [{
        items: [order.deleteScheduledAt
          ? { type: 'button' as const, label: 'Cancel deletion', icon: Undo2, onClick: () => onCancelDelete?.() }
          : {
              type: 'button' as const,
              label: 'Delete',
              icon: Trash2,
              tone: store.canDeleteOrder(order.id).ok ? 'danger' as const : 'muted' as const,
              onClick: () => {
                const check = store.canDeleteOrder(order.id)
                if (check.ok) onScheduleDelete?.()
                else onBlockedDelete?.(check.reason ?? 'This order cannot be deleted.')
              },
            },
        ],
      }] : []),
    ])
  }, [canCreateOrders, canDeleteOrders, canEditOrders, order, closeCheck?.ok, buyBackCheck.ok, onScheduleDelete, onCancelDelete, onBlockedDelete, store])

  if (!order) return null

  const closureLabel = completionTypeLabel(order.completionType)

  const isPO = order.side === 'purchase'
  const shortLabel = isPO ? 'PO' : 'SO'
  const contractRate = contractRateFromOrder(order.rate, order.rateBasis, order.ratePerBasis)
  const lineAmount = orderLineAmount(order.orderQty, contractRate, order.rateBasis)
  const remaining = toBeLifted(order)
  const liftPct = order.orderQty > 0 ? Math.min(100, (order.liftedQty / order.orderQty) * 100) : 0

  const linkedSOs = isPO ? store.getSOsForPO(order.ref) : []
  const buyBackTotal = isPO ? totalBuyBackQty(order) : 0

  const seller = order.sellerName || (isPO ? order.partyName : accountTrader)
  const buyer = order.buyerName || (!isPO ? order.partyName : accountTrader)

  const dockToggle = onDockChange && (
    <button
      type="button"
      onClick={() => onDockChange(!docked)}
      className="hidden lg:inline-flex rounded-lg p-1.5 text-muted hover:bg-gray-100 hover:text-heading dark:hover:bg-zinc-800 cursor-pointer attex-focus"
      aria-label={docked ? 'Undock panel' : 'Dock panel to the right'}
      title={docked ? 'Undock panel' : 'Dock to right'}
    >
      {docked ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
    </button>
  )

  const headerActions = (
    <>
      {dockToggle}
      <DetailPanelMenu onItemSelect={onClose} items={panelMenuItems} />
    </>
  )

  const footer = (
    <OrderDetailFooter
      order={order}
      isPO={isPO}
      remaining={remaining}
      linkedSoCount={linkedSOs.length}
      buyBackOk={canEditOrders && buyBackCheck.ok}
      onBuyBack={() => setBuyBackOpen(true)}
      onPanelClose={onClose}
    />
  )

  const content = (
    <DetailPanelBody>
      <DetailHero>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold text-heading leading-snug">{order.itemName}</p>
            {order.spot && (
              <p className="text-xs text-muted mt-0.5 leading-snug">{order.spot}</p>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-1.5 shrink-0 max-w-[52%]">
            {isPO && <BuyBackTag order={order} />}
            <StatusBadge status={order.status} />
            {closureLabel && <Badge variant="default">{closureLabel}</Badge>}
            {order.deliveryType === 'ready' && <Badge variant="info">Ready</Badge>}
            {order.deleteScheduledAt && (
              <Badge variant="warning">Deletes {formatDeletionDate(order.deleteScheduledAt)}</Badge>
            )}
          </div>
        </div>
      </DetailHero>

      <DetailMetricsSection>
        <DetailInlineStatRow>
          <DetailInlineStat label="Order" value={formatQty(order.orderQty)} />
          <DetailInlineStat label="Lifted" value={formatQty(order.liftedQty)} valueClassName="text-success" />
          <DetailInlineStat
            label="Pending"
            value={formatQty(remaining)}
            valueClassName={remaining > 0 ? 'text-warning' : undefined}
          />
        </DetailInlineStatRow>
      </DetailMetricsSection>

      <DetailMetricsSection>
        <div>
          <div className="flex justify-between text-xs text-muted mb-1">
            <span>Lift progress</span>
            <span className="tabular-nums">{liftPct.toFixed(0)}%</span>
          </div>
          <div className="h-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-success transition-all"
              style={{ width: `${liftPct}%` }}
            />
          </div>
        </div>
        <div className="flex items-baseline justify-between gap-4 text-sm">
          <p className="min-w-0">
            <span className="text-muted">Value </span>
            <span className="font-semibold tabular-nums text-heading">{formatCurrency(lineAmount)}</span>
          </p>
          <p className="text-right shrink-0">
            <span className="text-muted">Rate </span>
            <span className="font-medium text-heading">{formatContractRate(order.rate, order.rateBasis, order.ratePerBasis)}</span>
          </p>
        </div>
      </DetailMetricsSection>

      <DetailGroup title="Parties" icon={Users}>
        <PartyRow seller={seller} buyer={buyer} />
      </DetailGroup>

      <DetailGroup title="Delivery" icon={Package}>
        <DetailRow
          label="Period"
          value={
            <VerifiedPeriod
              start={order.deliveryPeriodStart}
              end={order.deliveryPeriodEnd}
              deliveryType={order.deliveryType}
              verified={order.deliveryPeriodVerified}
            />
          }
        />
        <DetailRow label="Type" value={order.deliveryType === 'ready' ? 'Ready (same day)' : 'Period'} />
        <DetailRow label="Spot" value={order.spot} />
      </DetailGroup>

      <DetailGroup title="Pricing" icon={IndianRupee}>
        <DetailRow label="Contract rate" value={formatContractRate(order.rate, order.rateBasis, order.ratePerBasis)} highlight />
        <DetailRow label="Tax (GST)" value={`${order.taxRate}%`} />
        <DetailRow label="Line amount" value={formatCurrency(lineAmount)} highlight />
      </DetailGroup>

      <DetailGroup title="Terms & broker" icon={FileText}>
        <DetailRow label="Broker" value={order.brokerName} />
        <DetailRow label="Brokerage" value={formatBrokerage(order)} />
        {order.brokerContractRef && (
          <DetailRow label="Broker contract #" value={order.brokerContractRef} mono />
        )}
        <DetailRow label="Payment terms" value={order.paymentTerms} />
        {order.remarks && <DetailRow label="Remarks" value={order.remarks} />}
      </DetailGroup>

      {isPO && (order.buyBacks?.length ?? 0) > 0 && (
        <DetailGroup title="Buy backs" icon={RotateCcw}>
          {order.buyBacks!.map(bb => (
            <DetailRow
              key={bb.id}
              label={formatDate(bb.date)}
              value={`${formatQty(bb.qtyMt)} @ ${formatContractRate(bb.rate, bb.rateBasis, bb.ratePerBasis)}`}
            />
          ))}
          {buyBackTotal > 0 && (
            <DetailRow label="Total bought back" value={formatQty(buyBackTotal)} highlight />
          )}
        </DetailGroup>
      )}

      <OrderRelatedSection
        order={order}
        linkedSOs={linkedSOs}
        lifts={store.lifts}
        onNavigate={onClose}
      />

      {isPO && (
        <TradeProfitSection
          po={order}
          orders={store.tradeOrders}
          lifts={store.lifts}
        />
      )}
    </DetailPanelBody>
  )

  const panelProps = {
    title: formatOrderRef(order.ref, order.side),
    subtitle: `${shortLabel} · ${formatDate(order.date)}`,
    footer,
    onClose,
    headerActions,
    width: 'lg' as const,
  }

  if (docked) {
    if (!open) return null
    return (
      <>
        <DockedPanel {...panelProps}>
          {content}
        </DockedPanel>
        <BuyBackModal order={order} open={buyBackOpen} onClose={() => setBuyBackOpen(false)} />
        <CloseOrderModal order={order} open={closeOpen} onClose={() => setCloseOpen(false)} />
      </>
    )
  }

  return (
    <>
      <Drawer open={open} variant="registerDetail" {...panelProps}>
        {content}
      </Drawer>
      <BuyBackModal order={order} open={buyBackOpen} onClose={() => setBuyBackOpen(false)} />
      <CloseOrderModal order={order} open={closeOpen} onClose={() => setCloseOpen(false)} />
    </>
  )
}

export function findOrderByRef(store: ReturnType<typeof useTradeStore>, ref: string, side: OrderSide): TradeOrder | undefined {
  return store.tradeOrders.find(o => o.ref === ref && o.side === side)
}
