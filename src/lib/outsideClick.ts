/** pointerdown with mousedown fallback for consistent outside-click detection. */
export function onOutsideClick(handler: (event: MouseEvent | PointerEvent) => void): () => void {
  const listener = (event: Event) => handler(event as MouseEvent | PointerEvent)
  document.addEventListener('pointerdown', listener, true)
  document.addEventListener('mousedown', listener, true)
  return () => {
    document.removeEventListener('pointerdown', listener, true)
    document.removeEventListener('mousedown', listener, true)
  }
}
