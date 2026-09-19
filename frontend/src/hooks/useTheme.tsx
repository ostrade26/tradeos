import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  applyAccentColor,
  applySystemAccentColor,
  getStoredAccentId,
  getStoredCustomHex,
  storeAccentId,
  storeCustomHex,
  resolveAccent,
  type AccentPreset,
  ACCENT_PRESETS,
  CUSTOM_ACCENT_ID,
  SYSTEM_ACCENT_PRESET,
  normalizeHex,
} from '../lib/accentColor'
import { isCustomBrandingEnabled } from '../lib/brandingFlags'
import { loadSidebarStyle, storeSidebarStyle, type SidebarStyle } from '../lib/sidebarStyle'
import { preferenceUserKey, readScopedPref, writeScopedPref } from '../lib/userPreferences'
import { schedulePersistPreferences } from './usePersistUserPreferences'
import { useAuth } from './useAuth'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
  accentId: string
  accentPreset: AccentPreset
  accentPresets: AccentPreset[]
  customHex: string
  setAccentId: (accentId: string) => void
  setCustomAccent: (hex: string) => void
  sidebarStyle: SidebarStyle
  setSidebarStyle: (style: SidebarStyle) => void
  /** True when Custom branding feature is unlocked (or platform admin). */
  brandingEnabled: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readTheme(userKey: string | null): Theme {
  const stored = readScopedPref('tradeal-theme', userKey)
  return stored === 'dark' ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { session, isPlatformAdmin } = useAuth()
  const userKey = preferenceUserKey()
  const brandingEnabled = isCustomBrandingEnabled(session, isPlatformAdmin)

  const [theme, setThemeState] = useState<Theme>(() => readTheme(userKey))
  const [accentId, setAccentIdState] = useState(() => getStoredAccentId(userKey))
  const [customHex, setCustomHexState] = useState(() => getStoredCustomHex(userKey))
  const [sidebarStyle, setSidebarStyleState] = useState<SidebarStyle>(() => loadSidebarStyle(userKey))

  useEffect(() => {
    setThemeState(readTheme(userKey))
    setAccentIdState(getStoredAccentId(userKey))
    setCustomHexState(getStoredCustomHex(userKey))
    setSidebarStyleState(loadSidebarStyle(userKey))
  }, [
    userKey,
    session?.preferences?.theme,
    session?.preferences?.accentId,
    session?.preferences?.customHex,
    session?.preferences?.sidebarStyle,
    session?.appliedUpdates,
  ])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    writeScopedPref('tradeal-theme', theme, userKey)
    if (brandingEnabled) {
      applyAccentColor(accentId, theme === 'dark', customHex)
    } else {
      applySystemAccentColor(theme === 'dark')
    }
  }, [theme, accentId, customHex, userKey, brandingEnabled])

  const skipNextPersist = useRef(true)
  useEffect(() => {
    if (!userKey) return
    if (skipNextPersist.current) {
      skipNextPersist.current = false
      return
    }
    if (brandingEnabled) {
      schedulePersistPreferences({ theme, accentId, customHex, sidebarStyle })
    } else {
      schedulePersistPreferences({ theme })
    }
  }, [theme, accentId, customHex, sidebarStyle, userKey, brandingEnabled])

  useEffect(() => {
    skipNextPersist.current = true
  }, [userKey])

  const toggleTheme = () => setThemeState(t => (t === 'light' ? 'dark' : 'light'))
  const setTheme = (next: Theme) => setThemeState(next)
  const setAccentId = useCallback(
    (next: string) => {
      if (!brandingEnabled) return
      setAccentIdState(next)
      storeAccentId(next, userKey)
    },
    [userKey, brandingEnabled],
  )
  const setCustomAccent = useCallback(
    (hex: string) => {
      if (!brandingEnabled) return
      const next = normalizeHex(hex)
      setCustomHexState(next)
      storeCustomHex(next, userKey)
      setAccentIdState(CUSTOM_ACCENT_ID)
      storeAccentId(CUSTOM_ACCENT_ID, userKey)
    },
    [userKey, brandingEnabled],
  )
  const setSidebarStyle = useCallback(
    (next: SidebarStyle) => {
      if (!brandingEnabled) return
      setSidebarStyleState(next)
      storeSidebarStyle(next, userKey)
    },
    [userKey, brandingEnabled],
  )

  const effectiveSidebarStyle: SidebarStyle = brandingEnabled ? sidebarStyle : 'default'
  const effectiveAccentId = brandingEnabled ? accentId : SYSTEM_ACCENT_PRESET.id
  const accentPreset = useMemo(
    () => (brandingEnabled ? resolveAccent(accentId, customHex) : SYSTEM_ACCENT_PRESET),
    [brandingEnabled, accentId, customHex],
  )

  return (
    <ThemeContext.Provider value={{
      theme,
      toggleTheme,
      setTheme,
      accentId: effectiveAccentId,
      accentPreset,
      accentPresets: ACCENT_PRESETS,
      customHex,
      setAccentId,
      setCustomAccent,
      sidebarStyle: effectiveSidebarStyle,
      setSidebarStyle,
      brandingEnabled,
    }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
