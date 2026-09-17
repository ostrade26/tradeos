const INBOX_PATHS = ['/notifications', '/app/notifications', '/platform-admin/notifications']

function pathnameOf(value: string): string {
  return (value.split('?')[0] || '/').replace(/\/+$/, '') || '/'
}

function isInboxPath(pathname: string): boolean {
  return INBOX_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`))
}

/** Page the requester was on — never the inbox query they happened to have open. */
export function captureFeedbackPagePath(pathname: string, search: string): string {
  const path = pathnameOf(pathname)
  if (isInboxPath(path)) return ''
  const params = new URLSearchParams(search)
  params.delete('compose')
  params.delete('id')
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

export function isUsefulFeedbackPagePath(value: string | undefined | null): boolean {
  const path = (value || '').trim()
  if (!path) return false
  return !isInboxPath(pathnameOf(path))
}
