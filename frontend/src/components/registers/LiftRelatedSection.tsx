import { Link } from 'react-router-dom'
import { Layers } from 'lucide-react'
import type { Lift, LiftAllocation, TradeOrder } from '../../data/mockData'
import { formatDate, formatQty } from '../../lib/utils'
import { formatLiftRef, formatPoRef, formatSoRef } from '../../lib/tradeRefs'
import { formatTankerNo, getLiftTankers } from '../../lib/liftTankers'
import { appPath } from '../../lib/appShellMode'
import { DetailGroup } from './DetailPanelSections'
import {
  AllocationSoCard,
  RelatedCard,
  RelatedCardsStack,
} from './RelatedSectionCards'

interface LiftRelatedSectionProps {
  lift: Lift
  allocations: LiftAllocation[]
  getOrderByRef: (ref: string, side: 'purchase' | 'sale') => TradeOrder | undefined
  onNavigate?: () => void
}

function ThisLiftRows({
  lift,
  qtyMt,
  onNavigate,
}: {
  lift: Lift
  qtyMt: number
  onNavigate?: () => void
}) {
  const tankers = getLiftTankers(lift).filter(t => t.tankerNo.trim())
  const rows = tankers.length > 0
    ? tankers
    : [{ tankerNo: '', actualQtyMt: qtyMt as number | undefined }]

  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-800">
      {rows.map((tanker, index) => {
        const tankerNo = tanker.tankerNo.trim()
          ? formatTankerNo(tanker.tankerNo)
          : '—'
        const rowQty = tanker.actualQtyMt != null
          ? tanker.actualQtyMt
          : tankers.length <= 1
            ? qtyMt
            : undefined

        return (
          <li key={`${lift.id}-${index}`}>
            <Link
              to={`/lifts?ref=${encodeURIComponent(String(lift.liftRef))}`}
              onClick={onNavigate}
              className="grid grid-cols-[auto_auto_auto_auto] justify-between items-center gap-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
            >
              <span className="text-[13px] font-medium text-accent whitespace-nowrap">
                {formatLiftRef(lift.liftRef)}
              </span>
              <span className="text-[13px] text-heading tabular-nums whitespace-nowrap">
                {formatDate(lift.date)}
              </span>
              <span className="text-[13px] text-heading whitespace-nowrap">
                {tankerNo}
              </span>
              <span className="text-[13px] text-heading tabular-nums whitespace-nowrap text-right">
                {rowQty != null ? formatQty(rowQty) : '—'}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function SoAllocationCard({
  allocation,
  lift,
  so,
  crossPo,
  bookedPoRef,
  onNavigate,
}: {
  allocation: LiftAllocation
  lift: Lift
  so: TradeOrder
  crossPo: boolean
  bookedPoRef?: string
  onNavigate?: () => void
}) {
  const poRef = allocation.poRef
  const soRef = allocation.soRef!
  const pendingQty = Math.max(0, so.orderQty - so.liftedQty)

  return (
    <AllocationSoCard
      title={(
        <Link
          to={`/sales-orders?ref=${encodeURIComponent(soRef)}`}
          onClick={onNavigate}
          className="text-[13px] font-medium text-accent hover:underline"
        >
          {formatSoRef(soRef)}
        </Link>
      )}
      subtitle={so.partyName}
      totalQty={so.orderQty}
      deliveredQty={so.liftedQty}
      pendingQty={pendingQty}
    >
      {crossPo && bookedPoRef && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-2 bg-amber-50/60 dark:bg-amber-950/20">
          <p className="text-[13px] text-heading">
            {formatSoRef(soRef)} booked on {formatPoRef(bookedPoRef)} · dispatching from {formatPoRef(poRef)}
          </p>
        </div>
      )}
      <ThisLiftRows lift={lift} qtyMt={allocation.qtyMt} onNavigate={onNavigate} />
    </AllocationSoCard>
  )
}

function StockAllocationCard({
  allocation,
  lift,
  onNavigate,
}: {
  allocation: LiftAllocation
  lift: Lift
  onNavigate?: () => void
}) {
  return (
    <RelatedCard>
      <div className="bg-gray-50/90 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 p-3">
        <div className="flex items-baseline justify-between gap-2 flex-wrap min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap min-w-0">
            <Link
              to={appPath(`/purchase-orders?ref=${encodeURIComponent(allocation.poRef)}`)}
              onClick={onNavigate}
              className="text-[13px] font-medium text-accent hover:underline shrink-0"
            >
              {formatPoRef(allocation.poRef)}
            </Link>
            <span className="text-[13px] text-muted">Stock lift · not linked to an SO</span>
          </div>
          <Link
            to={appPath(`/lifts/new?poRef=${encodeURIComponent(allocation.poRef)}`)}
            onClick={onNavigate}
            className="text-[13px] font-medium text-accent hover:underline shrink-0"
          >
            Dispatch from stock
          </Link>
        </div>
      </div>
      <ThisLiftRows lift={lift} qtyMt={allocation.qtyMt} onNavigate={onNavigate} />
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
      <div className="bg-gray-50/90 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 p-3">
        <p className="text-[13px] font-medium text-heading">{refLabel}</p>
        <p className="text-[13px] text-muted mt-0.5">
          {party || (missingSide === 'purchase' ? 'Purchase order' : 'Sales order')}
        </p>
      </div>
      <div className="p-3 space-y-2">
        <p className="text-[13px] text-muted">
          {refLabel} is not in your register yet — shown from this lift only.
        </p>
        <ThisLiftRows lift={lift} qtyMt={allocation.qtyMt} onNavigate={onNavigate} />
      </div>
    </RelatedCard>
  )
}

export function LiftRelatedSection({
  lift,
  allocations,
  getOrderByRef,
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
        onNavigate={onNavigate}
      />
    )
  })

  if (cards.length === 0) return null

  return (
    <DetailGroup title="Allocations" icon={Layers}>
      <RelatedCardsStack>{cards}</RelatedCardsStack>
    </DetailGroup>
  )
}
