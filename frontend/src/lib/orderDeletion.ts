export const ORDER_DELETE_GRACE_DAYS = 7

export function deletionDateFromNow(from = new Date()): string {
  const d = new Date(from)
  d.setDate(d.getDate() + ORDER_DELETE_GRACE_DAYS)
  return d.toISOString()
}

export function formatDeletionDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

export function isDeletionDue(iso: string, now = new Date()): boolean {
  return new Date(iso).getTime() <= now.getTime()
}
