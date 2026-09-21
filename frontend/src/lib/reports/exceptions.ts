import type { TradeStoreValue } from '../../store/TradeStore'
import { getLiftAllocations } from '../liftAllocations'
import { getLiftPlannedQty } from '../liftBalance'
import { roundQtyMt } from '../utils'
import { formatLiftRef, formatPoRef } from '../tradeRefs'
import { loadExceptionOverlay, type ExceptionOverlay } from './exceptionOverlay'

export type ExceptionSeverity = 'Critical' | 'High' | 'Medium'
export type ExceptionStatus = 'Open' | 'Under Review' | 'Resolved' | 'Ignored'

export interface ExceptionRow {
  id: string
  href?: string
  date: string
  item: string
  customer: string
  supplier: string
  broker: string
  status: ExceptionStatus
  severity: ExceptionSeverity
  issue: string
  ref: string
  detected: string
  assignee: string
  resolution: string
  resolvedAt: string
  notes: string
}

function applyOverlay(row: ExceptionRow, overlay: Record<string, ExceptionOverlay>): ExceptionRow {
  const saved = overlay[row.id]
  if (!saved) return row
  return {
    ...row,
    status: saved.status,
    assignee: saved.assignee || row.assignee,
    resolution: saved.resolution || row.resolution,
    resolvedAt: saved.resolvedAt || row.resolvedAt,
    notes: saved.notes || row.notes,
  }
}

function base(
  id: string,
  issue: string,
  ref: string,
  href: string,
  severity: ExceptionSeverity,
  extra: Partial<ExceptionRow> = {},
): ExceptionRow {
  return {
    id,
    href,
    date: extra.date || '',
    item: extra.item || '',
    customer: extra.customer || '',
    supplier: extra.supplier || '',
    broker: extra.broker || '',
    status: 'Open',
    severity,
    issue,
    ref,
    detected: extra.detected || extra.date || '',
    assignee: '—',
    resolution: '—',
    resolvedAt: '—',
    notes: extra.notes || '—',
  }
}

export function detectExceptions(store: TradeStoreValue): ExceptionRow[] {
  const overlay = loadExceptionOverlay()
  const out: ExceptionRow[] = []
  const invoiceCount = new Map<string, number>()
  for (const lift of store.lifts) {
    const no = lift.salesInvoiceNo?.trim()
    if (no) invoiceCount.set(no, (invoiceCount.get(no) ?? 0) + 1)
  }

  for (const so of store.tradeOrders.filter(o => o.side === 'sale')) {
    const lifts = store.lifts.filter(l => getLiftAllocations(l).some(a => a.soRef === so.ref))
    if (so.liftedQty > 0 && !lifts.some(l => l.salesInvoiceNo)) {
      out.push(base(`missing-inv:${so.ref}`, 'Missing sales invoice', so.ref, `/sales-orders?ref=${encodeURIComponent(so.ref)}`, 'High', {
        date: so.date, item: so.itemName, customer: so.partyName, broker: so.brokerName, detected: so.date,
      }))
    }
    if (!so.brokerContractRef && !so.poRef) {
      out.push(base(`missing-cc:${so.ref}`, 'Missing contract confirmation', so.ref, `/sales-orders?ref=${encodeURIComponent(so.ref)}`, 'Medium', {
        date: so.date, item: so.itemName, customer: so.partyName,
      }))
    }
  }

  for (const po of store.tradeOrders.filter(o => o.side === 'purchase')) {
    if (!po.brokerContractRef) {
      out.push(base(`missing-cc:${po.ref}`, 'Missing contract confirmation', po.ref, `/purchase-orders?ref=${encodeURIComponent(po.ref)}`, 'Medium', {
        date: po.date, item: po.itemName, supplier: po.partyName,
      }))
    }
    if (po.status === 'completed' && roundQtyMt(Math.abs(po.liftedQty - po.orderQty)) > 0.05) {
      out.push(base(`qty:${po.ref}`, 'Quantity mismatch vs PO', formatPoRef(po.ref), `/purchase-orders?ref=${encodeURIComponent(po.ref)}`, 'High', {
        date: po.date, item: po.itemName, supplier: po.partyName,
      }))
    }
  }

  for (const lift of store.lifts) {
    const planned = getLiftPlannedQty(lift)
    if (lift.status === 'delivered' && roundQtyMt(Math.abs(lift.liftedQty - planned)) > 0.05) {
      const under = lift.liftedQty < planned
      out.push(base(`lift-var:${lift.id}`, under ? 'Lift underfill' : 'Lift overfill', formatLiftRef(lift.liftRef), `/lifts?ref=${lift.liftRef}`, 'High', {
        date: lift.date, item: lift.itemName, supplier: lift.sellerName, customer: lift.buyerName,
      }))
    }
    const no = lift.salesInvoiceNo?.trim()
    if (no && (invoiceCount.get(no) ?? 0) > 1) {
      out.push(base(`dup-inv:${no}:${lift.id}`, 'Duplicate invoice number', no, `/lifts?ref=${lift.liftRef}`, 'Critical', {
        date: lift.date, item: lift.itemName,
      }))
    }
  }

  const orderRefs = new Set(store.tradeOrders.map(o => o.ref))
  for (const p of store.payments) {
    if (!orderRefs.has(p.contractRef)) {
      out.push(base(`unalloc:${p.id}`, 'Unallocated payment', p.contractRef || p.id, '/reports/payment-reconciliation', 'High', {
        date: p.paidDate || p.dueDate, customer: p.party, supplier: p.party,
      }))
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  for (const p of store.payments) {
    if (p.status === 'outstanding' && p.dueDate < today) {
      out.push(base(`overdue:${p.id}`, 'Overdue receivable / payable', p.contractRef, '/reports/customer-outstanding', 'High', {
        date: p.dueDate, customer: p.party,
      }))
    }
  }

  for (const a of store.activities.filter(x => x.type === 'order_updated' && /rate/i.test(x.description))) {
    out.push(base(`rate:${a.id}`, 'Manual rate change', a.entityRef || '—', '/reports/rate-change', 'Medium', {
      date: a.timestamp.slice(0, 10), notes: a.description,
    }))
  }

  for (const po of store.tradeOrders.filter(o => o.side === 'purchase' && (o.buyBacks?.length ?? 0) > 0)) {
    out.push(base(`adj:${po.ref}`, 'Inventory adjustment (buy-back)', po.ref, `/purchase-orders?ref=${encodeURIComponent(po.ref)}`, 'Medium', {
      date: po.date, item: po.itemName, supplier: po.partyName,
    }))
  }

  const seen = new Set<string>()
  return out.filter(row => {
    if (seen.has(row.id)) return false
    seen.add(row.id)
    return true
  }).map(row => applyOverlay(row, overlay))
}
