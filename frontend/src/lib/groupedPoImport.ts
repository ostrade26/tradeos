import {
  CURRENT_TRADER,
  type Lift,
  type TradeOrder,
} from '../data/mockData'
import { formatTankerNo } from './liftTankers'
import { parseDateValue, parseNumber } from './spreadsheetImport'
import { randomUUID } from './randomId'

export interface GroupedPoParseResult {
  orders: TradeOrder[]
  lifts: Lift[]
}

interface PoGroupHeader {
  paymentTerms: string
  taxLabel: string
  sellerName: string
}

interface PoLine {
  invoiceNo: string
  date: string
  serialNo: string
  tankerNo: string
  qtyMt: number
}

interface ColumnMap {
  payment: number
  tax: number
  seller: number
  invoice: number
  date: number
  serial: number
  tanker: number
  qty: number
}

const HEADER_LABELS = new Set([
  'payment', 'tax', 'seller', 'invoice', 'date', 'tanker', 'qty', 'quantity',
  'ref', 'ref#', 'purchase ref#', 'party', 'seller name', 'invoice no', 'invoice no.',
  'advance', 'fix duty', 'sr no', 's.no', 's no', 'vehicle', 'vehicle no',
])

function cellText(value: unknown): string {
  if (value == null) return ''
  return String(value).trim()
}

function normalizeRow(row: unknown): string[] {
  if (!Array.isArray(row)) return []
  return row.map(cellText)
}

function padRows(rows: unknown[][]): string[][] {
  const maxLen = rows.reduce((max, row) => Math.max(max, normalizeRow(row).length), 0)
  return rows
    .map(normalizeRow)
    .filter(rowHasContent)
    .map(cells => {
      while (cells.length < maxLen) cells.push('')
      return cells
    })
}

function rowHasContent(cells: string[]): boolean {
  return cells.some(Boolean)
}

function looksLikeLabelHeaderRow(cells: string[]): boolean {
  if (!rowHasContent(cells)) return false
  const lower = cells.map(c => c.toLowerCase()).filter(Boolean)
  if (lower.length === 0) return false
  const labeled = lower.filter(c => HEADER_LABELS.has(c)).length
  return labeled >= 2 || (labeled >= 1 && lower.length <= 4)
}

function skipHeaderRows(rows: unknown[][]): string[][] {
  const normalized = padRows(rows)
  if (normalized.length === 0) return []
  if (looksLikeLabelHeaderRow(normalized[0]!)) return normalized.slice(1)
  return normalized
}

function isTanker(value: string): boolean {
  const compact = value.replace(/\s/g, '').toUpperCase()
  if (!compact) return false
  if (/^[A-Z]{2}-[A-Z0-9-]+$/i.test(compact)) return true
  if (/^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{3,4}$/i.test(compact)) return true
  return false
}

function isInvoiceRef(value: string): boolean {
  if (!value || isTanker(value)) return false
  const text = value.trim()
  if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(text)) return false
  if (/^\d{5,8}$/.test(text)) return false
  return /[A-Za-z]/.test(text) && (text.includes('/') || text.includes('-'))
}

function isQtyValue(value: string): boolean {
  const n = parseNumber(value)
  return n != null && n > 0 && n <= 500
}

function isSerialValue(value: string): boolean {
  return /^\d{5,8}$/.test(value)
}

function isDateCell(value: string): boolean {
  if (!value || isInvoiceRef(value) || isTanker(value) || isSerialValue(value)) return false
  if (/^\d+(\.\d+)?$/.test(value)) {
    const serial = parseFloat(value)
    if (serial > 20000 && serial < 60000) return true
  }
  if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(value)) return true
  // Avoid Date.parse on slash dates — that uses US MM/DD and flips Indian dates.
  if (!/^\d{1,2}[/.-]\d{1,2}[/.-]\d/.test(value)) {
    const parsed = Date.parse(value)
    return !Number.isNaN(parsed)
  }
  return false
}

function detectColumns(rows: string[][]): ColumnMap | null {
  for (const cells of rows) {
    const tanker = cells.findIndex(isTanker)
    const qty = (() => {
      for (let i = cells.length - 1; i >= 0; i--) {
        if (isQtyValue(cells[i]!)) return i
      }
      return -1
    })()
    if (tanker < 0 && qty < 0) continue

    const invoice = cells.findIndex((c, i) => isInvoiceRef(c) && (qty < 0 || i < qty))
    if (invoice < 0 && qty < 0 && tanker < 0) continue

    const invoiceIdx = invoice >= 0 ? invoice : Math.max(tanker, qty) - 2
    const date = cells.findIndex((c, i) => i !== invoiceIdx && isDateCell(c))
    const serial = cells.findIndex((c, i) =>
      isSerialValue(c) && i !== invoiceIdx && i !== date && i !== tanker && i !== qty,
    )
    const leading = detectLeadingColumns(rows, invoiceIdx)

    return {
      ...leading,
      invoice: invoiceIdx,
      date: date >= 0 ? date : invoiceIdx + 1,
      serial: serial >= 0 ? serial : invoiceIdx + 2,
      tanker: tanker >= 0 ? tanker : invoiceIdx + 3,
      qty: qty >= 0 ? qty : invoiceIdx + 4,
    }
  }
  return null
}

function detectLeadingColumns(dataRows: string[][], invoiceIdx: number): Pick<ColumnMap, 'payment' | 'tax' | 'seller'> {
  for (const cells of dataRows) {
    const filled: number[] = []
    for (let i = 0; i < invoiceIdx; i++) {
      if (cells[i]) filled.push(i)
    }
    if (filled.length < 2) continue

    const sellerIdx = filled.reduce(
      (best, i) => ((cells[i]?.length ?? 0) > (cells[best]?.length ?? 0) ? i : best),
      filled[0]!,
    )
    const rest = filled.filter(i => i !== sellerIdx)
    return {
      payment: rest[0] ?? filled[0]!,
      tax: rest[1] ?? rest[0] ?? filled[0]!,
      seller: sellerIdx,
    }
  }
  return { payment: 0, tax: 1, seller: 2 }
}

function leadingFilledCount(cells: string[], beforeIdx: number): number {
  let count = 0
  for (let i = 0; i < beforeIdx; i++) {
    if (cells[i]) count++
  }
  return count
}

function hasDeliveryLine(cells: string[], cols: ColumnMap): boolean {
  return Boolean(
    isInvoiceRef(cells[cols.invoice] ?? '')
    || isTanker(cells[cols.tanker] ?? '')
    || isQtyValue(cells[cols.qty] ?? ''),
  )
}

export function isGroupedPoRawRows(rows: unknown[][]): boolean {
  const dataRows = skipHeaderRows(rows)
  if (dataRows.length < 1) return false

  const cols = detectColumns(dataRows)
  if (!cols) return false

  let headerRows = 0
  let deliveryLines = 0
  for (const cells of dataRows) {
    if (!hasDeliveryLine(cells, cols)) continue
    deliveryLines++
    if (leadingFilledCount(cells, cols.invoice) >= 2) headerRows++
  }

  return headerRows >= 1 && deliveryLines >= 1
}

function safePoRef(raw: string): string {
  return raw.replace(/\s+/g, '-').replace(/[\\/]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function poRefFromGroup(header: PoGroupHeader, lines: PoLine[], groupIndex: number): string {
  const firstInvoice = lines[0]?.invoiceNo
  if (firstInvoice?.includes('/')) {
    const parts = firstInvoice.split('/').filter(Boolean)
    if (parts.length >= 2) return safePoRef(parts.slice(0, -1).join('/'))
  }
  if (firstInvoice) return safePoRef(firstInvoice)
  const slug = header.sellerName.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24)
  return slug ? `PO-${slug}-${groupIndex + 1}` : `PO-${groupIndex + 1}`
}

function itemNameFromInvoice(invoice: string): string {
  const prefix = invoice.split(/[/-]/)[0]?.trim()
  if (!prefix) return ''
  if (/SOYAOIL/i.test(prefix)) return 'Soybean Oil'
  if (/PALM/i.test(prefix)) return 'Palm Oil'
  if (/RICE/i.test(prefix)) return 'Rice'
  return prefix
}

function parseLine(cells: string[], cols: ColumnMap): PoLine | null {
  const invoiceNo = cells[cols.invoice] ?? ''
  const tankerNo = formatTankerNo(cells[cols.tanker] ?? '')
  const qtyMt = parseNumber(cells[cols.qty]) ?? 0
  const dateRaw = cells[cols.date] ?? ''
  const date = isDateCell(dateRaw) ? parseDateValue(dateRaw) : ''
  const serialNo = cells[cols.serial] ?? ''

  if (!isInvoiceRef(invoiceNo) && !tankerNo && qtyMt <= 0) return null
  if (qtyMt <= 0 && !tankerNo && !isInvoiceRef(invoiceNo)) return null

  return {
    invoiceNo: isInvoiceRef(invoiceNo) ? invoiceNo : (serialNo || tankerNo || `LINE-${serialNo || 'X'}`),
    date: date || new Date().toISOString().slice(0, 10),
    serialNo,
    tankerNo,
    qtyMt: qtyMt > 0 ? qtyMt : 0,
  }
}

function buildLiftFromLine(
  line: PoLine,
  poRef: string,
  header: PoGroupHeader,
  liftRef: number,
): Lift {
  return {
    id: randomUUID(),
    liftRef,
    poRef,
    soRef: '',
    date: line.date,
    status: 'delivered',
    deliveredAt: line.date,
    buyerName: CURRENT_TRADER,
    sellerName: header.sellerName,
    itemName: itemNameFromInvoice(line.invoiceNo),
    deliveryPeriod: '',
    deliveryPeriodStart: '',
    deliveryPeriodEnd: '',
    deliveryPeriodVerified: false,
    rate: 0,
    liftedQty: line.qtyMt,
    plannedQtyMt: line.qtyMt,
    tankerNo: line.tankerNo,
    tankers: line.tankerNo
      ? [{
        tankerNo: line.tankerNo,
        transportName: '',
        driverMobile: '',
        lrNo: '',
        actualQtyMt: line.qtyMt > 0 ? line.qtyMt : undefined,
      }]
      : [],
    salesInvoiceNo: line.invoiceNo,
    isSelfLift: true,
    stockLift: true,
    remarks: header.taxLabel
      ? `${header.taxLabel}${header.paymentTerms ? ` · ${header.paymentTerms}` : ''}`
      : header.paymentTerms,
  }
}

function buildPoFromGroup(
  header: PoGroupHeader,
  lines: PoLine[],
  groupIndex: number,
): TradeOrder {
  const poRef = poRefFromGroup(header, lines, groupIndex)
  const orderQty = lines.reduce((sum, line) => sum + line.qtyMt, 0)
  const dates = lines.map(l => l.date).filter(Boolean).sort()
  const firstDate = dates[0] ?? new Date().toISOString().slice(0, 10)
  const itemName = itemNameFromInvoice(lines[0]?.invoiceNo ?? '')

  return {
    id: randomUUID(),
    ref: poRef,
    side: 'purchase',
    date: firstDate,
    partyName: header.sellerName,
    itemName,
    spot: '',
    deliveryType: 'period',
    deliveryPeriodStart: firstDate,
    deliveryPeriodEnd: dates.at(-1) ?? firstDate,
    deliveryPeriodVerified: false,
    rate: 0,
    taxRate: 0,
    orderQty,
    liftedQty: 0,
    committedLiftQty: 0,
    unit: 'MT',
    brokerName: '',
    brokeragePct: 0,
    sellerName: header.sellerName,
    buyerName: CURRENT_TRADER,
    paymentTerms: header.paymentTerms || undefined,
    remarks: header.taxLabel || undefined,
    status: 'pending',
  }
}

export function tryParseGroupedPoRawRows(rows: unknown[][]): GroupedPoParseResult | null {
  const dataRows = skipHeaderRows(rows)
  if (dataRows.length === 0) return null

  const cols = detectColumns(dataRows)
  if (!cols) return null

  const orders: TradeOrder[] = []
  const lifts: Lift[] = []
  let currentHeader: PoGroupHeader | null = null
  let currentLines: PoLine[] = []
  let groupIndex = 0
  let liftRef = 1

  const flushGroup = () => {
    if (!currentHeader || currentLines.length === 0) return
    const order = buildPoFromGroup(currentHeader, currentLines, groupIndex)
    orders.push(order)
    for (const line of currentLines) {
      const numericSerial = parseNumber(line.serialNo)
      const ref = numericSerial && numericSerial > 0 ? numericSerial : liftRef++
      lifts.push(buildLiftFromLine(line, order.ref, currentHeader, ref))
    }
    groupIndex++
    currentHeader = null
    currentLines = []
  }

  for (const cells of dataRows) {
    if (!hasDeliveryLine(cells, cols)) continue
    const leading = leadingFilledCount(cells, cols.invoice)
    const line = parseLine(cells, cols)
    if (!line) continue

    if (leading >= 2) {
      flushGroup()
      currentHeader = {
        paymentTerms: cells[cols.payment] ?? '',
        taxLabel: cells[cols.tax] ?? '',
        sellerName: cells[cols.seller] || cells[cols.tax] || cells[cols.payment] || 'Unknown seller',
      }
      currentLines = [line]
      continue
    }

    if (!currentHeader) {
      currentHeader = {
        paymentTerms: '',
        taxLabel: '',
        sellerName: 'Unknown seller',
      }
    }
    currentLines.push(line)
  }

  flushGroup()
  if (orders.length === 0) return null
  return { orders, lifts }
}

export function parseGroupedPoRawRows(rows: unknown[][]): GroupedPoParseResult | null {
  if (!isGroupedPoRawRows(rows)) return null
  return tryParseGroupedPoRawRows(rows)
}

export function parseGroupedPoSheetRows(rows: Record<string, unknown>[]): GroupedPoParseResult | null {
  const raw = rows
    .map(row => row._cells)
    .filter(Array.isArray) as unknown[][]
  if (raw.length === 0) return null
  return tryParseGroupedPoRawRows(raw)
}
