/** Organisation trading desk home (public `/` is the marketing site). */
export const APP_HOME = '/app'

/** Prefix an organisation route so it lives under `/app`, like platform-admin under `/platform-admin`. */
export function appPath(path: string = ''): string {
  if (!path || path === '/') return APP_HOME
  const url = path.startsWith('/') ? path : `/${path}`
  if (
    url === APP_HOME
    || url.startsWith(`${APP_HOME}/`)
    || url.startsWith(`${APP_HOME}?`)
    || url.startsWith(`${APP_HOME}#`)
  ) {
    return url
  }
  return `${APP_HOME}${url}`
}

export function isAppPath(pathname: string): boolean {
  return pathname === APP_HOME || pathname.startsWith(`${APP_HOME}/`)
}

/** True when the current route uses the platform-admin console (not org trading app). */
export function isPlatformAdminPath(pathname: string): boolean {
  return pathname.startsWith('/platform-admin')
}
