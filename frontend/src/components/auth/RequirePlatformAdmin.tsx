import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

/** Tradeal platform administrator only — not organisation admins. */
export function RequirePlatformAdmin() {
  const { isPlatformAdmin } = useAuth()

  if (!isPlatformAdmin) {
    return <Navigate to="/app" replace />
  }

  return <Outlet />
}
