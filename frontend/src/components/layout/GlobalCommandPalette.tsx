import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CommandPalette } from '../ui/CommandPalette'
import { buildGlobalSearchItems } from '../../lib/globalSearch'
import { useTradeStore } from '../../store/TradeStore'
import { useAuth, usePermissions } from '../../hooks/useAuth'
import { useLocation } from 'react-router-dom'
import { isPlatformAdminPath } from '../../lib/appShellMode'

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
  const platformAdminMode = isPlatformAdmin && isPlatformAdminPath(location.pathname)

  const items = useMemo(() => {
    if (platformAdminMode) {
      const nav = [
        { id: 'orgs', label: 'Organisations', group: 'Navigation', action: () => navigate('/platform-admin/organisations') },
        { id: 'plans', label: 'Plans & Pricing', group: 'Navigation', action: () => navigate('/platform-admin/plans') },
        { id: 'licenses', label: 'Licences', group: 'Navigation', action: () => navigate('/platform-admin/licenses') },
        { id: 'amcs', label: 'AMC / Renewals', group: 'Navigation', action: () => navigate('/platform-admin/amcs') },
        { id: 'seats', label: 'Seats', group: 'Navigation', action: () => navigate('/platform-admin/seats') },
        { id: 'payments', label: 'Payments', group: 'Navigation', action: () => navigate('/platform-admin/payments') },
        { id: 'releases', label: 'Releases', group: 'Navigation', action: () => navigate('/platform-admin/releases') },
        {
          id: 'needs-attention',
          label: 'Needs attention',
          group: 'Navigation',
          action: () => navigate('/platform-admin/seat-requests'),
        },
        {
          id: 'seat-requests',
          label: 'Seat requests',
          group: 'Navigation',
          action: () => navigate('/platform-admin/seat-requests'),
        },
        { id: 'audit', label: 'Audit log', group: 'Navigation', action: () => navigate('/platform-admin/audit') },
        { id: 'profile', label: 'Profile', group: 'Navigation', action: () => navigate('/platform-admin/profile') },
        { id: 'settings', label: 'Settings', group: 'Navigation', action: () => navigate('/platform-admin/settings') },
      ]
      return [
        { id: 'assistant', label: 'Ask Tradeal AI', description: '⌘J', group: 'Actions', action: onOpenAssistant },
        ...nav,
      ]
    }

    const nav = [
      { id: 'dash', label: 'Go to Dashboard', group: 'Navigation', action: () => navigate('/') },
      { id: 'po', label: 'Purchase Orders', group: 'Navigation', action: () => navigate('/purchase-orders') },
      { id: 'so', label: 'Sales Orders', group: 'Navigation', action: () => navigate('/sales-orders') },
      { id: 'lifts', label: 'Lift Register', group: 'Navigation', action: () => navigate('/lifts') },
      { id: 'inventory', label: 'Inventory', group: 'Navigation', action: () => navigate('/inventory') },
      { id: 'directory', label: 'Directory', group: 'Navigation', action: () => navigate('/directory') },
      { id: 'reports', label: 'Reports', group: 'Navigation', action: () => navigate('/reports') },
      { id: 'analytics', label: 'Analytics', group: 'Navigation', action: () => navigate('/analytics') },
      { id: 'activity', label: 'Activity', group: 'Navigation', action: () => navigate('/activity') },
      { id: 'notices', label: 'From Tradeal', group: 'Navigation', action: () => navigate('/app/notices') },
      { id: 'contracts', label: 'Contracts', group: 'Navigation', action: () => navigate('/contracts') },
      { id: 'settings', label: 'Settings', group: 'Navigation', action: () => navigate('/settings') },
      { id: 'profile', label: 'Profile', group: 'Navigation', action: () => navigate('/profile') },
    ]

    const actions = [
      ...(hasPermission('purchase.create')
        ? [{ id: 'new-po', label: 'New Purchase Order', description: 'F1', group: 'Actions', action: () => navigate('/purchase-orders/new') }]
        : []),
      ...(hasPermission('sales.create')
        ? [{ id: 'new-so', label: 'New Sales Order', description: 'F3', group: 'Actions', action: () => navigate('/sales-orders/new') }]
        : []),
      ...(hasPermission('lifts.create')
        ? [{ id: 'new-lift', label: 'Record Lift', description: 'F5', group: 'Actions', action: () => navigate('/lifts/new') }]
        : []),
      ...(hasPermission('contracts.create')
        ? [{ id: 'new-contract', label: 'New Contract', group: 'Actions', action: () => navigate('/contracts/new') }]
        : []),
      { id: 'assistant', label: 'Ask Tradeal AI', description: '⌘J', group: 'Actions', action: onOpenAssistant },
    ]

    const searchHits = buildGlobalSearchItems(store, navigate).map(item => ({
      id: item.id,
      label: item.label,
      description: item.description,
      group: item.group,
      action: item.action,
    }))

    return [...actions, ...nav, ...searchHits]
  }, [hasPermission, store, navigate, onOpenAssistant, platformAdminMode])

  return <CommandPalette open={open} onClose={onClose} items={items} />
}
