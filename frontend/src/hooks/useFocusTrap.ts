import { useEffect, type RefObject } from 'react'

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(el => {
    if (el.getAttribute('aria-hidden') === 'true') return false
    if ((el as HTMLInputElement).readOnly) return false
    // Skip zero-size / visually hidden controls
    const style = window.getComputedStyle(el)
    if (style.visibility === 'hidden' || style.display === 'none') return false
    return true
  })
}

export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !containerRef.current) return

    const container = containerRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null

    // Prefer the first text/number field so qty inputs aren't fought by the close button.
    const focusable = getFocusable(container)
    const preferred =
      focusable.find(el => {
        if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return false
        const type = (el as HTMLInputElement).type
        return !type || type === 'text' || type === 'search' || type === 'tel' || type === 'email' || type === 'number'
      }) ?? focusable[0]

    // Only move focus if nothing inside the dialog is focused yet.
    if (!container.contains(document.activeElement)) {
      preferred?.focus()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = getFocusable(container)
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        }
      } else if (document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }

    container.addEventListener('keydown', onKeyDown)
    return () => {
      container.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [active, containerRef])
}
