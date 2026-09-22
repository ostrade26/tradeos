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
  sidebarStyle?: 'theme' | 'default'
  lastSeenPlatformWhatsNew?: string
  completedOrgProductTour?: boolean
  completedOrgAccountWelcome?: boolean
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
  organisationIsTest: boolean
  appliedUpdates: string[]
  appliedVersion: string
}

import { storageGet, storageRemove, storageSet } from './storage'

const STORAGE_KEY = 'tradeal-auth-session'
const KEEP_SIGNED_IN_KEY = 'tradeal-keep-signed-in'
const REMEMBERED_USERNAME_KEY = 'tradeal-remembered-username'

const VALID_LEGACY_ROLES: UserRole[] = ['admin', 'operator', 'view_only']

function sessionStorageGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function sessionStorageSet(key: string, value: string): boolean {
  try {
    sessionStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function sessionStorageRemove(key: string): void {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // ignore
  }
}

function parseAuthSession(raw: string | null): AuthSession | null {
  if (!raw) return null
  try {
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
    if (typeof parsed.organisationIsTest !== 'boolean') {
      parsed.organisationIsTest = false
    }
    if (typeof parsed.isPlatformAdmin !== 'boolean') {
      parsed.isPlatformAdmin = parsed.roleSlug === 'platform_admin'
    }
    if (!Array.isArray(parsed.appliedUpdates)) parsed.appliedUpdates = []
    if (typeof parsed.appliedVersion !== 'string') parsed.appliedVersion = ''
    return parsed
  } catch {
    return null
  }
}

/** Default true — matches previous always-persist behaviour. */
export function loadKeepSignedIn(): boolean {
  const raw = storageGet(KEEP_SIGNED_IN_KEY)
  if (raw === null) return true
  return raw === '1'
}

export function saveKeepSignedIn(keep: boolean) {
  storageSet(KEEP_SIGNED_IN_KEY, keep ? '1' : '0')
}

export function loadRememberedUsername(): string {
  return storageGet(REMEMBERED_USERNAME_KEY) ?? ''
}

export function saveRememberedUsername(username: string) {
  const trimmed = username.trim()
  if (!trimmed) {
    storageRemove(REMEMBERED_USERNAME_KEY)
    return
  }
  storageSet(REMEMBERED_USERNAME_KEY, trimmed)
}

export function clearRememberedUsername() {
  storageRemove(REMEMBERED_USERNAME_KEY)
}

export function loadAuthSession(): AuthSession | null {
  return parseAuthSession(sessionStorageGet(STORAGE_KEY)) ?? parseAuthSession(storageGet(STORAGE_KEY))
}

export function saveAuthSession(session: AuthSession, options?: { keepSignedIn?: boolean }) {
  const keep = options?.keepSignedIn ?? loadKeepSignedIn()
  const raw = JSON.stringify(session)
  if (keep) {
    storageSet(STORAGE_KEY, raw)
    sessionStorageRemove(STORAGE_KEY)
  } else {
    sessionStorageSet(STORAGE_KEY, raw)
    storageRemove(STORAGE_KEY)
  }
  saveKeepSignedIn(keep)
}

export function clearAuthSession() {
  storageRemove(STORAGE_KEY)
  sessionStorageRemove(STORAGE_KEY)
}

export function hasPermission(session: AuthSession | null, permission: string): boolean {
  if (!session) return false
  return session.permissions.includes(permission)
}

export function hasAppliedUpdate(session: AuthSession | null, featureKey: string): boolean {
  if (!session || !featureKey) return false
  return session.appliedUpdates.includes(featureKey)
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

export function canDeleteLifts(session: AuthSession | null): boolean {
  return hasPermission(session, 'lifts.delete')
}
