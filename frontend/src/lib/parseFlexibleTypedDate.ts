import { isValid, parse, parseISO } from 'date-fns'

function expandTwoDigitYear(year: number): number {
  if (year >= 100) return year
  return 2000 + year
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const dt = new Date(year, month - 1, day)
  return dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day
}

function toLocalDate(year: number, month: number, day: number): Date | null {
  if (!isValidCalendarDate(year, month, day)) return null
  return new Date(year, month - 1, day)
}

function toIso(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const NAMED_FORMATS = [
  'd MMM yyyy',
  'dd MMM yyyy',
  'd MMMM yyyy',
  'dd MMMM yyyy',
  'yyyy/M/d',
  'yyyy/MM/dd',
]

function parseIsoLoose(text: string): Date | null {
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/)
  if (match) {
    return toLocalDate(Number(match[1]), Number(match[2]), Number(match[3]))
  }
  // Never parseISO bare numbers — "10" becomes year 1000, not day 10.
  if (!/^\d+$/.test(text) && (text.includes('T') || /^\d{4}-\d{1,2}-\d{1,2}/.test(text))) {
    const parsed = parseISO(text)
    return isValid(parsed) ? parsed : null
  }
  return null
}

function parseSeparatedParts(parts: string[], reference: Date): Date | null {
  const nums = parts.map(p => Number(p))
  if (parts.some((p, i) => !/^\d+$/.test(p) || Number.isNaN(nums[i]))) return null

  const refYear = reference.getFullYear()
  const refMonth = reference.getMonth() + 1

  if (parts.length === 1) {
    const day = nums[0]!
    if (day < 1 || day > 31) return null
    return toLocalDate(refYear, refMonth, day)
  }

  if (parts.length === 2) {
    const [day, month] = nums
    return toLocalDate(refYear, month!, day!)
  }

  if (parts.length === 3) {
    const [a, b, c] = nums
    let year = c!
    const yearPart = parts[2]!
    if (yearPart.length === 2) year = expandTwoDigitYear(year)

    // yyyy-MM-dd when first part is a 4-digit year
    if (parts[0]!.length === 4 && a! >= 1000) {
      return toLocalDate(a!, b!, c!)
    }

    return toLocalDate(year, b!, a!)
  }

  return null
}

function parseDigitRuns(digits: string, ref: Date): Date | null {
  const refYear = ref.getFullYear()
  const refMonth = ref.getMonth() + 1

  if (digits.length <= 2) {
    return toLocalDate(refYear, refMonth, Number(digits))
  }

  if (digits.length === 3) {
    const dayOne = Number(digits[0])
    const monthTwo = Number(digits.slice(1))
    if (monthTwo >= 1 && monthTwo <= 12) {
      const d = toLocalDate(refYear, monthTwo, dayOne)
      if (d) return d
    }
    const dayTwo = Number(digits.slice(0, 2))
    const monthOne = Number(digits[2])
    if (monthOne >= 1 && monthOne <= 12) {
      return toLocalDate(refYear, monthOne, dayTwo)
    }
    return null
  }

  if (digits.length === 4) {
    const day = Number(digits.slice(0, 2))
    const month = Number(digits.slice(2, 4))
    return toLocalDate(refYear, month, day)
  }

  if (digits.length === 6) {
    const day = Number(digits.slice(0, 2))
    const month = Number(digits.slice(2, 4))
    let year = expandTwoDigitYear(Number(digits.slice(4)))
    return toLocalDate(year, month, day)
  }

  if (digits.length === 8) {
    const day = Number(digits.slice(0, 2))
    const month = Number(digits.slice(2, 4))
    const year = Number(digits.slice(4))
    return toLocalDate(year, month, day)
  }

  return null
}

/**
 * Parse partial or full typed dates (DD/MM/YYYY style). Missing month/year default to today’s month/year.
 */
export function parseFlexibleTypedDate(raw: string, reference: Date = new Date()): Date | null {
  let text = raw.trim().replace(/\u00a0/g, ' ')
  if (!text) return null

  text = text.replace(/[/.-\s]+$/g, '')

  if (/^\d+$/.test(text)) {
    const digit = parseDigitRuns(text, reference)
    if (digit) return digit
  }

  const iso = parseIsoLoose(text)
  if (iso) return iso

  if (/[/.-\s]/.test(text)) {
    const parts = text.split(/[/.-\s]+/).filter(Boolean)
    const separated = parseSeparatedParts(parts, reference)
    if (separated) return separated
  }

  for (const pattern of NAMED_FORMATS) {
    const parsed = parse(text, pattern, reference)
    if (isValid(parsed)) return parsed
  }

  return null
}

export function parseFlexibleTypedDateToIso(raw: string, reference: Date = new Date()): string {
  const parsed = parseFlexibleTypedDate(raw, reference)
  return parsed ? toIso(parsed) : ''
}
