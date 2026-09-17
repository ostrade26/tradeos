import { clearAuthSession, loadAuthSession } from '../lib/auth'
import { classifyApiFailure, emitServiceIssue } from '../lib/serviceIssue'

/** Accepts `/api/v1`, `https://host`, or `https://host/api/v1`. */
export function resolveApiBase(raw: string | undefined): string {
  const value = (raw ?? '').trim().replace(/\/+$/, '')
  if (!value) return '/api/v1'
  if (value.endsWith('/api/v1')) return value
  return `${value}/api/v1`
}

export const API_BASE = resolveApiBase(import.meta.env.VITE_API_URL)
const API_TOKEN = (
  (import.meta.env.VITE_TRADEAL_API_TOKEN as string | undefined)
  ?? (import.meta.env.VITE_TRADEOS_API_TOKEN as string | undefined)
)?.trim() ?? ''
const USING_LOCAL_PROXY = API_BASE === '/api/v1'

const USER_FACING_OFFLINE = 'Tradeal is not responding. Try refreshing the page.'

function surfaceInfrastructureIssue(path: string, status: number, detail: string) {
  const issue = classifyApiFailure(path, status, detail)
  if (issue) emitServiceIssue(issue)
}

/** For support copy on service-issue modals (no secrets). */
export function apiBaseForDiagnostics(): string {
  return API_BASE
}

if (import.meta.env.PROD && USING_LOCAL_PROXY) {
  console.error(
    'VITE_API_URL is not set. The UI will call this Vercel origin, which has no API. '
    + 'Set VITE_API_URL to https://<your-service>.up.railway.app/api/v1 and redeploy.',
  )
}

function authHeaders(): Record<string, string> {
  const session = loadAuthSession()
  if (session?.token) return { Authorization: `Bearer ${session.token}` }
  return {}
}

function formatApiDetail(detail: unknown): string {
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail)) {
    const parts = detail.map(item => {
      if (item && typeof item === 'object' && 'msg' in item) {
        const loc = Array.isArray((item as { loc?: unknown }).loc)
          ? (item as { loc: unknown[] }).loc.filter(p => p !== 'body').join('.')
          : ''
        const msg = String((item as { msg: unknown }).msg)
        return loc ? `${loc}: ${msg}` : msg
      }
      return typeof item === 'string' ? item : ''
    }).filter(Boolean)
    if (parts.length) return parts.join('; ')
  }
  if (detail && typeof detail === 'object') {
    try {
      return JSON.stringify(detail)
    } catch {
      return ''
    }
  }
  return ''
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function parseJson(res: Response) {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

const FETCH_TIMEOUT_MS = 25_000

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: init?.signal ?? controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...(API_TOKEN ? { 'X-Tradeal-Token': API_TOKEN } : {}),
        ...init?.headers,
      },
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      surfaceInfrastructureIssue(path, 0, 'timeout')
      throw new ApiError(USER_FACING_OFFLINE, 0)
    }
    surfaceInfrastructureIssue(path, 0, 'network')
    throw new ApiError(USER_FACING_OFFLINE, 0)
  } finally {
    clearTimeout(timeout)
  }
  const body = await parseJson(res)
  if (!res.ok) {
    const detail = body && typeof body === 'object' && 'detail' in body
      ? (formatApiDetail((body as { detail: unknown }).detail) || res.statusText || 'Request failed')
      : res.statusText || 'Request failed'
    if (res.status === 401 && !path.startsWith('/auth/login')) {
      clearAuthSession()
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.assign('/login')
      }
    }
    surfaceInfrastructureIssue(path, res.status, detail)
    if (res.status === 404) {
      throw new ApiError(detail || 'This request is not available.', res.status)
    }
    throw new ApiError(detail || 'Something went wrong.', res.status)
  }
  return body as T
}
