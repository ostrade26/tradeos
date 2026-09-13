import { useSearchParams } from 'react-router-dom'
import { useCallback } from 'react'
import { OrderRegisterView, type OrderListMode } from '../components/registers/OrderRegisterView'

function parseMode(view: string | null): OrderListMode {
  if (view === 'completed' || view === 'register') return 'completed'
  return 'pending'
}

export function SalesOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const mode = parseMode(searchParams.get('view'))

  const setMode = useCallback((next: OrderListMode) => {
    setSearchParams(prev => {
      const current = parseMode(prev.get('view'))
      if (current === next) return prev
      const params = new URLSearchParams(prev)
      params.delete('ref')
      if (next === 'completed') params.set('view', 'completed')
      else params.delete('view')
      return params
    }, { replace: true })
  }, [setSearchParams])

  return <OrderRegisterView side="sale" mode={mode} onModeChange={setMode} />
}
