import { useEffect, useMemo, useState } from 'react'
import {
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
  TrendingUp,
} from 'lucide-react'
import { Drawer, DockedPanel } from '../ui/Drawer'
import { DetailPanelMenu, groupMenuItems, type DetailPanelMenuItem } from '../ui/DetailPanelMenu'
import { Badge, StatusBadge } from '../ui/Badge'
import { VerifiedPeriod } from '../ui/GroupedDataTable'
import { formatDate, formatQty } from '../../lib/utils'
import { formatContractRate } from '../../lib/orderRate'
import { formatOrderRef, refCore } from '../../lib/tradeRefs'
import { usePermissions } from '../../hooks/useAuth'
import {
  type TradeOrder,
  type OrderSide,
  toBeLifted,
  unliftedQty,
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
} from './DetailPanelSections'
import { OrderDetailFooter } from './OrderDetailFooter'
import { OrderRelatedSection } from './OrderRelatedSection'
import { TradeProfitModal } from '../orders/TradeProfitModal'
import { shareOrderOnWhatsApp } from '../../lib/whatsappShare'
import { appPath } from '../../lib/appShellMode'

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
  const [buyBackOpen, setBuyBackOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [tradeProfitOpen, setTradeProfitOpen] = useState(false)

  useEffect(() => {
    setBuyBackOpen(false)
    setCloseOpen(false)
    setTradeProfitOpen(false)
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
          ...(isPO
            ? [{ type: 'button' as const, label: 'Trade profit', icon: TrendingUp, onClick: () => setTradeProfitOpen(true) }]
            : []),
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
  const remaining = toBeLifted(order)
  const pending = unliftedQty(order)

  const linkedSOs = isPO ? store.getSOsForPO(order.ref) : []
  const buyBackTotal = isPO ? totalBuyBackQty(order) : 0

  const productLine = order.spot
    ? `${order.itemName} • ${order.spot}`
    : order.itemName

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
      onPanelClose={onClose}
    />
  )

  const content = (
    <DetailPanelBody>
      <DetailHero>
        <div className="min-w-0">
          <p className="text-base font-semibold text-heading leading-snug">{order.partyName}</p>
          <div className="flex items-start justify-between gap-3 mt-0.5">
            <p className="text-[14px] text-muted leading-snug min-w-0">{productLine}</p>
            <div className="flex flex-wrap justify-end gap-1.5 shrink-0">
              {isPO && <BuyBackTag order={order} />}
              <StatusBadge status={order.status} />
              {closureLabel && <Badge variant="default">{closureLabel}</Badge>}
              {order.deliveryType === 'ready' && <Badge variant="info">Ready</Badge>}
            </div>
          </div>
        </div>
      </DetailHero>

      <DetailMetricsSection>
        <DetailInlineStatRow>
          <DetailInlineStat label="Order" value={formatQty(order.orderQty)} />
          <DetailInlineStat label="Delivered" value={formatQty(order.liftedQty)} valueClassName="text-success" />
          <DetailInlineStat label="Pending" value={formatQty(pending)} />
        </DetailInlineStatRow>
      </DetailMetricsSection>

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
      </DetailGroup>

      <DetailGroup title="Pricing" icon={IndianRupee}>
        <DetailRow label="Contract rate" value={formatContractRate(order.rate, order.rateBasis, order.ratePerBasis)} highlight />
        <DetailRow label="Tax (GST)" value={`${order.taxRate}%`} />
      </DetailGroup>

      <DetailGroup title="Terms & broker" icon={FileText}>
        <DetailRow label="Broker" value={order.brokerName} />
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
        <CloseOrderModal
          orders={order ? [order] : []}
          open={closeOpen}
          onClose={() => setCloseOpen(false)}
        />
        <TradeProfitModal
          po={isPO ? order : null}
          orders={store.tradeOrders}
          lifts={store.lifts}
          open={tradeProfitOpen}
          onClose={() => setTradeProfitOpen(false)}
        />
      </>
    )
  }

  return (
    <>
      <Drawer open={open} variant="registerDetail" {...panelProps}>
        {content}
      </Drawer>
      <BuyBackModal order={order} open={buyBackOpen} onClose={() => setBuyBackOpen(false)} />
      <CloseOrderModal
        orders={order ? [order] : []}
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
      />
      <TradeProfitModal
        po={isPO ? order : null}
        orders={store.tradeOrders}
        lifts={store.lifts}
        open={tradeProfitOpen}
        onClose={() => setTradeProfitOpen(false)}
      />
    </>
  )
}

export function findOrderByRef(store: ReturnType<typeof useTradeStore>, ref: string, side: OrderSide): TradeOrder | undefined {
  const needle = ref.trim()
  if (!needle) return undefined
  const exact = store.tradeOrders.find(o => o.side === side && o.ref === needle)
  if (exact) return exact
  const core = refCore(needle)
  if (!core) return undefined
  return store.tradeOrders.find(o => o.side === side && refCore(o.ref) === core)
}
