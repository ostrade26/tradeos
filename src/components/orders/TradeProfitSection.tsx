import { useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import type { Lift, TradeOrder } from '../../data/mockData'
import { DetailGroup } from '../registers/DetailPanelSections'
import {
  RelatedCard,
  RelatedCardBody,
  RelatedCardHeader,
  RelatedDetailRow,
  RelatedStat,
} from '../registers/RelatedSectionCards'
import { computePoTradeProfit, formatRatePerMt } from '../../lib/tradeProfit'
import { cn, formatCurrency, formatQty } from '../../lib/utils'

interface TradeProfitSectionProps {
  po: TradeOrder
  orders: TradeOrder[]
  lifts: Lift[]
  className?: string
}

export function TradeProfitSection({ po, orders, lifts, className }: TradeProfitSectionProps) {
  const profit = useMemo(
    () => computePoTradeProfit(po, orders, lifts),
    [po, orders, lifts],
  )

  return (
    <DetailGroup title="Trade profit" icon={TrendingUp} className={className}>
      <RelatedCard>
        <RelatedCardHeader
          title={<span className="text-sm font-medium text-heading">{po.itemName}</span>}
          subtitle={`${formatQty(po.orderQty)} purchase lot`}
          stats={(
            <>
              <RelatedStat label="Purchase" value={formatCurrency(profit.purchaseValue)} />
              <RelatedStat label="Landed" value={formatRatePerMt(profit.trueLandedCostPerMt)} />
              {profit.hasSales && profit.avgSaleRatePerMt != null && (
                <RelatedStat
                  label="Sold"
                  value={`${formatQty(profit.soldQtyMt)} @ ${formatRatePerMt(profit.avgSaleRatePerMt)}`}
                  tone="success"
                />
              )}
            </>
          )}
        />

        <RelatedCardBody>
          <RelatedDetailRow label="Purchase rate" value={formatRatePerMt(profit.purchaseRatePerMt)} />
          {profit.freightCost > 0 && (
            <RelatedDetailRow label="Freight" value={formatCurrency(profit.freightCost)} />
          )}
          {profit.loadingCost > 0 && (
            <RelatedDetailRow label="Loading" value={formatCurrency(profit.loadingCost)} />
          )}
          {profit.brokerageTotal > 0 && (
            <RelatedDetailRow label="Brokerage" value={formatCurrency(profit.brokerageTotal)} />
          )}
          {profit.otherCost > 0 && (
            <RelatedDetailRow label="Other" value={formatCurrency(profit.otherCost)} />
          )}
          <RelatedDetailRow
            label="True landed cost"
            value={<span className="font-semibold tabular-nums">{formatRatePerMt(profit.trueLandedCostPerMt)}</span>}
          />
          {!profit.hasSales && (
            <p className="text-xs text-muted leading-relaxed pt-0.5">
              No delivered sales against this PO yet — landed cost is ready when you sell.
            </p>
          )}
        </RelatedCardBody>

        {profit.hasSales && profit.grossProfit != null && (
          <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-2.5 bg-gray-50/90 dark:bg-gray-800/50">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted">Gross profit</span>
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
        )}
      </RelatedCard>
    </DetailGroup>
  )
}
