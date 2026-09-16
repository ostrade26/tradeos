import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  applyAccentColor,
  getStoredAccentId,
  getStoredCustomHex,
  storeAccentId,
  storeCustomHex,
  resolveAccent,
  type AccentPreset,
  ACCENT_PRESETS,
  CUSTOM_ACCENT_ID,
  normalizeHex,
} from '../lib/accentColor'
import { readScopedPref, writeScopedPref } from '../lib/userPreferences'
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
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readTheme(userKey: string | null): Theme {
  const stored = readScopedPref('tradeal-theme', userKey)
  return stored === 'dark' ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userKey = session?.username ?? null

  const [theme, setThemeState] = useState<Theme>(() => readTheme(userKey))
  const [accentId, setAccentIdState] = useState(() => getStoredAccentId(userKey))
  const [customHex, setCustomHexState] = useState(() => getStoredCustomHex(userKey))

  useEffect(() => {
    setThemeState(readTheme(userKey))
    setAccentIdState(getStoredAccentId(userKey))
    setCustomHexState(getStoredCustomHex(userKey))
  }, [userKey])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    writeScopedPref('tradeal-theme', theme, userKey)
    applyAccentColor(accentId, theme === 'dark', customHex)
  }, [theme, accentId, customHex, userKey])

  const skipNextPersist = useRef(true)
  useEffect(() => {
    if (!userKey) return
    if (skipNextPersist.current) {
      skipNextPersist.current = false
      return
    }
    schedulePersistPreferences({ theme, accentId, customHex })
  }, [theme, accentId, customHex, userKey])

  useEffect(() => {
    skipNextPersist.current = true
  }, [userKey])

  const toggleTheme = () => setThemeState(t => (t === 'light' ? 'dark' : 'light'))
  const setTheme = (next: Theme) => setThemeState(next)
  const setAccentId = useCallback(
    (next: string) => {
      setAccentIdState(next)
      storeAccentId(next, userKey)
    },
    [userKey],
  )
  const setCustomAccent = useCallback(
    (hex: string) => {
      const next = normalizeHex(hex)
      setCustomHexState(next)
      storeCustomHex(next, userKey)
      setAccentIdState(CUSTOM_ACCENT_ID)
      storeAccentId(CUSTOM_ACCENT_ID, userKey)
    },
    [userKey],
  )

  const accentPreset = resolveAccent(accentId, customHex)

  return (
    <ThemeContext.Provider value={{
      theme,
      toggleTheme,
      setTheme,
      accentId,
      accentPreset,
      accentPresets: ACCENT_PRESETS,
      customHex,
      setAccentId,
      setCustomAccent,
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
