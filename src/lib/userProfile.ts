import { CURRENT_TRADER, CURRENT_TRADER_LOCATION } from '../data/mockData'
import { storageGet, storageSet } from './storage'

export interface UserProfile {
  name: string
  location: string
  email: string
  phone: string
  role: string
}

export const DEFAULT_USER_PROFILE: UserProfile = {
  name: CURRENT_TRADER,
  location: CURRENT_TRADER_LOCATION,
  email: 'accounts@shrikubera.com',
  phone: '+91 98765 43210',
  role: 'Trader / Admin',
}

const STORAGE_KEY = 'tradeos-user-profile'

export function loadUserProfile(): UserProfile {
  try {
    const raw = storageGet(STORAGE_KEY)
    if (!raw) return DEFAULT_USER_PROFILE
    return { ...DEFAULT_USER_PROFILE, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_USER_PROFILE
  }
}

export function saveUserProfile(profile: UserProfile) {
  storageSet(STORAGE_KEY, JSON.stringify(profile))
}

export function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}
