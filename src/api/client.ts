import { clearAuthSession, loadAuthSession } from '../lib/auth'

const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1'
const API_TOKEN = (import.meta.env.VITE_TRADEOS_API_TOKEN as string | undefined)?.trim() ?? ''

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

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...(API_TOKEN ? { 'X-TradeOS-Token': API_TOKEN } : {}),
        ...init?.headers,
      },
    })
  } catch {
    throw new ApiError(
      'Cannot reach the API. Start the backend with: npm run dev:backend (port 8000), then open http://localhost:5173',
      0,
    )
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
        `${detail} — check that the backend is running (npm run dev:backend) and you are using http://localhost:5173`,
        res.status,
      )
    }
    throw new ApiError(detail, res.status)
  }
  return body as T
}
