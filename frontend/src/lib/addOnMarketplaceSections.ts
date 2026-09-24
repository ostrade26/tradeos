import type { OrgFeatureOffer } from '../api/organisationApi'

/** Days since list date to appear under Just launched / New sort. */
export const ADDON_JUST_LAUNCHED_DAYS = 45

/** Cap for Most requested / Popular tiles in curated view. */
export const ADDON_MOST_REQUESTED_LIMIT = 8

/**
 * When true, curated browse splits into Featured / Most requested / Just launched / More.
 * Kept false for now — section logic below stays for a later rollout.
 */
export const ADDON_CURATED_CATEGORY_SECTIONS_ENABLED = false

export type AddOnMarketplaceSectionId =
  | 'yours'
  | 'featured'
  | 'most_requested'
  | 'just_launched'
  | 'more'
  | 'browse'

export type AddOnBrowseSort = 'curated' | 'popular' | 'new' | 'featured' | 'all'

export type AddOnPricingFilter = 'all' | 'free' | 'paid'

export type AddOnMarketplaceSection = {
  id: AddOnMarketplaceSectionId
  title: string
  subtitle: string
  offers: OrgFeatureOffer[]
  /** Featured hero sizing only in the Featured section. */
  allowFeaturedLayout: boolean
}

export const ADDON_SORT_OPTIONS: { id: AddOnBrowseSort; label: string }[] = [
  { id: 'curated', label: 'For you' },
  { id: 'popular', label: 'Popular' },
  { id: 'new', label: 'New' },
  { id: 'featured', label: 'Featured' },
  { id: 'all', label: 'All' },
]

export const ADDON_PRICING_OPTIONS: { id: AddOnPricingFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'free', label: 'Free' },
  { id: 'paid', label: 'Paid' },
]

function parseListedAt(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : null
}

function isJustLaunched(offer: OrgFeatureOffer, nowMs: number): boolean {
  const listed = parseListedAt(offer.listed_at)
  if (listed == null) return false
  const windowMs = ADDON_JUST_LAUNCHED_DAYS * 24 * 60 * 60 * 1000
  return nowMs - listed <= windowMs
}

function popularity(offer: OrgFeatureOffer): number {
  return Number(offer.request_count ?? 0)
}

function matchesQuery(offer: OrgFeatureOffer, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const blob = `${offer.title} ${offer.description} ${offer.feature_key}`.toLowerCase()
  return blob.includes(q)
}

function matchesPricing(offer: OrgFeatureOffer, pricing: AddOnPricingFilter): boolean {
  if (pricing === 'all') return true
  if (pricing === 'free') return offer.pricing_type === 'free'
  return offer.pricing_type === 'paid' || offer.pricing_type === 'contact'
}

/** Owned / pending for this organisation. */
export function yoursAddOns(offers: OrgFeatureOffer[]): OrgFeatureOffer[] {
  return offers
    .filter(o => o.entitlement_status === 'active' || o.entitlement_status === 'pending')
    .sort((a, b) => {
      if (a.entitlement_status === b.entitlement_status) return a.title.localeCompare(b.title)
      return a.entitlement_status === 'active' ? -1 : 1
    })
}

/** Catalog not yet owned (available to enable / request). */
export function browseAddOns(offers: OrgFeatureOffer[]): OrgFeatureOffer[] {
  return offers.filter(
    o => o.entitlement_status !== 'active' && o.entitlement_status !== 'pending',
  )
}

export function filterAddOnOffers(
  offers: OrgFeatureOffer[],
  opts: { query: string; pricing: AddOnPricingFilter },
): OrgFeatureOffer[] {
  return offers.filter(o => matchesQuery(o, opts.query) && matchesPricing(o, opts.pricing))
}

function curatedBrowseSections(
  browse: OrgFeatureOffer[],
  nowMs: number,
): AddOnMarketplaceSection[] {
  const featured = browse.filter(o => Boolean(o.card_featured))
  const featuredKeys = new Set(featured.map(o => o.feature_key))
  const remainingAfterFeatured = browse.filter(o => !featuredKeys.has(o.feature_key))

  // Skip Most requested / Just launched section headers until we turn this on.
  if (!ADDON_CURATED_CATEGORY_SECTIONS_ENABLED) {
    if (featured.length === 0) {
      return flatBrowseSection(
        'browse',
        'Add-ons',
        'Available to enable or request',
        remainingAfterFeatured,
      )
    }
    return [
      {
        id: 'featured' as const,
        title: 'Featured',
        subtitle: 'Highlighted by Tradeal',
        offers: featured,
        allowFeaturedLayout: true,
      },
      {
        id: 'more' as const,
        title: 'More add-ons',
        subtitle: 'Everything else available to enable or request',
        offers: remainingAfterFeatured,
        allowFeaturedLayout: false,
      },
    ].filter(s => s.offers.length > 0)
  }

  const mostRequested = [...remainingAfterFeatured]
    .filter(o => popularity(o) > 0)
    .sort((a, b) => popularity(b) - popularity(a) || a.title.localeCompare(b.title))
    .slice(0, ADDON_MOST_REQUESTED_LIMIT)
  const mostKeys = new Set(mostRequested.map(o => o.feature_key))

  const remainingAfterPopular = remainingAfterFeatured.filter(o => !mostKeys.has(o.feature_key))

  const justLaunched = remainingAfterPopular
    .filter(o => isJustLaunched(o, nowMs))
    .sort((a, b) => (parseListedAt(b.listed_at) ?? 0) - (parseListedAt(a.listed_at) ?? 0))

  const justKeys = new Set(justLaunched.map(o => o.feature_key))
  const more = remainingAfterPopular.filter(o => !justKeys.has(o.feature_key))

  return [
    {
      id: 'featured' as const,
      title: 'Featured',
      subtitle: 'Highlighted by Tradeal',
      offers: featured,
      allowFeaturedLayout: true,
    },
    {
      id: 'most_requested' as const,
      title: 'Most requested',
      subtitle: 'Popular with other organisations',
      offers: mostRequested,
      allowFeaturedLayout: false,
    },
    {
      id: 'just_launched' as const,
      title: 'Just launched',
      subtitle: 'Newly listed on the catalog',
      offers: justLaunched,
      allowFeaturedLayout: false,
    },
    {
      id: 'more' as const,
      title: 'More add-ons',
      subtitle: 'Everything else available to enable or request',
      offers: more,
      allowFeaturedLayout: false,
    },
  ].filter(s => s.offers.length > 0)
}

function flatBrowseSection(
  id: AddOnMarketplaceSectionId,
  title: string,
  subtitle: string,
  offers: OrgFeatureOffer[],
  allowFeaturedLayout = false,
): AddOnMarketplaceSection[] {
  if (offers.length === 0) return []
  return [{ id, title, subtitle, offers, allowFeaturedLayout }]
}

/**
 * Browse catalog view (excludes Your add-ons).
 * - curated: Sketch-style sections
 * - popular / new / featured / all: Framer-style single ranked grid
 * Search or pricing filter always collapses to a flat “results” grid with count.
 */
export function buildAddOnBrowseSections(
  browse: OrgFeatureOffer[],
  opts: {
    sort: AddOnBrowseSort
    query: string
    pricing: AddOnPricingFilter
    nowMs?: number
  },
): { sections: AddOnMarketplaceSection[]; resultCount: number; isFiltered: boolean } {
  const { sort, query, pricing, nowMs = Date.now() } = opts
  const filtered = filterAddOnOffers(browse, { query, pricing })
  const isFiltered = Boolean(query.trim()) || pricing !== 'all'
  const n = filtered.length
  const countLabel = n === 1 ? '1 add-on' : `${n} add-ons`

  if (isFiltered) {
    const sorted = [...filtered].sort((a, b) => {
      if (sort === 'popular') return popularity(b) - popularity(a) || a.title.localeCompare(b.title)
      if (sort === 'new')
        return (parseListedAt(b.listed_at) ?? 0) - (parseListedAt(a.listed_at) ?? 0)
      if (sort === 'featured') {
        const af = a.card_featured ? 1 : 0
        const bf = b.card_featured ? 1 : 0
        return bf - af || a.title.localeCompare(b.title)
      }
      return a.title.localeCompare(b.title)
    })
    return {
      resultCount: n,
      isFiltered: true,
      sections: flatBrowseSection(
        'browse',
        'Results',
        countLabel,
        sorted,
        sort === 'featured',
      ),
    }
  }

  if (sort === 'curated') {
    const sections = curatedBrowseSections(filtered, nowMs)
    return {
      resultCount: filtered.length,
      isFiltered: false,
      sections,
    }
  }

  if (sort === 'popular') {
    const offers = [...filtered].sort(
      (a, b) => popularity(b) - popularity(a) || a.title.localeCompare(b.title),
    )
    return {
      resultCount: n,
      isFiltered: false,
      sections: flatBrowseSection(
        'most_requested',
        'Popular',
        'Most requested across organisations',
        offers,
      ),
    }
  }

  if (sort === 'new') {
    const offers = [...filtered]
      .filter(o => parseListedAt(o.listed_at) != null)
      .sort((a, b) => (parseListedAt(b.listed_at) ?? 0) - (parseListedAt(a.listed_at) ?? 0))
    return {
      resultCount: offers.length,
      isFiltered: false,
      sections: flatBrowseSection(
        'just_launched',
        'New',
        'Recently listed on the catalog',
        offers.length > 0 ? offers : [...filtered].sort((a, b) => a.title.localeCompare(b.title)),
      ),
    }
  }

  if (sort === 'featured') {
    const offers = filtered.filter(o => Boolean(o.card_featured))
    return {
      resultCount: offers.length,
      isFiltered: false,
      sections: flatBrowseSection(
        'featured',
        'Featured',
        'Highlighted by Tradeal',
        offers,
        true,
      ),
    }
  }

  // all
  const offers = [...filtered].sort((a, b) => a.title.localeCompare(b.title))
  return {
    resultCount: n,
    isFiltered: false,
    sections: flatBrowseSection('browse', 'All add-ons', countLabel, offers),
  }
}

/** Filter + sort for the Your add-ons tab (flat grid, no curated sections). */
export function buildYoursAddOnList(
  yours: OrgFeatureOffer[],
  opts: { sort: AddOnBrowseSort; query: string; pricing: AddOnPricingFilter },
): OrgFeatureOffer[] {
  const filtered = filterAddOnOffers(yours, { query: opts.query, pricing: opts.pricing })
  const { sort } = opts

  if (sort === 'popular') {
    return [...filtered].sort(
      (a, b) => popularity(b) - popularity(a) || a.title.localeCompare(b.title),
    )
  }
  if (sort === 'new') {
    return [...filtered].sort(
      (a, b) => (parseListedAt(b.listed_at) ?? 0) - (parseListedAt(a.listed_at) ?? 0),
    )
  }
  if (sort === 'featured') {
    return [...filtered].sort((a, b) => {
      const af = a.card_featured ? 1 : 0
      const bf = b.card_featured ? 1 : 0
      return bf - af || a.title.localeCompare(b.title)
    })
  }
  if (sort === 'all') {
    return [...filtered].sort((a, b) => a.title.localeCompare(b.title))
  }
  // curated / default — active first, then title (same as yoursAddOns)
  return [...filtered].sort((a, b) => {
    if (a.entitlement_status === b.entitlement_status) return a.title.localeCompare(b.title)
    return a.entitlement_status === 'active' ? -1 : 1
  })
}

/** @deprecated Prefer buildAddOnBrowseSections + yoursAddOns */
export function partitionAddOnMarketplace(
  offers: OrgFeatureOffer[],
  nowMs: number = Date.now(),
): AddOnMarketplaceSection[] {
  const yours = yoursAddOns(offers)
  const browse = browseAddOns(offers)
  const { sections } = buildAddOnBrowseSections(browse, {
    sort: 'curated',
    query: '',
    pricing: 'all',
    nowMs,
  })
  const yoursSection: AddOnMarketplaceSection | null =
    yours.length > 0
      ? {
          id: 'yours',
          title: 'Your add-ons',
          subtitle: 'Active and pending for this organisation',
          offers: yours,
          allowFeaturedLayout: false,
        }
      : null
  return yoursSection ? [yoursSection, ...sections] : sections
}
