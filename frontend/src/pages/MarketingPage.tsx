import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { APP_HOME } from '../lib/appShellMode'
import MarketingApp from '../../marketing/src/App'
import './marketing-site.css'

export function MarketingPage({ preview = false }: { preview?: boolean }) {
  const { isAuthenticated, isPlatformAdmin } = useAuth()
  const showSite = preview || !isAuthenticated

  useEffect(() => {
    if (!showSite) return
    document.documentElement.classList.add('marketing-site')
    return () => document.documentElement.classList.remove('marketing-site')
  }, [showSite])

  if (!showSite) {
    return <Navigate to={isPlatformAdmin ? '/platform-admin/organisations' : APP_HOME} replace />
  }

  return <MarketingApp />
}
