import { preferenceUserKey, readScopedPref, writeScopedPref } from './userPreferences'

export interface AccentPreset {
  id: string
  label: string
  accent: string
  hover: string
}

/**
 * Quick presets — chosen for ≥4.5:1 contrast with white text
 * (primary buttons, selected chips).
 */
export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'blue', label: 'Blue', accent: '#0A66C2', hover: '#084e96' },
  { id: 'green', label: 'Green', accent: '#1B7A34', hover: '#155c28' },
  { id: 'orange', label: 'Orange', accent: '#B85C00', hover: '#8f4700' },
  { id: 'purple', label: 'Purple', accent: '#7E22CE', hover: '#6419a5' },
]

export const CUSTOM_ACCENT_ID = 'custom'
export const DEFAULT_ACCENT_ID = ACCENT_PRESETS[0].id
export const DEFAULT_CUSTOM_HEX = '#0A66C2'

/** Attex system default — used when Custom branding is locked. */
export const SYSTEM_ACCENT_HEX = '#3e60d5'
export const SYSTEM_ACCENT_HOVER = '#3553b8'
export const SYSTEM_ACCENT_PRESET: AccentPreset = {
  id: 'system',
  label: 'Default',
  accent: SYSTEM_ACCENT_HEX,
  hover: SYSTEM_ACCENT_HOVER,
}

/** Minimum contrast vs white for accent swatches (WCAG AA normal text). */
export const ACCENT_CONTRAST_MIN = 4.5

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

function srgbChannelToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Relative luminance (0–1) per WCAG 2.x. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(normalizeHex(hex))
  return (
    0.2126 * srgbChannelToLinear(r) +
    0.7152 * srgbChannelToLinear(g) +
    0.0722 * srgbChannelToLinear(b)
  )
}

/** Contrast ratio between two hex colours (1–21). */
export function contrastRatio(hexA: string, hexB: string): number {
  const l1 = relativeLuminance(hexA)
  const l2 = relativeLuminance(hexB)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/** True when hex keeps readable white text (and works as text on light surfaces). */
export function hasGoodAccentContrast(hex: string, minRatio = ACCENT_CONTRAST_MIN): boolean {
  return contrastRatio(normalizeHex(hex), '#ffffff') >= minRatio
}

/**
 * Safari-style block palette: vivid row, greys, then hue × shade grid.
 * Every swatch meets {@link ACCENT_CONTRAST_MIN} against white.
 */
export const BLOCK_COLOR_ROWS: string[][] = [
  // System / vivid
  [
    '#B91C1C', '#C2410C', '#B45309', '#1B7A34', '#0F766E', '#0E7490',
    '#1D4ED8', '#6D28D9', '#7E22CE', '#BE185D', '#78350F', '#1C1C1E',
  ],
  // Greyscale (skip lights — poor contrast on white text)
  [
    '#6B7280', '#4B5563', '#374151', '#1F2937', '#111827', '#000000',
  ],
  // Spectrum — darker → mid (all ≥4.5:1 vs white)
  [
    '#3e0909', '#3e1b09', '#3e2809', '#3e3609', '#243e09', '#093e1f',
    '#093e3a', '#092d3e', '#091b3e', '#16093e', '#36093e', '#3e0924',
  ],
  [
    '#500b0b', '#50220b', '#50340b', '#50450b', '#2e500b', '#0b5028',
    '#0b504b', '#0b3950', '#0b2250', '#1d0b50', '#450b50', '#500b2e',
  ],
  [
    '#620e0e', '#622a0e', '#623f0e', '#62540e', '#38620e', '#0e6231',
    '#0e625b', '#0e4662', '#0e2a62', '#230e62', '#540e62', '#620e38',
  ],
  [
    '#741111', '#743211', '#744b11', '#746311', '#427411', '#11743a',
    '#11746c', '#115374', '#113274', '#291174', '#631174', '#741142',
  ],
  [
    '#7d1212', '#7d3612', '#7d5012', '#7d6b12', '#477d12', '#127d3e',
    '#127d74', '#12597d', '#12367d', '#2d127d', '#6b127d', '#7d1247',
  ],
]

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

/** Force Attex system accent (Custom branding locked). */
export function applySystemAccentColor(dark = false) {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  root.style.setProperty('--color-accent', SYSTEM_ACCENT_HEX)
  root.style.setProperty('--color-accent-hover', SYSTEM_ACCENT_HOVER)
  root.style.setProperty('--color-accent-muted', accentMutedColor(SYSTEM_ACCENT_HEX, dark))
}

export function initAccentColor() {
  const userKey = preferenceUserKey()
  const dark = readScopedPref('tradeal-theme', userKey) === 'dark'
  applyAccentColor(getStoredAccentId(userKey), dark, getStoredCustomHex(userKey))
}

export function storeAccentId(accentId: string, userKey?: string | null) {
  writeScopedPref(STORAGE_KEY, accentId, userKey)
}
