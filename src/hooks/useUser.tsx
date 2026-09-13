import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { roleLabel } from '../lib/auth'
import {
  loadUserProfile,
  saveUserProfile,
  userInitials,
  type UserProfile,
} from '../lib/userProfile'
import { useAuth } from './useAuth'

interface UserContextValue {
  profile: UserProfile
  initials: string
  updateProfile: (patch: Partial<UserProfile>) => void
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [profile, setProfile] = useState<UserProfile>(() => loadUserProfile())

  useEffect(() => {
    if (!session) return
    setProfile(prev => {
      const next: UserProfile = {
        ...prev,
        name: session.name,
        role: roleLabel(session.role),
      }
      saveUserProfile(next)
      return next
    })
  }, [session?.username, session?.name, session?.role])

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfile(prev => {
      const next = { ...prev, ...patch }
      saveUserProfile(next)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      profile,
      initials: userInitials(profile.name),
      updateProfile,
    }),
    [profile, updateProfile],
  )

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within UserProvider')
  return ctx
}
