import { Navigate } from 'react-router-dom'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb } from '../components/ui/Tabs'
import { AddOnsMarketplace } from '../components/settings/AddOnsMarketplace'
import { useAuth, usePermissions } from '../hooks/useAuth'
import { APP_HOME } from '../lib/appShellMode'

export function FeaturesPage() {
  const { isPlatformAdmin } = useAuth()
  const { hasPermission } = usePermissions()
  const canBrowse = hasPermission('organisation.subscription.view') && !isPlatformAdmin

  if (!canBrowse) {
    return <Navigate to={APP_HOME} replace />
  }

  return (
    <div className="animate-fade-in w-full min-w-0 max-w-none">
      <PageHeader
        title="Features"
        subtitle="Optional capabilities for your organisation"
        breadcrumb={<Breadcrumb items={[{ label: 'Tradeal', href: APP_HOME }, { label: 'Features' }]} />}
      />
      <AddOnsMarketplace />
    </div>
  )
}
