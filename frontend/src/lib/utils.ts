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
const SHORT_MONTH_INDEX: Record<string, number> = Object.fromEntries(
  SHORT_MONTHS.map((m, i) => [m.toLowerCase(), i + 1]),
)

/** Calendar date — always `16 Sep 2026` (no comma, English short month). */
function formatDayMonthYear(date: Date): string {
  return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

function excelSerialToIso(value: number): string {
  // Excel serial day count (1900 system) → UTC calendar day (no local TZ shift).
  const utc = new Date(Math.round((value - 25569) * 86400 * 1000))
  return ymdToIso(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate())
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

/** Parse `8 Dec 2026`, `08-Dec-2026`, `8 December 2026`. */
function parseNamedMonthDateText(text: string): string {
  const match = text.match(
    /^(\d{1,2})[-\s]+([A-Za-z]{3,9})[-\s,]+(\d{2}|\d{4})(?:\s+.*)?$/i,
  )
  if (!match) {
    const us = text.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2}|\d{4})(?:\s+.*)?$/i)
    if (!us) return ''
    const month = SHORT_MONTH_INDEX[us[1]!.slice(0, 3).toLowerCase()]
    if (!month) return ''
    const day = parseInt(us[2]!, 10)
    const year = expandTwoDigitYear(parseInt(us[3]!, 10))
    return isValidCalendarDate(year, month, day) ? ymdToIso(year, month, day) : ''
  }
  const day = parseInt(match[1]!, 10)
  const month = SHORT_MONTH_INDEX[match[2]!.slice(0, 3).toLowerCase()]
  if (!month) return ''
  const year = expandTwoDigitYear(parseInt(match[3]!, 10))
  return isValidCalendarDate(year, month, day) ? ymdToIso(year, month, day) : ''
}

function dateObjectToIso(value: Date): string {
  if (Number.isNaN(value.getTime())) return ''
  // SheetJS / date-only values are UTC midnight — use UTC parts to avoid US TZ off-by-one.
  if (
    value.getUTCHours() === 0
    && value.getUTCMinutes() === 0
    && value.getUTCSeconds() === 0
    && value.getUTCMilliseconds() === 0
  ) {
    return ymdToIso(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate())
  }
  return ymdToIso(value.getFullYear(), value.getMonth() + 1, value.getDate())
}

/**
 * Parse numeric slash/dash dates as DD/MM/YYYY (India) by default.
 * Ambiguous values like 08/10/2026 prefer day-first; only fall back to
 * month-first when day-first is an invalid calendar date (e.g. 08/19/2026).
 * Pass `preferMonthFirst` when Excel's number format is m/d/y.
 */
function parseDayMonthYearText(text: string, preferMonthFirst = false): string {
  const match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:\s+.*)?$/)
  if (!match) return ''

  const a = parseInt(match[1]!, 10)
  const b = parseInt(match[2]!, 10)
  const year = expandTwoDigitYear(parseInt(match[3]!, 10))

  const dayFirst = isValidCalendarDate(year, b, a) ? ymdToIso(year, b, a) : ''
  const monthFirst = isValidCalendarDate(year, a, b) ? ymdToIso(year, a, b) : ''
  if (preferMonthFirst) return monthFirst || dayFirst
  return dayFirst || monthFirst
}

/** True when Excel format code is month-first (US m/d/y), not day-first (d/m/y). */
export function excelFormatPrefersMonthFirst(z: string): boolean {
  const fmt = z.toLowerCase().replace(/\[[^\]]*\]/g, '')
  if (/d\s*[/.-]\s*m/.test(fmt) || /\bdd?\b.*\bmm?\b/.test(fmt)) return false
  if (/m\s*[/.-]\s*d/.test(fmt)) return true
  return false
}

/** Swap day/month on an ISO date when both parts are ≤12 (ambiguous import). */
export function swapAmbiguousIsoDayMonth(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return iso
  const year = parseInt(match[1]!, 10)
  const month = parseInt(match[2]!, 10)
  const day = parseInt(match[3]!, 10)
  if (month === day || day > 12 || month > 12) return iso
  if (!isValidCalendarDate(year, day, month)) return iso
  return ymdToIso(year, day, month)
}

function isoInInclusiveRange(iso: string, start: string, end: string): boolean {
  return Boolean(iso && start && end && iso >= start && iso <= end)
}

/**
 * Fix dates corrupted by US MM/DD display text parsed as DD/MM.
 * Repairs inverted delivery periods and order dates that fall outside the period
 * when a day/month swap lands inside.
 */
export function repairAmbiguousTradeDates<T extends {
  date?: string
  deliveryPeriodStart?: string
  deliveryPeriodEnd?: string
  deliveredAt?: string
}>(row: T): T {
  let date = row.date ?? ''
  let start = row.deliveryPeriodStart ?? ''
  let end = row.deliveryPeriodEnd ?? ''
  let deliveredAt = row.deliveredAt ?? ''

  if (start && end && start > end) {
    const swapStart = swapAmbiguousIsoDayMonth(start)
    const swapEnd = swapAmbiguousIsoDayMonth(end)
    if (swapStart !== start && swapStart <= end) start = swapStart
    else if (swapEnd !== end && start <= swapEnd) end = swapEnd
    else if (swapStart !== start && swapEnd !== end && swapStart <= swapEnd) {
      start = swapStart
      end = swapEnd
    }
  }

  if (date && start && end && !isoInInclusiveRange(date, start, end)) {
    const swapped = swapAmbiguousIsoDayMonth(date)
    if (swapped !== date && isoInInclusiveRange(swapped, start, end)) date = swapped
  } else if (date && start && date !== start && swapAmbiguousIsoDayMonth(date) === start) {
    date = start
  }

  if (deliveredAt && start && end && !isoInInclusiveRange(deliveredAt, start, end)) {
    const swapped = swapAmbiguousIsoDayMonth(deliveredAt)
    if (swapped !== deliveredAt && isoInInclusiveRange(swapped, start, end)) deliveredAt = swapped
  }

  if (
    date === (row.date ?? '')
    && start === (row.deliveryPeriodStart ?? '')
    && end === (row.deliveryPeriodEnd ?? '')
    && deliveredAt === (row.deliveredAt ?? '')
  ) {
    return row
  }

  return {
    ...row,
    ...(row.date !== undefined ? { date } : {}),
    ...(row.deliveryPeriodStart !== undefined ? { deliveryPeriodStart: start } : {}),
    ...(row.deliveryPeriodEnd !== undefined ? { deliveryPeriodEnd: end } : {}),
    ...(row.deliveredAt !== undefined ? { deliveredAt: deliveredAt || undefined } : {}),
  }
}

/** Normalize spreadsheet / user date input to `YYYY-MM-DD`, or empty when unparseable. */
export function normalizeDateToIso(value: unknown, opts?: { preferMonthFirst?: boolean }): string {
  if (value == null || value === '') return ''
  if (value instanceof Date) return dateObjectToIso(value)
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Excel serials are ~30k–50k for modern trade dates; reject epoch ms / junk.
    if (value > 20000 && value < 60000) return excelSerialToIso(value)
    return ''
  }

  const text = String(value).trim().replace(/\u00a0/g, ' ')
  if (!text) return ''

  // Zero-padded or unpadded ISO: 2026-12-08 / 2026-12-8 / 2026-12-08T…
  const isoLoose = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/)
  if (isoLoose) {
    const year = parseInt(isoLoose[1]!, 10)
    const month = parseInt(isoLoose[2]!, 10)
    const day = parseInt(isoLoose[3]!, 10)
    if (isValidCalendarDate(year, month, day)) return ymdToIso(year, month, day)
  }

  const dmy = parseDayMonthYearText(text, opts?.preferMonthFirst === true)
  if (dmy) return dmy

  const named = parseNamedMonthDateText(text)
  if (named) return named

  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = parseFloat(text)
    if (serial > 20000 && serial < 60000) return excelSerialToIso(serial)
    // Never Date.parse bare integers — they become year 46004 etc.
    return ''
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
