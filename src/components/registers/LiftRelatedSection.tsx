import { Link } from 'react-router-dom'
import { Link2 } from 'lucide-react'
import type { Lift, LiftAllocation, TradeOrder } from '../../data/mockData'
import { toBeLifted } from '../../data/mockData'
import { liftsForSoOnPo } from '../../lib/orderRelatedLifts'
import { formatQty } from '../../lib/utils'
import { formatPoRef, formatSoRef } from '../../lib/tradeRefs'
import { StatusBadge } from '../ui/Badge'
import { DetailGroup } from './DetailPanelSections'
import {
  RelatedCard,
  RelatedCardBody,
  RelatedCardHeader,
  RelatedCardsStack,
  RelatedDetailRow,
  RelatedOrderStats,
} from './RelatedSectionCards'

interface LiftRelatedSectionProps {
  lift: Lift
  allocations: LiftAllocation[]
  getOrderByRef: (ref: string, side: 'purchase' | 'sale') => TradeOrder | undefined
  lifts: Lift[]
  getOutstandingBalance: (poRef: string, soRef: string) => number
  onNavigate?: () => void
}

function SoAllocationCard({
  allocation,
  lift,
  so,
  po,
  lifts,
  outstandingBalance,
  crossPo,
  bookedPoRef,
  onNavigate,
}: {
  allocation: LiftAllocation
  lift: Lift
  so: TradeOrder
  po: TradeOrder
  lifts: Lift[]
  outstandingBalance: number
  crossPo: boolean
  bookedPoRef?: string
  onNavigate?: () => void
}) {
  const poRef = allocation.poRef
  const soRef = allocation.soRef!
  const soLifts = liftsForSoOnPo(lifts, poRef, soRef)
  const onLiftQty = soLifts
    .filter(e => e.lift.status === 'pending')
    .reduce((sum, e) => sum + e.qtyMt, 0)
  const pendingQty = Math.max(0, so.orderQty - so.liftedQty)

  return (
    <RelatedCard>
      <RelatedCardHeader
        title={(
          <Link
            to={`/sales-orders?ref=${encodeURIComponent(soRef)}`}
            onClick={onNavigate}
            className="font-mono text-sm font-medium text-accent hover:underline"
          >
            {formatSoRef(soRef)}
          </Link>
        )}
        subtitle={so.partyName}
        trailing={<span className="text-xs text-muted tabular-nums shrink-0">{formatQty(so.orderQty)}</span>}
        stats={(
          <RelatedOrderStats
            deliveredQty={so.liftedQty}
            onLiftQty={onLiftQty}
            pendingQty={pendingQty}
            toScheduleQty={toBeLifted(so)}
          />
        )}
      />
      <RelatedCardBody>
        {crossPo && bookedPoRef && (
          <div className="rounded-md border border-amber-200/80 bg-amber-50/60 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/20">
            <p className="text-xs font-medium uppercase tracking-wide text-warning">Cross lot dispatch</p>
            <p className="text-xs text-heading mt-1">
              {formatSoRef(soRef)} booked on {formatPoRef(bookedPoRef)} · dispatching from {formatPoRef(poRef)}
            </p>
          </div>
        )}
        <div className="flex items-center gap-2 rounded-md bg-gray-50/80 dark:bg-gray-800/40 px-2.5 py-2">
          <span className="text-xs text-muted">This lift</span>
          <StatusBadge status={lift.status} context="lift" />
          <span className="ml-auto tabular-nums text-sm font-semibold text-heading">
            {formatQty(allocation.qtyMt)}
          </span>
        </div>
        <RelatedDetailRow
          label="Purchase order"
          value={(
            <Link
              to={`/purchase-orders?ref=${encodeURIComponent(poRef)}`}
              onClick={onNavigate}
              className="font-mono text-sm text-accent hover:underline"
            >
              {formatPoRef(poRef)}{crossPo ? ' (dispatch lot)' : ''}
            </Link>
          )}
        />
        {crossPo && bookedPoRef && (
          <RelatedDetailRow label="Booked PO" value={<span className="font-mono text-sm">{bookedPoRef}</span>} />
        )}
        <RelatedDetailRow label="Seller" value={`${po.partyName} · ${formatQty(po.orderQty)} ordered`} />
        {outstandingBalance > 0 && (
          <RelatedDetailRow
            label="Balance owed"
            value={<span className="text-warning font-medium tabular-nums">{formatQty(outstandingBalance)}</span>}
          />
        )}
      </RelatedCardBody>
    </RelatedCard>
  )
}

function StockAllocationCard({
  allocation,
  lift,
  po,
  onNavigate,
}: {
  allocation: LiftAllocation
  lift: Lift
  po: TradeOrder
  onNavigate?: () => void
}) {
  return (
    <RelatedCard>
      <RelatedCardHeader
        title={<span className="text-sm font-medium text-heading">Stock lift</span>}
        subtitle={`From ${formatPoRef(allocation.poRef)} · not linked to an SO`}
        stats={(
          <RelatedOrderStats
            deliveredQty={lift.status === 'delivered' ? allocation.qtyMt : 0}
            onLiftQty={lift.status === 'pending' ? allocation.qtyMt : 0}
            pendingQty={0}
          />
        )}
      />
      <RelatedCardBody>
        <div className="flex items-center gap-2 rounded-md bg-gray-50/80 dark:bg-gray-800/40 px-2.5 py-2">
          <span className="text-xs text-muted">This lift</span>
          <StatusBadge status={lift.status} context="lift" />
          <span className="ml-auto tabular-nums text-sm font-semibold text-heading">
            {formatQty(allocation.qtyMt)}
          </span>
        </div>
        <RelatedDetailRow
          label="Purchase order"
          value={(
            <Link
              to={`/purchase-orders?ref=${encodeURIComponent(allocation.poRef)}`}
              onClick={onNavigate}
              className="font-mono text-sm text-accent hover:underline"
            >
              {formatPoRef(allocation.poRef)}
            </Link>
          )}
        />
        <RelatedDetailRow label="Seller" value={`${po.partyName} · ${formatQty(po.orderQty)} ordered`} />
      </RelatedCardBody>
    </RelatedCard>
  )
}

function MissingOrderAllocationCard({
  allocation,
  lift,
  missingSide,
  onNavigate,
}: {
  allocation: LiftAllocation
  lift: Lift
  missingSide: 'purchase' | 'sale'
  onNavigate?: () => void
}) {
  const ref = missingSide === 'purchase' ? allocation.poRef : allocation.soRef!
  const refLabel = missingSide === 'purchase' ? formatPoRef(ref) : formatSoRef(ref)
  const party = missingSide === 'purchase' ? lift.sellerName : lift.buyerName

  return (
    <RelatedCard>
      <RelatedCardHeader
        title={(
          <span className="font-mono text-sm font-medium text-heading">{refLabel}</span>
        )}
        subtitle={party || (missingSide === 'purchase' ? 'Purchase order' : 'Sales order')}
      />
      <RelatedCardBody>
        <div className="rounded-md border border-amber-200/80 bg-amber-50/60 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="text-xs text-heading">
            {refLabel} is not in your register yet — shown from this lift only.
          </p>
        </div>
        <RelatedDetailRow label="This lift qty" value={formatQty(allocation.qtyMt)} />
        {allocation.poRef && missingSide === 'sale' && (
          <RelatedDetailRow
            label="Purchase order"
            value={(
              <Link
                to={`/purchase-orders?ref=${encodeURIComponent(allocation.poRef)}`}
                onClick={onNavigate}
                className="font-mono text-sm text-accent hover:underline"
              >
                {formatPoRef(allocation.poRef)}
              </Link>
            )}
          />
        )}
      </RelatedCardBody>
    </RelatedCard>
  )
}

export function LiftRelatedSection({
  lift,
  allocations,
  getOrderByRef,
  lifts,
  getOutstandingBalance,
  onNavigate,
}: LiftRelatedSectionProps) {
  if (allocations.length === 0) return null

  const cards = allocations.map(a => {
    const po = getOrderByRef(a.poRef, 'purchase')

    if (a.soRef) {
      const so = getOrderByRef(a.soRef, 'sale')
      if (po && so) {
        const crossPo = so.poRef != null && so.poRef !== a.poRef
        return (
          <SoAllocationCard
            key={`${a.soRef}-${a.poRef}`}
            allocation={a}
            lift={lift}
            so={so}
            po={po}
            lifts={lifts}
            outstandingBalance={getOutstandingBalance(a.poRef, a.soRef)}
            crossPo={crossPo}
            bookedPoRef={crossPo ? so.poRef : undefined}
            onNavigate={onNavigate}
          />
        )
      }
      if (po && !so) {
        return (
          <MissingOrderAllocationCard
            key={`missing-so-${a.soRef}-${a.poRef}`}
            allocation={a}
            lift={lift}
            missingSide="sale"
            onNavigate={onNavigate}
          />
        )
      }
      if (!po && so) {
        return (
          <MissingOrderAllocationCard
            key={`missing-po-${a.soRef}-${a.poRef}`}
            allocation={a}
            lift={lift}
            missingSide="purchase"
            onNavigate={onNavigate}
          />
        )
      }
      return (
        <MissingOrderAllocationCard
          key={`missing-both-${a.soRef}-${a.poRef}`}
          allocation={a}
          lift={lift}
          missingSide="sale"
          onNavigate={onNavigate}
        />
      )
    }

    if (!po) {
      return (
        <MissingOrderAllocationCard
          key={`missing-po-stock-${a.poRef}`}
          allocation={a}
          lift={lift}
          missingSide="purchase"
          onNavigate={onNavigate}
        />
      )
    }

    return (
      <StockAllocationCard
        key={`stock-${a.poRef}`}
        allocation={a}
        lift={lift}
        po={po}
        onNavigate={onNavigate}
      />
    )
  })

  if (cards.length === 0) return null

  return (
    <DetailGroup title="Related" icon={Link2}>
      <RelatedCardsStack>{cards}</RelatedCardsStack>
    </DetailGroup>
  )
}
