import type { Company, CompanyType } from '../data/mockData'

export type MatchConfidence = 'high' | 'low' | 'none'

export interface CompanyMatch {
  company: Company
  score: number
  matchedVia: 'exact' | 'alias' | 'fuzzy'
}

export interface CompanyResolutionResult {
  extractedName: string
  normalizedName: string
  match: CompanyMatch | null
  confidence: MatchConfidence
  suggestions: CompanyMatch[]
}

export const HIGH_CONFIDENCE_THRESHOLD = 0.92
export const LOW_CONFIDENCE_THRESHOLD = 0.72
/** Show in resolution modal — lower bar so near-matches and PDF variants appear */
export const SUGGESTION_THRESHOLD = 0.45

const LEGAL_SUFFIX_PATTERN = /\b(pvt\.?\s*ltd\.?|private\s+limited|limited|ltd\.?|llp|inc\.?|corp\.?|co\.?\s*ltd\.?)\b/gi

const LOCATION_TAIL_PATTERN = /,\s*[A-Za-z][A-Za-z\s.-]{1,40}$/

/** Strip PDF noise before matching — keep original for audit display */
export function prepareNameForMatching(name: string): string {
  return name
    .replace(/\([^)]*\)/g, ' ')
    .replace(LOCATION_TAIL_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Normalize for matching — not for display */
export function normalizeCompanyName(name: string): string {
  return prepareNameForMatching(name)
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/,/g, ' ')
    .replace(LEGAL_SUFFIX_PATTERN, '')
    .replace(/[^a-z0-9\s&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactKey(name: string): string {
  return normalizeCompanyName(name).replace(/\s/g, '')
}

function tokenSet(name: string): Set<string> {
  return new Set(
    normalizeCompanyName(name)
      .split(' ')
      .filter(t => t.length > 1),
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

function fuzzyScore(extracted: string, candidate: string): number {
  const normA = normalizeCompanyName(extracted)
  const normB = normalizeCompanyName(candidate)
  if (!normA || !normB) return 0

  if (normA === normB) return 0.98

  const compactA = compactKey(extracted)
  const compactB = compactKey(candidate)
  if (compactA === compactB) return 1

  const tokenScore = jaccardSimilarity(extracted, candidate)
  const maxLen = Math.max(compactA.length, compactB.length)
  const editScore = maxLen === 0 ? 0 : 1 - levenshtein(compactA, compactB) / maxLen

  const shorter = compactA.length <= compactB.length ? compactA : compactB
  const longer = compactA.length <= compactB.length ? compactB : compactA
  if (shorter.length >= 4 && longer.includes(shorter)) {
    return Math.max(0.9, tokenScore, editScore)
  }

  if (compactA.includes(compactB) || compactB.includes(compactA)) {
    return Math.max(0.88, tokenScore, editScore)
  }

  return tokenScore * 0.55 + editScore * 0.45
}

function confidenceFromScore(score: number): MatchConfidence {
  if (score >= HIGH_CONFIDENCE_THRESHOLD) return 'high'
  if (score >= LOW_CONFIDENCE_THRESHOLD) return 'low'
  return 'none'
}

function companyMatchesName(company: Company, extractedName: string): CompanyMatch | null {
  const trimmed = prepareNameForMatching(extractedName.trim())
  if (!trimmed) return null

  const normExtracted = normalizeCompanyName(trimmed)
  const compactExtracted = compactKey(trimmed)

  const candidates: { label: string; via: CompanyMatch['matchedVia'] }[] = [
    { label: company.officialName, via: 'exact' },
    ...company.aliases.map(alias => ({ label: alias, via: 'alias' as const })),
  ]

  let best: CompanyMatch | null = null

  for (const { label, via } of candidates) {
    const normLabel = normalizeCompanyName(label)
    const compactLabel = compactKey(label)

    if (normExtracted === normLabel || compactExtracted === compactLabel) {
      return { company, score: 1, matchedVia: via === 'alias' ? 'alias' : 'exact' }
    }

    const score = fuzzyScore(trimmed, label)
    if (!best || score > best.score) {
      best = {
        company,
        score,
        matchedVia: score >= HIGH_CONFIDENCE_THRESHOLD ? via : 'fuzzy',
      }
    }
  }

  return best
}

function dedupeMatches(matches: CompanyMatch[]): CompanyMatch[] {
  const byId = new Map<string, CompanyMatch>()
  for (const match of matches) {
    const existing = byId.get(match.company.id)
    if (!existing || match.score > existing.score) {
      byId.set(match.company.id, match)
    }
  }
  return Array.from(byId.values()).sort((a, b) => b.score - a.score)
}

function resolveFromPool(extractedName: string, pool: Company[]): CompanyMatch[] {
  const matches: CompanyMatch[] = []
  for (const company of pool) {
    const match = companyMatchesName(company, extractedName)
    if (match && match.score >= SUGGESTION_THRESHOLD) {
      matches.push(match)
    }
  }
  return dedupeMatches(matches)
}

export function resolveCompany(
  extractedName: string,
  companies: Company[],
  role?: CompanyType,
): CompanyResolutionResult {
  const trimmed = extractedName.trim()
  const normalizedName = normalizeCompanyName(trimmed)

  if (!trimmed) {
    return { extractedName: '', normalizedName: '', match: null, confidence: 'none', suggestions: [] }
  }

  const rolePool = role
    ? companies.filter(c => c.types.includes(role) || c.types.includes('both'))
    : companies

  let matches = resolveFromPool(trimmed, rolePool)

  // If role-filtered pool has no suggestions, search all companies (e.g. type not set yet)
  if (matches.length === 0 && role) {
    matches = resolveFromPool(trimmed, companies)
  }

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

export function needsResolution(...results: CompanyResolutionResult[]): boolean {
  return results.some(r => r.extractedName && r.confidence !== 'high')
}

export function formatMatchScore(score: number): string {
  return `${Math.round(score * 100)}%`
}
