import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CommandPalette } from '../ui/CommandPalette'
import { buildGlobalSearchItems } from '../../lib/globalSearch'
import { useTradeStore } from '../../store/TradeStore'
import { useAuth, usePermissions } from '../../hooks/useAuth'
import { useLocation } from 'react-router-dom'
import { APP_HOME, appPath, isPlatformAdminPath } from '../../lib/appShellMode'
import { useAssistantEnabled } from '../../lib/assistant/useAssistantEnabled'

interface GlobalCommandPaletteProps {
  open: boolean
  onClose: () => void
  onOpenAssistant: () => void
}

export function GlobalCommandPalette({ open, onClose, onOpenAssistant }: GlobalCommandPaletteProps) {
  const store = useTradeStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { isPlatformAdmin } = useAuth()
  const { hasPermission } = usePermissions()
  const assistantEnabled = useAssistantEnabled()
  const platformAdminMode = isPlatformAdmin && isPlatformAdminPath(location.pathname)

  const items = useMemo(() => {
    if (platformAdminMode) {
      const nav = [
        { id: 'orgs', label: 'Organisations', group: 'Customers', action: () => navigate('/platform-admin/organisations') },
        { id: 'seats', label: 'Seats', group: 'Customers', action: () => navigate('/platform-admin/seats') },
        {
          id: 'seat-requests',
          label: 'Seat requests',
          group: 'Customers',
          action: () => navigate('/platform-admin/seats?tab=requests'),
        },
        { id: 'plans', label: 'Plans & Pricing', group: 'Commerce', action: () => navigate('/platform-admin/plans') },
        { id: 'licenses', label: 'Licences', group: 'Commerce', action: () => navigate('/platform-admin/licenses') },
        { id: 'amcs', label: 'AMC', group: 'Commerce', action: () => navigate('/platform-admin/amcs') },
        { id: 'payments', label: 'Payments', group: 'Commerce', action: () => navigate('/platform-admin/payments') },
        { id: 'releases', label: 'Releases', group: 'Product', action: () => navigate('/platform-admin/releases') },
        {
          id: 'add-ons',
          label: 'Features & Access',
          group: 'Product',
          action: () => navigate('/platform-admin/add-ons'),
        },
        { id: 'inbox', label: 'Inbox', group: 'Product', action: () => navigate('/platform-admin/notifications') },
        { id: 'audit', label: 'Audit log', group: 'Product', action: () => navigate('/platform-admin/audit') },
        { id: 'profile', label: 'Profile', group: 'Account', action: () => navigate('/platform-admin/settings/account') },
        { id: 'settings', label: 'Settings', group: 'Account', action: () => navigate('/platform-admin/settings') },
      ]
      return [
        ...(assistantEnabled
          ? [{ id: 'assistant', label: 'Ask Tradeal AI', description: '⌘J', group: 'Actions', action: onOpenAssistant }]
          : []),
        {
          id: 'send-update',
          label: 'Send update',
          group: 'Actions',
          action: () => navigate('/platform-admin/notifications?compose=1'),
        },
        ...nav,
      ]
    }

    const nav = [
      { id: 'dash', label: 'Go to Dashboard', group: 'Navigation', action: () => navigate(APP_HOME) },
      { id: 'po', label: 'Purchase Orders', group: 'Navigation', action: () => navigate(appPath('/purchase-orders')) },
      { id: 'so', label: 'Sales Orders', group: 'Navigation', action: () => navigate(appPath('/sales-orders')) },
      { id: 'lifts', label: 'Lift Register', group: 'Navigation', action: () => navigate(appPath('/lifts')) },
      { id: 'inventory', label: 'Inventory', group: 'Navigation', action: () => navigate(appPath('/inventory')) },
      { id: 'directory', label: 'Directory', group: 'Navigation', action: () => navigate(appPath('/directory')) },
      { id: 'reports', label: 'Reports', group: 'Navigation', action: () => navigate(appPath('/reports')) },
      { id: 'analytics', label: 'Analytics', group: 'Navigation', action: () => navigate(appPath('/analytics')) },
      { id: 'activity', label: 'Activity', group: 'Navigation', action: () => navigate(appPath('/activity')) },
      ...(hasPermission('organisation.subscription.view') && !isPlatformAdmin
        ? [{ id: 'features', label: 'Features', group: 'Navigation', action: () => navigate(appPath('/features')) }]
        : []),
      { id: 'inbox', label: 'Inbox', group: 'Navigation', action: () => navigate(appPath('/notifications')) },
      ...(hasPermission('purchase.create')
        ? [{ id: 'new-po', label: 'New Purchase Order', description: 'F1', group: 'Actions', action: () => navigate(appPath('/purchase-orders/new')) }]
        : []),
      ...(hasPermission('sales.create')
        ? [{ id: 'new-so', label: 'New Sales Order', description: 'F3', group: 'Actions', action: () => navigate(appPath('/sales-orders/new')) }]
        : []),
      ...(hasPermission('lifts.create')
        ? [{ id: 'new-lift', label: 'Record Lift', description: 'F5', group: 'Actions', action: () => navigate(appPath('/lifts/new')) }]
        : []),
      ...(hasPermission('contracts.create')
        ? [{ id: 'new-contract', label: 'New Contract', group: 'Actions', action: () => navigate(appPath('/contracts/new')) }]
        : []),
      ...(assistantEnabled
        ? [{ id: 'assistant', label: 'Ask Tradeal AI', description: '⌘J', group: 'Actions', action: onOpenAssistant }]
        : []),
      { id: 'send-tradeal', label: 'Send request', group: 'Actions', action: () => navigate(appPath('/notifications?compose=1')) },
    ]

    const searchHits = buildGlobalSearchItems(store, navigate).map(item => ({
      id: item.id,
      label: item.label,
      description: item.description,
      group: item.group,
      action: item.action,
    }))

    return [...nav, ...searchHits]
  }, [assistantEnabled, hasPermission, store, navigate, onOpenAssistant, platformAdminMode, isPlatformAdmin])

  return <CommandPalette open={open} onClose={onClose} items={items} />
}
