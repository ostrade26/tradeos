import { preferenceUserKey, readScopedPref, writeScopedPref } from './userPreferences'

export interface AccentPreset {
  id: string
  label: string
  accent: string
  hover: string
}

/** Four distinct primaries from the system colour set (white excluded). */
export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'blue', label: 'Blue', accent: '#007AFF', hover: '#0062cc' },
  { id: 'green', label: 'Green', accent: '#34C759', hover: '#248a3d' },
  { id: 'orange', label: 'Orange', accent: '#FF9500', hover: '#cc7700' },
  { id: 'purple', label: 'Purple', accent: '#AF52DE', hover: '#8c35b8' },
]

export const CUSTOM_ACCENT_ID = 'custom'
export const DEFAULT_ACCENT_ID = ACCENT_PRESETS[0].id
export const DEFAULT_CUSTOM_HEX = '#007AFF'

const STORAGE_KEY = 'tradeal-accent'
const CUSTOM_STORAGE_KEY = 'tradeal-accent-custom'

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '')
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  }
}

export function normalizeHex(hex: string, fallback = DEFAULT_CUSTOM_HEX): string {
  let value = hex.trim()
  if (!value.startsWith('#')) value = `#${value}`
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    value = `#${[...value.slice(1)].map(ch => ch + ch).join('')}`
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) return fallback.toLowerCase()
  return value.toLowerCase()
}

export function darkenHex(hex: string, amount = 0.18): string {
  const { r, g, b } = hexToRgb(normalizeHex(hex))
  const factor = 1 - amount
  const channel = (n: number) => Math.max(0, Math.min(255, Math.round(n * factor))).toString(16).padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

export function accentMutedColor(accent: string, dark: boolean): string {
  const { r, g, b } = hexToRgb(normalizeHex(accent))
  return dark ? `rgba(${r}, ${g}, ${b}, 0.18)` : `rgba(${r}, ${g}, ${b}, 0.1)`
}

export function getStoredCustomHex(userKey?: string | null): string {
  return normalizeHex(readScopedPref(CUSTOM_STORAGE_KEY, userKey) ?? DEFAULT_CUSTOM_HEX)
}

export function storeCustomHex(hex: string, userKey?: string | null) {
  writeScopedPref(CUSTOM_STORAGE_KEY, normalizeHex(hex), userKey)
}

export function resolveAccent(id: string, customHex = getStoredCustomHex()): AccentPreset {
  if (id === CUSTOM_ACCENT_ID) {
    const accent = normalizeHex(customHex)
    return { id: CUSTOM_ACCENT_ID, label: 'Custom', accent, hover: darkenHex(accent) }
  }
  return ACCENT_PRESETS.find(preset => preset.id === id) ?? ACCENT_PRESETS[0]
}

export function getAccentPreset(id: string): AccentPreset {
  return resolveAccent(id)
}

export function getStoredAccentId(userKey?: string | null): string {
  const stored = readScopedPref(STORAGE_KEY, userKey)
  if (stored === CUSTOM_ACCENT_ID) return CUSTOM_ACCENT_ID
  return stored && ACCENT_PRESETS.some(preset => preset.id === stored) ? stored : DEFAULT_ACCENT_ID
}

export function applyAccentColor(accentId: string, dark = false, customHex = getStoredCustomHex()) {
  if (typeof document === 'undefined') return

  const preset = resolveAccent(accentId, customHex)
  const root = document.documentElement
  root.style.setProperty('--color-accent', preset.accent)
  root.style.setProperty('--color-accent-hover', preset.hover)
  root.style.setProperty('--color-accent-muted', accentMutedColor(preset.accent, dark))
}

export function initAccentColor() {
  const userKey = preferenceUserKey()
  const dark = readScopedPref('tradeal-theme', userKey) === 'dark'
  applyAccentColor(getStoredAccentId(userKey), dark, getStoredCustomHex(userKey))
}

export function storeAccentId(accentId: string, userKey?: string | null) {
  writeScopedPref(STORAGE_KEY, accentId, userKey)
}
