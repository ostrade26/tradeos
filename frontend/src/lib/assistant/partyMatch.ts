import { normalizeCompanyName } from '../companyResolution'

/** Collect every party label seen in trade data for fuzzy lookup */
export function collectPartyNames(sources: {
  companies: { officialName: string; aliases: string[] }[]
  producers: { name: string }[]
  retailers: { name: string }[]
  brokers: { name: string }[]
  tradeOrders: { partyName: string; sellerName?: string; buyerName?: string }[]
  lifts: { buyerName: string; sellerName: string }[]
  lots: { producer: string }[]
}): string[] {
  const seen = new Set<string>()
  const add = (name?: string) => {
    const trimmed = name?.trim()
    if (trimmed) seen.add(trimmed)
  }

  for (const c of sources.companies) {
    add(c.officialName)
    c.aliases.forEach(add)
  }
  sources.producers.forEach(p => add(p.name))
  sources.retailers.forEach(r => add(r.name))
  sources.brokers.forEach(b => add(b.name))
  for (const o of sources.tradeOrders) {
    add(o.partyName)
    add(o.sellerName)
    add(o.buyerName)
  }
  for (const l of sources.lifts) {
    add(l.buyerName)
    add(l.sellerName)
  }
  sources.lots.forEach(l => add(l.producer))

  return [...seen].sort((a, b) => a.localeCompare(b))
}

function scorePartyMatch(query: string, candidate: string): number {
  const q = normalizeCompanyName(query)
  const c = normalizeCompanyName(candidate)
  if (!q || !c) return 0
  if (q === c) return 1
  if (c.includes(q) || q.includes(c)) return 0.85

  const qTokens = q.split(' ').filter(t => t.length > 1)
  const cTokens = new Set(c.split(' ').filter(t => t.length > 1))
  if (qTokens.length === 0) return 0
  const overlap = qTokens.filter(t => cTokens.has(t)).length
  return overlap / qTokens.length
}

export function resolvePartyName(query: string, candidates: string[]): string | null {
  const trimmed = query.trim()
  if (!trimmed) return null

  let best: { name: string; score: number } | null = null
  for (const candidate of candidates) {
    const score = scorePartyMatch(trimmed, candidate)
    if (score >= 0.5 && (!best || score > best.score)) {
      best = { name: candidate, score }
    }
  }
  return best?.name ?? null
}

export function partyMatches(name: string, party: string): boolean {
  const n = normalizeCompanyName(name)
  const p = normalizeCompanyName(party)
  if (!n || !p) return false
  return n === p || n.includes(p) || p.includes(n)
}
