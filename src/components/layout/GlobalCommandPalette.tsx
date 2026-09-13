import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CommandPalette } from '../ui/CommandPalette'
import { buildGlobalSearchItems } from '../../lib/globalSearch'
import { useTradeStore } from '../../store/TradeStore'

interface GlobalCommandPaletteProps {
  open: boolean
  onClose: () => void
  onOpenAssistant: () => void
}

export function GlobalCommandPalette({ open, onClose, onOpenAssistant }: GlobalCommandPaletteProps) {
  const store = useTradeStore()
  const navigate = useNavigate()

  const items = useMemo(() => {
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
      { id: 'contracts', label: 'Contracts', group: 'Navigation', action: () => navigate('/contracts') },
      { id: 'settings', label: 'Settings', group: 'Navigation', action: () => navigate('/settings') },
      { id: 'profile', label: 'Profile', group: 'Navigation', action: () => navigate('/profile') },
    ]

    const actions = [
      { id: 'new-po', label: 'New Purchase Order', description: 'F1', group: 'Actions', action: () => navigate('/purchase-orders/new') },
      { id: 'new-so', label: 'New Sales Order', description: 'F3', group: 'Actions', action: () => navigate('/sales-orders/new') },
      { id: 'new-lift', label: 'Record Lift', description: 'F5', group: 'Actions', action: () => navigate('/lifts/new') },
      { id: 'new-contract', label: 'New Contract', group: 'Actions', action: () => navigate('/contracts/new') },
      { id: 'assistant', label: 'Ask TradeOS AI', description: '⌘J', group: 'Actions', action: onOpenAssistant },
    ]

    const searchHits = buildGlobalSearchItems(store, navigate).map(item => ({
      id: item.id,
      label: item.label,
      description: item.description,
      group: item.group,
      action: item.action,
    }))

    return [...actions, ...nav, ...searchHits]
  }, [store, navigate, onOpenAssistant])

  return <CommandPalette open={open} onClose={onClose} items={items} />
}
