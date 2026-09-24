import { Link } from 'react-router-dom'
import { Layers } from 'lucide-react'
import type { Lift, TradeOrder } from '../../data/mockData'
import {
  groupLiftsBySoForPo,
  liftsForSo,
  liftsForSoOnPo,
  stockLiftsForPo,
  type SoLiftEntry,
  type SoLiftGroup,
} from '../../lib/orderRelatedLifts'
import { formatDate, formatQty, cn } from '../../lib/utils'
import { formatLiftRef, formatPoRef, formatSoRef } from '../../lib/tradeRefs'
import { formatTankerNo, getLiftTankers } from '../../lib/liftTankers'
import { appPath } from '../../lib/appShellMode'
import { DetailGroup } from './DetailPanelSections'
import {
  AllocationSoCard,
  RelatedCard,
  RelatedCardsStack,
} from './RelatedSectionCards'

interface OrderRelatedSectionProps {
  order: TradeOrder
  linkedSOs: TradeOrder[]
  lifts: Lift[]
  onNavigate?: () => void
}

function LiftRows({
  entries,
  onNavigate,
  showTopBorder = true,
}: {
  entries: SoLiftEntry[]
  onNavigate?: () => void
  showTopBorder?: boolean
}) {
  if (entries.length === 0) {
    return (
      <p
        className={cn(
          'p-3 text-[13px] text-muted',
          showTopBorder && 'border-t border-gray-100 dark:border-gray-800',
        )}
      >
        No lifts recorded yet
      </p>
    )
  }

  return (
    <ul
      className={cn(
        'divide-y divide-gray-100 dark:divide-gray-800',
        showTopBorder && 'border-t border-gray-100 dark:border-gray-800',
      )}
    >
      {entries.flatMap(({ lift, qtyMt }) => {
        const tankers = getLiftTankers(lift).filter(t => t.tankerNo.trim())
        const rows = tankers.length > 0
          ? tankers
          : [{ tankerNo: '', actualQtyMt: qtyMt }]

        return rows.map((tanker, index) => {
          const tankerNo = tanker.tankerNo.trim()
            ? formatTankerNo(tanker.tankerNo)
            : '—'
          const rowQty = tanker.actualQtyMt != null
            ? tanker.actualQtyMt
            : tankers.length <= 1
              ? qtyMt
              : undefined

          return (
            <li key={`${lift.id}-${qtyMt}-${index}`}>
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
        })
      })}
    </ul>
  )
}

function SoLiftGroupBlock({
  group,
  onNavigate,
}: {
  group: SoLiftGroup
  onNavigate?: () => void
}) {
  const { so, deliveredQty, pendingQty, lifts } = group

  return (
    <AllocationSoCard
      title={(
        <Link
          to={`/sales-orders?ref=${encodeURIComponent(so.ref)}`}
          onClick={onNavigate}
          className="text-[13px] font-medium text-accent hover:underline"
        >
          {formatSoRef(so.ref)}
        </Link>
      )}
      subtitle={so.partyName}
      totalQty={so.orderQty}
      deliveredQty={deliveredQty}
      pendingQty={pendingQty}
    >
      <LiftRows entries={lifts} onNavigate={onNavigate} showTopBorder={false} />
    </AllocationSoCard>
  )
}

function StockLiftGroup({
  poRef,
  entries,
  onNavigate,
}: {
  poRef: string
  entries: SoLiftEntry[]
  onNavigate?: () => void
}) {
  if (entries.length === 0) return null

  const deliveredQty = entries
    .filter(e => e.lift.status === 'delivered')
    .reduce((sum, e) => sum + e.qtyMt, 0)
  const pendingQty = entries
    .filter(e => e.lift.status === 'pending')
    .reduce((sum, e) => sum + e.qtyMt, 0)

  return (
    <AllocationSoCard
      title={<span className="text-[13px] font-medium text-heading">Stock lifts</span>}
      subtitle={`From ${formatPoRef(poRef)} · not linked to an SO`}
      totalLabel="Total"
      totalQty={deliveredQty + pendingQty}
      deliveredQty={deliveredQty}
      pendingQty={pendingQty}
    >
      <LiftRows entries={entries} onNavigate={onNavigate} showTopBorder={false} />
    </AllocationSoCard>
  )
}

export function OrderRelatedSection({ order, linkedSOs, lifts, onNavigate }: OrderRelatedSectionProps) {
  const isPO = order.side === 'purchase'

  if (isPO) {
    const soGroups = groupLiftsBySoForPo(order.ref, linkedSOs, lifts)
    const stockLifts = stockLiftsForPo(lifts, order.ref)
    const hasContent = soGroups.length > 0 || stockLifts.length > 0

    if (!hasContent) return null

    return (
      <DetailGroup title="Allocations" icon={Layers}>
        <RelatedCardsStack>
          {soGroups.map(group => (
            <SoLiftGroupBlock key={group.so.id} group={group} onNavigate={onNavigate} />
          ))}
          <StockLiftGroup poRef={order.ref} entries={stockLifts} onNavigate={onNavigate} />
        </RelatedCardsStack>
      </DetailGroup>
    )
  }

  const poRef = order.poRef
  const soLifts = poRef
    ? liftsForSoOnPo(lifts, poRef, order.ref)
    : liftsForSo(lifts, order.ref)

  if (!poRef && soLifts.length === 0) return null

  return (
    <DetailGroup title="Allocations" icon={Layers}>
      <RelatedCard>
        {poRef && (
          <div className="bg-gray-50/90 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 p-3">
            <div className="flex items-baseline gap-2 flex-wrap min-w-0">
              <Link
                to={appPath(`/purchase-orders?ref=${encodeURIComponent(poRef)}`)}
                onClick={onNavigate}
                className="text-[13px] font-medium text-accent hover:underline shrink-0"
              >
                {formatPoRef(poRef)}
              </Link>
              <span className="text-[13px] text-muted">Linked purchase order</span>
            </div>
          </div>
        )}
        <LiftRows
          entries={soLifts}
          onNavigate={onNavigate}
          showTopBorder={false}
        />
      </RelatedCard>
    </DetailGroup>
  )
}
