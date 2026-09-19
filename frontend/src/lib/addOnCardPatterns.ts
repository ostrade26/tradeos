import type { CSSProperties } from 'react'
import type { AddOnIllustrationKind } from './featureOfferVisuals'

export type AddOnGeometricPatternKind = 'dots' | 'grid' | 'lines' | 'diagonal' | 'cross'

const PATTERN_CYCLE: AddOnGeometricPatternKind[] = ['dots', 'grid', 'lines', 'diagonal', 'cross']

/** Tint matched to category wash — kept very light so pattern stays subtle. */
const PATTERN_INK: Record<AddOnIllustrationKind, string> = {
  neutral: 'rgba(100, 116, 139, 0.035)',
  ai: 'rgba(56, 189, 248, 0.04)',
  analytics: 'rgba(236, 72, 153, 0.035)',
  connect: 'rgba(249, 115, 22, 0.035)',
  ops: 'rgba(16, 185, 129, 0.035)',
  spark: 'rgba(6, 182, 212, 0.035)',
}

const PATTERN_INK_DARK: Record<AddOnIllustrationKind, string> = {
  neutral: 'rgba(148, 163, 184, 0.05)',
  ai: 'rgba(125, 211, 252, 0.05)',
  analytics: 'rgba(244, 114, 182, 0.05)',
  connect: 'rgba(251, 146, 60, 0.05)',
  ops: 'rgba(52, 211, 153, 0.05)',
  spark: 'rgba(34, 211, 238, 0.05)',
}

function hashKey(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i += 1) {
    h = (Math.imul(31, h) + key.charCodeAt(i)) >>> 0
  }
  return h
}

function patternStyle(kind: AddOnGeometricPatternKind, ink: string): CSSProperties {
  switch (kind) {
    case 'dots':
      return {
        backgroundImage: `radial-gradient(circle, ${ink} 1px, transparent 1px)`,
        backgroundSize: '13px 13px',
        backgroundPosition: '0 0',
      }
    case 'grid':
      return {
        backgroundImage: `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`,
        backgroundSize: '15px 15px',
        backgroundPosition: '0 0',
      }
    case 'lines':
      return {
        backgroundImage: `repeating-linear-gradient(0deg, ${ink} 0, ${ink} 1px, transparent 1px, transparent 9px)`,
        backgroundSize: '100% 9px',
      }
    case 'diagonal':
      return {
        backgroundImage: `repeating-linear-gradient(-45deg, ${ink} 0, ${ink} 1px, transparent 1px, transparent 11px)`,
        backgroundSize: '11px 11px',
      }
    case 'cross':
      return {
        backgroundImage: `repeating-linear-gradient(45deg, ${ink} 0, ${ink} 1px, transparent 1px, transparent 10px), repeating-linear-gradient(-45deg, ${ink} 0, ${ink} 1px, transparent 1px, transparent 10px)`,
        backgroundSize: '10px 10px',
      }
    default:
      return patternStyle('dots', ink)
  }
}

export type AddOnCardGeometricPattern = {
  kind: AddOnGeometricPatternKind
  style: CSSProperties
  styleDark: CSSProperties
}

export function addOnCardGeometricPattern(
  featureKey: string,
  illustration: AddOnIllustrationKind,
): AddOnCardGeometricPattern {
  const kind = PATTERN_CYCLE[hashKey(featureKey) % PATTERN_CYCLE.length]!
  const ink = PATTERN_INK[illustration]
  const inkDark = PATTERN_INK_DARK[illustration]
  return {
    kind,
    style: patternStyle(kind, ink),
    styleDark: patternStyle(kind, inkDark),
  }
}

/** Radial mask so pattern reads in the top-right with the color wash. */
export const ADDON_CARD_PATTERN_MASK =
  '[mask-image:radial-gradient(ellipse_100%_95%_at_82%_8%,#000_45%,transparent_78%)]'
