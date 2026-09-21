import { useSearchParams } from 'react-router-dom'
import { useCallback } from 'react'
import { OrderRegisterView, type OrderListMode } from '../components/registers/OrderRegisterView'

function parseMode(view: string | null): OrderListMode {
  if (view === 'completed' || view === 'register') return 'completed'
  if (view === 'deleted') return 'deleted'
  return 'pending'
}

function viewParam(mode: OrderListMode): string | null {
  if (mode === 'completed') return 'completed'
  if (mode === 'deleted') return 'deleted'
  return null
}

export function PurchaseOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const mode = parseMode(searchParams.get('view'))

  const setMode = useCallback((next: OrderListMode) => {
    setSearchParams(prev => {
      const current = parseMode(prev.get('view'))
      if (current === next) return prev
      const params = new URLSearchParams(prev)
      params.delete('ref')
      const view = viewParam(next)
      if (view) params.set('view', view)
      else params.delete('view')
      return params
    }, { replace: true })
  }, [setSearchParams])

  return <OrderRegisterView side="purchase" mode={mode} onModeChange={setMode} />
}
