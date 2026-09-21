import type { TradeData, TradeCounters } from '../api/tradeApi'
import type {
  Activity,
  Broker,
  Company,
  Contract,
  Delivery,
  Lift,
  Lot,
  Payment,
  Producer,
  Retailer,
  TradeOrder,
  BalanceSettlement,
} from '../data/mockData'
import { BACKUP_VERSION, parseTradeBackup, type TradeBackup } from './tradeBackupCore'
import { downloadFile } from './export'
import {
  allocationTotal,
  getLiftAllocations,
  liftTouchesRef,
  uniqueLiftRefs,
} from './liftAllocations'
import { formatTankerNo, getLiftTankers } from './liftTankers'
import { STOCK_LIFT_LABEL } from './stockLift'
import { refCore } from './tradeRefs'
import {
  parseJsonCell,
  parseSalesOrderRow,
  parseTemplatePurchaseOrders,
  readLiftsFromSheetRows,
  readTradeOrdersFromSheetRows,
  sheetHasStandardPoHeaders,
} from './spreadsheetImport'
import { isGroupedPoRawRows, tryParseGroupedPoRawRows } from './groupedPoImport'
import { buildSeedData } from '../data/seedData'
import { ensureOrdersReferencedByLifts, inferSoPoRefsFromLifts, normalizeLiftOrderRefs } from './inferImportLinks'
import { ensureDirectoryFromOrders } from './ensureDirectoryFromOrders'
import { normalizeDateToIso, excelFormatPrefersMonthFirst } from './utils'

const PO_EXPORT_HEADERS = [
  'Purchase Ref#',
  'Purchase Date',
  'Seller Name',
  'Broker Name',
  'Item Name',
  'Rate',
  'Tax',
  'Qty',
  'Delivery Period',
  'Delivery From',
  'Delivery To',
  'Delivery Others',
  'Brokerage',
  'Payment',
  'Remarks',
  'Spot',
  'Invoice No.,',
  'Invoice Date',
  'Invoice Amount',
  'Tanker No.,',
  'Actual Qty',
  '_json',
] as const

const SO_EXPORT_HEADERS = [
  'Sale Ref#',
  'Sale Date',
  'PO Ref#',
  'Broker',
  'Buyer',
  'Item',
  'Rate',
  'Tax',
  'Qty',
  'Delivery Period',
  'Delivery From',
  'Delivery To',
  'Delivery Others',
  'Brokerage',
  'Payment',
  'Remarks',
  'Spot',
  '_json',
] as const

const LIFT_EXPORT_HEADERS = [
  'Lift Ref#',
  'Lift Date',
  'Item',
  'Seller',
  'Buyer',
  'Broker',
  'Delivery Period',
  'Rate',
  'Tax Rate',
  'SO Qty',
  'Lifted Qty',
  'Tanker No.,',
  'PO Ref#',
  'SO Ref#',
  'Sales Invoice',
  'Remarks',
  '_json',
] as const

const OBJECT_SHEETS = [
  'lifts',
  'contracts',
  'lots',
  'payments',
  'deliveries',
  'brokers',
  'producers',
  'retailers',
  'companies',
  'activities',
  'balanceSettlements',
] as const satisfies readonly (keyof TradeData)[]

type ObjectSheet = (typeof OBJECT_SHEETS)[number]

const EMPTY_COUNTERS: TradeCounters = { po: 0, so: 0, lift: 0, invoice: 0 }

function backupFilename(ext: string) {
  return `tradeal-backup-${new Date().toISOString().slice(0, 10)}.${ext}`
}

function isoDate(value?: string) {
  return value?.slice(0, 10) ?? ''
}

function withJson<T extends Record<string, unknown>>(row: T, record: unknown): T & { _json: string } {
  return { ...row, _json: JSON.stringify(record) }
}

function formatBrokerageExport(order: TradeOrder): string {
  if (order.brokeragePerTon != null && order.brokeragePerTon > 0) {
    return `${order.brokeragePerTon}/MT`
  }
  if (order.brokeragePct > 0) return `${order.brokeragePct}%`
  return ''
}

function deliveryOthers(order: TradeOrder): string {
  return order.deliveryType === 'ready' ? 'Ready' : ''
}

function deliveryPeriodLabel(order: Pick<TradeOrder, 'deliveryType' | 'deliveryPeriodStart' | 'deliveryPeriodEnd'>): string {
  if (order.deliveryType === 'ready') return 'Ready'
  const start = isoDate(order.deliveryPeriodStart)
  const end = isoDate(order.deliveryPeriodEnd)
  if (start || end) return [start, end].filter(Boolean).join(' – ')
  return 'Period'
}

function liftDeliveryPeriodLabel(lift: Pick<Lift, 'deliveryPeriod' | 'deliveryPeriodStart' | 'deliveryPeriodEnd'>): string {
  const p = lift.deliveryPeriod.trim().toLowerCase()
  if (p === 'ready') return 'Ready'
  const start = isoDate(lift.deliveryPeriodStart)
  const end = isoDate(lift.deliveryPeriodEnd)
  if (start || end) return [start, end].filter(Boolean).join(' – ')
  if (p && p !== 'period') return lift.deliveryPeriod.trim()
  return 'Period'
}

function poDeliveryFields(order: TradeOrder, lifts: Lift[]) {
  const related = lifts.filter(l => l.status === 'delivered' && liftTouchesRef(l, order.ref))
  const invoiceNos = [...new Set(related.map(l => l.salesInvoiceNo).filter(Boolean) as string[])]
  const invoiceDates = [...new Set(related.map(l => isoDate(l.deliveredAt)).filter(Boolean))]
  const tankerNos = [...new Set(
    related.flatMap(l => getLiftTankers(l).map(t => t.tankerNo.trim()).filter(Boolean)),
  )]
  const invoiceAmount = related.reduce((sum, lift) => {
    const qtyOnPo = getLiftAllocations(lift)
      .filter(a => a.poRef === order.ref)
      .reduce((s, a) => s + a.qtyMt, 0)
    return sum + qtyOnPo * lift.rate
  }, 0)

  return {
    'Invoice No.,': invoiceNos.join(', '),
    'Invoice Date': invoiceDates.join(', '),
    'Invoice Amount': invoiceAmount > 0 ? invoiceAmount : '',
    'Tanker No.,': tankerNos.join(', '),
    'Actual Qty': order.liftedQty > 0 ? order.liftedQty : '',
  }
}

function purchaseOrderRow(order: TradeOrder, lifts: Lift[]) {
  const delivery = poDeliveryFields(order, lifts)
  return {
    'Purchase Ref#': order.ref,
    'Purchase Date': isoDate(order.date),
    'Seller Name': order.sellerName || order.partyName,
    'Broker Name': order.brokerName,
    'Item Name': order.itemName,
    Rate: order.rate,
    Tax: order.taxRate,
    Qty: order.orderQty,
    'Delivery Period': deliveryPeriodLabel(order),
    'Delivery From': isoDate(order.deliveryPeriodStart),
    'Delivery To': isoDate(order.deliveryPeriodEnd),
    'Delivery Others': deliveryOthers(order),
    Brokerage: formatBrokerageExport(order),
    Payment: order.paymentTerms ?? '',
    Remarks: order.remarks ?? '',
    Spot: order.spot,
    ...delivery,
    _json: JSON.stringify(order),
  }
}

function salesOrderRow(order: TradeOrder) {
  return {
    'Sale Ref#': order.ref,
    'Sale Date': isoDate(order.date),
    'PO Ref#': order.poRef ?? '',
    Broker: order.brokerName,
    Buyer: order.buyerName || order.partyName,
    Item: order.itemName,
    Rate: order.rate,
    Tax: order.taxRate,
    Qty: order.orderQty,
    'Delivery Period': deliveryPeriodLabel(order),
    'Delivery From': isoDate(order.deliveryPeriodStart),
    'Delivery To': isoDate(order.deliveryPeriodEnd),
    'Delivery Others': deliveryOthers(order),
    Brokerage: formatBrokerageExport(order),
    Payment: order.paymentTerms ?? '',
    Remarks: order.remarks ?? '',
    Spot: order.spot,
    _json: JSON.stringify(order),
  }
}

function liftExportRow(lift: Lift, orders: TradeOrder[]) {
  const po = orders.find(o => o.ref === lift.poRef && o.side === 'purchase')
  const so = orders.find(o => o.ref === lift.soRef && o.side === 'sale')
  const allocations = getLiftAllocations(lift)
  const tankerNos = getLiftTankers(lift).map(t => t.tankerNo.trim()).filter(Boolean)
  const poRefs = uniqueLiftRefs(lift, 'poRef')
  const soRefs = uniqueLiftRefs(lift, 'soRef')

  return {
    'Lift Ref#': lift.liftRef,
    'Lift Date': isoDate(lift.date),
    Item: lift.itemName,
    Seller: lift.sellerName,
    Buyer: lift.buyerName,
    Broker: po?.brokerName ?? so?.brokerName ?? '',
    'Delivery Period': liftDeliveryPeriodLabel(lift),
    Rate: lift.rate,
    'Tax Rate': so?.taxRate ?? po?.taxRate ?? '',
    'SO Qty': lift.plannedQtyMt ?? allocationTotal(allocations),
    'Lifted Qty': lift.liftedQty,
    'Tanker No.,': tankerNos.join(', '),
    // Raw cores so re-import matches order.ref (not "PO6" / "SO3")
    'PO Ref#': poRefs.join(', '),
    'SO Ref#': lift.stockLift || soRefs.length === 0 ? STOCK_LIFT_LABEL : soRefs.join(', '),
    'Sales Invoice': lift.salesInvoiceNo ?? '',
    Remarks: lift.remarks ?? '',
    _json: JSON.stringify(lift),
  }
}

function sheetFromHeaders(headers: readonly string[], rows: Record<string, unknown>[]) {
  return {
    headers,
    rows: rows.map(row => Object.fromEntries(headers.map(key => [key, row[key] ?? '']))),
  }
}

function rowsToAoA(headers: readonly string[], rows: Record<string, unknown>[]) {
  return [headers as unknown as string[], ...rows.map(row => headers.map(key => row[key] ?? ''))]
}

function lotRow(lot: Lot) {
  return withJson({
    'Lot #': lot.lotNumber,
    Commodity: lot.commodity,
    Seller: lot.producer,
    Broker: lot.broker,
    'PO Qty': lot.quantityPurchased,
    Remaining: lot.remaining,
    Allocated: lot.allocated,
    Available: lot.available,
    'Purchase Date': isoDate(lot.purchaseDate),
  }, lot)
}

function brokerRow(broker: Broker) {
  return withJson({
    Name: broker.name,
    Email: broker.email,
    Phone: broker.phone,
    Contracts: broker.contracts,
    'Commission Earned': broker.commissionEarned,
  }, broker)
}

function producerRow(producer: Producer) {
  return withJson({
    'Code No': producer.code ?? '',
    Name: producer.name,
    Address: producer.address ?? '',
    City: producer.city || producer.location || '',
    'Contact Person': producer.contactPerson ?? '',
    Phone: producer.phone ?? '',
    WhatsApp: producer.whatsapp ?? '',
    Email: producer.email ?? '',
    'TAN No': producer.tan || producer.tin || '',
    'FSSAI No': producer.fssai ?? '',
    'Bank Name': producer.bankName ?? '',
    'Bank A/C': producer.bankAccount ?? '',
    'IFSC / RTGS': producer.ifsc ?? '',
    PAN: producer.pan ?? '',
    Aadhaar: producer.aadhar ?? '',
    'GST No': producer.gst ?? '',
    Products: Array.isArray(producer.products) ? producer.products.join('; ') : String(producer.products ?? ''),
  }, producer)
}

function retailerRow(retailer: Retailer) {
  return withJson({
    'Code No': retailer.code ?? '',
    Name: retailer.name,
    Address: retailer.address ?? '',
    City: retailer.city || retailer.location || '',
    'Contact Person': retailer.contactPerson ?? '',
    Phone: retailer.phone ?? '',
    WhatsApp: retailer.whatsapp ?? '',
    Email: retailer.email ?? '',
    'TAN No': retailer.tan || retailer.tin || '',
    'FSSAI No': retailer.fssai ?? '',
    'Bank Name': retailer.bankName ?? '',
    'Bank A/C': retailer.bankAccount ?? '',
    'IFSC / RTGS': retailer.ifsc ?? '',
    PAN: retailer.pan ?? '',
    Aadhaar: retailer.aadhar ?? '',
    'GST No': retailer.gst ?? '',
    Products: Array.isArray(retailer.products) ? retailer.products.join('; ') : String(retailer.products ?? ''),
  }, retailer)
}

function companyRow(company: Company) {
  return withJson({
    Name: company.officialName,
    Types: company.types.join(', '),
    GST: company.gst ?? '',
    Location: company.location ?? '',
    Aliases: company.aliases.join('; '),
  }, company)
}

function contractRow(contract: Contract) {
  return withJson({
    Ref: contract.ref,
    Status: contract.status,
    Buyer: contract.buyer,
    Seller: contract.seller,
    Commodity: contract.commodity,
    Qty: contract.quantity,
    Rate: contract.rate,
    Value: contract.value,
    Broker: contract.broker,
    'Delivery Date': isoDate(contract.deliveryDate),
  }, contract)
}

function paymentRow(payment: Payment) {
  return withJson({
    'Contract Ref': payment.contractRef,
    Party: payment.party,
    Type: payment.type,
    Amount: payment.amount,
    Status: payment.status,
    'Due Date': isoDate(payment.dueDate),
    'Paid Date': isoDate(payment.paidDate),
  }, payment)
}

function deliveryRow(delivery: Delivery) {
  return withJson({
    'Contract Ref': delivery.contractRef,
    Commodity: delivery.commodity,
    Qty: delivery.quantity,
    Status: delivery.status,
    Scheduled: isoDate(delivery.scheduledDate),
    Delivered: isoDate(delivery.deliveredDate),
    From: delivery.from,
    To: delivery.to,
  }, delivery)
}

function activityRow(activity: Activity) {
  return withJson({
    Type: activity.type,
    Title: activity.title,
    Timestamp: activity.timestamp,
    Ref: activity.entityRef ?? '',
  }, activity)
}

function settlementRow(settlement: BalanceSettlement) {
  return withJson({
    PO: settlement.poRef,
    SO: settlement.soRef,
    QtyMT: settlement.qtyMt,
    Method: settlement.method,
    SettledAt: isoDate(settlement.settledAt),
  }, settlement)
}

const ROW_BUILDERS: Record<Exclude<ObjectSheet, 'lifts'>, (record: never) => Record<string, unknown>> = {
  lots: lotRow as (record: never) => Record<string, unknown>,
  brokers: brokerRow as (record: never) => Record<string, unknown>,
  producers: producerRow as (record: never) => Record<string, unknown>,
  retailers: retailerRow as (record: never) => Record<string, unknown>,
  companies: companyRow as (record: never) => Record<string, unknown>,
  contracts: contractRow as (record: never) => Record<string, unknown>,
  payments: paymentRow as (record: never) => Record<string, unknown>,
  deliveries: deliveryRow as (record: never) => Record<string, unknown>,
  activities: activityRow as (record: never) => Record<string, unknown>,
  balanceSettlements: settlementRow as (record: never) => Record<string, unknown>,
}

function recordsToDisplayRows(key: Exclude<ObjectSheet, 'lifts'>, records: unknown[]) {
  const build = ROW_BUILDERS[key]
  return records.map(record => build(record as never))
}

function inferCountersFromData(data: TradeData): TradeCounters {
  const maxOrderRef = (orders: TradeOrder[]) =>
    orders.reduce((max, order) => {
      const match = order.ref.match(/(\d+)\s*$/)
      const n = match ? parseInt(match[1]!, 10) : 0
      return Number.isFinite(n) ? Math.max(max, n) : max
    }, 0)

  return {
    po: maxOrderRef(data.tradeOrders.filter(o => o.side === 'purchase')),
    so: maxOrderRef(data.tradeOrders.filter(o => o.side === 'sale')),
    lift: data.lifts.reduce((max, lift) => Math.max(max, lift.liftRef), 0),
    invoice: data.counters.invoice ?? 0,
  }
}

function rowsToRecords<T>(rows: Record<string, unknown>[]): T[] {
  const records: T[] = []
  for (const row of rows) {
    const parsed = parseJsonCell(row._json)
    if (parsed != null) records.push(parsed as T)
  }
  return records
}

function emptyTradeData(): TradeData {
  return {
    tradeOrders: [],
    lifts: [],
    contracts: [],
    lots: [],
    payments: [],
    deliveries: [],
    brokers: [],
    producers: [],
    retailers: [],
    companies: [],
    activities: [],
    balanceSettlements: [],
    spots: [],
    items: [],
    counters: { ...EMPTY_COUNTERS },
  }
}

function tankerMatchKey(poRef: string, tankerNo: string): string {
  const tanker = formatTankerNo(tankerNo).replace(/[-\s]/g, '').toUpperCase()
  return `${refCore(poRef)}|${tanker}`
}

/** Merge seller invoice / tanker details from PO register lines onto Lift Register rows. */
function enrichLiftsFromPoInvoiceLifts(lifts: Lift[], poInvoiceLifts: Lift[]): Lift[] {
  if (lifts.length === 0 || poInvoiceLifts.length === 0) return lifts

  const byPoTanker = new Map<string, Lift>()
  for (const lift of poInvoiceLifts) {
    const tanker = lift.tankerNo || lift.tankers?.[0]?.tankerNo || ''
    if (!lift.poRef || !tanker) continue
    byPoTanker.set(tankerMatchKey(lift.poRef, tanker), lift)
  }

  return lifts.map(lift => {
    const tanker = lift.tankerNo || lift.tankers?.[0]?.tankerNo || ''
    if (!lift.poRef || !tanker) return lift
    const fromPo = byPoTanker.get(tankerMatchKey(lift.poRef, tanker))
    if (!fromPo) return lift

    const salesInvoiceNo = lift.salesInvoiceNo || fromPo.salesInvoiceNo
    let remarks = lift.remarks
    if (
      fromPo.salesInvoiceNo
      && salesInvoiceNo
      && fromPo.salesInvoiceNo !== salesInvoiceNo
      && !remarks
    ) {
      remarks = `Seller invoice: ${fromPo.salesInvoiceNo}`
    }

    return {
      ...lift,
      salesInvoiceNo: salesInvoiceNo || undefined,
      remarks: remarks || undefined,
      tankerNo: lift.tankerNo || fromPo.tankerNo,
      tankers: lift.tankers?.length ? lift.tankers : fromPo.tankers,
      deliveredAt: lift.deliveredAt || fromPo.deliveredAt,
      status: lift.status === 'pending' && fromPo.status === 'delivered' ? 'delivered' : lift.status,
    }
  })
}

function buildDataFromSheetRows(sheetRows: Map<string, Record<string, unknown>[]>): TradeData {
  const data = emptyTradeData()

  const purchaseRows = sheetRows.get('purchaseOrders')
  const standardPoRows = purchaseRows?.filter(row => !Array.isArray(row._cells)) ?? []
  const isStandardTemplate = standardPoRows.length > 0 && sheetHasStandardPoHeaders(standardPoRows)

  let embeddedLifts = false
  let poInvoiceLifts: Lift[] = []
  let groupedPo = parseGroupedPoFromSheets(sheetRows)
  const parsedPoFromTemplate = isStandardTemplate || groupedPo != null

  if (isStandardTemplate) {
    const template = parseTemplatePurchaseOrders(standardPoRows)
    data.tradeOrders = template.orders
    poInvoiceLifts = template.lifts
    data.lifts = template.lifts
    embeddedLifts = true
    groupedPo = null
  } else if (groupedPo) {
    data.tradeOrders = groupedPo.orders
    poInvoiceLifts = groupedPo.lifts
    data.lifts = groupedPo.lifts
    embeddedLifts = true
  } else {
    data.tradeOrders = readTradeOrdersFromSheetRows(sheetRows)
  }

  if (parsedPoFromTemplate) {
    const salesRows = sheetRows.get('salesOrders')?.filter(row => !Array.isArray(row._cells)) ?? []
    for (const row of salesRows) {
      const order = parseSalesOrderRow(row)
      if (order) data.tradeOrders.push(order)
    }
    const byKey = new Map<string, TradeOrder>()
    for (const order of data.tradeOrders) {
      byKey.set(`${order.side}:${order.ref}`, order)
    }
    data.tradeOrders = [...byKey.values()]
  }

  for (const key of OBJECT_SHEETS) {
    const rows = sheetRows.get(key)
    if (!rows?.length) continue
    if (key === 'lifts') {
      const parsed = readLiftsFromSheetRows(rows)
      if (parsed.length > 0) {
        data.lifts = enrichLiftsFromPoInvoiceLifts(parsed, poInvoiceLifts)
      } else if (!embeddedLifts) {
        data.lifts = parsed
      }
      continue
    }
    const records = rowsToRecords(rows)
    switch (key) {
      case 'contracts': data.contracts = records as TradeData['contracts']; break
      case 'lots': data.lots = records as TradeData['lots']; break
      case 'payments': data.payments = records as TradeData['payments']; break
      case 'deliveries': data.deliveries = records as TradeData['deliveries']; break
      case 'brokers': data.brokers = records as TradeData['brokers']; break
      case 'producers': data.producers = records as TradeData['producers']; break
      case 'retailers': data.retailers = records as TradeData['retailers']; break
      case 'companies': data.companies = records as TradeData['companies']; break
      case 'activities': data.activities = records as TradeData['activities']; break
      case 'balanceSettlements': data.balanceSettlements = records as TradeData['balanceSettlements']; break
    }
  }

  const spotRows = sheetRows.get('spots')
  if (spotRows?.length) {
    data.spots = rowsToRecords<string>(spotRows)
  }

  const itemRows = sheetRows.get('items')
  if (itemRows?.length) {
    data.items = rowsToRecords<string>(itemRows)
  }

  const counterRows = sheetRows.get('counters')
  if (counterRows?.length) {
    const parsed = parseJsonCell(counterRows[0]!._json)
    if (parsed && typeof parsed === 'object') {
      data.counters = { ...EMPTY_COUNTERS, ...(parsed as TradeCounters) }
    }
  } else if (data.tradeOrders.length > 0 || data.lifts.length > 0) {
    data.counters = inferCountersFromData(data)
  }

  data.tradeOrders = ensureOrdersReferencedByLifts(data.tradeOrders, data.lifts)
  data.lifts = normalizeLiftOrderRefs(data.tradeOrders, data.lifts)
  data.tradeOrders = inferSoPoRefsFromLifts(data.tradeOrders, data.lifts)
  return ensureDirectoryFromOrders(data)
}

async function loadXlsx() {
  return import('xlsx')
}

const SHEET_KEY_ALIASES: Record<string, string> = {
  purchaseorders: 'purchaseOrders',
  po: 'purchaseOrders',
  pos: 'purchaseOrders',
  purchase: 'purchaseOrders',
  purchaseorder: 'purchaseOrders',
  salesorders: 'salesOrders',
  so: 'salesOrders',
  sos: 'salesOrders',
  sale: 'salesOrders',
  sales: 'salesOrders',
  salesorder: 'salesOrders',
  lifts: 'lifts',
  lift: 'lifts',
}

function normalizeSheetKey(name: string): string {
  const compact = name.trim().toLowerCase().replace(/[\s_-]+/g, '')
  return SHEET_KEY_ALIASES[compact] ?? name
}

function headerSet(rows: Record<string, unknown>[]): Set<string> {
  const keys = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) keys.add(key.toLowerCase())
  }
  return keys
}

function headersInclude(headers: Set<string>, ...names: string[]): boolean {
  return names.some(name => headers.has(name.toLowerCase()))
}

export function detectSheetKindFromRows(rows: Record<string, unknown>[]): string | null {
  if (rows.length === 0) return null
  const headers = headerSet(rows)

  if (headersInclude(headers, 'Lift Ref#', 'Lift #', 'Lift Ref')) return 'lifts'
  if (headersInclude(headers, 'Sale Ref#', 'Sale Ref', 'SO Ref#', 'SO Ref')
    || (headersInclude(headers, 'Buyer') && !headersInclude(headers, 'Seller Name', 'Purchase Ref#'))) {
    return 'salesOrders'
  }
  if (headersInclude(headers, 'Purchase Ref#', 'Purchase Ref', 'PO Ref#', 'PO Ref')
    && headersInclude(headers, 'Seller Name', 'Seller')) {
    return 'purchaseOrders'
  }
  if (headersInclude(headers, 'Ref#', 'Side')) return 'tradeOrders'
  return null
}

function inferSheetKindFromFilename(filename: string): string | null {
  const base = filename.replace(/\.[^.]+$/, '').toLowerCase()
  if (/\b(po|purchase)\b/.test(base)) return 'purchaseOrders'
  if (/\b(so|sale)\b/.test(base)) return 'salesOrders'
  if (/\blift/.test(base)) return 'lifts'
  return null
}

function appendSheetRows(
  target: Map<string, Record<string, unknown>[]>,
  key: string,
  rows: Record<string, unknown>[],
) {
  if (rows.length === 0) return
  const existing = target.get(key) ?? []
  target.set(key, [...existing, ...rows])
}

function parseGroupedPoFromSheets(sheetRows: Map<string, Record<string, unknown>[]>) {
  const purchaseRows = sheetRows.get('purchaseOrders')
  const objectRows = purchaseRows?.filter(row => !Array.isArray(row._cells)) ?? []
  if (objectRows.length > 0 && sheetHasStandardPoHeaders(objectRows)) {
    return null
  }

  const rawChunks: unknown[][][] = []

  const groupedRows = sheetRows.get('purchaseOrders')?.filter(row => Array.isArray(row._cells)) ?? []
  if (groupedRows.length > 0) {
    rawChunks.push(groupedRows.map(row => row._cells as unknown[]))
  }

  const rawRows = sheetRows.get('purchaseOrders_raw')
  if (rawRows?.length) {
    const raw = rawRows.map(row => row._cells).filter(Array.isArray) as unknown[][]
    if (raw.length > 0) rawChunks.push(raw)
  }

  for (const raw of rawChunks) {
    const parsed = tryParseGroupedPoRawRows(raw)
    if (parsed) return parsed
  }

  return null
}

function appendRawSheetRows(
  target: Map<string, Record<string, unknown>[]>,
  key: string,
  XLSX: Pick<typeof import('xlsx'), 'utils'>,
  sheet: import('xlsx').WorkSheet,
) {
  const raw = sheetToAoAPreferDateText(XLSX, sheet)
  if (raw.length === 0) return
  appendSheetRows(
    target,
    key,
    raw.map(cells => ({ _cells: cells })),
  )
}

/** Excel date serial / Date cells (locale-independent). */
function cellLooksLikeExcelDate(cell: import('xlsx').CellObject): boolean {
  if (cell.t === 'd') return true
  if (cell.t !== 'n' || typeof cell.v !== 'number') return false
  if (cell.v <= 20000 || cell.v >= 60000) return false
  const z = typeof cell.z === 'string' ? cell.z : ''
  if (/[dy]|mm?[/.-]dd?|dd?[/.-]mm?/i.test(z)) return true
  const w = typeof cell.w === 'string' ? cell.w.trim() : ''
  return /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(w)
}

function headerLooksLikeDateField(header: string): boolean {
  return /date|delivery\s*(from|to|start|end)|delivered|^from$|^to$/i.test(header.trim())
}

function isExcelSerialValue(value: unknown): value is number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 20000 && value < 60000
  }
  if (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value.trim())) {
    const n = parseFloat(value)
    return n > 20000 && n < 60000
  }
  return false
}

/**
 * Convert an Excel date cell to YYYY-MM-DD from the serial / Date value.
 * Never prefer locale-formatted `cell.w` alone — US MM/DD vs India DD/MM swaps day/month.
 *
 * Exception: when Excel has already converted typed India DD/MM text into a date serial
 * (common on US-locale Excel), `cell.w` still shows the typed digits (e.g. "10/5/26" for
 * 10 May). Prefer parsing that display as DD/MM so we recover the trader's date instead of
 * the US-interpreted serial (which would be 5 Oct).
 */
function excelDateCellToIso(cell: import('xlsx').CellObject): string {
  const display = typeof cell.w === 'string' ? cell.w.trim().replace(/\u00a0/g, ' ') : ''
  // Slash/dash display with day+month(+year) — India trade registers always mean DD/MM.
  if (display && /^\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?$/.test(display)) {
    // Bare "10/5" has no year — fall through to serial/Date which has the year.
    if (/[/.-]\d{2,4}$/.test(display)) {
      const fromDisplay = normalizeDateToIso(display, { preferMonthFirst: false })
      if (fromDisplay) return fromDisplay
    }
  }

  if (typeof cell.v === 'number' && Number.isFinite(cell.v)) {
    return normalizeDateToIso(cell.v)
  }
  if (typeof cell.v === 'string' && isExcelSerialValue(cell.v)) {
    return normalizeDateToIso(parseFloat(cell.v))
  }
  if (cell.t === 'd' && cell.v instanceof Date && !Number.isNaN(cell.v.getTime())) {
    // SheetJS Date values are UTC midnight for the calendar day — use UTC parts.
    // Some files store local-midnight offsets (e.g. IST → previous day 18:30Z); use local parts then.
    const asUtcMidnight =
      cell.v.getUTCHours() === 0
      && cell.v.getUTCMinutes() === 0
      && cell.v.getUTCSeconds() === 0
      && cell.v.getUTCMilliseconds() === 0
    if (asUtcMidnight) {
      const y = cell.v.getUTCFullYear()
      const m = cell.v.getUTCMonth() + 1
      const d = cell.v.getUTCDate()
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
    const y = cell.v.getFullYear()
    const m = cell.v.getMonth() + 1
    const d = cell.v.getDate()
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  if (!display) return ''
  const z = typeof cell.z === 'string' ? cell.z : ''
  return normalizeDateToIso(display, { preferMonthFirst: excelFormatPrefersMonthFirst(z) })
}

function sheetToJsonPreferDateText(
  XLSX: Pick<typeof import('xlsx'), 'utils'>,
  sheet: import('xlsx').WorkSheet,
): Record<string, unknown>[] {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true })
  if (rows.length === 0) return rows

  const ref = sheet['!ref']
  if (!ref) return rows

  const range = XLSX.utils.decode_range(ref)
  const headers: string[] = []
  for (let c = range.s.c; c <= range.e.c; c++) {
    const address = XLSX.utils.encode_cell({ r: range.s.r, c })
    const headerCell = sheet[address]
    const header = headerCell != null && headerCell.v != null ? String(headerCell.v).trim() : ''
    headers.push(header)
  }

  return rows.map((row, rowIndex) => {
    const excelRow = range.s.r + 1 + rowIndex
    const next = { ...row }
    for (let c = range.s.c; c <= range.e.c; c++) {
      const header = headers[c - range.s.c]
      if (!header) continue
      const cell = sheet[XLSX.utils.encode_cell({ r: excelRow, c })]
      if (!cell) continue
      const treatAsDate =
        cellLooksLikeExcelDate(cell)
        || (headerLooksLikeDateField(header) && isExcelSerialValue(cell.v))
      if (!treatAsDate) continue
      const iso = excelDateCellToIso(cell)
      if (iso) next[header] = iso
    }
    return next
  })
}

function sheetToAoAPreferDateText(
  XLSX: Pick<typeof import('xlsx'), 'utils'>,
  sheet: import('xlsx').WorkSheet,
): unknown[][] {
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true }) as unknown[][]
  const ref = sheet['!ref']
  if (!ref || raw.length === 0) return raw

  const range = XLSX.utils.decode_range(ref)
  const headerRow = raw[0] ?? []
  return raw.map((row, rowIndex) => {
    const excelRow = range.s.r + rowIndex
    const next = [...row]
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: excelRow, c })]
      if (!cell) continue
      const header = rowIndex === 0 ? '' : String(headerRow[c - range.s.c] ?? '')
      const treatAsDate =
        cellLooksLikeExcelDate(cell)
        || (headerLooksLikeDateField(header) && isExcelSerialValue(cell.v))
      if (!treatAsDate) continue
      const iso = excelDateCellToIso(cell)
      if (iso) next[c - range.s.c] = iso
    }
    return next
  })
}

function appendSheetFromWorkbook(
  target: Map<string, Record<string, unknown>[]>,
  XLSX: Pick<typeof import('xlsx'), 'utils'>,
  sheet: import('xlsx').WorkSheet,
  kind: string,
  filename?: string,
) {
  const isPoSheet = kind === 'purchaseOrders'
    || inferSheetKindFromFilename(filename ?? '') === 'purchaseOrders'

  const rows = sheetToJsonPreferDateText(XLSX, sheet)
  if (rows.length > 0 && isPoSheet && sheetHasStandardPoHeaders(rows)) {
    appendSheetRows(target, 'purchaseOrders', rows)
    return
  }

  const raw = sheetToAoAPreferDateText(XLSX, sheet)

  if (isPoSheet && (isGroupedPoRawRows(raw) || tryParseGroupedPoRawRows(raw))) {
    appendSheetRows(target, 'purchaseOrders', raw.map(cells => ({ _cells: cells })))
    return
  }

  if (rows.length === 0) return
  appendSheetRows(target, kind, rows)
  if (isPoSheet) appendRawSheetRows(target, 'purchaseOrders_raw', XLSX, sheet)
}

export function extractSheetRowsFromWorkbook(
  XLSX: Pick<typeof import('xlsx'), 'utils'>,
  workbook: import('xlsx').WorkBook,
  filename?: string,
): Map<string, Record<string, unknown>[]> {
  const sheetRows = new Map<string, Record<string, unknown>[]>()

  if (workbook.SheetNames.length === 1) {
    const onlyName = workbook.SheetNames[0]!
    const onlySheet = workbook.Sheets[onlyName]
    if (onlySheet) {
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(onlySheet, { defval: '' })
      if (rows.length > 0 && rows[0]?._sheet != null) {
        for (const row of rows) {
          const sheet = String(row._sheet ?? '').trim()
          if (!sheet) continue
          appendSheetRows(sheetRows, normalizeSheetKey(sheet), [{ _json: row._json }])
        }
        return sheetRows
      }

      const normalized = normalizeSheetKey(onlyName)
      const known = normalized === 'purchaseOrders' || normalized === 'salesOrders' || normalized === 'lifts'
      const kind = known
        ? normalized
        : (detectSheetKindFromRows(rows) ?? inferSheetKindFromFilename(filename ?? onlyName))
      if (kind) {
        appendSheetFromWorkbook(sheetRows, XLSX, onlySheet, kind, filename ?? onlyName)
        return sheetRows
      }
      const raw = XLSX.utils.sheet_to_json(onlySheet, { header: 1, defval: '' }) as unknown[][]
      if (isGroupedPoRawRows(raw) || tryParseGroupedPoRawRows(raw)) {
        appendSheetFromWorkbook(sheetRows, XLSX, onlySheet, 'purchaseOrders', filename ?? onlyName)
        return sheetRows
      }
    }
  }

  for (const sheetName of workbook.SheetNames) {
    if (sheetName === '_meta') continue
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue

    const normalized = normalizeSheetKey(sheetName)
    const known = normalized === 'purchaseOrders' || normalized === 'salesOrders' || normalized === 'lifts'
      || (OBJECT_SHEETS as readonly string[]).includes(normalized)
    const probeRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    if (probeRows.length === 0) continue
    const kind = known
      ? normalized
      : (detectSheetKindFromRows(probeRows) ?? inferSheetKindFromFilename(filename ?? sheetName))
    if (!kind) {
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
      if (isGroupedPoRawRows(raw) || tryParseGroupedPoRawRows(raw)) {
        appendSheetFromWorkbook(sheetRows, XLSX, sheet, 'purchaseOrders', filename ?? sheetName)
      }
      continue
    }
    appendSheetFromWorkbook(sheetRows, XLSX, sheet, normalizeSheetKey(kind), filename ?? sheetName)
  }

  return sheetRows
}

async function readWorkbookFromFile(file: File) {
  const XLSX = await loadXlsx()
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'csv') {
    const text = await file.text()
    return XLSX.read(text, { type: 'string' })
  }

  const buffer = await file.arrayBuffer()
  return XLSX.read(buffer, { type: 'array' })
}

async function parseWorkbookBackup(workbook: import('xlsx').WorkBook, filename?: string): Promise<TradeBackup> {
  const XLSX = await loadXlsx()
  let exportedAt = new Date().toISOString()

  const metaSheet = workbook.Sheets._meta
  if (metaSheet) {
    const metaRows = XLSX.utils.sheet_to_json<{ exportedAt?: string }>(metaSheet)
    if (metaRows[0]?.exportedAt) exportedAt = metaRows[0].exportedAt
  }

  const sheetRows = extractSheetRowsFromWorkbook(XLSX, workbook, filename)

  const data = buildDataFromSheetRows(sheetRows)
  if (data.tradeOrders.length === 0 && sheetRows.size === 0) {
    throw new Error('Spreadsheet backup is empty or unrecognized')
  }
  if (data.tradeOrders.length === 0) {
    throw new Error('Spreadsheet must include at least one purchase or sales order row')
  }

  return { exportedAt, version: BACKUP_VERSION, data }
}

export async function exportTradeDataToExcel(data: TradeData) {
  const XLSX = await loadXlsx()
  const workbook = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet([{ version: BACKUP_VERSION, exportedAt: new Date().toISOString() }]),
    '_meta',
  )

  const purchaseOrders = data.tradeOrders
    .filter(o => o.side === 'purchase')
    .map(order => purchaseOrderRow(order, data.lifts))
  const purchaseSheet = sheetFromHeaders(PO_EXPORT_HEADERS, purchaseOrders)
  XLSX.utils.book_append_sheet(
    workbook,
    purchaseSheet.rows.length > 0
      ? XLSX.utils.aoa_to_sheet(rowsToAoA(purchaseSheet.headers, purchaseSheet.rows))
      : XLSX.utils.aoa_to_sheet([PO_EXPORT_HEADERS as unknown as string[]]),
    'purchaseOrders',
  )

  const salesOrders = data.tradeOrders
    .filter(o => o.side === 'sale')
    .map(salesOrderRow)
  const salesSheet = sheetFromHeaders(SO_EXPORT_HEADERS, salesOrders)
  XLSX.utils.book_append_sheet(
    workbook,
    salesSheet.rows.length > 0
      ? XLSX.utils.aoa_to_sheet(rowsToAoA(salesSheet.headers, salesSheet.rows))
      : XLSX.utils.aoa_to_sheet([SO_EXPORT_HEADERS as unknown as string[]]),
    'salesOrders',
  )

  for (const key of OBJECT_SHEETS) {
    const records = data[key]
    if (key === 'lifts') {
      const rows = Array.isArray(records)
        ? records.map(lift => liftExportRow(lift as Lift, data.tradeOrders))
        : []
      const liftSheet = sheetFromHeaders(LIFT_EXPORT_HEADERS, rows)
      XLSX.utils.book_append_sheet(
        workbook,
        liftSheet.rows.length > 0
          ? XLSX.utils.aoa_to_sheet(rowsToAoA(liftSheet.headers, liftSheet.rows))
          : XLSX.utils.aoa_to_sheet([LIFT_EXPORT_HEADERS as unknown as string[]]),
        key,
      )
      continue
    }

    const rows = Array.isArray(records) ? recordsToDisplayRows(key, records) : []
    XLSX.utils.book_append_sheet(
      workbook,
      rows.length > 0 ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([['No records']]),
      key,
    )
  }

  const spotRows = data.spots.map(name => withJson({ Name: name }, name))
  XLSX.utils.book_append_sheet(
    workbook,
    spotRows.length > 0 ? XLSX.utils.json_to_sheet(spotRows) : XLSX.utils.aoa_to_sheet([['Name'], ['No records']]),
    'spots',
  )

  const itemRows = data.items.map(name => withJson({ Name: name }, name))
  XLSX.utils.book_append_sheet(
    workbook,
    itemRows.length > 0 ? XLSX.utils.json_to_sheet(itemRows) : XLSX.utils.aoa_to_sheet([['Name'], ['No records']]),
    'items',
  )

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet([{
      PO: data.counters.po,
      SO: data.counters.so,
      Lift: data.counters.lift,
      Invoice: data.counters.invoice,
      _json: JSON.stringify(data.counters),
    }]),
    'counters',
  )

  const out = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  downloadFile(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    backupFilename('xlsx'),
  )
}

export async function exportTradeDataToCsv(data: TradeData) {
  const rows: { _sheet: string; _json: string }[] = []

  for (const order of data.tradeOrders.filter(o => o.side === 'purchase')) {
    rows.push({ _sheet: 'purchaseOrders', _json: JSON.stringify(order) })
  }
  for (const order of data.tradeOrders.filter(o => o.side === 'sale')) {
    rows.push({ _sheet: 'salesOrders', _json: JSON.stringify(order) })
  }

  for (const key of OBJECT_SHEETS) {
    const records = data[key]
    if (!Array.isArray(records)) continue
    for (const record of records) {
      rows.push({ _sheet: key, _json: JSON.stringify(record) })
    }
  }
  for (const spot of data.spots) rows.push({ _sheet: 'spots', _json: JSON.stringify(spot) })
  for (const item of data.items) rows.push({ _sheet: 'items', _json: JSON.stringify(item) })
  rows.push({ _sheet: 'counters', _json: JSON.stringify(data.counters) })

  const XLSX = await loadXlsx()
  const sheet = XLSX.utils.json_to_sheet(rows)
  const csv = XLSX.utils.sheet_to_csv(sheet)
  downloadFile(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), backupFilename('csv'))
}

export async function readSpreadsheetBackupFile(file: File): Promise<TradeBackup> {
  const workbook = await readWorkbookFromFile(file)
  return parseWorkbookBackup(workbook, file.name)
}

function demoDataForImportTemplate(): TradeData {
  const seed = buildSeedData()
  return {
    ...seed,
    contracts: [],
    balanceSettlements: [],
  }
}

function appendImportTemplateSheets(
  workbook: import('xlsx').WorkBook,
  XLSX: typeof import('xlsx'),
  data: Pick<TradeData, 'tradeOrders' | 'lifts'>,
) {
  const purchaseOrders = data.tradeOrders
    .filter(o => o.side === 'purchase')
    .map(order => purchaseOrderRow(order, data.lifts))
  const purchaseSheet = sheetFromHeaders(PO_EXPORT_HEADERS, purchaseOrders)
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(rowsToAoA(purchaseSheet.headers, purchaseSheet.rows)),
    'purchaseOrders',
  )

  const salesOrders = data.tradeOrders
    .filter(o => o.side === 'sale')
    .map(salesOrderRow)
  const salesSheet = sheetFromHeaders(SO_EXPORT_HEADERS, salesOrders)
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(rowsToAoA(salesSheet.headers, salesSheet.rows)),
    'salesOrders',
  )

  const liftRows = data.lifts.map(lift => liftExportRow(lift, data.tradeOrders))
  const liftSheet = sheetFromHeaders(LIFT_EXPORT_HEADERS, liftRows)
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(rowsToAoA(liftSheet.headers, liftSheet.rows)),
    'lifts',
  )
}

export async function exportImportTemplate() {
  const XLSX = await loadXlsx()
  const workbook = XLSX.utils.book_new()
  appendImportTemplateSheets(workbook, XLSX, demoDataForImportTemplate())

  const out = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  downloadFile(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    'tradeal-import-template.xlsx',
  )
}

export async function readMultipleSpreadsheetFiles(files: File[]): Promise<TradeBackup> {
  if (files.length === 0) {
    throw new Error('Select at least one Excel file')
  }
  if (files.length === 1) {
    return readSpreadsheetBackupFile(files[0]!)
  }

  const XLSX = await loadXlsx()
  const merged = new Map<string, Record<string, unknown>[]>()

  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
      throw new Error(`${file.name}: use .xlsx, .xls, or .csv`)
    }
    const workbook = await readWorkbookFromFile(file)
    const extracted = extractSheetRowsFromWorkbook(XLSX, workbook, file.name)
    for (const [key, rows] of extracted) {
      appendSheetRows(merged, key, rows)
    }
  }

  if (merged.size === 0) {
    throw new Error(
      'Could not read any rows from the selected files. Name files PO.xlsx, SO.xlsx, and Lift.xlsx, or download the Template and match column headers.',
    )
  }

  const data = buildDataFromSheetRows(merged)
  if (data.tradeOrders.length === 0) {
    throw new Error('Combined import must include at least one PO or SO row across all files')
  }

  return {
    exportedAt: new Date().toISOString(),
    version: BACKUP_VERSION,
    data,
  }
}

export async function readBackupFile(file: File): Promise<TradeBackup> {
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'json') {
    const text = await file.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error('Backup file is not valid JSON')
    }
    return parseTradeBackup(parsed)
  }

  if (ext === 'csv' || ext === 'xlsx' || ext === 'xls') {
    return readSpreadsheetBackupFile(file)
  }

  throw new Error('Unsupported file type. Use .json, .csv, .xlsx, or .xls')
}

export type { ObjectSheet }
