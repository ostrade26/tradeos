import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
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
import { storageGet, storageSet } from '../lib/storage'

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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = storageGet('tradeos-theme')
    return (stored as Theme) || 'light'
  })
  const [accentId, setAccentIdState] = useState(getStoredAccentId)
  const [customHex, setCustomHexState] = useState(getStoredCustomHex)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    storageSet('tradeos-theme', theme)
    applyAccentColor(accentId, theme === 'dark', customHex)
  }, [theme, accentId, customHex])

  const toggleTheme = () => setThemeState(t => (t === 'light' ? 'dark' : 'light'))
  const setTheme = (next: Theme) => setThemeState(next)
  const setAccentId = (next: string) => {
    setAccentIdState(next)
    storeAccentId(next)
  }
  const setCustomAccent = (hex: string) => {
    const next = normalizeHex(hex)
    setCustomHexState(next)
    storeCustomHex(next)
    setAccentIdState(CUSTOM_ACCENT_ID)
    storeAccentId(CUSTOM_ACCENT_ID)
  }

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
