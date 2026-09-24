import type { OrgFeatureOffer } from '../api/organisationApi'

export type AddOnMarketplaceStats = {
  /** Organisations with this add-on enabled. */
  enabledCount: number
  /** Stable 0–5 display rating for marketplace cards (null when brand-new). */
  rating: number | null
  /** Proxy review/interest volume shown beside stars. */
  ratingCount: number
}

/**
 * Marketplace social proof from API adoption fields.
 * Not a real review system — used for Envato-style card chrome until ratings exist.
 */
export function addOnMarketplaceStats(offer: OrgFeatureOffer): AddOnMarketplaceStats {
  const enabledCount = Math.max(0, Number(offer.active_orgs ?? 0))
  const interest = Math.max(0, Number(offer.interest_count ?? 0))
  const ratingCount = interest + enabledCount

  if (ratingCount === 0) {
    return { enabledCount, rating: null, ratingCount: 0 }
  }

  // 3.8–5.0 from adoption volume — stable for a given count.
  const rating = Math.min(5, Math.round((3.8 + Math.min(1.2, ratingCount * 0.08)) * 10) / 10)
  return { enabledCount, rating, ratingCount }
}

export function formatEnabledCount(n: number): string {
  if (n <= 0) return 'No organisations yet'
  if (n === 1) return '1 organisation'
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k organisations`
  return `${n.toLocaleString('en-IN')} organisations`
}

export function formatSalesLabel(n: number): string {
  return formatAdoptionLabel(n)
}

/** Adoption line under price on marketplace cards. */
export function formatAdoptionLabel(n: number): string {
  if (n <= 0) return 'Be the first to enable'
  if (n === 1) return 'Used by 1 organisation'
  if (n >= 1000) {
    const k = `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
    return `Used by ${k} organisations`
  }
  return `Used by ${n.toLocaleString('en-IN')} organisations`
}

export function addOnDetailPath(featureKey: string): string {
  return `/addons/${encodeURIComponent(featureKey)}`
}

/** Must stay in sync with `ADDON_MARKETPLACE_GRID` column breakpoints. */
function browseGridColumnCount(viewportWidth: number): number {
  if (viewportWidth >= 1536) return 5
  if (viewportWidth >= 1024) return 4
  if (viewportWidth >= 640) return 3
  return 2
}

const BROWSE_GRID_GAP_PX = 32 // gap-8 — keep in sync with ADDON_MARKETPLACE_GRID
/** Fallback when `#main-content` is missing: sidebar `lg:w-60` + main `p-6` × 2. */
const ORG_SHELL_CHROME_PX = 240 + 48

function browseGridContentWidthPx(): number {
  if (typeof document === 'undefined') {
    return Math.max(320, 1280 - ORG_SHELL_CHROME_PX)
  }
  const main = document.getElementById('main-content')
  if (main) {
    const style = getComputedStyle(main)
    const pl = parseFloat(style.paddingLeft) || 0
    const pr = parseFloat(style.paddingRight) || 0
    return Math.max(320, main.clientWidth - pl - pr)
  }
  return Math.max(320, window.innerWidth - ORG_SHELL_CHROME_PX)
}

/**
 * Pixel width of one Browse add-on card — same grid math as org Add-ons
 * (`ADDON_MARKETPLACE_GRID` + `#main-content` content box).
 * Height is content-driven (square image + details).
 */
export function browseMarketplaceCardSizePx(
  viewportWidth: number = typeof window !== 'undefined' ? window.innerWidth : 1280,
): { width: number; height: number } {
  const cols = browseGridColumnCount(viewportWidth)
  const content = browseGridContentWidthPx()
  const width = Math.max(140, Math.floor((content - BROWSE_GRID_GAP_PX * (cols - 1)) / cols))
  // Approximate: 4/3 image + typical details block (preview locks width only).
  const height = Math.round(width * (3 / 4) + 140)
  return { width, height }
}

/** @deprecated Prefer `browseMarketplaceCardSizePx` */
export function browseMarketplaceCardWidthPx(
  viewportWidth?: number,
): number {
  return browseMarketplaceCardSizePx(viewportWidth).width
}
