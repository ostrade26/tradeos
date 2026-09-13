export type ItemMatchConfidence = 'high' | 'low' | 'none'

export interface ItemMatch {
  name: string
  score: number
  matchedVia: 'exact' | 'alias' | 'fuzzy'
}

export interface ItemResolutionResult {
  extractedName: string
  normalizedName: string
  match: ItemMatch | null
  confidence: ItemMatchConfidence
  suggestions: ItemMatch[]
}

export const ITEM_HIGH_CONFIDENCE_THRESHOLD = 0.85
export const ITEM_LOW_CONFIDENCE_THRESHOLD = 0.68
export const ITEM_SUGGESTION_THRESHOLD = 0.55

const ITEM_ALIASES: Record<string, string> = {
  soyabeen: 'soybean',
  soya: 'soybean',
  'soya bean': 'soybean',
  soyabean: 'soybean',
  palmolein: 'palm olein',
  'palm olein': 'palm olein',
  'rbd palmolein': 'rbd palmolein',
  sunfloweroil: 'sunflower oil',
  coconutoil: 'coconut oil',
  ricebranoil: 'rice bran oil',
}

const ITEM_STOP_WORDS = new Set([
  'rbd', 'refined', 'extra', 'virgin', 'crude', 'grade', 'oil', 'olein', 'fat', 'fats',
])

/** Normalize for matching — not for display */
export function normalizeItemName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactItemKey(name: string): string {
  return normalizeItemName(name)
    .split(' ')
    .filter(token => token.length > 0 && !ITEM_STOP_WORDS.has(token))
    .join('')
}

function applyItemAlias(name: string): string {
  const normalized = normalizeItemName(name)
  if (ITEM_ALIASES[normalized]) return ITEM_ALIASES[normalized]
  const compact = compactItemKey(name)
  return ITEM_ALIASES[compact] ?? normalized
}

function tokenSet(name: string): Set<string> {
  return new Set(
    applyItemAlias(name)
      .split(' ')
      .filter(token => token.length > 1 && !ITEM_STOP_WORDS.has(token)),
  )
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenSet(a)
  const setB = tokenSet(b)
  if (setA.size === 0 && setB.size === 0) return 1
  if (setA.size === 0 || setB.size === 0) return 0
  let intersection = 0
  for (const token of setA) {
    if (setB.has(token)) intersection++
  }
  return intersection / (setA.size + setB.size - intersection)
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = i
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1]
        ? row[j - 1]
        : Math.min(row[j] + 1, row[j - 1] + 1, prev + 1)
      row[j - 1] = prev
      prev = val
    }
    row[b.length] = prev
  }
  return row[b.length]
}

function itemFuzzyScore(extracted: string, candidate: string): number {
  const normA = normalizeItemName(extracted)
  const normB = normalizeItemName(candidate)
  if (!normA || !normB) return 0
  if (normA === normB) return 1

  const aliasA = applyItemAlias(extracted)
  const aliasB = applyItemAlias(candidate)
  if (aliasA === aliasB) return 0.98

  const compactA = compactItemKey(aliasA)
  const compactB = compactItemKey(aliasB)
  if (compactA === compactB) return 0.98

  const tokenScore = jaccardSimilarity(extracted, candidate)
  const maxLen = Math.max(compactA.length, compactB.length)
  const editScore = maxLen === 0 ? 0 : 1 - levenshtein(compactA, compactB) / maxLen

  const shorter = compactA.length <= compactB.length ? compactA : compactB
  const longer = compactA.length <= compactB.length ? compactB : compactA
  if (shorter.length >= 4 && longer.includes(shorter)) {
    return Math.max(0.92, tokenScore, editScore)
  }

  if (compactA.includes(compactB) || compactB.includes(compactA)) {
    return Math.max(0.88, tokenScore, editScore)
  }

  return tokenScore * 0.5 + editScore * 0.5
}

function confidenceFromScore(score: number): ItemMatchConfidence {
  if (score >= ITEM_HIGH_CONFIDENCE_THRESHOLD) return 'high'
  if (score >= ITEM_LOW_CONFIDENCE_THRESHOLD) return 'low'
  return 'none'
}

export function collectItemNames(sources: {
  items: string[]
  tradeOrders?: { itemName: string }[]
  lots?: { commodity: string }[]
}): string[] {
  const seen = new Set<string>()
  const add = (name?: string) => {
    const trimmed = name?.trim()
    if (trimmed) seen.add(trimmed)
  }

  sources.items.forEach(add)
  sources.tradeOrders?.forEach(order => add(order.itemName))
  sources.lots?.forEach(lot => add(lot.commodity))

  return [...seen].sort((a, b) => a.localeCompare(b))
}

export function itemMatches(name: string, candidate: string): boolean {
  const left = normalizeItemName(name)
  const right = normalizeItemName(candidate)
  if (!left || !right) return false
  if (left === right) return true
  return compactItemKey(left) === compactItemKey(right)
}

export function resolveItemName(extractedName: string, candidates: string[]): ItemResolutionResult {
  const trimmed = extractedName.trim()
  const normalizedName = normalizeItemName(trimmed)

  if (!trimmed) {
    return { extractedName: '', normalizedName: '', match: null, confidence: 'none', suggestions: [] }
  }

  const exact = candidates.find(candidate => itemMatches(trimmed, candidate))
  if (exact) {
    return {
      extractedName: trimmed,
      normalizedName,
      match: { name: exact, score: 1, matchedVia: 'exact' },
      confidence: 'high',
      suggestions: [{ name: exact, score: 1, matchedVia: 'exact' }],
    }
  }

  const matches: ItemMatch[] = []
  for (const candidate of candidates) {
    const score = itemFuzzyScore(trimmed, candidate)
    if (score >= ITEM_SUGGESTION_THRESHOLD) {
      matches.push({
        name: candidate,
        score,
        matchedVia: score >= ITEM_HIGH_CONFIDENCE_THRESHOLD ? 'alias' : 'fuzzy',
      })
    }
  }

  matches.sort((a, b) => b.score - a.score)
  const top = matches[0] ?? null
  const confidence = top ? confidenceFromScore(top.score) : 'none'

  return {
    extractedName: trimmed,
    normalizedName,
    match: confidence === 'none' ? null : top,
    confidence,
    suggestions: matches.slice(0, 5),
  }
}

/** Pick the canonical catalog name when a close match exists; otherwise keep the input. */
export function canonicalItemName(extractedName: string, candidates: string[]): string {
  const trimmed = extractedName.trim()
  if (!trimmed) return trimmed

  const exact = candidates.find(candidate => itemMatches(trimmed, candidate))
  if (exact) return exact

  const resolved = resolveItemName(trimmed, candidates)
  if (resolved.confidence === 'high' && resolved.match) {
    return resolved.match.name
  }

  return trimmed
}
