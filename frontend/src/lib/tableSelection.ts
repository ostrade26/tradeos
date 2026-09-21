/** Meta passed from DataTable when a row checkbox is clicked. */
export type RowSelectMeta = {
  shiftKey: boolean
  visibleIds: string[]
}

/**
 * Toggle one row, or Shift+click to select the inclusive range from the last
 * anchor through the clicked id (using the currently visible row order).
 */
export function applyRowSelection(
  prev: string[],
  id: string,
  meta: RowSelectMeta | undefined,
  anchorId: string | null,
): { selected: string[]; anchorId: string | null } {
  if (meta?.shiftKey && anchorId && meta.visibleIds.length > 0) {
    const from = meta.visibleIds.indexOf(anchorId)
    const to = meta.visibleIds.indexOf(id)
    if (from !== -1 && to !== -1) {
      const lo = Math.min(from, to)
      const hi = Math.max(from, to)
      const range = meta.visibleIds.slice(lo, hi + 1)
      return {
        selected: [...new Set([...prev, ...range])],
        anchorId,
      }
    }
  }

  const selected = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  return { selected, anchorId: id }
}
