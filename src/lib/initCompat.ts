import { randomUUID } from './randomId'

/** Runtime fixes for cross-browser / cross-platform consistency. */
export function initCompat(): void {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID !== 'function') {
    try {
      Object.defineProperty(crypto, 'randomUUID', {
        value: randomUUID,
        configurable: true,
      })
    } catch {
      // randomId() is used directly where needed
    }
  }

  if (typeof window.matchMedia === 'function') {
    if (window.matchMedia('(pointer: coarse)').matches) {
      document.documentElement.classList.add('touch')
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.classList.add('motion-reduce')
    }
  }
}
