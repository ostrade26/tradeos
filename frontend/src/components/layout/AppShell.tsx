import { useEffect, useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { DetailPanelColumn, DetailPanelRouteSync, DetailPanelSlotProvider } from './DetailPanelSlot'
import { GlobalCommandPalette } from './GlobalCommandPalette'
import { FloatingCreateCta } from './FloatingCreateCta'
import { AssistantPanel } from '../assistant/AssistantPanel'
import { ApiStatusBanner } from './ApiStatusBanner'
import { initOverlayScrollbars } from '../../lib/overlayScrollbars'
import { lockBodyScroll, unlockBodyScroll } from '../../lib/bodyScrollLock'
import { usePermissions } from '../../hooks/useAuth'
import { appPath } from '../../lib/appShellMode'

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export function AppShell() {
  const { hasPermission } = usePermissions()
  const [commandOpen, setCommandOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

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
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
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
  }, [hasPermission, navigate])

  return (
    <DetailPanelSlotProvider>
      <DetailPanelRouteSync />
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
          <ApiStatusBanner />
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
        <AssistantPanel
          open={assistantOpen}
          onClose={() => setAssistantOpen(false)}
        />
        <FloatingCreateCta />
      </div>
    </DetailPanelSlotProvider>
  )
}
