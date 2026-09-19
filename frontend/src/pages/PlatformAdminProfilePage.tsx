import { Navigate } from 'react-router-dom'
import { platformSettingsPath } from '../lib/platformSettingsSections'

/** Profile lives under Settings → Account (same pattern as org settings). */
export function PlatformAdminProfilePage() {
  return <Navigate to={platformSettingsPath('account')} replace />
}
