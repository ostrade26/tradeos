/** Organisation trading desk home (public `/` is the marketing site). */
export const APP_HOME = '/app'

/** True when the current route uses the platform-admin console (not org trading app). */
export function isPlatformAdminPath(pathname: string): boolean {
  return pathname.startsWith('/platform-admin')
}
