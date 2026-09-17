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
    return toView(kind, presentation(kind))
  }

  if (DB_PATTERN.test(text)) {
    return toView('database', presentation('database', sanitizeDetail(text)))
  }

  if (status === 404 && INFRA_404_PATHS.test(normalizedPath)) {
    return toView('not_found', presentation('not_found'))
  }

  if (status === 404 && /^\/me\//.test(normalizedPath)) {
    return toView('not_found', presentation('not_found'))
  }

  if (status >= 500) {
    return toView('server', presentation('server', sanitizeDetail(text)))
  }

  if (status === 502 || status === 503 || status === 504) {
    return toView('connectivity', presentation('connectivity'))
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

export const SERVICE_ISSUE_EVENT = 'tradeal-service-issue'

export function emitServiceIssue(issue: ServiceIssueView) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SERVICE_ISSUE_EVENT, { detail: issue }))
}
