import { Navigate } from 'react-router-dom'
import { usePermissions } from '../../hooks/useAuth'

export function RequireEditOrders({ children }: { children: React.ReactNode }) {
  const { canEditOrders } = usePermissions()

  if (!canEditOrders) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
