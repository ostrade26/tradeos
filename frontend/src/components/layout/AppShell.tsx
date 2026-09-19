import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { authApi } from '../../api/tradeApi'
import { sessionFromApi } from '../../lib/authSession'
import { ORG_PRODUCT_GUIDE_STEPS } from '../../lib/productGuideTour'
import { AccountSetupWelcome } from '../onboarding/AccountSetupWelcome'
import { ProductGuideTour } from '../onboarding/ProductGuideTour'
import {
  clearPendingAccountWelcome,
  markPendingAccountWelcome,
  shouldShowAccountWelcome,
} from '../../lib/firstLoginWelcome'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { DetailPanelColumn, DetailPanelRouteSync, DetailPanelSlotProvider } from './DetailPanelSlot'
import { GlobalCommandPalette } from './GlobalCommandPalette'
import { FloatingCreateCta } from './FloatingCreateCta'
import { AssistantPanel } from '../assistant/AssistantPanel'
import { ApiServiceIssueWatch } from './ApiServiceIssueWatch'
import { initOverlayScrollbars } from '../../lib/overlayScrollbars'
import { lockBodyScroll, unlockBodyScroll } from '../../lib/bodyScrollLock'
import { useAuth, usePermissions } from '../../hooks/useAuth'
import { useAssistantEnabled } from '../../lib/assistant/useAssistantEnabled'
import { setAssistantOpen } from '../../lib/assistant/session'
import { APP_HOME, appPath, isPlatformAdminPath } from '../../lib/appShellMode'
import { ProductTourProvider } from '../../contexts/ProductTourContext'

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export function AppShell() {
  const { hasPermission } = usePermissions()
  const { session, applySession, isPlatformAdmin } = useAuth()
  const assistantEnabled = useAssistantEnabled()
  const [commandOpen, setCommandOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [productTourOpen, setProductTourOpen] = useState(false)
  const [accountWelcomeOpen, setAccountWelcomeOpen] = useState(false)
  const tourStartedRef = useRef(false)
  const pendingReplayOnDashboardRef = useRef(false)
  const navigate = useNavigate()
  const location = useLocation()

  const isDashboardPath = (pathname: string) =>
    pathname === APP_HOME || pathname === `${APP_HOME}/`

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  const openProductTour = useCallback(() => {
    setSidebarCollapsed(false)
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      setMobileNavOpen(true)
    }
    window.setTimeout(() => setProductTourOpen(true), 400)
  }, [])

  useEffect(() => {
    if (!pendingReplayOnDashboardRef.current || !isDashboardPath(location.pathname)) return
    pendingReplayOnDashboardRef.current = false
    openProductTour()
  }, [location.pathname, openProductTour])

  useEffect(() => {
    if (!session || isPlatformAdmin) return
    if (shouldShowAccountWelcome(session)) {
      setAccountWelcomeOpen(true)
    }
  }, [isPlatformAdmin, session])

  const finishAccountWelcome = useCallback(async () => {
    setAccountWelcomeOpen(false)
    clearPendingAccountWelcome()
    if (session?.token) {
      try {
        const me = await authApi.updatePreferences({ completedOrgAccountWelcome: true })
        applySession(sessionFromApi(me, session.token))
      } catch {
        /* still continue to product guide */
      }
    }
    if (!isDashboardPath(location.pathname)) {
      navigate(APP_HOME)
    }
    tourStartedRef.current = true
    window.setTimeout(() => openProductTour(), 300)
  }, [applySession, location.pathname, navigate, openProductTour, session?.token])

  useEffect(() => {
    if (!session || isPlatformAdmin || isPlatformAdminPath(location.pathname) || tourStartedRef.current) {
      return
    }
    if (accountWelcomeOpen) return
    if (session.preferences?.completedOrgProductTour) return
    if (
      !session.preferences?.completedOrgAccountWelcome &&
      shouldShowAccountWelcome(session)
    ) {
      return
    }

    tourStartedRef.current = true
    const state = location.state as { startProductTour?: boolean } | null
    if (state?.startProductTour) {
      navigate(
        { pathname: location.pathname, search: location.search, hash: location.hash },
        { replace: true, state: {} },
      )
    }
    openProductTour()
  }, [
    isPlatformAdmin,
    location.hash,
    location.pathname,
    location.search,
    location.state,
    navigate,
    accountWelcomeOpen,
    openProductTour,
    session,
  ])

  const finishProductTour = useCallback(async () => {
    setProductTourOpen(false)
    setMobileNavOpen(false)
    if (!session?.token) return
    try {
      const me = await authApi.updatePreferences({ completedOrgProductTour: true })
      applySession(sessionFromApi(me, session.token))
    } catch {
      /* tour still closes */
    }
  }, [applySession, session?.token])

  const replayProductTour = useCallback(async () => {
    if (!session?.token || isPlatformAdmin) return
    try {
      const me = await authApi.updatePreferences({ completedOrgProductTour: false })
      applySession(sessionFromApi(me, session.token))
    } catch {
      /* tour can still run; pref sync is best-effort for replay */
    }
    tourStartedRef.current = true
    if (isDashboardPath(location.pathname)) {
      openProductTour()
      return
    }
    pendingReplayOnDashboardRef.current = true
    navigate(APP_HOME)
  }, [applySession, isPlatformAdmin, location.pathname, navigate, openProductTour, session?.token])

  const replayAccountSetup = useCallback(async () => {
    if (!session?.token || isPlatformAdmin) return
    setProductTourOpen(false)
    try {
      const me = await authApi.updatePreferences({ completedOrgAccountWelcome: false })
      applySession(sessionFromApi(me, session.token))
    } catch {
      /* still open setup UI */
    }
    markPendingAccountWelcome()
    tourStartedRef.current = true
    setAccountWelcomeOpen(true)
  }, [applySession, isPlatformAdmin, session?.token])

  useEffect(() => initOverlayScrollbars(), [])

  useEffect(() => {
    if (!mobileNavOpen) return
    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [mobileNavOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandOpen(true)
      }
      if (assistantEnabled && (e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        setAssistantOpen(true)
      }
      if (isTypingTarget(e.target)) return
      if (e.key === 'F1' && hasPermission('purchase.create')) { e.preventDefault(); navigate(appPath('/purchase-orders/new')) }
      if (e.key === 'F3' && hasPermission('sales.create')) { e.preventDefault(); navigate(appPath('/sales-orders/new')) }
      if (e.key === 'F5' && hasPermission('lifts.create')) { e.preventDefault(); navigate(appPath('/lifts/new')) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [assistantEnabled, hasPermission, navigate])

  return (
    <DetailPanelSlotProvider>
      <DetailPanelRouteSync />
      <ProductTourProvider replayProductTour={replayProductTour} replayAccountSetup={replayAccountSetup}>
      <div className="flex h-viewport overflow-hidden bg-body wrapper">
        <a href="#main-content" className="skip-to-main">
          Skip to main content
        </a>
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(c => !c)}
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />

        <div className="page-content flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden transition-all duration-300">
          <Header
            onOpenCommand={() => setCommandOpen(true)}
            onOpenAssistant={() => setAssistantOpen(true)}
            onOpenMobileNav={() => setMobileNavOpen(true)}
          />
          <ApiServiceIssueWatch />
          <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
            <main
              id="main-content"
              tabIndex={-1}
              className="relative z-0 flex flex-1 min-h-0 min-w-0 flex-col overflow-y-auto p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            >
              <Outlet />
            </main>
            <DetailPanelColumn />
          </div>
        </div>

        <GlobalCommandPalette
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          onOpenAssistant={() => { setCommandOpen(false); setAssistantOpen(true) }}
        />
        {assistantEnabled ? <AssistantPanel /> : null}
        <FloatingCreateCta />
        {session && !isPlatformAdmin ? (
          <AccountSetupWelcome
            open={accountWelcomeOpen}
            session={session}
            onComplete={() => void finishAccountWelcome()}
          />
        ) : null}
        <ProductGuideTour
          open={productTourOpen}
          steps={ORG_PRODUCT_GUIDE_STEPS}
          onComplete={() => void finishProductTour()}
          onSkip={() => void finishProductTour()}
        />
      </div>
      </ProductTourProvider>
    </DetailPanelSlotProvider>
  )
}
