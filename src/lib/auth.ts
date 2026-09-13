export type UserRole = 'admin' | 'operator'

export interface AuthSession {
  token: string
  username: string
  name: string
  role: UserRole
}

import { storageGet, storageRemove, storageSet } from './storage'

const STORAGE_KEY = 'tradeos-auth-session'

export function loadAuthSession(): AuthSession | null {
  try {
    const raw = storageGet(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthSession
    if (!parsed?.token || (parsed.role !== 'admin' && parsed.role !== 'operator')) return null
    return parsed
  } catch {
    return null
  }
}

export function saveAuthSession(session: AuthSession) {
  storageSet(STORAGE_KEY, JSON.stringify(session))
}

export function clearAuthSession() {
  storageRemove(STORAGE_KEY)
}

export function roleLabel(role: UserRole): string {
  return role === 'admin' ? 'Admin' : 'Operator'
}

export function canEditOrders(role: UserRole): boolean {
  return role === 'admin'
}

export function isAdmin(role: UserRole): boolean {
  return role === 'admin'
}
