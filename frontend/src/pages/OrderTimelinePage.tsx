import { useParams } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb, EmptyState } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { OrderTimeline, OrderTimelineSummary } from '../components/orders/OrderTimeline'
import { OrderFlowDiagram } from '../components/orders/OrderFlowDiagram'
import { ShareWhatsAppButton } from '../components/ui/ShareWhatsAppButton'
import { useTradeStore } from '../store/TradeStore'
import { usePermissions } from '../hooks/useAuth'
import { shareOrderOnWhatsApp } from '../lib/whatsappShare'
import { formatOrderRef } from '../lib/tradeRefs'
import { buildOrderFlowTree, countFlowNodes } from '../lib/orderFlowGraph'
import type { TradeOrder } from '../data/mockData'

function useDealOrder() {
  const { ref } = useParams()
  const store = useTradeStore()
  const decodedRef = ref ? decodeURIComponent(ref) : ''
  const po = store.getOrderByRef(decodedRef, 'purchase')
  const so = store.getOrderByRef(decodedRef, 'sale')
  return { order: po ?? so, decodedRef }
}

function DealNotFound({ decodedRef }: { decodedRef: string }) {
  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <PageHeader
        title="Order not found"
        breadcrumb={<Breadcrumb items={[{ label: 'TradeOS', href: '/' }, { label: 'Deal' }]} />}
      />
      <EmptyState
        card
        icon={<FileText className="h-10 w-10" />}
        title="Order not found"
        description={`Could not find ${decodedRef}.`}
        action={<Button to="/">Back to Dashboard</Button>}
      />
    </div>
  )
}

function dealPaths(order: TradeOrder) {
  const listPath = order.side === 'purchase' ? '/purchase-orders' : '/sales-orders'
  const encoded = encodeURIComponent(order.ref)
  return {
    listPath,
    label: order.side === 'purchase' ? 'Purchase Order' : 'Sales Order',
    editHref: `${listPath}/${encoded}/edit`,
    flowHref: `${listPath}/${encoded}/flow`,
    timelineHref: `${listPath}/${encoded}/timeline`,
  }
}

function DealFooter({ order, listPath }: { order: TradeOrder; listPath: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ShareWhatsAppButton onShare={() => shareOrderOnWhatsApp(order)} label="Share on WhatsApp" />
      <Button variant="outline" to={listPath}>Back to orders</Button>
    </div>
  )
}

export function OrderFlowPage() {
  const { order, decodedRef } = useDealOrder()
  const store = useTradeStore()
  const { canEditOrders } = usePermissions()
  if (!order) return <DealNotFound decodedRef={decodedRef} />

  const { listPath, label, editHref, timelineHref } = dealPaths(order)
  const { sos, lifts } = countFlowNodes(buildOrderFlowTree(store, order))
  const flowSummary = `1 PO · ${sos} ${sos === 1 ? 'SO' : 'SOs'} · ${lifts} ${lifts === 1 ? 'lift' : 'lifts'}`

  return (
    <div className="animate-fade-in flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="shrink-0 [&>div]:mb-0">
        <PageHeader
          title="Deal flow"
          subtitle={flowSummary}
          breadcrumb={<Breadcrumb items={[
            { label: 'TradeOS', href: '/' },
            { label: label, href: listPath },
            { label: formatOrderRef(order.ref, order.side) },
            { label: 'Flow' },
          ]} />}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button to={timelineHref} variant="outline" size="sm">Timeline</Button>
              {canEditOrders && (
                <Button to={editHref} variant="outline" size="sm">Edit {formatOrderRef(order.ref, order.side)}</Button>
              )}
              <ShareWhatsAppButton onShare={() => shareOrderOnWhatsApp(order)} label="WhatsApp" />
            </div>
          }
        />
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden" padding={false}>
        <OrderFlowDiagram order={order} className="h-full min-h-0 flex-1 border-0 rounded-none bg-transparent" />
      </Card>
    </div>
  )
}

export function OrderTimelinePage() {
  const { order, decodedRef } = useDealOrder()
  const { canEditOrders } = usePermissions()
  if (!order) return <DealNotFound decodedRef={decodedRef} />

  const { listPath, label, editHref, flowHref } = dealPaths(order)

  return (
    <div className="animate-fade-in max-w-3xl">
      <PageHeader
        title="Deal timeline"
        subtitle={`What happened on ${formatOrderRef(order.ref, order.side)} · ${order.partyName}`}
        breadcrumb={<Breadcrumb items={[
          { label: 'TradeOS', href: '/' },
          { label: label, href: listPath },
          { label: formatOrderRef(order.ref, order.side) },
          { label: 'Timeline' },
        ]} />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button to={flowHref} variant="outline" size="sm">Flow</Button>
            {canEditOrders && (
              <Button to={editHref} variant="outline" size="sm">Edit {formatOrderRef(order.ref, order.side)}</Button>
            )}
            <ShareWhatsAppButton onShare={() => shareOrderOnWhatsApp(order)} label="WhatsApp" />
          </div>
        }
      />

      <Card className="mb-4">
        <OrderTimelineSummary order={order} />
        <OrderTimeline order={order} />
      </Card>

      <DealFooter order={order} listPath={listPath} />
    </div>
  )
}
