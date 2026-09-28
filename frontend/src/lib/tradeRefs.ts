import type { OrderSide, TradeOrder } from '../data/mockData'

export type RefKind = 'purchase' | 'sale' | 'lift'

/** Which document a ref already names. Bare "24" has no kind. */
export function refKind(ref: string | number | null | undefined): RefKind | null {
  const text = String(ref ?? '').trim()
  const long = text.match(/^(PO|SO|LT)[-#\s]*/i)
  if (long) {
    const prefix = long[1].toUpperCase()
    if (prefix === 'PO') return 'purchase'
    if (prefix === 'SO') return 'sale'
    return 'lift'
  }
  const short = text.match(/^([PSL])(?=\d)/i)
  if (!short) return null
  const prefix = short[1].toUpperCase()
  if (prefix === 'P') return 'purchase'
  if (prefix === 'S') return 'sale'
  return 'lift'
}

/** Strip PO / SO / LT (and legacy P/S/L) prefix for the numeric/token core. */
export function refCore(ref: string | number): string {
  return String(ref)
    .trim()
    .replace(/^(PO|SO|LT)[-#\s]*/i, '')
    .replace(/^[PSL](?=\d)/i, '')
}

/**
 * Read a ref the way the register does: attach PO/SO for this side,
 * but never recast an already-prefixed other document (PO24 stays PO24).
 */
export function attachOrderPrefix(ref: string | number | null | undefined, side: OrderSide): string {
  const core = refCore(ref ?? '')
  if (!core) return ''
  const kind = refKind(ref)
  if (kind === 'purchase') return `PO${core}`
  if (kind === 'sale') return `SO${core}`
  if (kind === 'lift') return `LT${core}`
  return side === 'purchase' ? `PO${core}` : `SO${core}`
}

/**
 * Same order only after prefixes are applied.
 * PO24 ≠ SO24 even when the number is 24. Bare 24 matches PO24 or SO24
 * only when `side` says which document we are reading.
 */
export function refsMatch(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  side?: OrderSide,
): boolean {
  if (side) {
    const left = attachOrderPrefix(a, side)
    const right = attachOrderPrefix(b, side)
    return Boolean(left) && left === right
  }
  const leftKind = refKind(a)
  const rightKind = refKind(b)
  const left = refCore(a ?? '')
  const right = refCore(b ?? '')
  if (!left || !right || left !== right) return false
  if (leftKind && rightKind && leftKind !== rightKind) return false
  return true
}

/** Find a PO or SO by attaching that side's prefix, then comparing. */
export function findTradeOrder(
  orders: TradeOrder[],
  side: OrderSide,
  ref: string | number | null | undefined,
): TradeOrder | undefined {
  if (ref == null || ref === '') return undefined
  return orders.find(o => o.side === side && refsMatch(o.ref, ref, side))
}

export function formatPoRef(ref: string | number): string {
  return attachOrderPrefix(ref, 'purchase')
}

/** Inventory lot for a purchase, shown as LOT-PO1. */
export function formatLotRef(poRef: string | number): string {
  const po = formatPoRef(poRef)
  return po ? `LOT-${po}` : ''
}

export function formatSoRef(ref: string | number): string {
  return attachOrderPrefix(ref, 'sale')
}

export function formatLiftRef(ref: string | number): string {
  const core = refCore(ref)
  return core ? `LT${core}` : ''
}

export function formatOrderRef(ref: string | number, side: OrderSide): string {
  return side === 'purchase' ? formatPoRef(ref) : formatSoRef(ref)
}

/** Format PO or SO ref based on which side it belongs to (when side is known). */
export function formatTradeRef(ref: string | number, kind: 'purchase' | 'sale' | 'lift'): string {
  if (kind === 'purchase') return formatPoRef(ref)
  if (kind === 'sale') return formatSoRef(ref)
  return formatLiftRef(ref)
}

/** Haystack for search: stored value, prefixed label, and bare number. */
export function orderRefSearchText(ref: string | number | null | undefined, side: OrderSide): string {
  const raw = String(ref ?? '').trim()
  if (!raw) return ''
  return [raw, attachOrderPrefix(raw, side), refCore(raw)].join(' ').toLowerCase()
}

export function liftRefSearchText(ref: string | number | null | undefined): string {
  const raw = String(ref ?? '').trim()
  if (!raw) return ''
  return [raw, formatLiftRef(raw), refCore(raw)].join(' ').toLowerCase()
}
