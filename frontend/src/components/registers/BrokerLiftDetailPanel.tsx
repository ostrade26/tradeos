import { FileText, Package, IndianRupee, Truck, PanelRight, PanelRightClose, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Drawer, DockedPanel } from '../ui/Drawer'
import { Badge, StatusBadge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { formatDate, formatQty } from '../../lib/utils'
import { formatLiftRef } from '../../lib/tradeRefs'
import { appPath } from '../../lib/appShellMode'
import type { BrokerLiftRow } from '../../lib/brokerLiftRegister'
import { tankerQtyLinesFromBrokerEvent } from '../../lib/tankerQtyLines'
import {
  DetailGroup,
  DetailHero,
  DetailPanelBody,
  DetailRow,
  DetailInlineStat,
  DetailInlineStatRow,
  DetailMetricsSection,
} from './DetailPanelSections'

interface BrokerLiftDetailPanelProps {
  lift: BrokerLiftRow | null
  open: boolean
  onClose: () => void
  docked?: boolean
  onDockChange?: (docked: boolean) => void
  onComplete?: (lift: BrokerLiftRow) => Promise<void>
}

export function BrokerLiftDetailPanel({
  lift,
  open,
  onClose,
  docked = false,
  onDockChange,
  onComplete,
}: BrokerLiftDetailPanelProps) {
  const [completing, setCompleting] = useState(false)
  if (!lift || (docked && !open)) return null

  const delivered = lift.status === 'delivered'
  const brokerDone = lift.brokerCompleted
  const qtyLabel = delivered ? 'Actual' : 'Planned'
  const roleLabel = lift.partyRole === 'seller' ? 'Seller' : 'Buyer'
  const invoices = lift.tankers.map(tanker => tanker.sales_invoice_no.trim()).filter(Boolean)
  const purchaseInvoices = lift.tankers.map(tanker => tanker.po_invoice_no.trim()).filter(Boolean)
  const dockToggle = onDockChange ? (
    <button
      type="button"
      onClick={() => onDockChange(!docked)}
      className="hidden lg:inline-flex rounded-lg p-1.5 text-muted hover:bg-gray-100 hover:text-heading dark:hover:bg-zinc-800 cursor-pointer attex-focus"
      aria-label={docked ? 'Undock panel' : 'Dock panel to the right'}
      title={docked ? 'Undock panel' : 'Dock to right'}
    >
      {docked ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
    </button>
  ) : null

  const content = (
    <DetailPanelBody>
      <DetailHero>
        <div className="min-w-0">
          <p className="text-base font-semibold text-heading leading-snug">
            {lift.partyName || (lift.partyRole === 'seller' ? lift.sellerName : lift.buyerName)}
          </p>
          <div className="flex items-start justify-between gap-3 mt-0.5">
            <p className="text-[14px] text-muted leading-snug min-w-0">
              {lift.itemName || 'Contract'}
              {lift.contractRef ? ` · ${lift.contractRef}` : ''}
            </p>
            <div className="flex flex-wrap justify-end gap-1.5 shrink-0">
              <StatusBadge
                status={brokerDone ? 'completed' : delivered ? 'delivered' : 'pending'}
                context="lift"
              />
              <Badge variant={lift.partyRole === 'seller' ? 'info' : 'accent'}>{roleLabel}</Badge>
            </div>
          </div>
        </div>
      </DetailHero>

      <DetailMetricsSection>
        <DetailInlineStatRow>
          <DetailInlineStat
            label={qtyLabel}
            value={formatQty(lift.qty)}
            valueClassName={delivered ? 'text-success' : undefined}
          />
          <DetailInlineStat label="Tankers" value={String(lift.tankers.length)} />
          <DetailInlineStat label="Rate" value={lift.rateLabel ? `${lift.rateLabel}/10 KG` : '—'} />
        </DetailInlineStatRow>
      </DetailMetricsSection>

      <DetailGroup title="Parties" icon={Truck}>
        <DetailRow label="Buyer" value={lift.buyerName || '—'} />
        <DetailRow label="Seller" value={lift.sellerName || '—'} />
        <DetailRow label="Recorded by" value={`${lift.partyName || roleLabel} (${roleLabel})`} />
        {lift.orderRef ? <DetailRow label="Order" value={lift.orderRef} /> : null}
        {lift.partyLiftRef ? <DetailRow label="Party lift" value={formatLiftRef(lift.partyLiftRef)} /> : null}
      </DetailGroup>

      <DetailGroup title="Delivery" icon={Package}>
        {lift.delivery ? <DetailRow label="Period" value={lift.delivery} /> : null}
        {lift.spot ? <DetailRow label="Location" value={lift.spot} /> : null}
        <DetailRow label="Lift date" value={formatDate(lift.date)} />
        {lift.deliveredAt ? <DetailRow label="Delivered" value={formatDate(lift.deliveredAt)} /> : null}
      </DetailGroup>

      <DetailGroup title="Pricing" icon={IndianRupee}>
        <DetailRow label="Rate" value={lift.rateLabel ? `${lift.rateLabel}/10 KG` : '—'} highlight />
        <DetailRow label={`${qtyLabel} qty`} value={formatQty(lift.qty)} highlight />
        {lift.balance > 0.0005 ? (
          <DetailRow label="Balance owed" value={formatQty(lift.balance)} highlight />
        ) : null}
      </DetailGroup>

      <DetailGroup title="Documents" icon={FileText}>
        <DetailRow label="Contract" value={<Link to={appPath(`/contract-shares/${lift.shareId}`)} className="text-accent hover:underline">{lift.contractRef}</Link>} />
        <DetailRow label={invoices.length > 1 ? 'Sales invoice nos' : 'Sales invoice no'} value={invoices.length ? invoices.join(', ') : '—'} />
        {purchaseInvoices.length ? (
          <DetailRow label={purchaseInvoices.length > 1 ? 'Purchase invoice nos' : 'Purchase invoice no'} value={purchaseInvoices.join(', ')} />
        ) : null}
      </DetailGroup>

      {lift.tankers.length > 0 ? (
        <DetailGroup title="Tankers" icon={Truck}>
          {tankerQtyLinesFromBrokerEvent(lift.tankers, {
            qty_mt: lift.qty,
            short_qty_mt: lift.balance,
            status: lift.status,
          }).map((line, index) => {
            const tanker = lift.tankers[index]
            return (
              <div key={`${line.tankerNo}-${index}`} className={index > 0 ? 'mt-3 border-t border-gray-100 pt-3 dark:border-gray-800' : undefined}>
                <DetailRow
                  label="Tanker"
                  value={
                    <span
                      title={line.previous ? `Was ${line.previous}` : undefined}
                      className={line.changed ? 'rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' : undefined}
                    >
                      {line.tankerNo || '—'}
                    </span>
                  }
                />
                {line.plannedMt != null && line.plannedMt > 0 ? (
                  <DetailRow label="Planned qty" value={formatQty(line.plannedMt)} />
                ) : null}
                {line.actualMt != null && line.actualMt > 0 ? (
                  <DetailRow label="Actual qty" value={formatQty(line.actualMt)} />
                ) : null}
                {line.balanceMt != null && line.balanceMt > 0.0005 ? (
                  <DetailRow label="Balance" value={formatQty(line.balanceMt)} highlight />
                ) : null}
                {tanker?.transport_name ? <DetailRow label="Transport" value={tanker.transport_name} /> : null}
                {tanker?.driver_mobile ? <DetailRow label="Driver" value={tanker.driver_mobile} /> : null}
                {tanker?.lr_no ? <DetailRow label="LR" value={tanker.lr_no} /> : null}
              </div>
            )
          })}
        </DetailGroup>
      ) : null}
    </DetailPanelBody>
  )

  const footer = !brokerDone && onComplete ? (
    <Button
      loading={completing}
      onClick={() => {
        setCompleting(true)
        void onComplete(lift).finally(() => setCompleting(false))
      }}
    >
      <CheckCircle2 className="h-4 w-4" /> Mark complete
    </Button>
  ) : undefined

  const panelProps = {
    title: formatLiftRef(lift.brokerLiftRef),
    subtitle: `Lift · ${formatDate(lift.date)}`,
    onClose,
    headerActions: dockToggle,
    footer,
    width: 'lg' as const,
  }

  if (docked) {
    return <DockedPanel {...panelProps}>{content}</DockedPanel>
  }

  return (
    <Drawer open={open} variant="registerDetail" {...panelProps}>
      {content}
    </Drawer>
  )
}
