import type { AuthSession } from './auth'
import { CUSTOM_ACCENT_ID, storeAccentId, storeCustomHex, normalizeHex, DEFAULT_CUSTOM_HEX } from './accentColor'
import { storeTableDensity, type TableDensity } from './tableDensity'
import { storeSidebarStyle, type SidebarStyle } from './sidebarStyle'
import { writeScopedPref } from './userPreferences'
import { preferenceUserKey } from './userPreferences'

export type StoredUserPreferences = {
  theme?: 'light' | 'dark'
  accentId?: string
  customHex?: string
  tableDensity?: TableDensity
  sidebarStyle?: SidebarStyle
}

export function applyUserPreferences(
  prefs: StoredUserPreferences | undefined,
  userKey: string | null = preferenceUserKey(),
): void {
  if (!prefs) return
  if (prefs.theme === 'light' || prefs.theme === 'dark') {
    writeScopedPref('tradeal-theme', prefs.theme, userKey)
  }
  if (prefs.accentId) {
    storeAccentId(prefs.accentId, userKey)
  }
  if (prefs.customHex) {
    storeCustomHex(normalizeHex(prefs.customHex, DEFAULT_CUSTOM_HEX), userKey)
    if (prefs.accentId === CUSTOM_ACCENT_ID || !prefs.accentId) {
      storeAccentId(CUSTOM_ACCENT_ID, userKey)
    }
  }
  if (prefs.tableDensity === 'compact' || prefs.tableDensity === 'relaxed') {
    storeTableDensity(prefs.tableDensity, userKey)
  }
  if (prefs.sidebarStyle === 'theme' || prefs.sidebarStyle === 'default') {
    storeSidebarStyle(prefs.sidebarStyle, userKey)
  }
}

export function preferencesFromSession(session: AuthSession | null): StoredUserPreferences | undefined {
  return session?.preferences
}
