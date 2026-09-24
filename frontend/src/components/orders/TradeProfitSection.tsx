import { useMemo, type ReactNode } from 'react'
import type { Lift, TradeOrder } from '../../data/mockData'
import { DetailInlineStatRow } from '../registers/DetailPanelSections'
import { RelatedDetailRow } from '../registers/RelatedSectionCards'
import { computePoTradeProfit, formatRatePerMt } from '../../lib/tradeProfit'
import { cn, formatCurrency, formatQty } from '../../lib/utils'

interface TradeProfitPartsProps {
  po: TradeOrder
  orders: TradeOrder[]
  lifts: Lift[]
  className?: string
}

function ProfitMetric({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: ReactNode
  valueClassName?: string
}) {
  return (
    <div className="min-w-0 shrink-0">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn('text-[14px] font-semibold tabular-nums mt-0.5 text-heading', valueClassName)}>
        {value}
      </p>
    </div>
  )
}

export function useTradeProfit(po: TradeOrder, orders: TradeOrder[], lifts: Lift[]) {
  return useMemo(() => computePoTradeProfit(po, orders, lifts), [po, orders, lifts])
}

/** Item + Purchase/Sold — for Modal ledeBody (edge-to-edge muted band). */
export function TradeProfitLede({ po, orders, lifts, className }: TradeProfitPartsProps) {
  const profit = useTradeProfit(po, orders, lifts)

  return (
    <div className={className}>
      <p className="text-[14px] font-medium text-heading">{po.itemName}</p>
      <p className="text-[14px] text-muted mt-0.5 leading-snug">
        {formatQty(po.orderQty)} purchase lot
      </p>
      <div className="mt-2.5 border-t border-gray-200 dark:border-gray-700 pt-2.5">
        <DetailInlineStatRow>
          <ProfitMetric label="Purchase" value={formatCurrency(profit.purchaseValue)} />
          <ProfitMetric
            label="Sold"
            value={
              profit.hasSales && profit.avgSaleRatePerMt != null
                ? `${formatQty(profit.soldQtyMt)} @ ${formatRatePerMt(profit.avgSaleRatePerMt)}`
                : '—'
            }
            valueClassName={profit.hasSales ? 'text-success font-medium' : undefined}
          />
        </DetailInlineStatRow>
      </div>
    </div>
  )
}

/** Cost breakdown rows — for Modal main body. */
export function TradeProfitBreakdown({ po, orders, lifts, className }: TradeProfitPartsProps) {
  const profit = useTradeProfit(po, orders, lifts)

  return (
    <div className={cn('space-y-2', className)}>
      <RelatedDetailRow
        label="Purchase rate"
        value={formatRatePerMt(profit.purchaseRatePerMt)}
      />
      {profit.brokerageTotal > 0 && (
        <RelatedDetailRow label="Brokerage" value={formatCurrency(profit.brokerageTotal)} />
      )}
      <RelatedDetailRow
        label="True landed cost"
        value={formatRatePerMt(profit.trueLandedCostPerMt)}
      />
      {!profit.hasSales && (
        <p className="text-xs text-muted leading-relaxed pt-0.5">
          No delivered sales against this PO yet — landed cost is ready when you sell.
        </p>
      )}
    </div>
  )
}

/** Gross profit — for Modal secondaryBody. */
export function TradeProfitSummary({ po, orders, lifts }: TradeProfitPartsProps) {
  const profit = useTradeProfit(po, orders, lifts)
  if (!profit.hasSales || profit.grossProfit == null) return null

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[14px]">
        <span className="font-semibold text-heading">Gross profit</span>
        <span className={cn(
          'font-semibold tabular-nums',
          profit.grossProfit >= 0 ? 'text-success' : 'text-danger',
        )}>
          {formatCurrency(profit.grossProfit)}
        </span>
      </div>
      {profit.avgSaleRatePerMt != null && (
        <p className="text-xs text-muted mt-1 leading-relaxed">
          {formatRatePerMt(profit.avgSaleRatePerMt - profit.trueLandedCostPerMt)} margin on {formatQty(profit.soldQtyMt)} sold
        </p>
      )}
    </div>
  )
}
