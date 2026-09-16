import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  canCreateOrders,
  canDeleteOrders,
  canEditOrders,
  clearAuthSession,
  hasPermission,
  isAdmin,
  loadAuthSession,
  roleLabel,
  saveAuthSession,
  type AuthSession,
  type RoleSlug,
  type UserRole,
} from '../lib/auth'
import { authApi } from '../api/tradeApi'
import { applyUserPreferences } from '../lib/applyUserPreferences'
import { sessionFromApi } from '../lib/authSession'
import { preferenceUserKey } from '../lib/userPreferences'

interface AuthContextValue {
  session: AuthSession | null
  isAuthenticated: boolean
  role: UserRole | null
  roleSlug: RoleSlug | null
  roleLabel: string
  canEditOrders: boolean
  canCreateOrders: boolean
  canDeleteOrders: boolean
  isAdmin: boolean
  isPlatformAdmin: boolean
  organisationSandboxTools: boolean
  hasPermission: (permission: string) => boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => loadAuthSession())

  useEffect(() => {
    const stored = loadAuthSession()
    if (!stored?.token) return
    let cancelled = false
    authApi
      .me()
      .then(result => {
        if (cancelled) return
        const next = sessionFromApi(result, stored.token)
        saveAuthSession(next)
        applyUserPreferences(next.preferences, preferenceUserKey())
        setSession(next)
      })
      .catch(() => {
        // Keep stored session if /me fails transiently; API calls will surface auth errors.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const result = await authApi.login(username, password)
    const next = sessionFromApi(result, result.token)
    saveAuthSession(next)
    applyUserPreferences(next.preferences, preferenceUserKey())
    setSession(next)
  }, [])

  const logout = useCallback(async () => {
    try {
      if (session?.token) await authApi.logout()
    } catch {
      // Clear local session even if the API is unreachable.
    }
    clearAuthSession()
    setSession(null)
  }, [session?.token])

  const value = useMemo((): AuthContextValue => {
    const perm = (p: string) => hasPermission(session, p)
    return {
      session,
      isAuthenticated: !!session,
      role: session?.role ?? null,
      roleSlug: session?.roleSlug ?? null,
      roleLabel: roleLabel(session),
      canEditOrders: canEditOrders(session),
      canCreateOrders: canCreateOrders(session),
      canDeleteOrders: canDeleteOrders(session),
      isAdmin: isAdmin(session),
      isPlatformAdmin: !!session?.isPlatformAdmin,
      organisationSandboxTools: !!session?.organisationSandboxTools,
      hasPermission: perm,
      login,
      logout,
    }
  }, [login, logout, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function usePermissions() {
  const auth = useAuth()
  return {
    canEditOrders: auth.canEditOrders,
    canCreateOrders: auth.canCreateOrders,
    canDeleteOrders: auth.canDeleteOrders,
    isAdmin: auth.isAdmin,
    isPlatformAdmin: auth.isPlatformAdmin,
    organisationSandboxTools: auth.organisationSandboxTools,
    role: auth.role,
    roleSlug: auth.roleSlug,
    roleLabel: auth.roleLabel,
    hasPermission: auth.hasPermission,
  }
}
