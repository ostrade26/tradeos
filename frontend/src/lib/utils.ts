import { clsx, type ClassValue } from 'clsx'

/** Browser / password-manager autofill off. Chrome ignores `off` on Name/Address labels, so callers should also lock until focus. */
export const noAutofill = {
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
  'data-1p-ignore': 'true',
  'data-lpignore': 'true',
  'data-form-type': 'other',
} as const

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

/** Reference # cells in DataTable rows — accent + underline when the row is hovered. */
export const tableRefCellClass =
  'font-mono font-medium text-accent whitespace-nowrap transition-colors group-hover:underline group-hover:font-semibold'

export const tableRefCellMutedClass =
  'font-mono font-medium text-heading whitespace-nowrap transition-colors group-hover:text-accent group-hover:font-semibold'

export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n)
}

const TABLE_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
}

const DELIVERY_PERIOD_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
}

function excelSerialToIso(value: number): string {
  const utc = new Date(Math.round((value - 25569) * 86400 * 1000))
  return utc.toISOString().slice(0, 10)
}

/** Normalize spreadsheet / user date input to `YYYY-MM-DD`, or empty when unparseable. */
export function normalizeDateToIso(value: unknown): string {
  if (value == null || value === '') return ''
  if (typeof value === 'number' && Number.isFinite(value)) return excelSerialToIso(value)

  const text = String(value).trim()
  if (!text) return ''

  const isoPrefix = text.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoPrefix) return isoPrefix[1]!

  const dmy = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (dmy) {
    const day = dmy[1]!.padStart(2, '0')
    const month = dmy[2]!.padStart(2, '0')
    const year = dmy[3]!
    return `${year}-${month}-${day}`
  }

  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = parseFloat(text)
    if (serial > 20000 && serial < 60000) return excelSerialToIso(serial)
  }

  const parsed = Date.parse(text)
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10)

  return ''
}

function parseDateValue(date: string): Date | null {
  const iso = normalizeDateToIso(date)
  if (!iso) return null
  const parsed = new Date(`${iso}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** Page heading date — e.g. `Monday, 31 Aug`. */
export function formatDateHeading(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

/** Activity group heading — e.g. `Monday, 31 August 2026`. */
export function formatDateGroupHeading(timestamp: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(timestamp))
}

export function formatDate(date: string): string {
  if (!date) return '—'
  const parsed = parseDateValue(date)
  if (!parsed) return '—'
  return new Intl.DateTimeFormat('en-IN', TABLE_DATE_OPTIONS).format(parsed)
}

/** Delivery period date — no year, e.g. `6 Apr`. */
export function formatDeliveryPeriodDate(date: string): string {
  if (!date) return '—'
  const parsed = parseDateValue(date)
  if (!parsed) return '—'
  return new Intl.DateTimeFormat('en-IN', DELIVERY_PERIOD_DATE_OPTIONS).format(parsed)
}

/** Delivery period — no year, one line, e.g. `6 Apr – 15 Aug`. */
export function formatDeliveryPeriodRange(start: string, end: string): string {
  if (!start && !end) return '—'
  if (start && end && start.slice(0, 10) === end.slice(0, 10)) return formatDeliveryPeriodDate(start)
  if (start && end) return `${formatDeliveryPeriodDate(start)} – ${formatDeliveryPeriodDate(end)}`
  if (start) return formatDeliveryPeriodDate(start)
  return formatDeliveryPeriodDate(end)
}

/** Table date range — same tokens as `formatDate`, e.g. `28 Aug 2026 – 5 Sep 2026`. */
export function formatDateRange(start: string, end: string): string {
  if (!start && !end) return '—'
  if (start && end && start.slice(0, 10) === end.slice(0, 10)) return formatDate(start)
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`
  if (start) return formatDate(start)
  return formatDate(end)
}

const DATE_TIME_DISPLAY: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}

function parseDateTimeValue(value: string): Date | null {
  const text = value.trim()
  if (!text) return null
  if (text.includes('T')) {
    const instant = new Date(text)
    return Number.isNaN(instant.getTime()) ? null : instant
  }
  return parseDateValue(text.slice(0, 10))
}

export function formatDateTime(date: string): string {
  if (!date) return '—'
  const parsed = parseDateTimeValue(date)
  if (!parsed) return '—'
  return new Intl.DateTimeFormat('en-IN', DATE_TIME_DISPLAY).format(parsed)
}

/** Round to 3 decimal places (MT). */
export function roundQtyMt(qty: number): number {
  return Math.round(qty * 1000) / 1000
}

/** Trading quantity — always exactly 3 decimal places */
export function formatMt(value: number): string {
  if (!Number.isFinite(value)) return '0.000'
  return roundQtyMt(value).toFixed(3)
}

/** Quantity with unit suffix, e.g. "100.000 MT" */
export function formatQty(value: number, unit = 'MT'): string {
  return `${formatMt(value)} ${unit}`
}

/** Remaining capacity after the quantity currently being entered */
export function remainingAfterQty(maxQty: number, enteredQty: number): number {
  const entered = Number.isFinite(enteredQty) ? enteredQty : 0
  return Math.max(0, maxQty - entered)
}

export function parseQtyInput(value: string): number {
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function qtyExceedsMax(value: string, maxQty: number): boolean {
  if (maxQty <= 0) return false
  return parseQtyInput(value) > maxQty
}

export function qtyMaxError(value: string, maxQty: number, message?: string): string | undefined {
  if (!qtyExceedsMax(value, maxQty)) return undefined
  return message ?? `Cannot exceed ${formatQty(maxQty)} available`
}

/** Inventory available qty — red when over-allocated, amber when low. */
export function availableQtyClass(value: number): string {
  if (value < 0) return 'text-danger font-bold'
  if (value < 20) return 'text-amber-700 dark:text-amber-400 font-semibold'
  return 'text-gray-800 dark:text-gray-200 font-semibold'
}
