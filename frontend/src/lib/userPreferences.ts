import { loadAuthSession } from './auth'
import { storageGet, storageSet } from './storage'

/** Scope local preferences per signed-in user (multi-user on one browser). */
export function preferenceUserKey(): string | null {
  const session = loadAuthSession()
  if (session?.userId != null) return `id:${session.userId}`
  return session?.username?.trim() || null
}

export function scopedStorageKey(baseKey: string, userKey: string | null = preferenceUserKey()): string {
  return userKey ? `${baseKey}@user:${userKey}` : baseKey
}

export function readScopedPref(baseKey: string, userKey: string | null = preferenceUserKey()): string | null {
  const scoped = storageGet(scopedStorageKey(baseKey, userKey))
  if (scoped != null) return scoped
  if (userKey) {
    const legacy = storageGet(baseKey)
    if (legacy != null) {
      storageSet(scopedStorageKey(baseKey, userKey), legacy)
      return legacy
    }
    return null
  }
  return storageGet(baseKey)
}

export function writeScopedPref(
  baseKey: string,
  value: string,
  userKey: string | null = preferenceUserKey(),
): void {
  storageSet(scopedStorageKey(baseKey, userKey), value)
}
