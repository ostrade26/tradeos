/** Save-time guards for PO/SO entry fields (smoke-test junk rejection). */

export const MAX_RATE_PER_10_KG = 100_000
export const MAX_ORDER_QTY_MT = 10_000

const ORDER_REF_RE = /^(PO|SO)-[A-Za-z0-9]{1,16}$/
const BROKER_CONTRACT_RE = /^[A-Za-z0-9][A-Za-z0-9 ./\-]{0,39}$/
const SPOT_RE = /^[A-Za-z0-9][A-Za-z0-9 ,.\-]{0,59}$/

export function validateOrderRef(ref: string, side: 'purchase' | 'sale'): string | null {
  const trimmed = ref.trim()
  if (!trimmed) {
    return side === 'purchase' ? 'Enter a PO reference' : 'Enter an SO reference'
  }
  const expected = side === 'purchase' ? 'PO' : 'SO'
  if (!ORDER_REF_RE.test(trimmed) || !trimmed.toUpperCase().startsWith(`${expected}-`)) {
    return `Use a short code like ${expected}-12 (letters and numbers only, no spaces).`
  }
  return null
}

export function validateBrokerContractRef(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!BROKER_CONTRACT_RE.test(trimmed)) {
    return 'Broker contract # can only use letters, numbers, spaces, and . / -'
  }
  return null
}

export function validateSpot(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!SPOT_RE.test(trimmed)) {
    return 'Spot can only use letters, numbers, spaces, and , . -'
  }
  return null
}

export function validateOrderQuantity(qty: number): string | null {
  if (!Number.isFinite(qty) || qty <= 0) return 'Enter a valid quantity'
  if (qty > MAX_ORDER_QTY_MT) {
    return `Quantity can’t be more than ${MAX_ORDER_QTY_MT.toLocaleString('en-IN')} MT`
  }
  return null
}

/** `ratePer10Kg` is the value shown on the form (₹/10 KG). */
export function validateOrderRatePer10Kg(ratePer10Kg: number): string | null {
  if (!Number.isFinite(ratePer10Kg) || ratePer10Kg <= 0) return 'Enter a valid rate'
  if (ratePer10Kg > MAX_RATE_PER_10_KG) {
    return 'That rate looks too high — check the amount and try again.'
  }
  return null
}

export function validateTaxRate(tax: number): string | null {
  if (!Number.isFinite(tax)) return 'Enter a valid tax rate'
  if (tax < 0 || tax > 100) return 'Tax rate must be between 0 and 100'
  return null
}
