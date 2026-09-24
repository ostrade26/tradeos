import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb, Tabs } from '../components/ui/Tabs'
import { AddOnsMarketplace } from '../components/settings/AddOnsMarketplace'
import { useAuth, usePermissions } from '../hooks/useAuth'
import { APP_HOME } from '../lib/appShellMode'

export type AddOnsPageView = 'catalog' | 'yours'

export function FeaturesPage() {
  const { isPlatformAdmin } = useAuth()
  const { hasPermission } = usePermissions()
  const canBrowse = hasPermission('organisation.subscription.view') && !isPlatformAdmin
  const [pageView, setPageView] = useState<AddOnsPageView>('catalog')
  const [browseCount, setBrowseCount] = useState(0)
  const [yoursCount, setYoursCount] = useState(0)

  if (!canBrowse) {
    return <Navigate to={APP_HOME} replace />
  }

  return (
    <div className="animate-fade-in w-full min-w-0 max-w-none">
      <PageHeader
        title="Add-ons"
        subtitle="Browse add-ons, enable free ones instantly, or request access to paid capabilities."
        breadcrumb={<Breadcrumb items={[{ label: 'Tradeal', href: APP_HOME }, { label: 'Add-ons' }]} />}
      />
      <Tabs
        className="mb-4"
        tabs={[
          { id: 'catalog', label: 'Browse Add-ons', count: browseCount },
          { id: 'yours', label: 'Your add-ons', count: yoursCount },
        ]}
        active={pageView}
        onChange={id => setPageView(id as AddOnsPageView)}
      />
      <AddOnsMarketplace
        pageView={pageView}
        onPageViewChange={setPageView}
        onBrowseCountChange={setBrowseCount}
        onYoursCountChange={setYoursCount}
      />
    </div>
  )
}
