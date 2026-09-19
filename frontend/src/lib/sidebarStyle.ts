import { readScopedPref, writeScopedPref } from './userPreferences'

/** `theme` = accent-filled sidenav; `default` = card surface (Attex classic). */
export type SidebarStyle = 'theme' | 'default'

const STORAGE_KEY = 'tradeal-sidebar-style'

export function loadSidebarStyle(userKey?: string | null): SidebarStyle {
  try {
    const stored = readScopedPref(STORAGE_KEY, userKey)
    if (stored === 'theme' || stored === 'default') return stored
  } catch {
    /* ignore */
  }
  return 'theme'
}

export function storeSidebarStyle(style: SidebarStyle, userKey?: string | null) {
  try {
    writeScopedPref(STORAGE_KEY, style, userKey)
  } catch {
    /* ignore */
  }
}
