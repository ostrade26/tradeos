import { useState } from 'react'
import {
  GitBranch,
  Truck,
  Users,
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
import { formatDate, formatCurrency, formatQty } from '../../lib/utils'
import { formatContractRate } from '../../lib/orderRate'
import { type Lift } from '../../data/mockData'
import { formatTankerNo, getLiftTankers } from '../../lib/liftTankers'
import { formatLiftOrderSummary, getLiftAllocations, crossPoAllocationsForLift, liftHasCrossPoAllocations } from '../../lib/liftAllocations'
import { formatLiftRef, formatSoRef } from '../../lib/tradeRefs'
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
  PartyRow,
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
  const lineAmount = allocations.reduce((sum, a) => {
    const so = a.soRef ? store.getOrderByRef(a.soRef, 'sale') : undefined
    const rate = so?.rate ?? lift.rate
    return sum + a.qtyMt * rate
  }, 0)

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
      href: `/purchase-orders/${encodeURIComponent(allocations[0].poRef)}/flow`,
    },
    ...(allocations[0].soRef ? [{
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
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold text-heading leading-snug">{lift.itemName}</p>
            <p className="text-xs text-muted mt-0.5 truncate">{formatLiftOrderSummary(lift)}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5 shrink-0 max-w-[52%]">
            <StatusBadge status={lift.status} context="lift" />
            {lift.isSelfLift && <Badge variant="info">Self lift</Badge>}
            {hasCrossPo && <Badge variant="warning">Cross lot dispatch</Badge>}
          </div>
        </div>
      </DetailHero>

      <DetailMetricsSection>
        <DetailInlineStatRow>
          <DetailInlineStat
            label={qtyLabel}
            value={formatQty(lift.liftedQty)}
            valueClassName={isPending ? 'text-warning' : 'text-success'}
          />
          <DetailInlineStat label="Tankers" value={String(tankers.length)} />
          <DetailInlineStat label="Rate" value={formatContractRate(lift.rate)} />
        </DetailInlineStatRow>
        {(balanceQty > 0 || (lift.balanceAppliedQtyMt ?? 0) > 0 || (!isPending && plannedQty !== lift.liftedQty)) && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            {!isPending && plannedQty !== lift.liftedQty && (
              <span>Planned {formatQty(plannedQty)}</span>
            )}
            {balanceQty > 0 && (
              <span className="text-warning">Balance owed {formatQty(balanceQty)}</span>
            )}
            {(lift.balanceAppliedQtyMt ?? 0) > 0 && (
              <span>Prior balance {formatQty(lift.balanceAppliedQtyMt!)}</span>
            )}
          </div>
        )}
      </DetailMetricsSection>

      <DetailMetricsSection>
        {allocations.length === 1 && allocations[0].soRef && (() => {
          const so = store.getOrderByRef(allocations[0].soRef!, 'sale')
          const soProgressPct = so && so.orderQty > 0
            ? Math.min(100, (so.liftedQty / so.orderQty) * 100)
            : null
          if (soProgressPct == null) return null
          return (
            <div>
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>SO lift progress ({formatSoRef(allocations[0].soRef!)})</span>
                <span className="tabular-nums">{soProgressPct.toFixed(0)}%</span>
              </div>
              <div className="h-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-success transition-all"
                  style={{ width: `${soProgressPct}%` }}
                />
              </div>
            </div>
          )
        })()}

        {hasCrossPo && (
          <CrossPoNotice messages={crossPoMessages} compact={crossPoMessages.length === 1} />
        )}

        <div className="flex items-baseline justify-between gap-4 text-sm">
          <p className="min-w-0">
            <span className="text-muted">Value </span>
            <span className="font-semibold tabular-nums text-heading">{formatCurrency(lineAmount)}</span>
          </p>
          <p className="text-right shrink-0">
            <span className="text-muted">Lift date </span>
            <span className="font-medium text-heading">{formatDate(lift.date)}</span>
          </p>
        </div>
      </DetailMetricsSection>

      <DetailGroup title="Parties" icon={Users}>
        <PartyRow seller={lift.sellerName} buyer={lift.buyerName} />
      </DetailGroup>

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
        {!isPending && (
          <DetailRow label="Planned qty" value={formatQty(plannedQty)} />
        )}
        {balanceQty > 0 && (
          <DetailRow label="Balance owed (seller)" value={formatQty(balanceQty)} highlight />
        )}
        {(lift.balanceAppliedQtyMt ?? 0) > 0 && (
          <DetailRow label="Prior balance applied" value={formatQty(lift.balanceAppliedQtyMt!)} />
        )}
        <DetailRow label="Line amount" value={formatCurrency(lineAmount)} highlight />
      </DetailGroup>

      <DetailGroup title="Tankers & transport" icon={Truck}>
        {tankers.length === 0 ? (
          <p className="text-xs text-muted">No tanker details</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
            {tankers.map((t, i) => {
              const tankerNo = t.tankerNo.trim() ? formatTankerNo(t.tankerNo) : '—'
              const hasInvoiceMeta = Boolean(t.salesInvoiceNo || t.poInvoiceNo)
              return (
                <li key={i} className="px-3 py-2.5">
                  <div className="grid grid-cols-[auto_auto_auto_auto] justify-between items-center gap-x-3">
                    <span className="text-xs font-medium text-accent whitespace-nowrap">
                      {formatLiftRef(lift.liftRef)}
                    </span>
                    <span className="text-xs text-heading tabular-nums whitespace-nowrap">
                      {formatDate(lift.date)}
                    </span>
                    <span className="text-xs text-heading whitespace-nowrap">
                      {tankerNo}
                    </span>
                    <span className="text-xs text-heading tabular-nums whitespace-nowrap text-right">
                      {t.actualQtyMt != null ? formatQty(t.actualQtyMt) : '—'}
                    </span>
                  </div>
                  {hasInvoiceMeta && (
                    <div className="mt-1.5 flex flex-wrap gap-x-4 text-xs text-muted">
                      {t.salesInvoiceNo && <span>{t.salesInvoiceNo}</span>}
                      {t.poInvoiceNo && <span>{t.poInvoiceNo}</span>}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
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
        lifts={store.lifts}
        getOutstandingBalance={store.getOutstandingBalance}
        onNavigate={onClose}
      />
    </DetailPanelBody>
  )

  const panelProps = {
    title: formatLiftRef(lift.liftRef),
    subtitle: `${formatLiftOrderSummary(lift)} · ${formatDate(lift.date)}`,
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
