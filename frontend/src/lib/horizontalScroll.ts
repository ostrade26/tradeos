/** Attach Shift+wheel (and horizontal wheel) → scrollLeft for mouse users. */
export function attachShiftWheelHorizontalScroll(el: HTMLElement): () => void {
  const onWheel = (e: WheelEvent) => {
    if (el.scrollWidth <= el.clientWidth + 1) return

    let delta = 0
    if (e.shiftKey) {
      // Mouse wheel: Shift+vertical → horizontal
      delta = e.deltaY !== 0 ? e.deltaY : e.deltaX
    } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      // Trackpad / tilt wheel already sending horizontal delta
      delta = e.deltaX
    } else {
      return
    }
    if (!delta) return

    const max = el.scrollWidth - el.clientWidth
    const next = Math.min(max, Math.max(0, el.scrollLeft + delta))
    if (next === el.scrollLeft) return
    e.preventDefault()
    el.scrollLeft = next
  }

  el.addEventListener('wheel', onWheel, { passive: false })
  return () => el.removeEventListener('wheel', onWheel)
}
