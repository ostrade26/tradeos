import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

/** Organisation members only — Tradeal platform admin is redirected to RBAC console. */
export function RequireOrganisationUser() {
  const { isPlatformAdmin, roleSlug } = useAuth()

  if (isPlatformAdmin || roleSlug === 'platform_admin') {
    return <Navigate to="/platform-admin/organisations" replace />
  }

  return <Outlet />
}
