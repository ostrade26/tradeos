/** Reference-counted scroll lock for overlays — avoids background scroll bleed on iOS. */

let lockCount = 0

export function lockBodyScroll(): void {
  lockCount += 1
  if (lockCount > 1) return

  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
  document.body.dataset.scrollLock = 'true'
  document.body.style.overflow = 'hidden'
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`
  }
}

export function unlockBodyScroll(): void {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount > 0) return

  delete document.body.dataset.scrollLock
  document.body.style.overflow = ''
  document.body.style.paddingRight = ''
}
