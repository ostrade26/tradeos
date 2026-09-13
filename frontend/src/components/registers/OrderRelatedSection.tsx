import { Link } from 'react-router-dom'
import { Link2 } from 'lucide-react'
import type { Lift, TradeOrder } from '../../data/mockData'
import { toBeLifted } from '../../data/mockData'
import {
  groupLiftsBySoForPo,
  liftsForSoOnPo,
  stockLiftsForPo,
  type SoLiftEntry,
  type SoLiftGroup,
} from '../../lib/orderRelatedLifts'
import { formatDate, formatQty } from '../../lib/utils'
import { formatLiftRef, formatOrderRef, formatPoRef, formatSoRef } from '../../lib/tradeRefs'
import { StatusBadge } from '../ui/Badge'
import { DetailGroup } from './DetailPanelSections'
import {
  RelatedCard,
  RelatedCardHeader,
  RelatedCardsStack,
  RelatedOrderStats,
} from './RelatedSectionCards'

interface OrderRelatedSectionProps {
  order: TradeOrder
  linkedSOs: TradeOrder[]
  lifts: Lift[]
  onNavigate?: () => void
}

function LiftRows({ entries, onNavigate }: { entries: SoLiftEntry[]; onNavigate?: () => void }) {
  if (entries.length === 0) {
    return (
      <p className="px-3 py-2.5 text-xs text-muted border-t border-gray-100 dark:border-gray-800">
        No lifts recorded yet
      </p>
    )
  }

  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800">
      {entries.map(({ lift, qtyMt }) => (
        <li key={`${lift.id}-${qtyMt}`}>
          <Link
            to={`/lifts?ref=${encodeURIComponent(String(lift.liftRef))}`}
            onClick={onNavigate}
            className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
          >
            <span className="font-mono text-sm font-medium text-accent shrink-0">
              {formatLiftRef(lift.liftRef)}
            </span>
            <StatusBadge status={lift.status} context="lift" />
            <span className="ml-auto tabular-nums text-sm font-medium text-heading shrink-0">
              {formatQty(qtyMt)}
            </span>
            <span className="text-xs text-muted tabular-nums shrink-0 w-16 text-right">
              {formatDate(lift.date)}
            </span>
          </Link>
        </li>
      ))}
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
  const onLiftQty = lifts
    .filter(e => e.lift.status === 'pending')
    .reduce((sum, e) => sum + e.qtyMt, 0)

  return (
    <RelatedCard>
      <RelatedCardHeader
        title={(
          <Link
            to={`/sales-orders?ref=${encodeURIComponent(so.ref)}`}
            onClick={onNavigate}
            className="font-mono text-sm font-medium text-accent hover:underline"
          >
            {formatSoRef(so.ref)}
          </Link>
        )}
        subtitle={so.partyName}
        trailing={<span className="text-xs text-muted tabular-nums shrink-0">{formatQty(so.orderQty)}</span>}
        stats={(
          <RelatedOrderStats
            deliveredQty={deliveredQty}
            onLiftQty={onLiftQty}
            pendingQty={pendingQty}
            toScheduleQty={toBeLifted(so)}
          />
        )}
      />
      <LiftRows entries={lifts} onNavigate={onNavigate} />
    </RelatedCard>
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
  const onLiftQty = entries
    .filter(e => e.lift.status === 'pending')
    .reduce((sum, e) => sum + e.qtyMt, 0)

  return (
    <RelatedCard>
      <RelatedCardHeader
        title={<span className="text-sm font-medium text-heading">Stock lifts</span>}
        subtitle={`From ${formatPoRef(poRef)} · not linked to an SO`}
        stats={(
          <RelatedOrderStats
            deliveredQty={deliveredQty}
            onLiftQty={onLiftQty}
            pendingQty={0}
          />
        )}
      />
      <LiftRows entries={entries} onNavigate={onNavigate} />
    </RelatedCard>
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
      <DetailGroup title="Related" icon={Link2}>
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
  const soLifts = poRef ? liftsForSoOnPo(lifts, poRef, order.ref) : []
  const hasContent = poRef || soLifts.length > 0

  if (!hasContent) return null

  const onLiftQty = soLifts
    .filter(e => e.lift.status === 'pending')
    .reduce((sum, e) => sum + e.qtyMt, 0)

  return (
    <DetailGroup title="Related" icon={Link2}>
      <RelatedCardsStack>
        {poRef && (
          <RelatedCard>
            <RelatedCardHeader
              title={(
                <Link
                  to={`/purchase-orders?ref=${encodeURIComponent(poRef)}`}
                  onClick={onNavigate}
                  className="font-mono text-sm font-medium text-accent hover:underline"
                >
                  {formatPoRef(poRef)}
                </Link>
              )}
              subtitle="Linked purchase order"
            />
          </RelatedCard>
        )}

        <RelatedCard>
          <RelatedCardHeader
            title={<span className="text-sm font-medium text-heading">{formatOrderRef(order.ref, order.side)}</span>}
            subtitle={`${formatQty(order.orderQty)} · ${order.partyName}`}
            stats={(
              <RelatedOrderStats
                deliveredQty={order.liftedQty}
                onLiftQty={onLiftQty}
                pendingQty={Math.max(0, order.orderQty - order.liftedQty)}
                toScheduleQty={toBeLifted(order)}
              />
            )}
          />
          <LiftRows entries={soLifts} onNavigate={onNavigate} />
        </RelatedCard>
      </RelatedCardsStack>
    </DetailGroup>
  )
}
