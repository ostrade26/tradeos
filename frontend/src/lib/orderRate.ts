import { formatIndianAmount, parseIndianAmount } from './indianAmount'

/** 1 MT = 100 × 10 KG */
export const TEN_KG_PER_MT = 100

/** Parse contract-style numbers: "1,48,000.00" → 148000 */
export function parseRateNumber(value: string | number | undefined): number {
  return parseIndianAmount(value)
}

export function ratePer10KgFromMt(ratePerMt: number): number {
  if (!Number.isFinite(ratePerMt) || ratePerMt === 0) return 0
  return ratePerMt / TEN_KG_PER_MT
}

export function ratePerMtFrom10Kg(ratePer10Kg: number): number {
  if (!Number.isFinite(ratePer10Kg) || ratePer10Kg === 0) return 0
  return ratePer10Kg * TEN_KG_PER_MT
}

/** Contract rate for forms and CSV — always ₹/10 KG. `order.rate` is stored as ₹/MT. */
export function contractRateFromOrder(rate: number, _rateBasis?: string, _ratePerBasis?: number): number {
  return ratePer10KgFromMt(rate)
}

/** Consistent rate label everywhere: 1,482.00/10 KG */
export function formatContractRate(rate: number, _rateBasis?: string, _ratePerBasis?: number): string {
  const per10 = ratePer10KgFromMt(rate)
  if (!Number.isFinite(per10) || per10 === 0) return '—'
  return `${formatIndianAmount(per10)}/10 KG`
}

/** Table cells — amount only; column header carries the /10 KG unit. */
export function formatRateCell(rate: number, _rateBasis?: string, _ratePerBasis?: number): string {
  const per10 = ratePer10KgFromMt(rate)
  if (!Number.isFinite(per10) || per10 === 0) return '—'
  return formatIndianAmount(per10)
}

/** Spreadsheet registers quote rate per 10 KG — convert for internal ₹/MT storage. */
export function importRateFromSpreadsheet(value: unknown): number {
  const per10 = parseIndianAmount(value as string | number)
  if (!per10) return 0
  return ratePerMtFrom10Kg(per10)
}

export const RATE_COLUMN_HEADER = 'Rate (/10 KG)'
export const PURCHASE_RATE_COLUMN_HEADER = 'Purchase Rate (/10 KG)'
export const SALE_RATE_COLUMN_HEADER = 'Sale Rate (/10 KG)'

/** Qty-weighted average contract rate (₹/10 KG) for a set of orders. */
export function weightedAverageRatePer10Kg(
  orders: { rate: number; rateBasis?: string; ratePerBasis?: number; orderQty: number }[],
): number | null {
  let weightedSum = 0
  let totalQty = 0
  for (const o of orders) {
    if (o.orderQty <= 0) continue
    const per10 = contractRateFromOrder(o.rate, o.rateBasis, o.ratePerBasis)
    if (!per10) continue
    weightedSum += per10 * o.orderQty
    totalQty += o.orderQty
  }
  if (totalQty <= 0) return null
  return weightedSum / totalQty
}

/** Persist the ₹/10 KG rate the user edited. `rate` is stored as ₹/MT. */
export function syncedRateFields(ratePer10Kg: number): {
  rate: number
  ratePerBasis: number | undefined
  rateBasis: string
  contractRateDisplay: string | undefined
} {
  if (!ratePer10Kg) {
    return { rate: 0, ratePerBasis: undefined, rateBasis: 'PER 10 KG', contractRateDisplay: undefined }
  }

  return {
    rate: ratePerMtFrom10Kg(ratePer10Kg),
    ratePerBasis: ratePer10Kg,
    rateBasis: 'PER 10 KG',
    contractRateDisplay: `${formatIndianAmount(ratePer10Kg)} PER 10 KG`,
  }
}

/** Line value: qty in MT × ₹/10 KG × 100 */
export function orderLineAmount(qtyMt: number, ratePer10Kg: number, _rateBasis?: string): number {
  if (!qtyMt || !ratePer10Kg) return 0
  return qtyMt * ratePerMtFrom10Kg(ratePer10Kg)
}

export function rateInputLabel(shortLabel: string, _rateBasis?: string): string {
  return `${shortLabel} Rate (/10 KG)`
}
