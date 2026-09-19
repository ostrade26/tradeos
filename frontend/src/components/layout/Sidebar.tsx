import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Package,
  BookUser, BarChart3, Activity, ChevronLeft, FileText,
  ArrowDownToLine, ArrowUpFromLine, Scale, X, ClipboardList,
  Building2, Users, UserPlus, CreditCard, ScrollText, KeyRound, Wallet, ShieldCheck, Bell,
} from 'lucide-react'
import {
  platformFeaturesAccessNavIcon,
  platformReleaseIcon,
} from '../../lib/platformProductIcons'
import { cn } from '../../lib/utils'
import { isPlatformAdminPath, APP_HOME, appPath } from '../../lib/appShellMode'
import { isSettingsAreaPath, SETTINGS_SECTIONS, settingsPath } from '../../lib/settingsSections'
import {
  isPlatformSettingsAreaPath,
  PLATFORM_SETTINGS_SECTIONS,
  platformSettingsPath,
} from '../../lib/platformSettingsSections'
import { useAuth, usePermissions } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { usePlatformSeatRequestInbox } from '../../hooks/usePlatformSeatRequestInbox'
import { useUnifiedInbox } from '../../hooks/useUnifiedInbox'
import { orgNoticesLabels, platformActionInboxLabels } from '../../lib/inboxLabels'

/** Register routes — navigate with a clean URL (no `ref` from the previous register). */
function registerNavTo(path: string) {
  return { pathname: path }
}

const tradingNav = [
  { to: APP_HOME, icon: LayoutDashboard, label: 'Dashboard', end: true, clearSearch: false },
  { to: appPath('/purchase-orders'), icon: ArrowDownToLine, label: 'Purchase Orders', clearSearch: true },
  { to: appPath('/sales-orders'), icon: ArrowUpFromLine, label: 'Sales Orders', clearSearch: true },
  { to: appPath('/lifts'), icon: Scale, label: 'Lift Register', clearSearch: true },
  { to: appPath('/inventory'), icon: Package, label: 'Inventory' },
  { to: appPath('/contracts'), icon: FileText, label: 'Contracts' },
]

const platformNavBase = [
  { to: appPath('/directory'), icon: BookUser, label: 'Directory' },
  { to: appPath('/reports'), icon: ClipboardList, label: 'Reports' },
  { to: appPath('/analytics'), icon: BarChart3, label: 'Analytics' },
  { to: appPath('/activity'), icon: Activity, label: 'Activity' },
  { to: appPath('/features'), icon: platformFeaturesAccessNavIcon, label: 'Features', featuresNav: true as const },
  { to: appPath('/notifications'), icon: Bell, label: orgNoticesLabels.sidebarNav },
]

const platformAdminNavGroups = [
  {
    label: 'Customers',
    items: [
      { to: '/platform-admin/organisations', icon: Building2, label: 'Organisations', end: true },
      { to: '/platform-admin/seats', icon: Users, label: 'Seats' },
      { to: '/platform-admin/seat-requests', icon: UserPlus, label: 'Seat requests' },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { to: '/platform-admin/plans', icon: CreditCard, label: 'Plans & Pricing' },
      { to: '/platform-admin/licenses', icon: KeyRound, label: 'Licences' },
      { to: '/platform-admin/amcs', icon: ShieldCheck, label: 'AMC' },
      { to: '/platform-admin/payments', icon: Wallet, label: 'Payments' },
    ],
  },
  {
    label: 'Product',
    items: [
      { to: '/platform-admin/releases', icon: platformReleaseIcon, label: 'Releases' },
      { to: '/platform-admin/add-ons', icon: platformFeaturesAccessNavIcon, label: 'Features & Access' },
      { to: '/platform-admin/notifications', icon: Bell, label: platformActionInboxLabels.sidebarNav },
      { to: '/platform-admin/audit', icon: ScrollText, label: 'Audit' },
    ],
  },
] as const


interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen = false, onMobileClose }: SidebarProps) {
  const location = useLocation()
  const platformAdminMode = isPlatformAdminPath(location.pathname)
  const platformSettingsMode = platformAdminMode && isPlatformSettingsAreaPath(location.pathname)
  const settingsMode = !platformAdminMode && isSettingsAreaPath(location.pathname)
  const { isPlatformAdmin } = useAuth()
  const { hasPermission } = usePermissions()
  const canManageOrganisation = hasPermission('organisation.edit')
  const showPlanInSettings =
    canManageOrganisation &&
    (hasPermission('organisation.subscription.view') || hasPermission('organisation.seats.request'))
  const showTeamInSettings = canManageOrganisation
  const showFeaturesNav = hasPermission('organisation.subscription.view') && !isPlatformAdmin
  const { pendingCount: openSeatRequests } = usePlatformSeatRequestInbox(isPlatformAdmin)
  const { badgeCount: inboxBadgeCount } = useUnifiedInbox(
    isPlatformAdmin ? 'platform' : 'org',
    'received',
  )
  const settingsNavItems = SETTINGS_SECTIONS.filter(s => {
    if (s.planTeamSection) return showPlanInSettings || showTeamInSettings
    return true
  })
  const platformNav = platformNavBase.filter(item => !('featuresNav' in item && item.featuresNav) || showFeaturesNav)
  const showLabels = !collapsed || mobileOpen
  const iconOnly = collapsed && !mobileOpen
  const { sidebarStyle } = useTheme()
  const themed = sidebarStyle === 'theme'
  const badgeRing = themed ? 'ring-accent' : 'ring-[var(--color-card)]'

  const navClass = ({ isActive }: { isActive: boolean }) => cn(
    'flex items-center rounded-lg text-[15px] transition-colors duration-150',
    iconOnly ? 'justify-center px-0 py-2.5 min-h-[44px]' : 'gap-2.5 px-2.5 py-2.5 min-h-[44px]',
    themed
      ? isActive
        ? 'bg-white/15 text-white font-medium'
        : 'text-white/75 hover:bg-white/10 hover:text-white'
      : isActive
        ? 'bg-accent-muted text-accent font-medium'
        : 'text-muted hover:bg-gray-100 hover:text-heading dark:hover:bg-gray-700/40',
  )

  const sectionLabelClass = themed
    ? 'px-2.5 py-2 text-xs font-bold uppercase tracking-wider text-white/50'
    : 'px-2.5 py-2 text-xs font-bold uppercase tracking-wider text-muted/70'

  const groupLabelClass = themed
    ? 'px-2.5 py-2 text-xs font-medium text-white/50'
    : 'px-2.5 py-2 text-xs font-medium text-muted'

  const iconBtnClass = themed
    ? 'rounded-full p-1.5 text-white/70 hover:bg-white/15 hover:text-white cursor-pointer attex-focus'
    : 'rounded-full p-1.5 text-muted hover:bg-gray-100 hover:text-heading dark:hover:bg-gray-700/40 cursor-pointer attex-focus'

  const brandMarkClass = themed
    ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/20 ring-1 ring-white/25'
    : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-white'

  const brandMarkStroke = themed ? 'white' : 'currentColor'
  const dividerClass = themed ? 'border-white/15' : 'border-gray-200 dark:border-gray-700'

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onMobileClose} aria-hidden />
      )}

      <aside
        data-overlay-dismiss="ignore"
        className={cn(
          'app-menu flex flex-col overflow-hidden',
          themed ? 'bg-accent' : 'bg-card border-r border-gray-200 dark:border-gray-700',
          'transition-all duration-300 ease-out shrink-0',
          'fixed inset-y-0 left-0 z-50 lg:static lg:z-auto',
          'h-viewport',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          iconOnly ? 'w-[70px]' : 'w-[min(15rem,88vw)] lg:w-60',
        )}
      >
        <div className={cn(
          'flex h-[70px] items-center shrink-0 border-b',
          dividerClass,
          iconOnly ? 'justify-center px-2' : 'justify-between px-4',
        )}>
          {showLabels ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={brandMarkClass}>
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
                  <path d="M2 12L7 7L10 10L14 5" stroke={brandMarkStroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className={cn('text-lg font-semibold truncate', themed ? 'text-white' : 'text-heading')}>
                Tradeal
              </span>
            </div>
          ) : (
            <div className={brandMarkClass}>
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
                <path d="M2 12L7 7L10 10L14 5" stroke={brandMarkStroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          )}
          {!iconOnly && (
            <button
              onClick={() => mobileOpen ? onMobileClose?.() : onToggleCollapse()}
              className={iconBtnClass}
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
            className={cn('mx-auto mt-2', iconBtnClass)}
            aria-label="Expand sidebar"
          >
            <ChevronLeft className="h-5 w-5 rotate-180" />
          </button>
        )}

        <nav className="flex-1 overflow-y-auto overscroll-contain px-2.5 py-2 pb-[env(safe-area-inset-bottom)]">
          {settingsMode || platformSettingsMode ? (
            <>
              {showLabels && (
                <p className={sectionLabelClass}>
                  Settings
                </p>
              )}
              <div className="space-y-0.5 mb-3">
                <NavLink
                  to={platformSettingsMode ? '/platform-admin/organisations' : APP_HOME}
                  end
                  title={iconOnly ? (platformSettingsMode ? 'Organisations' : 'Dashboard') : undefined}
                  className={navClass}
                  onClick={onMobileClose}
                >
                  {platformSettingsMode ? (
                    <Building2 className="h-5 w-5 shrink-0" />
                  ) : (
                    <LayoutDashboard className="h-5 w-5 shrink-0" />
                  )}
                  {showLabels && (platformSettingsMode ? 'Organisations' : 'Dashboard')}
                </NavLink>
              </div>
              {showLabels && (
                <p className={sectionLabelClass}>
                  Categories
                </p>
              )}
              <div className="space-y-0.5">
                {(platformSettingsMode ? PLATFORM_SETTINGS_SECTIONS : settingsNavItems).map(item => (
                  <NavLink
                    key={item.id}
                    to={
                      platformSettingsMode
                        ? platformSettingsPath(item.segment)
                        : settingsPath(item.segment)
                    }
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
            <div className="space-y-3">
              {platformAdminNavGroups.map((group, groupIndex) => (
                <div key={group.label}>
                  {showLabels ? (
                    <p className={groupLabelClass}>
                      {group.label}
                    </p>
                  ) : groupIndex > 0 ? (
                    <div className={cn('mx-2 mb-2 border-t', dividerClass)} aria-hidden />
                  ) : null}
                  <div className="space-y-0.5">
                    {group.items.map(item => {
                      const seatBadge = item.to.includes('seat-requests') && openSeatRequests > 0
                      const inboxBadge =
                        item.to === '/platform-admin/notifications' && inboxBadgeCount > 0
                      const badgeCount = seatBadge
                        ? openSeatRequests
                        : inboxBadge
                          ? inboxBadgeCount
                          : 0
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          end={'end' in item ? item.end : undefined}
                          title={iconOnly ? item.label : undefined}
                          className={navClass}
                          onClick={onMobileClose}
                        >
                          <span className="relative shrink-0">
                            <item.icon className="h-5 w-5" />
                            {iconOnly && badgeCount > 0 && (
                              <span className={cn(
                                'absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-0.5 text-[9px] font-semibold text-white ring-2',
                                badgeRing,
                              )}>
                                {badgeCount > 9 ? '9+' : badgeCount}
                              </span>
                            )}
                          </span>
                          {showLabels && (
                            <>
                              <span className="truncate">{item.label}</span>
                              {badgeCount > 0 && (
                                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white tabular-nums">
                                  {badgeCount > 9 ? '9+' : badgeCount}
                                </span>
                              )}
                            </>
                          )}
                        </NavLink>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {showLabels && (
                <p className={sectionLabelClass}>Trading</p>
              )}
              <div className="space-y-0.5 mb-3" data-tour="nav-trading">
                {tradingNav.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.clearSearch ? registerNavTo(item.to) : item.to}
                    end={item.end}
                    title={iconOnly ? item.label : undefined}
                    className={navClass}
                    onClick={onMobileClose}
                    data-tour={
                      item.label === 'Purchase Orders'
                        ? 'nav-purchase-orders'
                        : item.label === 'Lift Register'
                          ? 'nav-lifts'
                          : undefined
                    }
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {showLabels && item.label}
                  </NavLink>
                ))}
              </div>

              {showLabels && (
                <p className={sectionLabelClass}>Platform</p>
              )}
              <div className="space-y-0.5">
                {platformNav.map(item => {
                  const isInbox = item.to === appPath('/notifications')
                  const badgeCount = isInbox && inboxBadgeCount > 0 ? inboxBadgeCount : 0
                  return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={iconOnly ? item.label : undefined}
                    className={navClass}
                    onClick={onMobileClose}
                  >
                    <span className="relative shrink-0">
                      <item.icon className="h-5 w-5" />
                      {iconOnly && badgeCount > 0 && (
                        <span className={cn(
                          'absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-0.5 text-[9px] font-semibold text-white ring-2',
                          badgeRing,
                        )}>
                          {badgeCount > 9 ? '9+' : badgeCount}
                        </span>
                      )}
                    </span>
                    {showLabels && (
                      <>
                        <span className="truncate">{item.label}</span>
                        {badgeCount > 0 && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white tabular-nums">
                            {badgeCount > 9 ? '9+' : badgeCount}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                  )
                })}
              </div>
            </>
          )}
        </nav>
      </aside>
    </>
  )
}
