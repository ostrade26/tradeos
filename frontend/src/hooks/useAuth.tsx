import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  canEditOrders,
  clearAuthSession,
  isAdmin,
  loadAuthSession,
  roleLabel,
  saveAuthSession,
  type AuthSession,
  type UserRole,
} from '../lib/auth'
import { authApi } from '../api/tradeApi'

interface AuthContextValue {
  session: AuthSession | null
  isAuthenticated: boolean
  role: UserRole | null
  roleLabel: string
  canEditOrders: boolean
  isAdmin: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => loadAuthSession())

  const login = useCallback(async (username: string, password: string) => {
    const result = await authApi.login(username, password)
    const next: AuthSession = {
      token: result.token,
      username: result.username,
      name: result.name,
      role: result.role,
    }
    saveAuthSession(next)
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
    const role = session?.role ?? null
    return {
      session,
      isAuthenticated: !!session,
      role,
      roleLabel: role ? roleLabel(role) : '',
      canEditOrders: role ? canEditOrders(role) : false,
      isAdmin: role ? isAdmin(role) : false,
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
  const { canEditOrders: canEdit, isAdmin: admin, role, roleLabel: label } = useAuth()
  return { canEditOrders: canEdit, isAdmin: admin, role, roleLabel: label }
}
