const INDIAN_AMOUNT = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const INDIAN_INTEGER = new Intl.NumberFormat('en-IN')

/** Parse "1,12,480.00" → 112480 */
export function parseIndianAmount(value: string | number | undefined | null): number {
  if (value === undefined || value === null || value === '') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const cleaned = String(value).replace(/,/g, '').trim()
  if (!cleaned || cleaned === '.') return 0
  const num = parseFloat(cleaned)
  return Number.isFinite(num) ? num : 0
}

/** Format to Indian grouping with 2 decimals: 1480 → "1,480.00" */
export function formatIndianAmount(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '') return ''
  const num = typeof value === 'number' ? value : parseIndianAmount(value)
  if (!Number.isFinite(num)) return ''
  return INDIAN_AMOUNT.format(num)
}

/** Live formatting while typing — commas + up to 2 decimal places, no forced .00 */
export function formatIndianAmountEditing(raw: string): string | null {
  const cleaned = raw.replace(/,/g, '')
  if (cleaned === '') return ''
  if (!/^\d*(\.\d{0,2})?$/.test(cleaned)) return null

  const dotIndex = cleaned.indexOf('.')
  const intPart = dotIndex === -1 ? cleaned : cleaned.slice(0, dotIndex)
  const decPart = dotIndex === -1 ? '' : cleaned.slice(dotIndex + 1)

  if (!intPart && dotIndex !== -1) {
    return decPart.length > 0 ? `0.${decPart}` : '0.'
  }

  const formattedInt = intPart
    ? INDIAN_INTEGER.format(parseInt(intPart, 10))
    : ''

  if (dotIndex !== -1) {
    return `${formattedInt || '0'}.${decPart}`
  }
  return formattedInt
}

/** Prepare a stored amount for in-field editing (drop trailing .00) */
export function indianAmountForEditing(value: string): string {
  if (!value) return ''
  const withoutDecimals = value.replace(/,/g, '').replace(/\.0+$/, '').replace(/\.$/, '')
  if (!withoutDecimals) return ''
  return formatIndianAmountEditing(withoutDecimals) ?? value
}
