export type UserRole = 'admin' | 'operator' | 'view_only'

export type RoleSlug =
  | 'platform_admin'
  | 'organisation_admin'
  | 'operator'
  | 'view_only'

export type AccountType = 'wholesaler_retailer' | 'broker'

export interface UserPreferences {
  theme?: 'light' | 'dark'
  accentId?: string
  customHex?: string
  tableDensity?: 'compact' | 'relaxed'
}

export interface AuthSession {
  token: string
  userId?: number
  username: string
  email?: string
  name: string
  phone?: string
  location?: string
  preferences?: UserPreferences
  role: UserRole
  roleSlug: RoleSlug
  roleName: string
  organisationId: number | null
  organisationName: string | null
  accountType: AccountType
  permissions: string[]
  isPlatformAdmin: boolean
  organisationSandboxTools: boolean
}

import { storageGet, storageRemove, storageSet } from './storage'

const STORAGE_KEY = 'tradeal-auth-session'

const VALID_LEGACY_ROLES: UserRole[] = ['admin', 'operator', 'view_only']

export function loadAuthSession(): AuthSession | null {
  try {
    const raw = storageGet(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthSession
    if (!parsed?.token) return null
    if (!parsed.roleSlug && parsed.role && VALID_LEGACY_ROLES.includes(parsed.role)) {
      parsed.roleSlug =
        parsed.role === 'admin'
          ? 'organisation_admin'
          : parsed.role === 'view_only'
            ? 'view_only'
            : 'operator'
    }
    if (!Array.isArray(parsed.permissions)) parsed.permissions = []
    if (typeof parsed.organisationSandboxTools !== 'boolean') {
      parsed.organisationSandboxTools = false
    }
    if (typeof parsed.isPlatformAdmin !== 'boolean') {
      parsed.isPlatformAdmin = parsed.roleSlug === 'platform_admin'
    }
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

export function hasPermission(session: AuthSession | null, permission: string): boolean {
  if (!session) return false
  return session.permissions.includes(permission)
}

export function roleLabel(session: AuthSession | null): string {
  if (!session) return ''
  if (session.roleName) return session.roleName
  return session.role === 'admin' ? 'Admin' : session.role === 'view_only' ? 'View Only' : 'Operator'
}

export function canEditOrders(session: AuthSession | null): boolean {
  return (
    hasPermission(session, 'purchase.edit') || hasPermission(session, 'sales.edit')
  )
}

export function canCreateOrders(session: AuthSession | null): boolean {
  return (
    hasPermission(session, 'purchase.create') || hasPermission(session, 'sales.create')
  )
}

/** Organisation Admin — full business access, not platform RBAC. */
export function isAdmin(session: AuthSession | null): boolean {
  if (!session) return false
  return session.roleSlug === 'organisation_admin' || session.role === 'admin'
}

export function canDeleteOrders(session: AuthSession | null): boolean {
  return (
    hasPermission(session, 'purchase.delete') || hasPermission(session, 'sales.delete')
  )
}
