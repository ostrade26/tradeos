import type { Lift, TradeOrder } from '../data/mockData'
import { formatContractRate } from './orderRate'
import { getLiftAllocations, liftTouchesRef } from './liftAllocations'
import { liftsForSoOnPo, stockLiftsForPo, type SoLiftEntry } from './orderRelatedLifts'
import { STOCK_LIFT_LABEL } from './stockLift'
import type { TradeStoreValue } from '../store/TradeStore'
import { formatLiftRef, formatPoRef, formatSoRef } from './tradeRefs'
import { formatQty } from './utils'

export type FlowNodeKind = 'po' | 'so' | 'lift' | 'stock'

export interface FlowNodeData {
  id: string
  kind: FlowNodeKind
  ref: string
  label: string
  party: string
  detail: string
  qtyLabel: string
  statusLabel: string
  statusTone: 'success' | 'warning' | 'default' | 'info' | 'accent'
  href: string
}

export interface FlowTree {
  node: FlowNodeData
  children: FlowTree[]
}

function orderStatusTone(status: TradeOrder['status']): FlowNodeData['statusTone'] {
  if (status === 'completed') return 'success'
  if (status === 'partial') return 'warning'
  if (status === 'cancelled') return 'default'
  return 'info'
}

function liftStatusTone(status: Lift['status']): FlowNodeData['statusTone'] {
  return status === 'delivered' ? 'success' : 'warning'
}

function poNode(po: TradeOrder): FlowNodeData {
  return {
    id: `po-${po.id}`,
    kind: 'po',
    ref: formatPoRef(po.ref),
    label: 'Purchase Order',
    party: po.partyName,
    detail: `${po.itemName} · ${formatContractRate(po.rate, po.rateBasis, po.ratePerBasis)}`,
    qtyLabel: formatQty(po.orderQty),
    statusLabel: po.status,
    statusTone: orderStatusTone(po.status),
    href: `/purchase-orders?ref=${encodeURIComponent(po.ref)}`,
  }
}

function soNode(so: TradeOrder): FlowNodeData {
  return {
    id: `so-${so.id}`,
    kind: 'so',
    ref: formatSoRef(so.ref),
    label: 'Sales Order',
    party: so.partyName,
    detail: `${so.itemName} · ${formatContractRate(so.rate, so.rateBasis, so.ratePerBasis)}`,
    qtyLabel: formatQty(so.orderQty),
    statusLabel: so.status,
    statusTone: orderStatusTone(so.status),
    href: `/sales-orders?ref=${encodeURIComponent(so.ref)}`,
  }
}

function stockNode(poRef: string): FlowNodeData {
  return {
    id: `stock-${poRef}`,
    kind: 'stock',
    ref: STOCK_LIFT_LABEL,
    label: 'Stock lift',
    party: 'Not linked to an SO',
    detail: `Inventory from ${formatPoRef(poRef)}`,
    qtyLabel: '—',
    statusLabel: 'stock',
    statusTone: 'default',
    href: `/purchase-orders?ref=${encodeURIComponent(poRef)}`,
  }
}

function liftNode(lift: Lift, qtyMt: number): FlowNodeData {
  return {
    id: `lift-${lift.id}`,
    kind: 'lift',
    ref: formatLiftRef(lift.liftRef),
    label: 'Lift',
    party: `${lift.sellerName} → ${lift.buyerName}`,
    detail: lift.salesInvoiceNo ? `Invoice ${lift.salesInvoiceNo}` : lift.status === 'pending' ? 'In transit' : 'Delivered',
    qtyLabel: formatQty(qtyMt),
    statusLabel: lift.status,
    statusTone: liftStatusTone(lift.status),
    href: `/lifts?ref=${encodeURIComponent(String(lift.liftRef))}`,
  }
}

function liftBranches(entries: SoLiftEntry[]): FlowTree[] {
  return entries.map(entry => ({
    node: liftNode(entry.lift, entry.qtyMt),
    children: [],
  }))
}

/** PO for a linked SO, or the PO itself when viewing a purchase order. */
export function resolveFlowRootPo(store: TradeStoreValue, order: TradeOrder): TradeOrder | null {
  if (order.side === 'purchase') return order
  if (!order.poRef) return null
  return store.getOrderByRef(order.poRef, 'purchase') ?? null
}

function buildPoFlowTree(store: TradeStoreValue, po: TradeOrder): FlowTree {
  const children: FlowTree[] = []

  for (const so of store.getSOsForPO(po.ref)) {
    children.push({
      node: soNode(so),
      children: liftBranches(liftsForSoOnPo(store.lifts, po.ref, so.ref)),
    })
  }

  const stockEntries = stockLiftsForPo(store.lifts, po.ref)
  if (stockEntries.length > 0) {
    children.push({
      node: stockNode(po.ref),
      children: liftBranches(stockEntries),
    })
  }

  return { node: poNode(po), children }
}

function buildOrphanSoFlowTree(store: TradeStoreValue, so: TradeOrder): FlowTree {
  const liftEntries = store.lifts
    .filter(l => liftTouchesRef(l, so.ref))
    .flatMap(lift =>
      getLiftAllocations(lift)
        .filter(a => a.soRef === so.ref)
        .map(a => ({ lift, qtyMt: a.qtyMt })),
    )

  return {
    node: soNode(so),
    children: liftBranches(liftEntries),
  }
}

export function buildOrderFlowTree(
  store: TradeStoreValue,
  order: TradeOrder,
): FlowTree {
  const rootPo = resolveFlowRootPo(store, order)
  if (rootPo) {
    return buildPoFlowTree(store, rootPo)
  }
  return buildOrphanSoFlowTree(store, order)
}

export function countFlowNodes(tree: FlowTree): { sos: number; lifts: number } {
  let sos = 0
  let lifts = 0
  for (const child of tree.children) {
    if (child.node.kind === 'so' || child.node.kind === 'stock') sos += 1
    lifts += child.children.length
  }
  return { sos, lifts }
}
