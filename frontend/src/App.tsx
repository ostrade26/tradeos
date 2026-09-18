import { createBrowserRouter, RouterProvider, Navigate, Outlet, useLocation } from 'react-router-dom'
import { lazy, Suspense, type ReactNode } from 'react'
import { TableSkeleton } from './components/ui/DataTable'
import { ThemeProvider } from './hooks/useTheme'
import { TableDensityProvider } from './hooks/useTableDensity'
import { AuthProvider } from './hooks/useAuth'
import { UserProvider } from './hooks/useUser'
import { ToastProvider } from './hooks/useToast'
import { ServiceIssueProvider } from './hooks/ServiceIssueProvider'
import { TradeProvider } from './store/TradeStore'
import { AppShell } from './components/layout/AppShell'
import { RequireAuth } from './components/auth/RequireAuth'
import { RequireEditOrders } from './components/auth/RequireEditOrders'
import { RequirePlatformAdmin } from './components/auth/RequirePlatformAdmin'
import { RequireOrganisationUser } from './components/auth/RequireOrganisationUser'
import { PlatformAdminPage } from './pages/PlatformAdminPage'
import { PlatformAdminProfilePage } from './pages/PlatformAdminProfilePage'
import { PlatformAdminSettingsPage } from './pages/PlatformAdminSettingsPage'
import { LoginPage } from './pages/LoginPage'
import { APP_HOME, appPath, isAppPath } from './lib/appShellMode'
import { MarketingPage } from './pages/MarketingPage'
import { DashboardPage } from './pages/DashboardPage'
import { InboxPage } from './pages/InboxPage'
import { ContractsPage } from './pages/ContractsPage'
import { CreateContractPage } from './pages/CreateContractPage'
import { ContractDetailsPage } from './pages/ContractDetailsPage'
import { InventoryPage } from './pages/InventoryPage'
import { LotDetailsPage } from './pages/LotDetailsPage'
import { SellInventoryPage } from './pages/SellInventoryPage'
import { DirectoryPage } from './pages/DirectoryPage'
import { ReportsDashboardPage } from './pages/ReportsDashboardPage'
import { ReportViewPage } from './pages/ReportViewPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { ActivityPage } from './pages/ActivityPage'
import { ProfilePage } from './pages/ProfilePage'
import { SettingsHubPage, SettingsLayout, SettingsSectionPage } from './pages/SettingsPage'
import { FeaturesPage } from './pages/FeaturesPage'
import { PurchaseOrdersPage } from './pages/PurchaseOrdersPage'
import { SalesOrdersPage } from './pages/SalesOrdersPage'
import { LiftRegisterPage } from './pages/LiftRegisterPage'
import { PartyPage } from './pages/PartyPage'
import { OrderFlowPage, OrderTimelinePage } from './pages/OrderTimelinePage'

const POEntryPage = lazy(() => import('./pages/OrderEntryPage').then(m => ({ default: m.POEntryPage })))
const POEditPage = lazy(() => import('./pages/OrderEntryPage').then(m => ({ default: m.POEditPage })))
const SOEntryPage = lazy(() => import('./pages/OrderEntryPage').then(m => ({ default: m.SOEntryPage })))
const SOEditPage = lazy(() => import('./pages/OrderEntryPage').then(m => ({ default: m.SOEditPage })))
const LiftEntryPage = lazy(() => import('./pages/OrderEntryPage').then(m => ({ default: m.LiftEntryPage })))
const LiftEditPage = lazy(() => import('./pages/OrderEntryPage').then(m => ({ default: m.LiftEditPage })))

function PageLoader() {
  return (
    <div className="animate-fade-in space-y-4">
      <div className="skeleton h-8 w-48 rounded" />
      <div className="skeleton h-4 w-72 rounded" />
      <TableSkeleton rows={8} cols={6} />
    </div>
  )
}

function withSuspense(page: ReactNode) {
  return <Suspense fallback={<PageLoader />}>{page}</Suspense>
}

function ShellLayout() {
  return (
    <UserProvider>
      <TradeProvider>
        <AppShell />
      </TradeProvider>
    </UserProvider>
  )
}

/** Old org URLs (`/purchase-orders`) move under `/app`. */
function RedirectIntoApp() {
  const { pathname, search, hash } = useLocation()
  if (isAppPath(pathname)) return <Navigate to={APP_HOME} replace />
  return <Navigate to={`${APP_HOME}${pathname}${search}${hash}`} replace />
}

/** App-wide providers must live inside the router tree (createBrowserRouter). */
function RootProviders() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <TableDensityProvider>
          <ToastProvider>
            <ServiceIssueProvider>
              <Outlet />
            </ServiceIssueProvider>
          </ToastProvider>
        </TableDensityProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}

const router = createBrowserRouter([
  {
    element: <RootProviders />,
    children: [
      { path: '/', element: <MarketingPage /> },
      { path: '/login', element: <LoginPage /> },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <RequirePlatformAdmin />,
            children: [
              {
                element: <ShellLayout />,
                children: [
                  { path: 'platform-admin/profile', element: <PlatformAdminProfilePage /> },
                  { path: 'platform-admin/settings', element: <PlatformAdminSettingsPage /> },
                  { path: 'platform-admin/notifications', element: <InboxPage /> },
                  { path: 'platform-admin', element: <Navigate to="/platform-admin/organisations" replace /> },
                  { path: 'platform-admin/:section', element: <PlatformAdminPage /> },
                ],
              },
            ],
          },
          {
            element: <RequireOrganisationUser />,
            children: [
              {
                path: 'app',
                element: <ShellLayout />,
                children: [
                  { index: true, element: <DashboardPage /> },
                  { path: 'purchase-orders', element: <PurchaseOrdersPage /> },
                  { path: 'purchase-orders/pending', element: <Navigate to={appPath('/purchase-orders')} replace /> },
                  { path: 'purchase-orders/register', element: <Navigate to={appPath('/purchase-orders?view=completed')} replace /> },
                  { path: 'purchase-orders/new', element: withSuspense(<POEntryPage />) },
                  { path: 'purchase-orders/:ref/flow', element: <OrderFlowPage /> },
                  { path: 'purchase-orders/:ref/timeline', element: <OrderTimelinePage /> },
                  {
                    path: 'purchase-orders/:ref/edit',
                    element: withSuspense(<RequireEditOrders><POEditPage /></RequireEditOrders>),
                  },
                  { path: 'sales-orders', element: <SalesOrdersPage /> },
                  { path: 'sales-orders/pending', element: <Navigate to={appPath('/sales-orders')} replace /> },
                  { path: 'sales-orders/register', element: <Navigate to={appPath('/sales-orders?view=completed')} replace /> },
                  { path: 'sales-orders/new', element: withSuspense(<SOEntryPage />) },
                  { path: 'sales-orders/:ref/flow', element: <OrderFlowPage /> },
                  { path: 'sales-orders/:ref/timeline', element: <OrderTimelinePage /> },
                  {
                    path: 'sales-orders/:ref/edit',
                    element: withSuspense(<RequireEditOrders><SOEditPage /></RequireEditOrders>),
                  },
                  { path: 'lifts', element: <LiftRegisterPage /> },
                  { path: 'lifts/register', element: <Navigate to={appPath('/lifts?view=completed')} replace /> },
                  { path: 'lifts/new', element: withSuspense(<LiftEntryPage />) },
                  { path: 'lifts/:liftRef/edit', element: withSuspense(<LiftEditPage />) },
                  { path: 'contracts', element: <ContractsPage /> },
                  { path: 'contracts/new', element: <CreateContractPage /> },
                  { path: 'contracts/:id', element: <ContractDetailsPage /> },
                  { path: 'inventory', element: <InventoryPage /> },
                  { path: 'inventory/:lotId/sell', element: <SellInventoryPage /> },
                  { path: 'inventory/:lotId', element: <LotDetailsPage /> },
                  { path: 'deliveries', element: <Navigate to={appPath('/lifts')} replace /> },
                  { path: 'directory', element: <DirectoryPage /> },
                  { path: 'party', element: <PartyPage /> },
                  { path: 'brokers', element: <Navigate to={appPath('/directory?tab=brokers')} replace /> },
                  { path: 'producers', element: <Navigate to={appPath('/directory?tab=parties')} replace /> },
                  { path: 'retailers', element: <Navigate to={appPath('/directory?tab=parties')} replace /> },
                  { path: 'payments', element: <Navigate to={APP_HOME} replace /> },
                  { path: 'reports', element: <ReportsDashboardPage /> },
                  { path: 'reports/:reportId', element: <ReportViewPage /> },
                  { path: 'analytics', element: <AnalyticsPage /> },
                  { path: 'market-news', element: <Navigate to={APP_HOME} replace /> },
                  { path: 'activity', element: <ActivityPage /> },
                  { path: 'notifications', element: <InboxPage /> },
                  { path: 'features', element: <FeaturesPage /> },
                  { path: 'profile', element: <ProfilePage /> },
                  {
                    path: 'settings',
                    element: <SettingsLayout />,
                    children: [
                      { index: true, element: <SettingsHubPage /> },
                      { path: 'addons', element: <Navigate to={appPath('/features')} replace /> },
                      { path: ':section', element: <SettingsSectionPage /> },
                    ],
                  },
                  { path: '*', element: <Navigate to={APP_HOME} replace /> },
                ],
              },
              { path: '*', element: <RedirectIntoApp /> },
            ],
          },
        ],
      },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
