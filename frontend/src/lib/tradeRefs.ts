import type { OrderSide } from '../data/mockData'

/** Strip PO / SO / LT (and legacy P/S/L) prefix for storage and URL lookup. */
export function refCore(ref: string | number): string {
  return String(ref)
    .trim()
    .replace(/^(PO|SO|LT)[-#\s]*/i, '')
    .replace(/^[PSL](?=\d)/i, '')
}

export function formatPoRef(ref: string | number): string {
  const core = refCore(ref)
  return core ? `PO${core}` : ''
}

export function formatSoRef(ref: string | number): string {
  const core = refCore(ref)
  return core ? `SO${core}` : ''
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
