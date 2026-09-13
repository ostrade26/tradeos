const SCROLL_END_MS = 700

function getScrollableElement(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el
  while (node && node !== document.documentElement) {
    if (node.classList.contains('scrollbar-none')) return null
    const { overflowY, overflowX } = getComputedStyle(node)
    const scrollsY = (overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight
    const scrollsX = (overflowX === 'auto' || overflowX === 'scroll') && node.scrollWidth > node.clientWidth
    if (scrollsY || scrollsX) return node
    node = node.parentElement
  }
  return null
}

/** Scrollbars appear while scrolling or when the scroll area has focus; hidden otherwise. */
export function initOverlayScrollbars(): () => void {
  const timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>()

  const markScrolling = (el: HTMLElement) => {
    if (el.classList.contains('scrollbar-none')) return
    el.classList.add('is-scrolling')
    const prev = timers.get(el)
    if (prev) clearTimeout(prev)
    timers.set(el, setTimeout(() => {
      el.classList.remove('is-scrolling')
      timers.delete(el)
    }, SCROLL_END_MS))
  }

  const onScroll = (e: Event) => {
    if (e.target instanceof HTMLElement) markScrolling(e.target)
  }

  const onFocusIn = (e: FocusEvent) => {
    if (!(e.target instanceof HTMLElement)) return
    const scrollable = getScrollableElement(e.target)
    scrollable?.classList.add('scrollbar-focused')
  }

  const onFocusOut = (e: FocusEvent) => {
    if (!(e.target instanceof HTMLElement)) return
    const scrollable = getScrollableElement(e.target)
    if (!scrollable) return
    requestAnimationFrame(() => {
      if (!scrollable.contains(document.activeElement)) {
        scrollable.classList.remove('scrollbar-focused')
      }
    })
  }

  document.addEventListener('scroll', onScroll, { capture: true, passive: true })
  document.addEventListener('focusin', onFocusIn, true)
  document.addEventListener('focusout', onFocusOut, true)

  return () => {
    document.removeEventListener('scroll', onScroll, true)
    document.removeEventListener('focusin', onFocusIn, true)
    document.removeEventListener('focusout', onFocusOut, true)
  }
}
