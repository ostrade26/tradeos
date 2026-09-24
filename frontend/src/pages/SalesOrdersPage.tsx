import { useSearchParams } from 'react-router-dom'
import { useCallback, useLayoutEffect, useRef } from 'react'
import { OrderRegisterView, type OrderListMode } from '../components/registers/OrderRegisterView'
import { appPath } from '../lib/appShellMode'
import { loadRegisterViewMode, saveRegisterViewMode } from '../lib/registerViewMode'

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

const REGISTER_KEY = appPath('/sales-orders')

export function SalesOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const hasExplicitView = searchParams.has('view')
  const mode = parseMode(searchParams.get('view'))
  const restored = useRef(false)

  useLayoutEffect(() => {
    if (restored.current || hasExplicitView) return
    restored.current = true
    const saved = loadRegisterViewMode(REGISTER_KEY)
    if (!saved || saved === 'pending') return
    setSearchParams(prev => {
      if (prev.has('view')) return prev
      const params = new URLSearchParams(prev)
      const view = viewParam(saved)
      if (view) params.set('view', view)
      return params
    }, { replace: true })
  }, [hasExplicitView, setSearchParams])

  useLayoutEffect(() => {
    saveRegisterViewMode(REGISTER_KEY, mode)
  }, [mode])

  const setMode = useCallback((next: OrderListMode) => {
    saveRegisterViewMode(REGISTER_KEY, next)
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

  return <OrderRegisterView side="sale" mode={mode} onModeChange={setMode} />
}
