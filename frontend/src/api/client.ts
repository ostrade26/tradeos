import { clearAuthSession, loadAuthSession } from '../lib/auth'

/** Accepts `/api/v1`, `https://host`, or `https://host/api/v1`. */
export function resolveApiBase(raw: string | undefined): string {
  const value = (raw ?? '').trim().replace(/\/+$/, '')
  if (!value) return '/api/v1'
  if (value.endsWith('/api/v1')) return value
  return `${value}/api/v1`
}

const API_BASE = resolveApiBase(import.meta.env.VITE_API_URL)
const API_TOKEN = (
  (import.meta.env.VITE_TRADEAL_API_TOKEN as string | undefined)
  ?? (import.meta.env.VITE_TRADEOS_API_TOKEN as string | undefined)
)?.trim() ?? ''
const USING_LOCAL_PROXY = API_BASE === '/api/v1'

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
      throw new ApiError(
        USING_LOCAL_PROXY
          ? `Request timed out — the Python API on port 8000 is not responding. Stop any stuck backend, then run: npm run dev:all`
          : `Request timed out after ${FETCH_TIMEOUT_MS / 1000}s. Check Railway is up and VITE_API_URL is ${API_BASE}.`,
        0,
      )
    }
    throw new ApiError(
      USING_LOCAL_PROXY
        ? 'Cannot reach the API. Start the backend with: npm run dev:backend (port 8000), then open http://localhost:5173'
        : `Cannot reach the API at ${API_BASE}. Check that Railway is running and VITE_API_URL is set on Vercel.`,
      0,
    )
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
    if (res.status === 404) {
      throw new ApiError(
        USING_LOCAL_PROXY
          ? `${detail} — check that the backend is running (npm run dev:backend) and you are using http://localhost:5173`
          : `${detail} — check VITE_API_URL (${API_BASE}) and that the Railway API is up`,
        res.status,
      )
    }
    throw new ApiError(detail, res.status)
  }
  return body as T
}
