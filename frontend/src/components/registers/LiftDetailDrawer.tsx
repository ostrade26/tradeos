import { useState } from 'react'
import {
  GitBranch,
  Package,
  IndianRupee,
  FileText,
  MessageCircle,
  PanelRight,
  PanelRightClose,
  CheckCircle2,
  Pencil,
} from 'lucide-react'
import { Drawer, DockedPanel } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { DetailPanelMenu } from '../ui/DetailPanelMenu'
import { Badge, StatusBadge } from '../ui/Badge'
import { VerifiedPeriod } from '../ui/GroupedDataTable'
import { MarkLiftDeliveredModal } from '../lifts/MarkLiftDeliveredModal'
import { formatDate, formatQty } from '../../lib/utils'
import { formatContractRate } from '../../lib/orderRate'
import { type Lift } from '../../data/mockData'
import { getLiftTankers } from '../../lib/liftTankers'
import {
  formatLiftOrderSummary,
  getLiftAllocations,
  crossPoAllocationsForLift,
  liftHasCrossPoAllocations,
} from '../../lib/liftAllocations'
import { formatLiftRef } from '../../lib/tradeRefs'
import { crossPoAllocationMessage } from '../../lib/sellerLiftPool'
import { CrossPoNotice } from '../lifts/CrossPoNotice'
import { getLiftPlannedQty, getLiftBalanceQty } from '../../lib/liftBalance'
import { shareLiftOnWhatsApp } from '../../lib/whatsappShare'
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
import { LiftRelatedSection } from './LiftRelatedSection'

interface LiftDetailDrawerProps {
  lift: Lift | null
  open: boolean
  onClose: () => void
  docked?: boolean
  onDockChange?: (docked: boolean) => void
  onDelivered?: () => void
}

export function LiftDetailDrawer({ lift, open, onClose, docked = false, onDockChange, onDelivered }: LiftDetailDrawerProps) {
  const store = useTradeStore()
  const [deliverOpen, setDeliverOpen] = useState(false)
  if (!lift) return null

  const isPending = lift.status === 'pending'
  const plannedQty = getLiftPlannedQty(lift)
  const balanceQty = getLiftBalanceQty(lift)
  const qtyLabel = isPending ? 'Planned' : 'Actual'

  const tankers = getLiftTankers(lift)
  const allocations = getLiftAllocations(lift)
  const crossPoEntries = crossPoAllocationsForLift(lift, store.tradeOrders)
  const hasCrossPo = liftHasCrossPoAllocations(lift, store.tradeOrders)
  const crossPoMessages = crossPoEntries.map(entry => {
    const so = store.getOrderByRef(entry.soRef, 'sale')
    return so ? crossPoAllocationMessage(so, entry.dispatchPoRef) : null
  }).filter((message): message is string => message != null)

  const partyName = lift.stockLift ? lift.sellerName : (lift.buyerName || lift.sellerName)
  const orderSummary = formatLiftOrderSummary(lift)

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

  const menuItems = [
    {
      type: 'link' as const,
      label: 'Edit',
      icon: Pencil,
      href: `/lifts/${lift.liftRef}/edit`,
    },
    {
      type: 'link' as const,
      label: 'PO flow',
      icon: GitBranch,
      href: `/purchase-orders/${encodeURIComponent(allocations[0]?.poRef ?? '')}/flow`,
    },
    ...(allocations[0]?.soRef ? [{
      type: 'link' as const,
      label: 'SO flow',
      icon: GitBranch,
      href: `/sales-orders/${encodeURIComponent(allocations[0].soRef)}/flow`,
    }] : []),
    {
      type: 'button' as const,
      label: 'Share on WhatsApp',
      icon: MessageCircle,
      tone: 'whatsapp' as const,
      onClick: () => shareLiftOnWhatsApp(lift),
    },
  ]

  const headerActions = (
    <>
      {dockToggle}
      <DetailPanelMenu onItemSelect={onClose} items={menuItems} />
    </>
  )

  const footer = isPending ? (
    <Button onClick={() => setDeliverOpen(true)}>
      <CheckCircle2 className="h-4 w-4" /> Mark as delivered
    </Button>
  ) : undefined

  const content = (
    <DetailPanelBody>
      <DetailHero>
        <div className="min-w-0">
          <p className="text-base font-semibold text-heading leading-snug">{partyName}</p>
          <div className="flex items-start justify-between gap-3 mt-0.5">
            <p className="text-[14px] text-muted leading-snug min-w-0">
              {lift.itemName}
              {orderSummary ? ` · ${orderSummary}` : ''}
            </p>
            <div className="flex flex-wrap justify-end gap-1.5 shrink-0">
              <StatusBadge status={lift.status} context="lift" />
              {lift.isSelfLift && <Badge variant="info">Self lift</Badge>}
              {hasCrossPo && <Badge variant="warning">Cross lot dispatch</Badge>}
            </div>
          </div>
        </div>
      </DetailHero>

      <DetailMetricsSection>
        <DetailInlineStatRow>
          <DetailInlineStat
            label={qtyLabel}
            value={formatQty(lift.liftedQty)}
            valueClassName={isPending ? undefined : 'text-success'}
          />
          <DetailInlineStat label="Tankers" value={String(tankers.length)} />
          <DetailInlineStat label="Rate" value={formatContractRate(lift.rate)} />
        </DetailInlineStatRow>
        {hasCrossPo && (
          <div className="mt-2">
            <CrossPoNotice messages={crossPoMessages} compact={crossPoMessages.length === 1} />
          </div>
        )}
      </DetailMetricsSection>

      <DetailGroup title="Delivery" icon={Package}>
        <DetailRow
          label="Period"
          value={
            <VerifiedPeriod
              start={lift.deliveryPeriodStart}
              end={lift.deliveryPeriodEnd}
              verified={lift.deliveryPeriodVerified}
            />
          }
        />
        <DetailRow label="Lift date" value={formatDate(lift.date)} />
        {lift.deliveredAt && (
          <DetailRow label="Delivered" value={formatDate(lift.deliveredAt)} />
        )}
      </DetailGroup>

      <DetailGroup title="Pricing" icon={IndianRupee}>
        <DetailRow label="Rate" value={formatContractRate(lift.rate)} highlight />
        <DetailRow label={`${qtyLabel} qty`} value={formatQty(lift.liftedQty)} highlight />
        {!isPending && plannedQty !== lift.liftedQty && (
          <DetailRow label="Planned qty" value={formatQty(plannedQty)} />
        )}
        {balanceQty > 0 && (
          <DetailRow label="Balance owed (seller)" value={formatQty(balanceQty)} highlight />
        )}
        {(lift.balanceAppliedQtyMt ?? 0) > 0 && (
          <DetailRow label="Prior balance applied" value={formatQty(lift.balanceAppliedQtyMt!)} />
        )}
      </DetailGroup>

      <DetailGroup title="Documents" icon={FileText}>
        {lift.salesInvoiceNo ? (
          <DetailRow
            label={tankers.length > 1 ? 'Sales invoice nos' : 'Sales invoice no'}
            value={lift.salesInvoiceNo}
          />
        ) : (
          <DetailRow label="Sales invoice no" value="Captured on delivery" />
        )}
        {lift.poInvoiceNo ? (
          <DetailRow
            label={tankers.length > 1 ? 'Purchase invoice nos' : 'Purchase invoice no'}
            value={lift.poInvoiceNo}
          />
        ) : lift.status === 'delivered' ? (
          <DetailRow label="Purchase invoice no" value="—" />
        ) : null}
        {lift.remarks && <DetailRow label="Remarks" value={lift.remarks} />}
        {lift.loadOnRisk && (
          <DetailRow
            label="Load on risk"
            value="Yes — waiver included in WhatsApp share"
          />
        )}
      </DetailGroup>

      <LiftRelatedSection
        lift={lift}
        allocations={allocations}
        getOrderByRef={store.getOrderByRef}
        onNavigate={onClose}
      />
    </DetailPanelBody>
  )

  const panelProps = {
    title: formatLiftRef(lift.liftRef),
    subtitle: `Lift · ${formatDate(lift.date)}`,
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
        <MarkLiftDeliveredModal
          lift={lift}
          open={deliverOpen}
          onClose={() => setDeliverOpen(false)}
          onDelivered={onDelivered}
        />
      </>
    )
  }

  return (
    <>
      <Drawer open={open} variant="registerDetail" {...panelProps}>
        {content}
      </Drawer>
      <MarkLiftDeliveredModal
        lift={lift}
        open={deliverOpen}
        onClose={() => setDeliverOpen(false)}
        onDelivered={onDelivered}
      />
    </>
  )
}
