export type ServiceIssueKind =
  | 'no_internet'
  | 'connectivity'
  | 'database'
  | 'not_found'
  | 'server'
  | 'generic'

export type ServiceIssueView = {
  id: string
  kind: ServiceIssueKind
  title: string
  message: string
  hint: string
  /** Support bundle — safe to share with platform admin (no secrets). */
  httpStatus?: number
  requestPath?: string
  technical?: string
}

const DB_PATTERN =
  /database|postgres|sqlite|row-level security|integrity|could not save|migration|connection refused|timeout expired/i

const INFRA_404_PATHS = /^\/(health|state|auth\/me)(\/|$)/

function contactHint(): string {
  return 'Try refreshing the page. If this keeps happening, contact your Tradeal platform administrator.'
}

function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function offlineKind(): 'no_internet' | 'connectivity' {
  return isBrowserOffline() ? 'no_internet' : 'connectivity'
}

function presentation(kind: ServiceIssueKind, message?: string): Omit<ServiceIssueView, 'id'> {
  switch (kind) {
    case 'no_internet':
      return {
        kind,
        title: 'No internet connection',
        message:
          message ??
          'Your device looks offline. Tradeal cannot sync until you are back on the network.',
        hint: contactHint(),
      }
    case 'connectivity':
      return {
        kind,
        title: 'Tradeal is unreachable',
        message:
          message ??
          'We could not connect to Tradeal right now. Your data is safe, but this device cannot load updates.',
        hint: contactHint(),
      }
    case 'database':
      return {
        kind,
        title: 'Data could not be loaded',
        message:
          message ??
          'Tradeal had trouble reading or saving organisation data. This is usually temporary.',
        hint: contactHint(),
      }
    case 'not_found':
      return {
        kind,
        title: 'This page is not available',
        message:
          message ??
          'We could not find what you were looking for. It may have moved or your app may need a refresh.',
        hint: contactHint(),
      }
    case 'server':
      return {
        kind,
        title: 'Tradeal encountered an error',
        message: message ?? 'The server returned an unexpected error while handling your request.',
        hint: contactHint(),
      }
    default:
      return {
        kind: 'generic',
        title: 'Something went wrong',
        message: message ?? 'An unexpected error occurred.',
        hint: contactHint(),
      }
  }
}

export function classifyApiFailure(path: string, status: number, detail: string): ServiceIssueView | null {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const text = detail.trim()

  if (status === 0) {
    const kind = offlineKind()
    return withRequestMeta(toView(kind, presentation(kind)), normalizedPath, status, text || 'network')
  }

  if (DB_PATTERN.test(text)) {
    return withRequestMeta(
      toView('database', presentation('database', sanitizeDetail(text))),
      normalizedPath,
      status,
      text,
    )
  }

  if (status === 404 && (INFRA_404_PATHS.test(normalizedPath) || /^\/me\//.test(normalizedPath))) {
    return withRequestMeta(toView('not_found', presentation('not_found')), normalizedPath, status, text)
  }

  if (status >= 500) {
    return withRequestMeta(
      toView('server', presentation('server', sanitizeDetail(text))),
      normalizedPath,
      status,
      text,
    )
  }

  if (status === 502 || status === 503 || status === 504) {
    return withRequestMeta(toView('connectivity', presentation('connectivity')), normalizedPath, status, text)
  }

  return null
}

function readApiError(err: unknown): { status: number; message: string } | null {
  if (!(err instanceof Error) || err.name !== 'ApiError') return null
  const status = (err as Error & { status?: number }).status
  if (typeof status !== 'number') return null
  return { status, message: err.message }
}

export function classifyUnknownError(err: unknown): ServiceIssueView {
  const apiErr = readApiError(err)
  if (apiErr) {
    const fromStatus = classifyApiFailure('', apiErr.status, apiErr.message)
    if (fromStatus) return fromStatus
    if (DB_PATTERN.test(apiErr.message)) {
      return toView('database', presentation('database', sanitizeDetail(apiErr.message)))
    }
    if (apiErr.status === 0 || /cannot reach|timed out|not responding|failed to fetch/i.test(apiErr.message)) {
      const kind = offlineKind()
      return toView(kind, presentation(kind))
    }
    if (apiErr.status === 404) {
      return toView('not_found', presentation('not_found', sanitizeDetail(apiErr.message)))
    }
    if (apiErr.status >= 500) {
      return toView('server', presentation('server', sanitizeDetail(apiErr.message)))
    }
  }

  if (err instanceof Error && /failed to fetch|network error|load failed/i.test(err.message)) {
    const kind = offlineKind()
    return toView(kind, presentation(kind))
  }

  return toView('generic', presentation('generic'))
}

export function connectivityIssue(): ServiceIssueView {
  const kind = offlineKind()
  return toView(kind, presentation(kind))
}

/** Dashboard / QA — sample copy for each modal variant. */
export function previewServiceIssue(kind: ServiceIssueKind): ServiceIssueView {
  return toView(kind, presentation(kind))
}

function sanitizeDetail(detail: string): string | undefined {
  const trimmed = detail.replace(/\s+/g, ' ').trim()
  if (!trimmed) return undefined
  if (/localhost|127\.0\.0\.1|railway|vercel|python|npm run|VITE_/i.test(trimmed)) return undefined
  if (trimmed.length > 220) return `${trimmed.slice(0, 217)}…`
  return trimmed
}

function toView(kind: ServiceIssueKind, base: Omit<ServiceIssueView, 'id'>): ServiceIssueView {
  return { ...base, kind, id: `${kind}-${Date.now()}` }
}

function withRequestMeta(
  issue: ServiceIssueView,
  requestPath: string,
  httpStatus: number,
  technical: string,
): ServiceIssueView {
  const path = requestPath && requestPath !== '/' ? requestPath : undefined
  const detail = technical.trim()
  return {
    ...issue,
    httpStatus: httpStatus || undefined,
    requestPath: path,
    technical: detail || undefined,
  }
}

export function formatServiceIssueReport(issue: ServiceIssueView, apiBase: string): string {
  const lines = [
    'Tradeal — service issue report',
    '—'.repeat(32),
    `Time (UTC): ${new Date().toISOString()}`,
    `Issue ID: ${issue.id}`,
    `Kind: ${issue.kind}`,
    `Title: ${issue.title}`,
    `Message: ${issue.message}`,
  ]
  if (issue.httpStatus != null) lines.push(`HTTP status: ${issue.httpStatus}`)
  if (issue.requestPath) lines.push(`API path: ${issue.requestPath}`)
  if (issue.technical) lines.push(`Detail: ${issue.technical}`)
  if (typeof window !== 'undefined') {
    lines.push(`Page: ${window.location.href}`)
    lines.push(`Browser online: ${navigator.onLine ? 'yes' : 'no'}`)
  }
  lines.push(`API base: ${apiBase}`)
  lines.push(`Environment: ${import.meta.env.PROD ? 'production' : 'development'}`)
  return lines.join('\n')
}

export async function copyServiceIssueReport(issue: ServiceIssueView, apiBase: string): Promise<void> {
  const text = formatServiceIssueReport(issue, apiBase)
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.left = '-9999px'
  document.body.appendChild(area)
  area.select()
  document.execCommand('copy')
  document.body.removeChild(area)
}

export const SERVICE_ISSUE_EVENT = 'tradeal-service-issue'

const EMIT_COOLDOWN_MS = 120_000
const lastEmitByKind: Partial<Record<ServiceIssueKind, number>> = {}

export function emitServiceIssue(issue: ServiceIssueView) {
  if (typeof window === 'undefined') return
  const now = Date.now()
  const last = lastEmitByKind[issue.kind]
  if (last != null && now - last < EMIT_COOLDOWN_MS) return
  lastEmitByKind[issue.kind] = now
  window.dispatchEvent(new CustomEvent(SERVICE_ISSUE_EVENT, { detail: issue }))
}

export function resetServiceIssueEmitCooldown() {
  for (const key of Object.keys(lastEmitByKind) as ServiceIssueKind[]) {
    delete lastEmitByKind[key]
  }
}
