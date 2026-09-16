import type { Activity, Lift, Payment, TradeOrder } from '../../data/mockData'
import type { TradeStoreValue } from '../../store/TradeStore'
import { formatLiftPoRefs, formatLiftSoRefs, getLiftAllocations } from '../liftAllocations'
import { getLiftPlannedQty } from '../liftBalance'
import { getLiftTankers } from '../liftTankers'
import { contractRateFromOrder, formatRateCell, orderLineAmount } from '../orderRate'
import { orderBrokerageTotal, computePoTradeProfit } from '../tradeProfit'
import { toBeLifted } from '../../data/mockData'
import { formatCurrency, formatDate, formatQty, roundQtyMt } from '../utils'
import type { ReportId } from './catalog'
import type { FilterableRow } from './filters'
import { detectExceptions, type ExceptionRow } from './exceptions'

export interface ReportColumn {
  key: string
  header: string
}

export interface ReportRow extends FilterableRow {
  id: string
  href?: string
  [key: string]: string | number | undefined
}

export interface BuiltReport {
  columns: ReportColumn[]
  rows: ReportRow[]
}

function grossOf(order: TradeOrder, qty = order.orderQty): number {
  return orderLineAmount(qty, contractRateFromOrder(order.rate, order.rateBasis, order.ratePerBasis), order.rateBasis)
}

function gstOf(order: TradeOrder, gross: number): number {
  return gross * ((order.taxRate || 0) / 100)
}

function liftsForPo(store: TradeStoreValue, poRef: string): Lift[] {
  return store.lifts.filter(l => getLiftAllocations(l).some(a => a.poRef === poRef))
}

function liftsForSo(store: TradeStoreValue, soRef: string): Lift[] {
  return store.lifts.filter(l => getLiftAllocations(l).some(a => a.soRef === soRef))
}

function paidForRef(payments: Payment[], ref: string): number {
  return payments
    .filter(p => p.contractRef === ref && p.paidDate && p.status !== 'outstanding')
    .reduce((sum, p) => sum + p.amount, 0)
}

function paymentStatus(value: number, paid: number): string {
  if (value <= 0) return '—'
  if (paid <= 0) return 'Unpaid'
  if (paid + 1 >= value) return 'Paid'
  return 'Partial'
}

function deliveryStatus(order: TradeOrder): string {
  if (order.status === 'completed') return 'Delivered'
  if (order.liftedQty > 0) return 'Partial'
  if ((order.committedLiftQty ?? 0) > 0) return 'In transit'
  return 'Pending'
}

function salesInvoiceFor(lifts: Lift[]): { no: string; date: string } {
  const withInv = lifts.filter(l => l.salesInvoiceNo)
  const first = withInv[0]
  return { no: first?.salesInvoiceNo || '', date: first?.deliveredAt?.slice(0, 10) || first?.date || '' }
}

function liftActualQty(lift: Lift): number {
  const fromTankers = getLiftTankers(lift).reduce((sum, t) => sum + (t.actualQtyMt ?? 0), 0)
  if (fromTankers > 0) return fromTankers
  if (lift.status === 'delivered') return lift.liftedQty
  return 0
}

function blob(parts: Array<string | number | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

function purchaseRegister(store: TradeStoreValue): BuiltReport {
  const columns: ReportColumn[] = [
    { key: 'ref', header: 'PO number' },
    { key: 'contractNo', header: 'Contract number' },
    { key: 'dateLabel', header: 'PO date' },
    { key: 'supplier', header: 'Supplier' },
    { key: 'broker', header: 'Broker' },
    { key: 'item', header: 'Product' },
    { key: 'qty', header: 'Quantity' },
    { key: 'rate', header: 'Purchase rate' },
    { key: 'gross', header: 'Gross value' },
    { key: 'brokerage', header: 'Brokerage' },
    { key: 'invoiceNo', header: 'Invoice number' },
    { key: 'invoiceDate', header: 'Invoice date' },
    { key: 'taxable', header: 'Taxable value' },
    { key: 'gst', header: 'GST' },
    { key: 'invoiceTotal', header: 'Total invoice value' },
    { key: 'payment', header: 'Payment status' },
    { key: 'delivery', header: 'Delivery status' },
  ]
  const rows: ReportRow[] = store.tradeOrders.filter(o => o.side === 'purchase').map(po => {
    const lifts = liftsForPo(store, po.ref)
    const inv = salesInvoiceFor(lifts.filter(l => l.status === 'delivered'))
    const gross = grossOf(po)
    const gst = gstOf(po, gross)
    const brokerage = orderBrokerageTotal(po)
    const paid = paidForRef(store.payments, po.ref)
    return {
      id: po.id,
      href: `/purchase-orders?ref=${encodeURIComponent(po.ref)}`,
      date: po.date,
      item: po.itemName,
      customer: '',
      supplier: po.sellerName || po.partyName,
      broker: po.brokerName,
      status: po.status,
      search: blob([po.ref, po.brokerContractRef, po.partyName, po.itemName, po.brokerName, inv.no]),
      ref: po.ref,
      contractNo: po.brokerContractRef || '—',
      dateLabel: formatDate(po.date),
      qty: formatQty(po.orderQty),
      rate: formatRateCell(po.rate, po.rateBasis, po.ratePerBasis),
      gross: formatCurrency(gross),
      brokerage: formatCurrency(brokerage),
      invoiceNo: inv.no || 'Missing',
      invoiceDate: inv.date ? formatDate(inv.date) : '—',
      taxable: formatCurrency(gross),
      gst: formatCurrency(gst),
      invoiceTotal: formatCurrency(gross + gst),
      payment: paymentStatus(gross + gst, paid),
      delivery: deliveryStatus(po),
    }
  })
  return { columns, rows }
}

function salesRegister(store: TradeStoreValue): BuiltReport {
  const columns: ReportColumn[] = [
    { key: 'ref', header: 'SO number' },
    { key: 'contractNo', header: 'Contract number' },
    { key: 'dateLabel', header: 'SO date' },
    { key: 'customer', header: 'Customer' },
    { key: 'broker', header: 'Broker' },
    { key: 'item', header: 'Product' },
    { key: 'qty', header: 'Quantity' },
    { key: 'rate', header: 'Selling rate' },
    { key: 'gross', header: 'Gross value' },
    { key: 'invoiceNo', header: 'Invoice number' },
    { key: 'invoiceDate', header: 'Invoice date' },
    { key: 'gst', header: 'GST' },
    { key: 'invoiceTotal', header: 'Total invoice value' },
    { key: 'delivered', header: 'Delivered quantity' },
    { key: 'pending', header: 'Pending quantity' },
    { key: 'payment', header: 'Payment status' },
  ]
  const rows: ReportRow[] = store.tradeOrders.filter(o => o.side === 'sale').map(so => {
    const lifts = liftsForSo(store, so.ref)
    const inv = salesInvoiceFor(lifts.filter(l => l.status === 'delivered'))
    const gross = grossOf(so)
    const gst = gstOf(so, gross)
    const paid = paidForRef(store.payments, so.ref)
    const pending = toBeLifted(so)
    return {
      id: so.id,
      href: `/sales-orders?ref=${encodeURIComponent(so.ref)}`,
      date: so.date,
      item: so.itemName,
      customer: so.buyerName || so.partyName,
      supplier: '',
      broker: so.brokerName,
      status: so.status,
      search: blob([so.ref, so.brokerContractRef, so.partyName, so.itemName, inv.no]),
      ref: so.ref,
      contractNo: so.brokerContractRef || so.poRef || '—',
      dateLabel: formatDate(so.date),
      qty: formatQty(so.orderQty),
      rate: formatRateCell(so.rate, so.rateBasis, so.ratePerBasis),
      gross: formatCurrency(gross),
      invoiceNo: inv.no || 'Missing',
      invoiceDate: inv.date ? formatDate(inv.date) : '—',
      gst: formatCurrency(gst),
      invoiceTotal: formatCurrency(gross + gst),
      delivered: formatQty(so.liftedQty),
      pending: formatQty(pending),
      payment: paymentStatus(gross + gst, paid),
    }
  })
  return { columns, rows }
}

function mismatchFlags(parts: string[]): string {
  return parts.length ? parts.join(' · ') : 'Matched'
}

function purchaseVsInvoice(store: TradeStoreValue): BuiltReport {
  const columns: ReportColumn[] = [
    { key: 'ref', header: 'PO' },
    { key: 'supplier', header: 'Supplier' },
    { key: 'item', header: 'Product' },
    { key: 'poQty', header: 'PO qty' },
    { key: 'invoicedQty', header: 'Lifted qty' },
    { key: 'poRate', header: 'PO rate' },
    { key: 'invoiceNo', header: 'Invoice' },
    { key: 'flags', header: 'Status' },
  ]
  const invoiceNos = new Map<string, string[]>()
  for (const lift of store.lifts) {
    const no = lift.salesInvoiceNo?.trim()
    if (!no) continue
    const list = invoiceNos.get(no) ?? []
    list.push(lift.poRef)
    invoiceNos.set(no, list)
  }
  const rows: ReportRow[] = store.tradeOrders.filter(o => o.side === 'purchase').map(po => {
    const lifts = liftsForPo(store, po.ref)
    const delivered = lifts.filter(l => l.status === 'delivered')
    const lifted = delivered.reduce((s, l) => s + l.liftedQty, 0)
    const inv = salesInvoiceFor(delivered)
    const flags: string[] = []
    if (!inv.no) flags.push('Invoice missing')
    if (roundQtyMt(Math.abs(lifted - po.orderQty)) > 0.001 && po.status === 'completed') flags.push('Quantity mismatch')
    if (inv.no && (invoiceNos.get(inv.no)?.length ?? 0) > 1) flags.push('Duplicate invoice number')
    return {
      id: po.id,
      href: `/purchase-orders?ref=${encodeURIComponent(po.ref)}`,
      date: po.date,
      item: po.itemName,
      supplier: po.sellerName || po.partyName,
      broker: po.brokerName,
      customer: '',
      status: flags.length ? 'Exception' : 'Matched',
      search: blob([po.ref, po.partyName, po.itemName, inv.no]),
      ref: po.ref,
      poQty: formatQty(po.orderQty),
      invoicedQty: formatQty(lifted),
      poRate: formatRateCell(po.rate, po.rateBasis, po.ratePerBasis),
      invoiceNo: inv.no || '—',
      flags: mismatchFlags(flags),
    }
  })
  return { columns, rows }
}

function salesVsInvoice(store: TradeStoreValue): BuiltReport {
  const columns: ReportColumn[] = [
    { key: 'ref', header: 'SO' },
    { key: 'customer', header: 'Customer' },
    { key: 'item', header: 'Product' },
    { key: 'soQty', header: 'SO qty' },
    { key: 'invoicedQty', header: 'Delivered qty' },
    { key: 'soRate', header: 'SO rate' },
    { key: 'invoiceNo', header: 'Invoice' },
    { key: 'flags', header: 'Status' },
  ]
  const byInvoice = new Map<string, number>()
  for (const lift of store.lifts) {
    const no = lift.salesInvoiceNo?.trim()
    if (no) byInvoice.set(no, (byInvoice.get(no) ?? 0) + 1)
  }
  const rows: ReportRow[] = store.tradeOrders.filter(o => o.side === 'sale').map(so => {
    const lifts = liftsForSo(store, so.ref)
    const delivered = lifts.filter(l => l.status === 'delivered')
    const inv = salesInvoiceFor(delivered)
    const flags: string[] = []
    if (!inv.no && so.liftedQty > 0) flags.push('Invoice missing')
    if (so.status === 'completed' && roundQtyMt(Math.abs(so.liftedQty - so.orderQty)) > 0.001) flags.push('Quantity mismatch')
    if (inv.no && (byInvoice.get(inv.no) ?? 0) > 1) flags.push('Duplicate invoice')
    const liftBuyers = new Set(delivered.map(l => l.buyerName).filter(Boolean))
    if (liftBuyers.size > 1) flags.push('Customer mismatch')
    return {
      id: so.id,
      href: `/sales-orders?ref=${encodeURIComponent(so.ref)}`,
      date: so.date,
      item: so.itemName,
      customer: so.buyerName || so.partyName,
      supplier: '',
      broker: so.brokerName,
      status: flags.length ? 'Exception' : 'Matched',
      search: blob([so.ref, so.partyName, inv.no]),
      ref: so.ref,
      soQty: formatQty(so.orderQty),
      invoicedQty: formatQty(so.liftedQty),
      soRate: formatRateCell(so.rate, so.rateBasis, so.ratePerBasis),
      invoiceNo: inv.no || '—',
      flags: mismatchFlags(flags),
    }
  })
  return { columns, rows }
}

function contractSummary(store: TradeStoreValue): BuiltReport {
  return {
    columns: [
      { key: 'ref', header: 'Contract' },
      { key: 'dateLabel', header: 'Created' },
      { key: 'supplier', header: 'Seller' },
      { key: 'customer', header: 'Buyer' },
      { key: 'item', header: 'Commodity' },
      { key: 'qty', header: 'Quantity' },
      { key: 'rate', header: 'Rate' },
      { key: 'value', header: 'Value' },
      { key: 'broker', header: 'Broker' },
      { key: 'status', header: 'Status' },
      { key: 'payment', header: 'Payment' },
    ],
    rows: store.contracts.map(c => ({
      id: c.id,
      href: `/contracts/${c.id}`,
      date: c.createdAt.slice(0, 10),
      item: c.commodity,
      customer: c.buyer,
      supplier: c.seller,
      broker: c.broker,
      status: c.status,
      search: blob([c.ref, c.buyer, c.seller, c.commodity, c.broker]),
      ref: c.ref,
      dateLabel: formatDate(c.createdAt.slice(0, 10)),
      qty: formatQty(c.quantity),
      rate: formatCurrency(c.rate),
      value: formatCurrency(c.value),
      payment: c.paymentStatus,
    })),
  }
}

function stockReconciliation(store: TradeStoreValue): BuiltReport {
  const commodities = [...new Set(store.lots.map(l => l.commodity))].sort()
  const columns: ReportColumn[] = [
    { key: 'item', header: 'Product' },
    { key: 'opening', header: 'Opening qty' },
    { key: 'purchased', header: 'Purchased qty' },
    { key: 'received', header: 'Received qty' },
    { key: 'sold', header: 'Sold qty' },
    { key: 'delivered', header: 'Delivered qty' },
    { key: 'adjustments', header: 'Adjustments' },
    { key: 'expected', header: 'Expected closing' },
    { key: 'actual', header: 'Tradeal quantity' },
    { key: 'variance', header: 'Variance' },
    { key: 'variancePct', header: 'Variance %' },
    { key: 'status', header: 'Status' },
  ]
  const rows: ReportRow[] = commodities.map(item => {
    const lots = store.lots.filter(l => l.commodity === item)
    const actual = roundQtyMt(lots.reduce((s, l) => s + l.remaining, 0))
    const purchased = roundQtyMt(store.tradeOrders.filter(o => o.side === 'purchase' && o.itemName === item).reduce((s, o) => s + o.orderQty, 0))
    const sold = roundQtyMt(store.tradeOrders.filter(o => o.side === 'sale' && o.itemName === item).reduce((s, o) => s + o.orderQty, 0))
    const received = roundQtyMt(store.lifts.filter(l => l.itemName === item && l.status === 'delivered').reduce((s, l) => {
      return s + getLiftAllocations(l).filter(a => !a.soRef).reduce((q, a) => q + a.qtyMt, 0) + (getLiftAllocations(l).some(a => a.soRef) ? 0 : 0)
    }, 0) + store.tradeOrders.filter(o => o.side === 'purchase' && o.itemName === item).reduce((s, o) => s + o.liftedQty, 0))
    const delivered = roundQtyMt(store.tradeOrders.filter(o => o.side === 'sale' && o.itemName === item).reduce((s, o) => s + o.liftedQty, 0))
    const adjustments = roundQtyMt(store.tradeOrders.filter(o => o.side === 'purchase' && o.itemName === item).reduce((s, o) => {
      return s + (o.buyBacks ?? []).reduce((b, bb) => b + bb.qtyMt, 0)
    }, 0))
    const opening = roundQtyMt(actual - received + delivered + adjustments)
    const expected = roundQtyMt(opening + received - delivered - adjustments)
    const variance = roundQtyMt(actual - expected)
    const variancePct = expected !== 0 ? ((variance / expected) * 100).toFixed(1) : '0.0'
    const significant = Math.abs(variance) >= 0.1
    return {
      id: item,
      href: '/inventory',
      date: '',
      item,
      customer: '',
      supplier: '',
      broker: '',
      status: significant ? 'Variance' : 'Reconciled',
      search: item,
      opening: formatQty(Math.max(0, opening)),
      purchased: formatQty(purchased),
      received: formatQty(received),
      sold: formatQty(sold),
      delivered: formatQty(delivered),
      adjustments: formatQty(adjustments),
      expected: formatQty(expected),
      actual: formatQty(actual),
      variance: formatQty(variance),
      variancePct: `${variancePct}%`,
    }
  })
  return { columns, rows }
}

function inventoryMovement(store: TradeStoreValue): BuiltReport {
  const columns: ReportColumn[] = [
    { key: 'dateLabel', header: 'Date' },
    { key: 'ref', header: 'Lift' },
    { key: 'direction', header: 'Movement' },
    { key: 'item', header: 'Product' },
    { key: 'supplier', header: 'Producer' },
    { key: 'customer', header: 'Customer' },
    { key: 'qty', header: 'Quantity' },
    { key: 'status', header: 'Status' },
  ]
  const rows: ReportRow[] = store.lifts.map(lift => {
    const allocs = getLiftAllocations(lift)
    const stock = allocs.every(a => !a.soRef)
    return {
      id: lift.id,
      href: `/lifts?ref=${lift.liftRef}`,
      date: lift.date,
      item: lift.itemName,
      supplier: lift.sellerName,
      customer: stock ? '' : lift.buyerName,
      broker: '',
      status: lift.status === 'delivered' ? 'Delivered' : 'In transit',
      search: blob([String(lift.liftRef), lift.itemName, lift.sellerName, lift.buyerName]),
      dateLabel: formatDate(lift.date),
      ref: `#${lift.liftRef}`,
      direction: stock ? 'Receipt (own stock)' : 'Dispatch',
      qty: formatQty(lift.liftedQty),
    }
  })
  return { columns, rows }
}

function liftReport(store: TradeStoreValue): BuiltReport {
  const columns: ReportColumn[] = [
    { key: 'ref', header: 'Lift' },
    { key: 'poRefs', header: 'PO' },
    { key: 'soRefs', header: 'SO' },
    { key: 'supplier', header: 'Producer' },
    { key: 'customer', header: 'Customer' },
    { key: 'item', header: 'Product' },
    { key: 'planned', header: 'Planned' },
    { key: 'actual', header: 'Actual' },
    { key: 'dateLabel', header: 'Loading date' },
    { key: 'deliveredAt', header: 'Delivery date' },
    { key: 'status', header: 'Status' },
  ]
  const rows: ReportRow[] = store.lifts.map(lift => ({
    id: lift.id,
    href: `/lifts?ref=${lift.liftRef}`,
    date: lift.date,
    item: lift.itemName,
    supplier: lift.sellerName,
    customer: lift.buyerName,
    broker: '',
    status: lift.status === 'delivered' ? 'Delivered' : 'In transit',
    search: blob([String(lift.liftRef), lift.poRef, lift.soRef, lift.itemName]),
    ref: `#${lift.liftRef}`,
    poRefs: formatLiftPoRefs(lift),
    soRefs: formatLiftSoRefs(lift) || 'Stock',
    planned: formatQty(getLiftPlannedQty(lift)),
    actual: formatQty(liftActualQty(lift) || (lift.status === 'delivered' ? lift.liftedQty : 0)),
    dateLabel: formatDate(lift.date),
    deliveredAt: lift.deliveredAt ? formatDate(lift.deliveredAt.slice(0, 10)) : '—',
  }))
  return { columns, rows }
}

function liftVariance(store: TradeStoreValue): BuiltReport {
  const columns: ReportColumn[] = [
    { key: 'ref', header: 'Lift' },
    { key: 'poRefs', header: 'PO' },
    { key: 'soRefs', header: 'SO' },
    { key: 'supplier', header: 'Producer' },
    { key: 'customer', header: 'Customer' },
    { key: 'item', header: 'Product' },
    { key: 'planned', header: 'Planned qty' },
    { key: 'actual', header: 'Actual qty' },
    { key: 'variance', header: 'Variance qty' },
    { key: 'variancePct', header: 'Variance %' },
    { key: 'dateLabel', header: 'Loading date' },
    { key: 'deliveredAt', header: 'Delivery date' },
    { key: 'reason', header: 'Reason' },
    { key: 'resolution', header: 'Resolution' },
    { key: 'carry', header: 'Carry-forward qty' },
  ]
  const rows: ReportRow[] = store.lifts.map(lift => {
    const planned = getLiftPlannedQty(lift)
    const actual = lift.status === 'delivered' ? lift.liftedQty : (liftActualQty(lift) || 0)
    const variance = roundQtyMt(actual - planned)
    const pct = planned ? ((variance / planned) * 100).toFixed(1) : '0.0'
    const carry = lift.balanceAppliedQtyMt ?? 0
    const settlements = store.balanceSettlements.filter(s =>
      getLiftAllocations(lift).some(a => a.poRef === s.poRef && (a.soRef || '') === (s.soRef || '')),
    )
    const cash = settlements.filter(s => s.method === 'cash').reduce((s, x) => s + x.qtyMt, 0)
    const carried = settlements.filter(s => s.method === 'carried_forward').reduce((s, x) => s + x.qtyMt, 0)
    const resolution = cash > 0 ? 'Settled in cash' : carried > 0 ? 'Carried forward' : variance === 0 ? '—' : 'Open'
    return {
      id: lift.id,
      href: `/lifts?ref=${lift.liftRef}`,
      date: lift.date,
      item: lift.itemName,
      supplier: lift.sellerName,
      customer: lift.buyerName,
      broker: '',
      status: resolution,
      search: blob([String(lift.liftRef), lift.itemName, lift.remarks]),
      ref: `#${lift.liftRef}`,
      poRefs: formatLiftPoRefs(lift),
      soRefs: formatLiftSoRefs(lift) || 'Stock',
      planned: formatQty(planned),
      actual: formatQty(actual),
      variance: formatQty(variance),
      variancePct: `${pct}%`,
      dateLabel: formatDate(lift.date),
      deliveredAt: lift.deliveredAt ? formatDate(lift.deliveredAt.slice(0, 10)) : '—',
      reason: lift.remarks || '—',
      resolution,
      carry: formatQty(carry || carried),
    }
  })
  return { columns, rows }
}

function deliveryReport(store: TradeStoreValue): BuiltReport {
  const delivered = store.lifts.filter(l => l.status === 'delivered')
  return {
    columns: [
      { key: 'ref', header: 'Lift' },
      { key: 'deliveredAt', header: 'Delivery date' },
      { key: 'item', header: 'Product' },
      { key: 'supplier', header: 'Producer' },
      { key: 'customer', header: 'Customer' },
      { key: 'qty', header: 'Actual qty' },
      { key: 'invoiceNo', header: 'Invoice' },
      { key: 'lr', header: 'LR / transport' },
    ],
    rows: delivered.map(lift => {
      const tanker = getLiftTankers(lift)[0]
      return {
        id: lift.id,
        href: `/lifts?ref=${lift.liftRef}`,
        date: lift.deliveredAt?.slice(0, 10) || lift.date,
        item: lift.itemName,
        supplier: lift.sellerName,
        customer: lift.buyerName,
        broker: '',
        status: 'Delivered',
        search: blob([String(lift.liftRef), lift.salesInvoiceNo, tanker?.lrNo, tanker?.tankerNo]),
        ref: `#${lift.liftRef}`,
        deliveredAt: formatDate(lift.deliveredAt?.slice(0, 10) || lift.date),
        qty: formatQty(lift.liftedQty),
        invoiceNo: lift.salesInvoiceNo || 'Missing',
        lr: tanker?.lrNo || tanker?.tankerNo || '—',
      }
    }),
  }
}

function outstandingRows(store: TradeStoreValue, side: 'customer' | 'supplier'): BuiltReport {
  const columns: ReportColumn[] = [
    { key: 'party', header: 'Party' },
    { key: 'ref', header: 'Invoice / order' },
    { key: 'dateLabel', header: 'Invoice date' },
    { key: 'due', header: 'Due date' },
    { key: 'value', header: 'Invoice value' },
    { key: 'paid', header: 'Paid' },
    { key: 'outstanding', header: 'Outstanding' },
    { key: 'overdue', header: 'Days overdue' },
    { key: 'creditLimit', header: 'Credit limit' },
    { key: 'utilisation', header: 'Credit utilisation' },
    { key: 'status', header: 'Status' },
  ]
  const orders = store.tradeOrders.filter(o => o.side === (side === 'customer' ? 'sale' : 'purchase'))
  const today = new Date().toISOString().slice(0, 10)
  const rows: ReportRow[] = orders.map(order => {
    const gross = grossOf(order)
    const total = gross + gstOf(order, gross)
    const paid = paidForRef(store.payments, order.ref)
    const outstanding = Math.max(0, total - paid)
    const payment = store.payments.find(p => p.contractRef === order.ref)
    const due = payment?.dueDate || order.date
    const overdueDays = outstanding > 1 && due < today
      ? Math.floor((Date.parse(today) - Date.parse(due)) / 86400000)
      : 0
    const party = side === 'customer' ? (order.buyerName || order.partyName) : (order.sellerName || order.partyName)
    const retailer = store.retailers.find(r => r.name === party)
    return {
      id: order.id,
      href: side === 'customer'
        ? `/sales-orders?ref=${encodeURIComponent(order.ref)}`
        : `/purchase-orders?ref=${encodeURIComponent(order.ref)}`,
      date: order.date,
      item: order.itemName,
      customer: side === 'customer' ? party : '',
      supplier: side === 'supplier' ? party : '',
      broker: order.brokerName,
      status: overdueDays > 0 ? 'Overdue' : outstanding > 1 ? 'Open' : 'Settled',
      search: blob([party, order.ref]),
      party,
      ref: order.ref,
      dateLabel: formatDate(order.date),
      due: formatDate(due),
      value: formatCurrency(total),
      paid: formatCurrency(paid),
      outstanding: formatCurrency(outstanding),
      overdue: overdueDays > 0 ? String(overdueDays) : '—',
      creditLimit: '—',
      utilisation: retailer && retailer.outstanding > 0 ? formatCurrency(retailer.outstanding) : '—',
    }
  })
  return { columns, rows }
}

function paymentReconciliation(store: TradeStoreValue): BuiltReport {
  const columns: ReportColumn[] = [
    { key: 'ref', header: 'Transaction' },
    { key: 'invoice', header: 'Invoice' },
    { key: 'party', header: 'Customer / Supplier' },
    { key: 'value', header: 'Invoice value' },
    { key: 'paid', header: 'Paid amount' },
    { key: 'outstanding', header: 'Outstanding' },
    { key: 'paidOn', header: 'Payment date' },
    { key: 'method', header: 'Method' },
    { key: 'unallocated', header: 'Unallocated' },
    { key: 'status', header: 'Status' },
  ]
  const orderRefs = new Set(store.tradeOrders.map(o => o.ref))
  const rows: ReportRow[] = []

  for (const order of store.tradeOrders) {
    const gross = grossOf(order)
    const value = gross + gstOf(order, gross)
    const related = store.payments.filter(p => p.contractRef === order.ref)
    const paid = related.filter(p => p.paidDate && p.status !== 'outstanding').reduce((s, p) => s + p.amount, 0)
    const last = related.filter(p => p.paidDate).sort((a, b) => (b.paidDate || '').localeCompare(a.paidDate || ''))[0]
    const outstanding = Math.max(0, value - paid)
    let status = 'Open'
    if (paid <= 0) status = 'Unpaid'
    else if (paid > value + 1) status = 'Overpayment'
    else if (outstanding > 1) status = 'Underpayment'
    else status = 'Settled'
    const lifts = order.side === 'sale' ? liftsForSo(store, order.ref) : liftsForPo(store, order.ref)
    const inv = salesInvoiceFor(lifts)
    rows.push({
      id: order.id,
      href: order.side === 'sale' ? `/sales-orders?ref=${encodeURIComponent(order.ref)}` : `/purchase-orders?ref=${encodeURIComponent(order.ref)}`,
      date: order.date,
      item: order.itemName,
      customer: order.side === 'sale' ? order.partyName : '',
      supplier: order.side === 'purchase' ? order.partyName : '',
      broker: order.brokerName,
      status,
      search: blob([order.ref, order.partyName, inv.no]),
      ref: order.ref,
      invoice: inv.no || '—',
      party: order.partyName,
      value: formatCurrency(value),
      paid: formatCurrency(paid),
      outstanding: formatCurrency(outstanding),
      paidOn: last?.paidDate ? formatDate(last.paidDate) : '—',
      method: last?.method || '—',
      unallocated: formatCurrency(0),
    })
  }

  for (const p of store.payments) {
    if (orderRefs.has(p.contractRef)) continue
    rows.push({
      id: p.id,
      date: p.paidDate || p.dueDate,
      item: '',
      customer: p.party,
      supplier: p.party,
      broker: '',
      status: 'Unallocated',
      search: blob([p.contractRef, p.party]),
      ref: p.contractRef || '—',
      invoice: '—',
      party: p.party,
      value: formatCurrency(0),
      paid: formatCurrency(p.amount),
      outstanding: formatCurrency(0),
      paidOn: p.paidDate ? formatDate(p.paidDate) : '—',
      method: p.method || '—',
      unallocated: formatCurrency(p.amount),
    })
  }
  return { columns, rows }
}

function brokerageReport(store: TradeStoreValue): BuiltReport {
  const columns: ReportColumn[] = [
    { key: 'broker', header: 'Broker' },
    { key: 'contractNo', header: 'Contract' },
    { key: 'ref', header: 'Transaction' },
    { key: 'side', header: 'Type' },
    { key: 'item', header: 'Product' },
    { key: 'qty', header: 'Quantity' },
    { key: 'rate', header: 'Brokerage rate' },
    { key: 'amount', header: 'Brokerage amount' },
    { key: 'payable', header: 'Payable' },
    { key: 'paid', header: 'Paid' },
    { key: 'outstanding', header: 'Outstanding' },
  ]
  const rows: ReportRow[] = store.tradeOrders.filter(o => o.brokerName).map(order => {
    const amount = orderBrokerageTotal(order)
    const rateLabel = order.brokeragePerTon
      ? `${formatCurrency(order.brokeragePerTon)}/MT`
      : `${order.brokeragePct}%`
    return {
      id: order.id,
      href: order.side === 'purchase'
        ? `/purchase-orders?ref=${encodeURIComponent(order.ref)}`
        : `/sales-orders?ref=${encodeURIComponent(order.ref)}`,
      date: order.date,
      item: order.itemName,
      customer: order.side === 'sale' ? order.partyName : '',
      supplier: order.side === 'purchase' ? order.partyName : '',
      broker: order.brokerName,
      status: amount > 0 ? 'Payable' : '—',
      search: blob([order.brokerName, order.ref, order.itemName]),
      contractNo: order.brokerContractRef || '—',
      ref: order.ref,
      side: order.side === 'purchase' ? 'Purchase' : 'Sale',
      qty: formatQty(order.orderQty),
      rate: rateLabel,
      amount: formatCurrency(amount),
      payable: formatCurrency(amount),
      paid: formatCurrency(0),
      outstanding: formatCurrency(amount),
    }
  })
  return { columns, rows }
}

function creditDebitNotes(store: TradeStoreValue): BuiltReport {
  const columns: ReportColumn[] = [
    { key: 'dateLabel', header: 'Date' },
    { key: 'kind', header: 'Type' },
    { key: 'ref', header: 'Transaction' },
    { key: 'qty', header: 'Quantity' },
    { key: 'amount', header: 'Amount' },
    { key: 'notes', header: 'Notes' },
  ]
  const rows: ReportRow[] = []
  for (const po of store.tradeOrders.filter(o => o.side === 'purchase')) {
    for (const bb of po.buyBacks ?? []) {
      rows.push({
        id: bb.id,
        href: `/purchase-orders?ref=${encodeURIComponent(po.ref)}`,
        date: bb.date,
        item: po.itemName,
        supplier: po.partyName,
        customer: '',
        broker: po.brokerName,
        status: 'Debit note',
        search: blob([po.ref, bb.remarks]),
        dateLabel: formatDate(bb.date),
        kind: 'Buy-back (debit)',
        ref: po.ref,
        qty: formatQty(bb.qtyMt),
        amount: formatCurrency(bb.qtyMt * bb.rate),
        notes: bb.remarks || '—',
      })
    }
  }
  for (const s of store.balanceSettlements) {
    rows.push({
      id: s.id,
      date: s.settledAt.slice(0, 10),
      item: '',
      supplier: '',
      customer: '',
      broker: '',
      status: s.method === 'cash' ? 'Credit note' : 'Carry forward',
      search: blob([s.poRef, s.soRef, s.notes]),
      dateLabel: formatDate(s.settledAt.slice(0, 10)),
      kind: s.method === 'cash' ? 'Cash settlement' : 'Carried forward',
      ref: `${s.poRef} / ${s.soRef}`,
      qty: formatQty(s.qtyMt),
      amount: formatCurrency(s.amount),
      notes: s.notes || '—',
    })
  }
  return { columns, rows }
}

function tradeProfitability(store: TradeStoreValue): BuiltReport {
  const columns: ReportColumn[] = [
    { key: 'ref', header: 'PO' },
    { key: 'item', header: 'Product' },
    { key: 'supplier', header: 'Supplier' },
    { key: 'purchased', header: 'Purchase value' },
    { key: 'landed', header: 'Landed cost / MT' },
    { key: 'soldQty', header: 'Sold qty' },
    { key: 'revenue', header: 'Sale revenue' },
    { key: 'profit', header: 'Gross profit' },
    { key: 'status', header: 'Status' },
  ]
  const rows: ReportRow[] = store.tradeOrders.filter(o => o.side === 'purchase').map(po => {
    const p = computePoTradeProfit(po, store.tradeOrders, store.lifts)
    return {
      id: po.id,
      href: `/purchase-orders?ref=${encodeURIComponent(po.ref)}`,
      date: po.date,
      item: po.itemName,
      supplier: po.sellerName || po.partyName,
      customer: '',
      broker: po.brokerName,
      status: p.hasSales ? 'Has sales' : 'Unsold',
      search: blob([po.ref, po.itemName]),
      ref: po.ref,
      purchased: formatCurrency(p.purchaseValue),
      landed: formatCurrency(p.trueLandedCostPerMt),
      soldQty: formatQty(p.soldQtyMt),
      revenue: formatCurrency(p.saleRevenue),
      profit: p.grossProfit == null ? '—' : formatCurrency(p.grossProfit),
    }
  })
  return { columns, rows }
}

function landedCost(store: TradeStoreValue): BuiltReport {
  const columns: ReportColumn[] = [
    { key: 'ref', header: 'PO' },
    { key: 'item', header: 'Product' },
    { key: 'qty', header: 'Quantity' },
    { key: 'purchase', header: 'Purchase value' },
    { key: 'brokerage', header: 'Brokerage' },
    { key: 'total', header: 'Total landed' },
    { key: 'perMt', header: '₹ / MT' },
  ]
  const rows: ReportRow[] = store.tradeOrders.filter(o => o.side === 'purchase').map(po => {
    const p = computePoTradeProfit(po, store.tradeOrders, store.lifts)
    return {
      id: po.id,
      href: `/purchase-orders?ref=${encodeURIComponent(po.ref)}`,
      date: po.date,
      item: po.itemName,
      supplier: po.partyName,
      customer: '',
      broker: po.brokerName,
      status: po.status,
      search: blob([po.ref, po.itemName]),
      ref: po.ref,
      qty: formatQty(po.orderQty),
      purchase: formatCurrency(p.purchaseValue),
      brokerage: formatCurrency(p.brokerageTotal),
      total: formatCurrency(p.purchaseValue + p.totalAdditionalCosts),
      perMt: formatCurrency(p.trueLandedCostPerMt),
    }
  })
  return { columns, rows }
}

function documentCompleteness(store: TradeStoreValue): BuiltReport {
  const columns: ReportColumn[] = [
    { key: 'ref', header: 'Transaction' },
    { key: 'kind', header: 'Type' },
    { key: 'item', header: 'Product' },
    { key: 'missing', header: 'Missing documents' },
    { key: 'status', header: 'Status' },
  ]
  const rows: ReportRow[] = []
  for (const po of store.tradeOrders.filter(o => o.side === 'purchase')) {
    const lifts = liftsForPo(store, po.ref)
    const missing: string[] = []
    if (!po.brokerContractRef) missing.push('Contract confirmation')
    if (!lifts.some(l => l.salesInvoiceNo) && po.liftedQty > 0) missing.push('Invoice')
    if (po.liftedQty <= 0 && po.status !== 'completed') missing.push('Delivery document')
    if (!paidForRef(store.payments, po.ref) && po.status === 'completed') missing.push('Payment document')
    if (lifts.some(l => getLiftTankers(l).every(t => !t.lrNo && !t.tankerNo))) missing.push('Transport document')
    const critical = missing.includes('Contract confirmation') || missing.includes('Invoice')
    rows.push({
      id: po.id,
      href: `/purchase-orders?ref=${encodeURIComponent(po.ref)}`,
      date: po.date,
      item: po.itemName,
      supplier: po.partyName,
      customer: '',
      broker: po.brokerName,
      status: missing.length === 0 ? 'Complete' : critical ? 'Critical missing' : 'Missing documents',
      search: blob([po.ref, missing.join(' ')]),
      ref: po.ref,
      kind: 'PO',
      missing: missing.join(', ') || '—',
    })
  }
  for (const so of store.tradeOrders.filter(o => o.side === 'sale')) {
    const lifts = liftsForSo(store, so.ref)
    const missing: string[] = []
    if (!so.brokerContractRef && !so.poRef) missing.push('Contract confirmation')
    if (so.liftedQty > 0 && !lifts.some(l => l.salesInvoiceNo)) missing.push('Invoice')
    if (so.liftedQty <= 0) missing.push('Delivery document')
    const critical = missing.includes('Invoice') && so.liftedQty > 0
    rows.push({
      id: so.id,
      href: `/sales-orders?ref=${encodeURIComponent(so.ref)}`,
      date: so.date,
      item: so.itemName,
      customer: so.partyName,
      supplier: '',
      broker: so.brokerName,
      status: missing.length === 0 ? 'Complete' : critical ? 'Critical missing' : 'Missing documents',
      search: blob([so.ref, missing.join(' ')]),
      ref: so.ref,
      kind: 'SO',
      missing: missing.join(', ') || '—',
    })
  }
  return { columns, rows }
}

function rateChange(store: TradeStoreValue): BuiltReport {
  const columns: ReportColumn[] = [
    { key: 'dateLabel', header: 'Date/time' },
    { key: 'ref', header: 'Transaction' },
    { key: 'item', header: 'Product' },
    { key: 'user', header: 'Changed by' },
    { key: 'detail', header: 'Change' },
    { key: 'reason', header: 'Reason' },
  ]
  const rows: ReportRow[] = store.activities
    .filter(a => a.type === 'order_updated' && /rate/i.test(`${a.title} ${a.description}`))
    .map(a => ({
      id: a.id,
      href: a.entityRef?.startsWith('SO')
        ? `/sales-orders?ref=${encodeURIComponent(a.entityRef)}`
        : a.entityRef?.startsWith('PO')
          ? `/purchase-orders?ref=${encodeURIComponent(a.entityRef)}`
          : '/activity',
      date: a.timestamp.slice(0, 10),
      item: '',
      customer: '',
      supplier: '',
      broker: '',
      status: 'Logged',
      search: blob([a.entityRef, a.description]),
      dateLabel: formatDate(a.timestamp.slice(0, 10)),
      ref: a.entityRef || '—',
      user: a.user,
      detail: a.description,
      reason: '—',
    }))
  return { columns, rows }
}

function auditTrail(store: TradeStoreValue): BuiltReport {
  const columns: ReportColumn[] = [
    { key: 'dateLabel', header: 'Timestamp' },
    { key: 'user', header: 'User' },
    { key: 'action', header: 'Action' },
    { key: 'ref', header: 'Record' },
    { key: 'detail', header: 'Detail' },
  ]
  const rows: ReportRow[] = store.activities.map((a: Activity) => ({
    id: a.id,
    href: '/activity',
    date: a.timestamp.slice(0, 10),
    item: '',
    customer: '',
    supplier: '',
    broker: '',
    status: a.type,
    search: blob([a.title, a.description, a.entityRef, a.user]),
    dateLabel: a.timestamp.replace('T', ' ').slice(0, 19),
    user: a.user,
    action: a.title,
    ref: a.entityRef || '—',
    detail: a.description,
  }))
  return { columns, rows }
}

function exceptionReport(store: TradeStoreValue): BuiltReport {
  const columns: ReportColumn[] = [
    { key: 'severity', header: 'Severity' },
    { key: 'issue', header: 'Issue' },
    { key: 'ref', header: 'Transaction' },
    { key: 'detected', header: 'Detected' },
    { key: 'status', header: 'Status' },
    { key: 'assignee', header: 'Assigned user' },
    { key: 'resolution', header: 'Resolution' },
    { key: 'resolvedAt', header: 'Resolution date' },
    { key: 'notes', header: 'Notes' },
  ]
  const rows: ReportRow[] = detectExceptions(store).map((e: ExceptionRow) => ({
    ...e,
    search: blob([e.issue, e.ref, e.status, e.notes]),
  }))
  return { columns, rows }
}

function auditSummary(store: TradeStoreValue): BuiltReport {
  const exceptions = detectExceptions(store)
  const docs = documentCompleteness(store).rows
  const stock = stockReconciliation(store).rows
  const payments = paymentReconciliation(store).rows
  const tx = store.tradeOrders.length + store.lifts.length
  const critical = exceptions.filter(e => e.severity === 'Critical').length
  const missingDocs = docs.filter(r => r.status !== 'Complete').length
  const stockVar = stock.filter(r => r.status === 'Variance').length
  const payEx = payments.filter(r => r.status === 'Unallocated' || r.status === 'Overpayment' || r.status === 'Underpayment').length
  const openEx = exceptions.filter(e => e.status === 'Open' || e.status === 'Under Review').length
  const reconciled = Math.max(0, tx - openEx)
  const columns: ReportColumn[] = [
    { key: 'metric', header: 'Metric' },
    { key: 'value', header: 'Count' },
    { key: 'hrefCol', header: 'Open report' },
  ]
  const make = (id: string, metric: string, value: number, href: string): ReportRow => ({
    id,
    href,
    date: '',
    item: '',
    customer: '',
    supplier: '',
    broker: '',
    status: '',
    search: metric,
    metric,
    value: String(value),
    hrefCol: 'View',
  })
  return {
    columns,
    rows: [
      make('tx', 'Transactions reviewed', tx, '/reports/purchase-register'),
      make('rec', 'Reconciled', reconciled, '/reports/exceptions'),
      make('ex', 'Exceptions', exceptions.length, '/reports/exceptions'),
      make('crit', 'Critical exceptions', critical, '/reports/exceptions'),
      make('docs', 'Missing documents', missingDocs, '/reports/document-completeness'),
      make('stock', 'Stock variances', stockVar, '/reports/stock-reconciliation'),
      make('pay', 'Payment exceptions', payEx, '/reports/payment-reconciliation'),
    ],
  }
}

export function buildReport(id: ReportId, store: TradeStoreValue): BuiltReport {
  switch (id) {
    case 'purchase-register': return purchaseRegister(store)
    case 'sales-register': return salesRegister(store)
    case 'purchase-vs-invoice': return purchaseVsInvoice(store)
    case 'sales-vs-invoice': return salesVsInvoice(store)
    case 'contract-summary': return contractSummary(store)
    case 'stock-reconciliation': return stockReconciliation(store)
    case 'inventory-movement': return inventoryMovement(store)
    case 'lift-report': return liftReport(store)
    case 'lift-variance': return liftVariance(store)
    case 'delivery-report': return deliveryReport(store)
    case 'customer-outstanding': return outstandingRows(store, 'customer')
    case 'supplier-outstanding': return outstandingRows(store, 'supplier')
    case 'payment-reconciliation': return paymentReconciliation(store)
    case 'brokerage': return brokerageReport(store)
    case 'credit-debit-note': return creditDebitNotes(store)
    case 'trade-profitability': return tradeProfitability(store)
    case 'landed-cost': return landedCost(store)
    case 'document-completeness': return documentCompleteness(store)
    case 'rate-change': return rateChange(store)
    case 'exceptions': return exceptionReport(store)
    case 'audit-trail': return auditTrail(store)
    case 'audit-summary': return auditSummary(store)
  }
}
