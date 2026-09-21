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

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** Calendar date — always `16 Sep 2026` (no comma, English short month). */
function formatDayMonthYear(date: Date): string {
  return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

function excelSerialToIso(value: number): string {
  const utc = new Date(Math.round((value - 25569) * 86400 * 1000))
  return utc.toISOString().slice(0, 10)
}

function expandTwoDigitYear(year: number): number {
  if (year >= 100) return year
  // Trade dates are contemporary — treat 00–99 as 2000–2099.
  return 2000 + year
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const dt = new Date(year, month - 1, day)
  return dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day
}

function ymdToIso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Parse numeric slash/dash dates as DD/MM/YYYY (India).
 * Ambiguous values like 08/10/2026 prefer day-first; only fall back to
 * month-first when day-first is an invalid calendar date (e.g. 08/19/2026).
 */
function parseDayMonthYearText(text: string): string {
  const match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/)
  if (!match) return ''

  const a = parseInt(match[1]!, 10)
  const b = parseInt(match[2]!, 10)
  const year = expandTwoDigitYear(parseInt(match[3]!, 10))

  if (isValidCalendarDate(year, b, a)) return ymdToIso(year, b, a)
  if (isValidCalendarDate(year, a, b)) return ymdToIso(year, a, b)
  return ''
}

function dateObjectToIso(value: Date): string {
  if (Number.isNaN(value.getTime())) return ''
  return ymdToIso(value.getFullYear(), value.getMonth() + 1, value.getDate())
}

/** Normalize spreadsheet / user date input to `YYYY-MM-DD`, or empty when unparseable. */
export function normalizeDateToIso(value: unknown): string {
  if (value == null || value === '') return ''
  if (value instanceof Date) return dateObjectToIso(value)
  if (typeof value === 'number' && Number.isFinite(value)) return excelSerialToIso(value)

  const text = String(value).trim()
  if (!text) return ''

  const isoPrefix = text.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoPrefix) return isoPrefix[1]!

  const dmy = parseDayMonthYearText(text)
  if (dmy) return dmy

  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = parseFloat(text)
    if (serial > 20000 && serial < 60000) return excelSerialToIso(serial)
  }

  // Named months / ISO-like strings only — never slash dates (those are DD/MM above).
  if (!/^\d{1,2}[/.-]\d{1,2}[/.-]\d/.test(text)) {
    const parsed = Date.parse(text)
    if (!Number.isNaN(parsed)) return dateObjectToIso(new Date(parsed))
  }

  return ''
}

function parseDateValue(date: string): Date | null {
  const iso = normalizeDateToIso(date)
  if (!iso) return null
  const parsed = new Date(`${iso}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** Page heading date — e.g. `Monday, 16 Sep`. */
export function formatDateHeading(date: Date = new Date()): string {
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(date)
  return `${weekday}, ${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}`
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
  return formatDayMonthYear(parsed)
}

/** Delivery period date — no year, e.g. `6 Apr`. */
export function formatDeliveryPeriodDate(date: string): string {
  if (!date) return '—'
  const parsed = parseDateValue(date)
  if (!parsed) return '—'
  return `${parsed.getDate()} ${SHORT_MONTHS[parsed.getMonth()]}`
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

const DATE_TIME_CLOCK: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
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

/** Date + time — e.g. `17 Sep 2026 3:48 AM`. Times are always 12-hour with AM/PM. */
export function formatDateTime(date: string): string {
  if (!date) return '—'
  const parsed = parseDateTimeValue(date)
  if (!parsed) return '—'
  const clock = new Intl.DateTimeFormat('en-US', DATE_TIME_CLOCK).format(parsed)
  return `${formatDayMonthYear(parsed)} ${clock}`
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
