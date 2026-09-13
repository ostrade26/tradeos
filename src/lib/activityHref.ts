/** Map an activity entityRef to an in-app route. */
export function activityEntityHref(entityRef?: string | null): string | null {
  if (!entityRef) return null
  const ref = entityRef.trim()
  if (!ref) return null

  if (/^PO-\d+/i.test(ref)) {
    return `/purchase-orders?ref=${encodeURIComponent(ref)}`
  }
  if (/^SO-\d+/i.test(ref)) {
    return `/sales-orders?ref=${encodeURIComponent(ref)}`
  }
  const lift = ref.match(/^Lift-(\d+)$/i)
  if (lift) {
    return `/lifts?ref=${encodeURIComponent(lift[1])}`
  }
  if (/^LOT[-_]/i.test(ref) || ref.startsWith('lot-')) {
    return `/inventory/${encodeURIComponent(ref)}`
  }
  if (/^CC-/i.test(ref)) {
    return `/contracts?q=${encodeURIComponent(ref)}`
  }
  return null
}
