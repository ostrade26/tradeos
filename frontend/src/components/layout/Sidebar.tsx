import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Package,
  BookUser, BarChart3, Activity, ChevronLeft, FileText,
  ArrowDownToLine, ArrowUpFromLine, Scale, X, ClipboardList,
  Building2, Users, UserPlus, CreditCard, ScrollText, KeyRound, Wallet, ShieldCheck, Sparkles,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { isPlatformAdminPath } from '../../lib/appShellMode'
import { isSettingsAreaPath, SETTINGS_SECTIONS, settingsPath } from '../../lib/settingsSections'
import { usePermissions } from '../../hooks/useAuth'

/** Register routes — navigate with a clean URL (no `ref` from the previous register). */
function registerNavTo(path: string) {
  return { pathname: path }
}

const tradingNav = [
  { to: '/app', icon: LayoutDashboard, label: 'Dashboard', end: true, clearSearch: false },
  { to: '/purchase-orders', icon: ArrowDownToLine, label: 'Purchase Orders', clearSearch: true },
  { to: '/sales-orders', icon: ArrowUpFromLine, label: 'Sales Orders', clearSearch: true },
  { to: '/lifts', icon: Scale, label: 'Lift Register', clearSearch: true },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/contracts', icon: FileText, label: 'Contracts' },
]

const platformNav = [
  { to: '/directory', icon: BookUser, label: 'Directory' },
  { to: '/reports', icon: ClipboardList, label: 'Reports' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/activity', icon: Activity, label: 'Activity' },
]

const platformAdminNav = [
  { to: '/platform-admin/organisations', icon: Building2, label: 'Organisations', end: true },
  { to: '/platform-admin/plans', icon: CreditCard, label: 'Plans & Pricing' },
  { to: '/platform-admin/licenses', icon: KeyRound, label: 'Licences' },
  { to: '/platform-admin/amcs', icon: ShieldCheck, label: 'AMC / Renewals' },
  { to: '/platform-admin/seats', icon: Users, label: 'Seats' },
  { to: '/platform-admin/payments', icon: Wallet, label: 'Payments' },
  { to: '/platform-admin/releases', icon: Sparkles, label: 'Releases' },
  { to: '/platform-admin/seat-requests', icon: UserPlus, label: 'Seat requests' },
  { to: '/platform-admin/audit', icon: ScrollText, label: 'Audit' },
]

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen = false, onMobileClose }: SidebarProps) {
  const location = useLocation()
  const platformAdminMode = isPlatformAdminPath(location.pathname)
  const settingsMode = !platformAdminMode && isSettingsAreaPath(location.pathname)
  const { hasPermission } = usePermissions()
  const canManageOrganisation = hasPermission('organisation.edit')
  const showPlanInSettings =
    canManageOrganisation &&
    (hasPermission('organisation.subscription.view') || hasPermission('organisation.seats.request'))
  const showTeamInSettings = canManageOrganisation
  const settingsNavItems = SETTINGS_SECTIONS.filter(s => {
    if (s.planSection && !showPlanInSettings) return false
    if (s.teamSection && !showTeamInSettings) return false
    return true
  })
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
        data-overlay-dismiss="ignore"
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
              <span className="text-lg font-semibold text-heading truncate">Tradeal</span>
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
          {settingsMode ? (
            <>
              {showLabels && (
                <p className="px-2.5 py-2 text-xs font-bold uppercase tracking-wider text-muted opacity-90">
                  Settings
                </p>
              )}
              <div className="space-y-0.5 mb-3">
                <NavLink
                  to="/app"
                  end
                  title={iconOnly ? 'Dashboard' : undefined}
                  className={navClass}
                  onClick={onMobileClose}
                >
                  <LayoutDashboard className="h-5 w-5 shrink-0" />
                  {showLabels && 'Dashboard'}
                </NavLink>
              </div>
              {showLabels && (
                <p className="px-2.5 py-2 text-xs font-bold uppercase tracking-wider text-muted opacity-90">
                  Categories
                </p>
              )}
              <div className="space-y-0.5">
                {settingsNavItems.map(item => (
                  <NavLink
                    key={item.id}
                    to={settingsPath(item.segment)}
                    title={iconOnly ? item.label : undefined}
                    className={navClass}
                    onClick={onMobileClose}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {showLabels && item.label}
                  </NavLink>
                ))}
              </div>
            </>
          ) : platformAdminMode ? (
            <>
              {showLabels && (
                <p className="px-2.5 py-2 text-xs font-bold uppercase tracking-wider text-muted opacity-90">
                  Administration
                </p>
              )}
              <div className="space-y-0.5">
                {platformAdminNav.map(item => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      title={iconOnly ? item.label : undefined}
                      className={navClass}
                      onClick={onMobileClose}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {showLabels && <span className="truncate">{item.label}</span>}
                    </NavLink>
                ))}
              </div>
            </>
          ) : (
            <>
              {showLabels && (
                <p className="px-2.5 py-2 text-xs font-bold uppercase tracking-wider text-muted opacity-90">Trading</p>
              )}
              <div className="space-y-0.5 mb-3">
                {tradingNav.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.clearSearch ? registerNavTo(item.to) : item.to}
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
            </>
          )}
        </nav>
      </aside>
    </>
  )
}
