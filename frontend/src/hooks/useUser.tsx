import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi } from '../api/tradeApi'
import { loadAuthSession } from '../lib/auth'
import { sessionFromApi } from '../lib/authSession'
import { profileFromSession } from '../lib/profileFromSession'
import {
  loadUserProfile,
  saveUserProfile,
  userInitials,
  type UserProfile,
} from '../lib/userProfile'
import { preferenceUserKey } from '../lib/userPreferences'
import { useAuth } from './useAuth'

interface UserContextValue {
  profile: UserProfile
  initials: string
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>
}

const UserContext = createContext<UserContextValue | null>(null)

function mergeProfile(sessionProfile: UserProfile, stored: UserProfile): UserProfile {
  return {
    name: sessionProfile.name.trim() ? sessionProfile.name : stored.name,
    email: sessionProfile.email.trim() ? sessionProfile.email : stored.email,
    phone: sessionProfile.phone.trim() ? sessionProfile.phone : stored.phone,
    location: sessionProfile.location.trim() ? sessionProfile.location : stored.location,
    role: sessionProfile.role || stored.role,
    username: sessionProfile.username?.trim() ? sessionProfile.username : stored.username || '',
  }
}

export function UserProvider({ children }: { children: ReactNode }) {
  const { session, applySession } = useAuth()
  const userKey = preferenceUserKey()
  const [profile, setProfile] = useState<UserProfile>(() => {
    const stored = loadUserProfile(userKey)
    return mergeProfile(profileFromSession(session), stored)
  })

  useEffect(() => {
    if (!session?.userId && !session?.username) return
    const key = preferenceUserKey()
    const fromSession = profileFromSession(session)
    const stored = loadUserProfile(key)
    const next = mergeProfile(fromSession, stored)
    setProfile(next)
    saveUserProfile(next, key)
  }, [
    session?.userId,
    session?.username,
    session?.name,
    session?.email,
    session?.phone,
    session?.location,
    session?.roleSlug,
    session?.roleName,
    session?.role,
  ])

  const updateProfile = useCallback(async (patch: Partial<UserProfile>) => {
    const { role: _role, email: _email, ...writable } = patch
    const previous = profile
    const next = { ...profile, ...patch }
    setProfile(next)
    saveUserProfile(next, userKey)

    const token = loadAuthSession()?.token
    if (!token) return

    try {
      const result = await authApi.updateProfile({
        name: writable.name ?? profile.name,
        phone: writable.phone ?? profile.phone,
        location: writable.location ?? profile.location,
        username: writable.username ?? profile.username,
      })
      const current = loadAuthSession()
      if (current?.token) {
        applySession(sessionFromApi(result, current.token))
      }
      const synced = profileFromSession(sessionFromApi(result, token))
      setProfile(prev => ({ ...synced, role: prev.role }))
      saveUserProfile({ ...next, ...synced }, preferenceUserKey())
    } catch (err) {
      setProfile(previous)
      saveUserProfile(previous, userKey)
      throw err
    }
  }, [applySession, profile, userKey])

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
