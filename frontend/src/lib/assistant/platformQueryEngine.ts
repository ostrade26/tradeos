import type {
  OrganisationLicence,
  OrganisationSeat,
  PlatformOrganisation,
  SeatRequest,
} from '../../api/platformApi'
import { platformApi } from '../../api/platformApi'
import type { AssistantResult } from './types'

export type PlatformAssistantSnapshot = {
  organisations: PlatformOrganisation[]
  seats: OrganisationSeat[]
  seatRequests: SeatRequest[]
  licenses: OrganisationLicence[]
}

let cache: { at: number; data: PlatformAssistantSnapshot } | null = null
const CACHE_MS = 60_000

export async function loadPlatformAssistantSnapshot(force = false): Promise<PlatformAssistantSnapshot> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.data

  const [orgsRes, seatsRes, requestsRes, licensesRes] = await Promise.all([
    platformApi.listOrganisations().catch(() => ({ organisations: [] as PlatformOrganisation[] })),
    platformApi.listSeats().catch(() => ({ seats: [] as OrganisationSeat[] })),
    platformApi.listSeatRequests().catch(() => ({ requests: [] as SeatRequest[] })),
    platformApi.listLicenses().catch(() => ({ licenses: [] as OrganisationLicence[] })),
  ])

  const pendingRequests = (requestsRes.requests ?? []).filter(
    r => r.status === 'pending_payment' || r.status === 'paid',
  )

  const data: PlatformAssistantSnapshot = {
    organisations: orgsRes.organisations ?? [],
    seats: seatsRes.seats ?? [],
    seatRequests: pendingRequests,
    licenses: licensesRes.licenses ?? [],
  }
  cache = { at: Date.now(), data }
  return data
}

function enc(value: string) {
  return encodeURIComponent(value)
}

function matchOrg(snapshot: PlatformAssistantSnapshot, hint: string): PlatformOrganisation | null {
  const q = hint.trim().toLowerCase()
  if (!q) return null
  const exact = snapshot.organisations.find(
    o => o.name.toLowerCase() === q || (o.org_code && o.org_code.toLowerCase() === q),
  )
  if (exact) return exact
  const partial = snapshot.organisations.filter(
    o =>
      o.name.toLowerCase().includes(q) ||
      (o.org_code && o.org_code.toLowerCase().includes(q)) ||
      (o.legal_name && o.legal_name.toLowerCase().includes(q)),
  )
  return partial.length === 1 ? partial[0]! : null
}

function extractOrgHint(raw: string): string | null {
  const patterns = [
    /(?:org(?:anisation|anization)?|customer|company)\s+(?:named\s+|called\s+)?(.+)$/i,
    /(?:find|show|open|go to)\s+(.+)$/i,
    /^(.+?)\s+org(?:anisation|anization)?$/i,
  ]
  for (const re of patterns) {
    const m = raw.trim().match(re)
    if (m?.[1]) {
      const hint = m[1].trim().replace(/\?+$/, '')
      if (hint && !/^(how many|what|all|the|my)$/i.test(hint)) return hint
    }
  }
  return null
}

function summaryResult(snapshot: PlatformAssistantSnapshot): AssistantResult {
  const live = snapshot.organisations.filter(o => !o.is_test)
  const test = snapshot.organisations.filter(o => o.is_test)
  const activeLicences = snapshot.licenses.filter(l => l.status === 'active')
  const suspended = snapshot.licenses.filter(l => l.status === 'suspended')
  const pendingSeats = snapshot.seatRequests.length

  return {
    message: [
      '**Platform summary**',
      `- **${live.length}** live organisation${live.length === 1 ? '' : 's'}` +
        (test.length ? ` · **${test.length}** test` : ''),
      `- **${snapshot.seats.length}** seat${snapshot.seats.length === 1 ? '' : 's'} assigned`,
      `- **${activeLicences.length}** active licence${activeLicences.length === 1 ? '' : 's'}` +
        (suspended.length ? ` · **${suspended.length}** suspended` : ''),
      `- **${pendingSeats}** open seat request${pendingSeats === 1 ? '' : 's'}`,
    ].join('\n'),
    actions: [
      { label: 'Organisations', path: '/platform-admin/organisations', count: live.length },
      { label: 'Seat requests', path: '/platform-admin/seat-requests', count: pendingSeats },
      { label: 'Licences', path: '/platform-admin/licenses', count: activeLicences.length },
    ],
  }
}

function orgResult(org: PlatformOrganisation): AssistantResult {
  const seats = org.seats
  const seatLine = seats
    ? `${seats.active_assigned_seats}/${seats.total_entitled_seats} seats used`
    : 'Seats not loaded'
  return {
    message: [
      `**${org.name}**`,
      org.org_code ? `- Code: \`${org.org_code}\`` : null,
      `- Status: **${org.status}** · ${org.account_type.replace(/_/g, ' ')}`,
      org.plan_name ? `- Plan: **${org.plan_name}**` : null,
      `- ${seatLine}`,
      org.is_test ? '- Test organisation' : null,
    ]
      .filter(Boolean)
      .join('\n'),
    actions: [
      {
        label: 'Open organisation',
        path: `/platform-admin/organisations?q=${enc(org.name)}`,
      },
    ],
    navigateTo: `/platform-admin/organisations?q=${enc(org.name)}`,
  }
}

export function runPlatformAssistantQuery(
  rawInput: string,
  snapshot: PlatformAssistantSnapshot,
): AssistantResult {
  const raw = rawInput.trim()
  const q = raw.toLowerCase()

  if (!q || /\b(help|what can you|commands?)\b/.test(q)) {
    return {
      message: [
        "I'm the **Tradeal Admin** assistant. Ask about customers, seats, licences, or jump to a console section.",
        '',
        'Try: *Main menu*, *How many organisations?*, *Pending seat requests*, *Active licences*, *Find Acme*, or *Open Features & Access*.',
      ].join('\n'),
      actions: [
        { label: 'Organisations', path: '/platform-admin/organisations' },
        { label: 'Seat requests', path: '/platform-admin/seat-requests' },
        { label: 'Features & Access', path: '/platform-admin/add-ons' },
      ],
    }
  }

  if (/\b(summary|stats|overview|dashboard)\b/.test(q)) {
    return summaryResult(snapshot)
  }

  if (/\b(how many|count|number of)\b/.test(q) && /\b(org|organisation|organization|customer)/.test(q)) {
    const live = snapshot.organisations.filter(o => !o.is_test)
    const test = snapshot.organisations.filter(o => o.is_test)
    return {
      message:
        `**${snapshot.organisations.length}** organisation${snapshot.organisations.length === 1 ? '' : 's'} total` +
        ` · **${live.length}** live` +
        (test.length ? ` · **${test.length}** test` : '') +
        '.',
      actions: [{ label: 'View organisations', path: '/platform-admin/organisations', count: snapshot.organisations.length }],
      navigateTo: '/platform-admin/organisations',
    }
  }

  if (/\b(seat\s*requests?|pending\s+seats?)\b/.test(q) || (/\bseats?\b/.test(q) && /\b(pending|request|open)\b/.test(q))) {
    const n = snapshot.seatRequests.length
    return {
      message:
        n === 0
          ? 'No open seat requests right now.'
          : `**${n}** open seat request${n === 1 ? '' : 's'} waiting for review or payment.`,
      actions: [{ label: 'Seat requests', path: '/platform-admin/seat-requests', count: n }],
      navigateTo: '/platform-admin/seat-requests',
    }
  }

  if (/\b(licence|license)s?\b/.test(q)) {
    const active = snapshot.licenses.filter(l => l.status === 'active')
    const suspended = snapshot.licenses.filter(l => l.status === 'suspended')
    const cancelled = snapshot.licenses.filter(l => l.status === 'cancelled')
    return {
      message: [
        `**${snapshot.licenses.length}** licence${snapshot.licenses.length === 1 ? '' : 's'}`,
        `- Active: **${active.length}**`,
        `- Suspended: **${suspended.length}**`,
        cancelled.length ? `- Cancelled: **${cancelled.length}**` : null,
      ]
        .filter(Boolean)
        .join('\n'),
      actions: [{ label: 'Licences', path: '/platform-admin/licenses', count: snapshot.licenses.length }],
      navigateTo: '/platform-admin/licenses',
    }
  }

  if (/\b(amc|annual\s+maintenance)\b/.test(q)) {
    return {
      message: 'Open AMC to review renewals and grace periods for each licence.',
      actions: [{ label: 'AMC', path: '/platform-admin/amcs' }],
      navigateTo: '/platform-admin/amcs',
    }
  }

  if (/\b(payment|payments|billing)\b/.test(q)) {
    return {
      message: 'Open Payments to record licence, AMC, or seat payments.',
      actions: [{ label: 'Payments', path: '/platform-admin/payments' }],
      navigateTo: '/platform-admin/payments',
    }
  }

  if (/\b(feature|add-?on|addon|access|catalog)\b/.test(q)) {
    return {
      message: 'Features & Access is where you list offers and approve org requests (including Custom branding and Tradeal AI).',
      actions: [{ label: 'Features & Access', path: '/platform-admin/add-ons' }],
      navigateTo: '/platform-admin/add-ons',
    }
  }

  if (/\b(release|releases|deploy|publish)\b/.test(q)) {
    return {
      message: 'Open Releases to draft, publish, and notify organisations about product updates.',
      actions: [{ label: 'Releases', path: '/platform-admin/releases' }],
      navigateTo: '/platform-admin/releases',
    }
  }

  if (/\b(inbox|notif|notify|broadcast)\b/.test(q)) {
    return {
      message: 'Platform inbox covers seat requests, feature interests, and outbound notices.',
      actions: [{ label: 'Inbox', path: '/platform-admin/notifications' }],
      navigateTo: '/platform-admin/notifications',
    }
  }

  if (/\b(plan|plans|pricing)\b/.test(q)) {
    return {
      message: 'Plans & Pricing controls licence, AMC, and seat prices for organisations.',
      actions: [{ label: 'Plans & Pricing', path: '/platform-admin/plans' }],
      navigateTo: '/platform-admin/plans',
    }
  }

  if (/\b(audit|log)\b/.test(q)) {
    return {
      message: 'Audit log lists privileged platform actions across organisations.',
      actions: [{ label: 'Audit', path: '/platform-admin/audit' }],
      navigateTo: '/platform-admin/audit',
    }
  }

  if (/\bseats?\b/.test(q)) {
    return {
      message: `**${snapshot.seats.length}** seat${snapshot.seats.length === 1 ? '' : 's'} currently assigned across organisations.`,
      actions: [
        { label: 'Seats', path: '/platform-admin/seats', count: snapshot.seats.length },
        { label: 'Seat requests', path: '/platform-admin/seat-requests', count: snapshot.seatRequests.length },
      ],
      navigateTo: '/platform-admin/seats',
    }
  }

  const orgHint = extractOrgHint(raw)
  if (orgHint) {
    const org = matchOrg(snapshot, orgHint)
    if (org) return orgResult(org)
    const hits = snapshot.organisations.filter(
      o =>
        o.name.toLowerCase().includes(orgHint.toLowerCase()) ||
        (o.org_code && o.org_code.toLowerCase().includes(orgHint.toLowerCase())),
    )
    if (hits.length > 1) {
      return {
        message: `Found **${hits.length}** organisations matching **${orgHint}**. Open Organisations to refine.`,
        actions: [
          { label: 'Search organisations', path: `/platform-admin/organisations?q=${enc(orgHint)}`, count: hits.length },
        ],
        navigateTo: `/platform-admin/organisations?q=${enc(orgHint)}`,
      }
    }
  }

  // Bare org name
  const direct = matchOrg(snapshot, raw.replace(/\?+$/, ''))
  if (direct) return orgResult(direct)

  if (/\b(org|organisation|organization|customer)/.test(q)) {
    return {
      message: `**${snapshot.organisations.length}** organisations on the platform. Ask *How many organisations?* or *Find Acme*.`,
      actions: [{ label: 'Organisations', path: '/platform-admin/organisations' }],
      navigateTo: '/platform-admin/organisations',
    }
  }

  return {
    message: [
      `I'm not sure how to answer "${raw}" in the admin console.`,
      '',
      'Try: *Platform summary*, *Pending seat requests*, *Active licences*, *Find Acme*, or type **help**.',
    ].join('\n'),
    actions: [
      { label: 'Organisations', path: '/platform-admin/organisations' },
      { label: 'Features & Access', path: '/platform-admin/add-ons' },
    ],
  }
}
