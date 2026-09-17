import { preferenceUserKey, readScopedPref, writeScopedPref } from './userPreferences'

export interface UserProfile {
  name: string
  location: string
  email: string
  phone: string
  role: string
  username: string
}

export const EMPTY_USER_PROFILE: UserProfile = {
  name: '',
  location: '',
  email: '',
  phone: '',
  role: '',
  username: '',
}

const STORAGE_KEY = 'tradeal-user-profile'

export function loadUserProfile(userKey: string | null = preferenceUserKey()): UserProfile {
  try {
    const raw = readScopedPref(STORAGE_KEY, userKey)
    if (!raw) return { ...EMPTY_USER_PROFILE }
    return { ...EMPTY_USER_PROFILE, ...JSON.parse(raw) }
  } catch {
    return { ...EMPTY_USER_PROFILE }
  }
}

export function saveUserProfile(profile: UserProfile, userKey: string | null = preferenceUserKey()) {
  writeScopedPref(STORAGE_KEY, JSON.stringify(profile), userKey)
}

export function userInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return trimmed.slice(0, 2).toUpperCase()
}
