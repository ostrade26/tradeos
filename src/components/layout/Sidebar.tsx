import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Package,
  BookUser, BarChart3, Activity, ChevronLeft, FileText,
  ArrowDownToLine, ArrowUpFromLine, Scale, X, ClipboardList
} from 'lucide-react'
import { cn } from '../../lib/utils'

const tradingNav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/purchase-orders', icon: ArrowDownToLine, label: 'Purchase Orders' },
  { to: '/sales-orders', icon: ArrowUpFromLine, label: 'Sales Orders' },
  { to: '/lifts', icon: Scale, label: 'Lift Register' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/contracts', icon: FileText, label: 'Contracts' },
]

const platformNav = [
  { to: '/directory', icon: BookUser, label: 'Directory' },
  { to: '/reports', icon: ClipboardList, label: 'Reports' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/activity', icon: Activity, label: 'Activity' },
]

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen = false, onMobileClose }: SidebarProps) {
  const showLabels = !collapsed || mobileOpen
  const iconOnly = collapsed && !mobileOpen

  const navClass = ({ isActive }: { isActive: boolean }) => cn(
    'flex items-center rounded-lg text-[15px] transition-colors duration-150',
    iconOnly ? 'justify-center px-0 py-2.5 min-h-[44px]' : 'gap-2.5 px-2.5 py-2.5 min-h-[44px]',
    isActive
      ? 'text-accent font-medium'
      : 'text-gray-600 hover:text-accent dark:text-muted dark:hover:text-accent',
  )

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onMobileClose} aria-hidden />
      )}

      <aside
        className={cn(
          'app-menu flex flex-col overflow-hidden bg-white dark:bg-card border-r border-gray-200/80 dark:border-gray-700/50',
          'transition-all duration-300 ease-out shrink-0',
          'fixed inset-y-0 left-0 z-50 lg:static lg:z-auto',
          'h-viewport',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          iconOnly ? 'w-[70px]' : 'w-[min(15rem,88vw)] lg:w-60',
        )}
      >
        <div className={cn(
          'flex h-[70px] items-center shrink-0 border-b border-gray-200/80 dark:border-gray-700/50',
          iconOnly ? 'justify-center px-2' : 'justify-between px-4',
        )}>
          {showLabels ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent">
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
                  <path d="M2 12L7 7L10 10L14 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="text-lg font-semibold text-heading truncate">TradeOS</span>
            </div>
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent">
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
                <path d="M2 12L7 7L10 10L14 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          )}
          {!iconOnly && (
            <button
              onClick={() => mobileOpen ? onMobileClose?.() : onToggleCollapse()}
              className="rounded-full p-1.5 text-muted hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700/50 cursor-pointer attex-focus"
              aria-label={mobileOpen ? 'Close menu' : 'Collapse sidebar'}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : (
                <ChevronLeft className={cn('h-5 w-5 transition-transform duration-300', collapsed && 'rotate-180')} />
              )}
            </button>
          )}
        </div>

        {iconOnly && (
          <button
            onClick={onToggleCollapse}
            className="mx-auto mt-2 rounded-full p-1.5 text-muted hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700/50 cursor-pointer attex-focus"
            aria-label="Expand sidebar"
          >
            <ChevronLeft className="h-5 w-5 rotate-180" />
          </button>
        )}

        <nav className="flex-1 overflow-y-auto overscroll-contain px-2.5 py-2 pb-[env(safe-area-inset-bottom)]">
          {showLabels && (
            <p className="px-2.5 py-2 text-xs font-bold uppercase tracking-wider text-muted opacity-90">Trading</p>
          )}
          <div className="space-y-0.5 mb-3">
            {tradingNav.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={iconOnly ? item.label : undefined}
                className={navClass}
                onClick={onMobileClose}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {showLabels && item.label}
              </NavLink>
            ))}
          </div>

          {showLabels && (
            <p className="px-2.5 py-2 text-xs font-bold uppercase tracking-wider text-muted opacity-90">Platform</p>
          )}
          <div className="space-y-0.5">
            {platformNav.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                title={iconOnly ? item.label : undefined}
                className={navClass}
                onClick={onMobileClose}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {showLabels && item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </aside>
    </>
  )
}
