import {
  CURRENT_TRADER,
  type DeliveryType,
  type Lift,
  type LiftTanker,
  type OrderStatus,
  type TradeOrder,
} from '../data/mockData'
import { formatTankerNo } from './liftTankers'
import { randomUUID } from './randomId'
import { STOCK_LIFT_LABEL } from './stockLift'
import { importRateFromSpreadsheet } from './orderRate'
import { parseIndianAmount } from './indianAmount'
import { refCore } from './tradeRefs'
import { normalizeDateToIso } from './utils'

export function parseJsonCell(value: unknown): unknown {
  if (value == null || value === '') return null
  const text = String(value).trim()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Spreadsheet contains invalid JSON in a _json cell')
  }
}

export function tryParseJsonCell(value: unknown): unknown | null {
  try {
    return parseJsonCell(value)
  } catch {
    return null
  }
}

export function str(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const val = row[key]
    if (val != null && String(val).trim() !== '') return String(val).trim()
  }
  return ''
}

export function parseNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const cleaned = String(value).replace(/[,\s₹]/g, '').trim()
  if (!cleaned) return undefined
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : undefined
}

function spreadsheetRateFields(row: Record<string, unknown>, base?: TradeOrder) {
  const raw = row.Rate
  const hasRate = raw != null && String(raw).trim() !== ''
  const rateValue = typeof raw === 'number' || typeof raw === 'string' ? raw : String(raw ?? '')
  const per10 = hasRate ? parseIndianAmount(rateValue) : (base?.ratePerBasis ?? 0)
  if (per10 > 0) {
    return {
      rate: importRateFromSpreadsheet(raw),
      rateBasis: 'PER 10 KG' as const,
      ratePerBasis: per10,
    }
  }
  return {
    rate: base?.rate ?? 0,
    rateBasis: base?.rateBasis,
    ratePerBasis: base?.ratePerBasis,
  }
}

export function parseDateValue(value: unknown): string {
  return normalizeDateToIso(value)
}

export function parseDateCell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== '') {
      return parseDateValue(row[key])
    }
  }
  return ''
}

export function parseBrokerage(value: string): { brokeragePct: number; brokeragePerTon?: number } {
  const text = value.trim()
  if (!text) return { brokeragePct: 0 }
  const perTon = text.match(/^([\d.]+)\s*\/?\s*MT$/i)
  if (perTon) return { brokeragePct: 0, brokeragePerTon: parseFloat(perTon[1]!) }
  const pct = text.match(/^([\d.]+)\s*%?$/)
  if (pct) return { brokeragePct: parseFloat(pct[1]!) }
  return { brokeragePct: 0 }
}

function firstRef(value: string): string {
  return refCore(value.split(',')[0]?.trim() ?? '')
}

function splitList(value: string): string[] {
  return value.split(',').map(part => part.trim()).filter(Boolean)
}

/** True when a remarks/invoice cell looks like a document number (not free text). */
export function looksLikeInvoiceNo(value: string): boolean {
  const text = value.trim()
  if (!text || text.length > 64) return false
  if (/^(fix\s*duty|advance|ready|period)$/i.test(text)) return false
  // e.g. WMY02434, PALMOIL/2627/001, 2026-2027/0149, 2026-27/04
  if (/^[A-Za-z]{2,}\d+/i.test(text)) return true
  if (/[A-Za-z].*\//.test(text) || /\d{4}[-/]\d{2,4}\/\d+/i.test(text)) return true
  if (/^\d{4}-\d{2}\/\d+/i.test(text)) return true
  return false
}

function tankerValueFromRow(row: Record<string, unknown>): string {
  return str(
    row,
    'Tanker No.,',
    'Tanker No.',
    'Tanker',
    'Lorry No.,',
    'Lorry No.',
    'Lorry',
    'Vehicle No.,',
    'Vehicle No.',
  )
}

function salesInvoiceFromRow(row: Record<string, unknown>): string {
  const explicit = str(row, 'Sales Invoice', 'Sales Invoice No.', 'Invoice No.,', 'Invoice No.', 'Invoice')
  if (explicit) return explicit
  const remarks = str(row, 'Remarks')
  return looksLikeInvoiceNo(remarks) ? remarks : ''
}

function deriveOrderStatus(orderQty: number, liftedQty: number, committedLiftQty?: number): OrderStatus {
  if (liftedQty >= orderQty && orderQty > 0) return 'completed'
  const committed = committedLiftQty ?? liftedQty
  if (committed > 0 || liftedQty > 0) return 'partial'
  return 'pending'
}

function isBlankDataRow(row: Record<string, unknown>, refKeys: string[]): boolean {
  if (tryParseJsonCell(row._json) != null) return false
  return refKeys.every(key => !str(row, key))
}

function newOrderId(): string {
  return randomUUID()
}

/** Ready vs Period from spreadsheet "Delivery Period" / "Delivery Others" columns. */
function parseDeliveryTypeFromImport(row: Record<string, unknown>): DeliveryType {
  const deliveryOthers = str(row, 'Delivery Others').toLowerCase()
  const deliveryPeriodCol = str(row, 'Delivery Period').toLowerCase()
  if (deliveryOthers === 'ready' || deliveryPeriodCol === 'ready') return 'ready'
  return 'period'
}

function buildPurchaseOrder(row: Record<string, unknown>, base?: TradeOrder): TradeOrder {
  const ref = firstRef(str(row, 'Purchase Ref#', 'Ref#', 'PO Ref#', 'PO Ref', 'PO')) || str(row, 'Purchase Ref#', 'Ref#', 'PO Ref#', 'PO Ref', 'PO')
  const deliveryFrom = parseDateCell(row, 'Delivery From', 'Delivery Start') || parseDateCell(row, 'Purchase Date', 'Date')
  const deliveryTo = parseDateCell(row, 'Delivery To', 'Delivery End') || deliveryFrom
  const { brokeragePct, brokeragePerTon } = parseBrokerage(str(row, 'Brokerage'))
  const orderQty = parseNumber(row.Qty ?? row['Order Qty']) ?? base?.orderQty ?? 0
  const liftedQty = base?.liftedQty ?? 0
  const sellerName = str(row, 'Seller Name', 'Party') || base?.sellerName || base?.partyName || ''

  return {
    id: base?.id ?? newOrderId(),
    ref,
    side: 'purchase',
    date: parseDateCell(row, 'Purchase Date', 'Date') || base?.date || new Date().toISOString().slice(0, 10),
    partyName: sellerName,
    itemName: str(row, 'Item Name', 'Item') || base?.itemName || '',
    spot: str(row, 'Spot') || base?.spot || '',
    deliveryType: parseDeliveryTypeFromImport(row),
    deliveryPeriodStart: deliveryFrom,
    deliveryPeriodEnd: deliveryTo,
    deliveryPeriodVerified: base?.deliveryPeriodVerified ?? false,
    ...spreadsheetRateFields(row, base),
    taxRate: parseNumber(row.Tax) ?? base?.taxRate ?? 0,
    orderQty,
    liftedQty,
    committedLiftQty: base?.committedLiftQty ?? 0,
    unit: base?.unit ?? 'MT',
    brokerName: str(row, 'Broker Name', 'Broker') || base?.brokerName || '',
    brokeragePct: base?.brokeragePct ?? brokeragePct,
    brokeragePerTon: brokeragePerTon ?? base?.brokeragePerTon,
    sellerName: sellerName || base?.sellerName,
    buyerName: base?.buyerName ?? CURRENT_TRADER,
    paymentTerms: str(row, 'Payment') || base?.paymentTerms,
    remarks: str(row, 'Remarks') || base?.remarks,
    status: base?.status ?? deriveOrderStatus(orderQty, liftedQty, base?.committedLiftQty),
    poRef: undefined,
    buyBacks: base?.buyBacks,
    completionType: base?.completionType,
    closedAt: base?.closedAt,
    closedNotes: base?.closedNotes,
    deleteScheduledAt: base?.deleteScheduledAt,
    brokerContractRef: base?.brokerContractRef,
    partyCompanyId: base?.partyCompanyId,
    sellerCompanyId: base?.sellerCompanyId,
    buyerCompanyId: base?.buyerCompanyId,
  }
}

function buildSalesOrder(row: Record<string, unknown>, base?: TradeOrder): TradeOrder {
  const ref = firstRef(str(row, 'Sale Ref#', 'Ref#', 'SO Ref#', 'SO Ref', 'SO')) || str(row, 'Sale Ref#', 'Ref#', 'SO Ref#', 'SO Ref', 'SO')
  const deliveryFrom = parseDateCell(row, 'Delivery From', 'Delivery Start') || parseDateCell(row, 'Sale Date', 'Date')
  const deliveryTo = parseDateCell(row, 'Delivery To', 'Delivery End') || deliveryFrom
  const { brokeragePct, brokeragePerTon } = parseBrokerage(str(row, 'Brokerage'))
  const orderQty = parseNumber(row.Qty ?? row['Order Qty']) ?? base?.orderQty ?? 0
  const liftedQty = base?.liftedQty ?? 0
  const buyerName = str(row, 'Buyer', 'Party') || base?.buyerName || base?.partyName || ''
  const linkedPo = str(row, 'PO Ref#', 'PO Ref', 'PO', 'Against PO', 'Linked PO', 'Purchase Order Ref')

  return {
    id: base?.id ?? newOrderId(),
    ref,
    side: 'sale',
    poRef: base?.poRef ?? (linkedPo ? firstRef(linkedPo) || undefined : undefined),
    date: parseDateCell(row, 'Sale Date', 'Date') || base?.date || new Date().toISOString().slice(0, 10),
    partyName: buyerName,
    itemName: str(row, 'Item', 'Item Name') || base?.itemName || '',
    spot: str(row, 'Spot') || base?.spot || '',
    deliveryType: parseDeliveryTypeFromImport(row),
    deliveryPeriodStart: deliveryFrom,
    deliveryPeriodEnd: deliveryTo,
    deliveryPeriodVerified: base?.deliveryPeriodVerified ?? false,
    ...spreadsheetRateFields(row, base),
    taxRate: parseNumber(row.Tax) ?? base?.taxRate ?? 0,
    orderQty,
    liftedQty,
    committedLiftQty: base?.committedLiftQty ?? 0,
    unit: base?.unit ?? 'MT',
    brokerName: str(row, 'Broker', 'Broker Name') || base?.brokerName || '',
    brokeragePct: base?.brokeragePct ?? brokeragePct,
    brokeragePerTon: brokeragePerTon ?? base?.brokeragePerTon,
    sellerName: base?.sellerName ?? CURRENT_TRADER,
    buyerName: buyerName || base?.buyerName,
    paymentTerms: str(row, 'Payment') || base?.paymentTerms,
    remarks: str(row, 'Remarks') || base?.remarks,
    status: base?.status ?? deriveOrderStatus(orderQty, liftedQty, base?.committedLiftQty),
    buyBacks: base?.buyBacks,
    completionType: base?.completionType,
    closedAt: base?.closedAt,
    closedNotes: base?.closedNotes,
    deleteScheduledAt: base?.deleteScheduledAt,
    brokerContractRef: base?.brokerContractRef,
    partyCompanyId: base?.partyCompanyId,
    sellerCompanyId: base?.sellerCompanyId,
    buyerCompanyId: base?.buyerCompanyId,
  }
}

export function parsePurchaseOrderRow(row: Record<string, unknown>): TradeOrder | null {
  if (isBlankDataRow(row, ['Purchase Ref#', 'Ref#', 'PO Ref#', 'PO Ref', 'PO'])) return null
  const json = tryParseJsonCell(row._json)
  if (json) return json as TradeOrder
  const order = buildPurchaseOrder(row)
  if (!order.ref) return null
  return order
}

export function parseSalesOrderRow(row: Record<string, unknown>): TradeOrder | null {
  if (isBlankDataRow(row, ['Sale Ref#', 'Ref#', 'SO Ref#', 'SO Ref', 'SO'])) return null
  const json = tryParseJsonCell(row._json)
  if (json) return json as TradeOrder
  const order = buildSalesOrder(row)
  if (!order.ref) return null
  return order
}

export function parseLegacyTradeOrderRow(row: Record<string, unknown>): TradeOrder | null {
  if (isBlankDataRow(row, ['Ref#', 'Purchase Ref#', 'Sale Ref#'])) return null
  const json = tryParseJsonCell(row._json)
  if (json) return json as TradeOrder

  const ref = str(row, 'Ref#', 'Purchase Ref#', 'Sale Ref#')
  if (!ref) return null

  const sideRaw = str(row, 'Side').toLowerCase()
  const side = sideRaw === 'sale' || ref.startsWith('SO')
    ? 'sale'
    : 'purchase'

  return side === 'sale' ? buildSalesOrder(row) : buildPurchaseOrder(row)
}

function buildTankersFromImport(tankerValue: string, liftedQty: number): LiftTanker[] {
  const tankerNos = splitList(tankerValue).map(formatTankerNo).filter(Boolean)
  if (tankerNos.length === 0) return []
  if (tankerNos.length === 1) {
    return [{
      tankerNo: tankerNos[0]!,
      transportName: '',
      driverMobile: '',
      lrNo: '',
      actualQtyMt: liftedQty > 0 ? liftedQty : undefined,
    }]
  }
  return tankerNos.map(tankerNo => ({
    tankerNo,
    transportName: '',
    driverMobile: '',
    lrNo: '',
  }))
}

function buildLift(row: Record<string, unknown>, base?: Lift): Lift {
  const liftRef = parseNumber(row['Lift Ref#'] ?? row['Lift #']) ?? base?.liftRef
  const liftedQty = parseNumber(row['Lifted Qty'] ?? row.Qty) ?? base?.liftedQty ?? 0
  const plannedQty = parseNumber(row['SO Qty'] ?? row['Sale Qty']) ?? base?.plannedQtyMt ?? liftedQty
  const poRef = firstRef(str(row, 'PO Ref#', 'PO Ref')) || base?.poRef || ''
  const soRaw = str(row, 'SO Ref#', 'SO Ref')
  const stockLift = !soRaw || soRaw.includes(STOCK_LIFT_LABEL)
  const soRef = stockLift ? '' : firstRef(soRaw)
  const tankerValue = tankerValueFromRow(row)
  const tankers = buildTankersFromImport(tankerValue, liftedQty)
  const legacyStatus = str(row, 'Status').toLowerCase()
  const deliveredAt = parseDateCell(row, 'Delivered') || base?.deliveredAt
  const salesInvoiceNo = salesInvoiceFromRow(row) || base?.salesInvoiceNo || ''
  const remarksRaw = str(row, 'Remarks')
  const remarks =
    remarksRaw && looksLikeInvoiceNo(remarksRaw) && salesInvoiceNo === remarksRaw
      ? (base?.remarks ?? '')
      : (remarksRaw || base?.remarks || '')
  const status = legacyStatus === 'delivered' || legacyStatus === 'pending'
    ? legacyStatus as Lift['status']
    : (deliveredAt || (liftedQty > 0 && salesInvoiceNo) || liftedQty > 0)
      ? 'delivered'
      : 'pending'

  return {
    id: base?.id ?? newOrderId(),
    liftRef: liftRef ?? 0,
    poRef,
    soRef: soRef || base?.soRef || '',
    allocations: base?.allocations,
    date: parseDateCell(row, 'Lift Date', 'Date') || base?.date || new Date().toISOString().slice(0, 10),
    status,
    deliveredAt: status === 'delivered' ? (deliveredAt || base?.deliveredAt || (liftedQty > 0 ? parseDateCell(row, 'Lift Date', 'Date') : undefined)) : base?.deliveredAt,
    buyerName: str(row, 'Buyer') || base?.buyerName || '',
    sellerName: str(row, 'Seller') || base?.sellerName || '',
    itemName: str(row, 'Item') || base?.itemName || '',
    deliveryPeriod: str(row, 'Delivery Period') || base?.deliveryPeriod || '',
    deliveryPeriodStart: base?.deliveryPeriodStart ?? '',
    deliveryPeriodEnd: base?.deliveryPeriodEnd ?? '',
    deliveryPeriodVerified: base?.deliveryPeriodVerified ?? false,
    rate: importRateFromSpreadsheet(row.Rate) || base?.rate || 0,
    liftedQty,
    plannedQtyMt: plannedQty,
    balanceQtyMt: base?.balanceQtyMt,
    balanceAppliedQtyMt: base?.balanceAppliedQtyMt,
    tankerNo: tankers[0]?.tankerNo ?? formatTankerNo(tankerValue) ?? base?.tankerNo ?? '',
    tankers: tankers.length > 0 ? tankers : base?.tankers ?? [],
    salesInvoiceNo: salesInvoiceNo || undefined,
    isSelfLift: base?.isSelfLift ?? true,
    stockLift: stockLift || base?.stockLift,
    remarks: remarks || undefined,
  }
}

export function parseLiftRow(row: Record<string, unknown>): Lift | null {
  if (isBlankDataRow(row, ['Lift Ref#', 'Lift #'])) return null
  const json = tryParseJsonCell(row._json)
  if (json) return json as Lift
  const lift = buildLift(row)
  if (!lift.liftRef) return null
  return lift
}

function dedupeOrders(orders: TradeOrder[]): TradeOrder[] {
  const byKey = new Map<string, TradeOrder>()
  for (const order of orders) {
    byKey.set(`${order.side}:${order.ref}`, order)
  }
  return [...byKey.values()]
}

function dedupeLifts(lifts: Lift[]): Lift[] {
  const byRef = new Map<number, Lift>()
  for (const lift of lifts) {
    byRef.set(lift.liftRef, lift)
  }
  return [...byRef.values()].sort((a, b) => a.liftRef - b.liftRef)
}

export function readTradeOrdersFromSheetRows(sheetRows: Map<string, Record<string, unknown>[]>): TradeOrder[] {
  const orders: TradeOrder[] = []

  const legacyRows = sheetRows.get('tradeOrders')
  if (legacyRows?.length) {
    for (const row of legacyRows) {
      const order = parseLegacyTradeOrderRow(row)
      if (order) orders.push(order)
    }
  }

  const purchaseRows = sheetRows.get('purchaseOrders')
  if (purchaseRows?.length) {
    for (const row of purchaseRows) {
      if (Array.isArray(row._cells)) continue
      const order = parsePurchaseOrderRow(row)
      if (order) orders.push(order)
    }
  }

  const salesRows = sheetRows.get('salesOrders')
  if (salesRows?.length) {
    for (const row of salesRows) {
      const order = parseSalesOrderRow(row)
      if (order) orders.push(order)
    }
  }

  return dedupeOrders(orders)
}

export function readLiftsFromSheetRows(rows: Record<string, unknown>[]): Lift[] {
  const lifts: Lift[] = []
  for (const row of rows) {
    const lift = parseLiftRow(row)
    if (lift) lifts.push(lift)
  }
  return dedupeLifts(lifts)
}

export function sheetHasStandardPoHeaders(rows: Record<string, unknown>[]): boolean {
  if (rows.length === 0) return false
  const headers = new Set(Object.keys(rows[0] ?? {}).map(key => key.toLowerCase()))
  return headers.has('purchase ref#')
    && (headers.has('seller name') || headers.has('qty') || headers.has('item name'))
}

function hasPoRef(row: Record<string, unknown>): boolean {
  return Boolean(str(row, 'Purchase Ref#', 'Ref#', 'PO Ref#', 'PO Ref', 'PO'))
}

function hasInvoiceContinuation(row: Record<string, unknown>): boolean {
  if (hasPoRef(row)) return false
  return Boolean(
    str(row, 'Invoice No.,', 'Invoice No.', 'Invoice')
    || tankerValueFromRow(row)
    || parseNumber(row['Actual Qty']) != null,
  )
}

function nextLiftRefFromRow(_row: Record<string, unknown>, fallback: number): number {
  return fallback
}

function buildLiftFromPoInvoiceRow(
  row: Record<string, unknown>,
  po: TradeOrder,
  liftRef: number,
): Lift | null {
  const invoiceNo = str(row, 'Invoice No.,', 'Invoice No.', 'Invoice')
  const tankerRaw = tankerValueFromRow(row)
  const liftedQty = parseNumber(row['Actual Qty'] ?? row['Lifted Qty']) ?? 0
  const date = parseDateCell(row, 'Invoice Date', 'Lift Date') || po.date
  if (!invoiceNo && !tankerRaw && liftedQty <= 0) return null

  const tankers = buildTankersFromImport(tankerRaw, liftedQty)

  return {
    id: newOrderId(),
    liftRef,
    poRef: po.ref,
    soRef: '',
    date,
    status: 'delivered',
    deliveredAt: date,
    buyerName: CURRENT_TRADER,
    sellerName: po.sellerName ?? po.partyName,
    itemName: po.itemName,
    deliveryPeriod: '',
    deliveryPeriodStart: po.deliveryPeriodStart ?? '',
    deliveryPeriodEnd: po.deliveryPeriodEnd ?? '',
    deliveryPeriodVerified: po.deliveryPeriodVerified ?? false,
    rate: po.rate,
    liftedQty,
    plannedQtyMt: liftedQty,
    tankerNo: tankers[0]?.tankerNo ?? formatTankerNo(tankerRaw),
    tankers,
    salesInvoiceNo: invoiceNo || undefined,
    isSelfLift: true,
  }
}

export function parseTemplatePurchaseOrders(rows: Record<string, unknown>[]): { orders: TradeOrder[]; lifts: Lift[] } {
  const orders: TradeOrder[] = []
  const lifts: Lift[] = []
  let currentPo: TradeOrder | null = null
  let nextLiftRef = 1

  for (const row of rows) {
    if (Array.isArray(row._cells)) continue

    if (hasPoRef(row)) {
      const order = parsePurchaseOrderRow(row)
      if (order) {
        orders.push(order)
        currentPo = order

        const liftRef = nextLiftRefFromRow(row, nextLiftRef)
        const lift = buildLiftFromPoInvoiceRow(row, order, liftRef)
        if (lift) {
          lifts.push(lift)
          nextLiftRef = Math.max(nextLiftRef, liftRef + 1)
        }
      }
      continue
    }

    if (currentPo && hasInvoiceContinuation(row)) {
      const liftRef = nextLiftRefFromRow(row, nextLiftRef)
      const lift = buildLiftFromPoInvoiceRow(row, currentPo, liftRef)
      if (lift) {
        lifts.push(lift)
        nextLiftRef = Math.max(nextLiftRef, liftRef + 1)
      }
    }
  }

  return { orders: dedupeOrders(orders), lifts: dedupeLifts(lifts) }
}
