import type { TradeStoreValue } from '../../store/TradeStore'
import { collectItemNames, resolveItemName } from '../itemResolution'
import { collectPartyNames, resolvePartyName } from './partyMatch'
import type { AssistantResult } from './types'

export type CreateKind = 'po' | 'so' | 'lift'

export type CreateDraft = {
  kind: CreateKind
  party?: string
  item?: string
  qty?: string
  rate?: string
  poRef?: string
  soRef?: string
  stock?: boolean
}

const CREATE_VERB = /\b(create|new|add|record|make|start|book)\b/i

function extractQty(text: string): string | undefined {
  const withUnit = text.match(/\b(\d+(?:\.\d+)?)\s*(?:mt|m\.t\.|metric tons?|tonnes?|tons?)\b/i)
  if (withUnit) return withUnit[1]
  return undefined
}

function extractRate(text: string): string | undefined {
  const m = text.match(/(?:at|@|rate)\s*(?:of\s+)?(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?)/i)
  return m?.[1]?.replace(/,/g, '')
}

function extractPoRef(text: string): string | undefined {
  const m = text.match(/\bpo[-\s]?(\d+)\b/i)
  return m ? `PO-${m[1]}` : undefined
}

function extractSoRef(text: string): string | undefined {
  const m = text.match(/\bso[-\s]?(\d+)\b/i)
  return m ? `SO-${m[1]}` : undefined
}

function findLongestName(query: string, candidates: string[]): string | null {
  const q = query.toLowerCase()
  let best: string | null = null
  for (const candidate of candidates) {
    const name = candidate.trim()
    if (name.length < 3) continue
    if (!q.includes(name.toLowerCase())) continue
    if (!best || name.length > best.length) best = name
  }
  return best
}

function detectKind(q: string): CreateKind | null {
  if (/\b(sales order|sale order|\bsos?\b)\b/.test(q)) return 'so'
  if (/\b(purchase order|\bpos?\b)\b/.test(q)) return 'po'
  if (/\blift\b/.test(q)) return 'lift'
  return null
}

export function parseCreateCommand(raw: string, store: TradeStoreValue): CreateDraft | null {
  const text = raw.trim()
  if (!text || !CREATE_VERB.test(text)) return null

  const q = text.toLowerCase()
  const kind = detectKind(q)
  if (!kind) return null

  const parties = collectPartyNames(store)
  const items = collectItemNames({
    items: store.items,
    tradeOrders: store.tradeOrders,
    lots: store.lots,
  })

  const itemInQuery = findLongestName(text, items)
  const itemResolved = itemInQuery
    ? resolveItemName(itemInQuery, items).match?.name ?? itemInQuery
    : undefined

  const partyInQuery = findLongestName(text, parties)
  const party = partyInQuery
    ? resolvePartyName(partyInQuery, parties) ?? partyInQuery
    : undefined

  const stock = kind === 'lift' && /\b(own stock|stock lift|into stock|to stock)\b/.test(q)

  return {
    kind,
    party,
    item: itemResolved,
    qty: extractQty(text),
    rate: extractRate(text),
    poRef: extractPoRef(text),
    soRef: extractSoRef(text),
    stock,
  }
}

export function createCommandPath(draft: CreateDraft): string {
  const params = new URLSearchParams()
  if (draft.party) params.set(draft.kind === 'so' ? 'buyer' : 'party', draft.party)
  if (draft.item) params.set('item', draft.item)
  if (draft.qty) params.set('qty', draft.qty)
  if (draft.rate) params.set('rate', draft.rate)
  if (draft.poRef) params.set('poRef', draft.poRef)
  if (draft.soRef) params.set('soRef', draft.soRef)
  if (draft.stock) params.set('stock', '1')
  const query = params.toString()

  if (draft.kind === 'po') return query ? `/purchase-orders/new?${query}` : '/purchase-orders/new'
  if (draft.kind === 'so') return query ? `/sales-orders/new?${query}` : '/sales-orders/new'
  return query ? `/lifts/new?${query}` : '/lifts/new'
}

function kindLabel(kind: CreateKind, stock?: boolean) {
  if (kind === 'po') return 'purchase order'
  if (kind === 'so') return 'sales order'
  return stock ? 'stock lift' : 'lift'
}

export function createCommandResult(draft: CreateDraft): AssistantResult {
  const path = createCommandPath(draft)
  const label = kindLabel(draft.kind, draft.stock)
  const bits = [
    draft.party && `party **${draft.party}**`,
    draft.item && `item **${draft.item}**`,
    draft.qty && `qty **${draft.qty} MT**`,
    draft.rate && `rate **${draft.rate}**`,
    draft.poRef && `**${draft.poRef}**`,
    draft.soRef && `**${draft.soRef}**`,
  ].filter(Boolean)

  const detail = bits.length > 0
    ? `I filled in ${bits.join(', ')}. Review and save when it looks right.`
    : 'Opening a blank form — add the details and save.'

  const cta = draft.kind === 'po' ? 'New PO' : draft.kind === 'so' ? 'New SO' : 'Record lift'

  return {
    message: [
      `Opening a new **${label}**.`,
      detail,
    ].join('\n'),
    actions: [{ label: cta, path }],
    navigateTo: path,
  }
}
