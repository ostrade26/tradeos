/** True when the current route uses the platform-admin console (not org trading app). */
export function isPlatformAdminPath(pathname: string): boolean {
  return pathname.startsWith('/platform-admin')
}
