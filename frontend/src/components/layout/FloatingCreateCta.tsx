import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Plus, ArrowDownToLine, ArrowUpFromLine, Scale } from 'lucide-react'
import { cn } from '../../lib/utils'
import { usePermissions } from '../../hooks/useAuth'
import { appPath, isPlatformAdminPath } from '../../lib/appShellMode'

const ALL_ACTIONS = [
  { to: appPath('/purchase-orders/new'), label: 'New PO', icon: ArrowDownToLine, permission: 'purchase.create' },
  { to: appPath('/sales-orders/new'), label: 'New SO', icon: ArrowUpFromLine, permission: 'sales.create' },
  { to: appPath('/lifts/new'), label: 'Record Lift', icon: Scale, permission: 'lifts.create' },
] as const

function shouldHideFab(pathname: string, actions: readonly { to: string }[]) {
  if (pathname.includes('/edit')) return true
  return actions.some(a => pathname === a.to)
}

export function FloatingCreateCta() {
  const { hasPermission } = usePermissions()
  const actions = ALL_ACTIONS.filter(a => hasPermission(a.permission))
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const location = useLocation()

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  if (
    isPlatformAdminPath(location.pathname) ||
    !actions.length ||
    shouldHideFab(location.pathname, actions)
  ) {
    return null
  }

  return (
    <div
      ref={ref}
      data-tour="create-fab"
      className="fixed bottom-6 right-6 z-30 pb-[env(safe-area-inset-bottom)] sm:bottom-6 lg:hidden"
      aria-label="Create order"
    >
      <div
        className={cn(
          'absolute bottom-full right-0 mb-2.5 flex flex-col items-end gap-2 transition-opacity duration-200',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        aria-hidden={!open}
      >
        {actions.map(action => (
          <Link
            key={action.to}
            to={action.to}
            onClick={() => setOpen(false)}
            tabIndex={open ? 0 : -1}
            className={cn(
              'flex items-center gap-2 rounded-full border border-gray-200 bg-white pl-3 pr-4 py-2.5',
              'text-sm font-medium text-heading shadow-lg whitespace-nowrap',
              'hover:border-accent/40 hover:text-accent transition-colors',
              'dark:border-gray-600 dark:bg-card dark:hover:border-accent/40',
            )}
          >
            <action.icon className="h-4 w-4 text-accent" />
            {action.label}
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-label={open ? 'Close create menu' : 'Create PO, SO, or lift'}
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg',
          'hover:bg-accent-hover transition-colors duration-200 attex-focus',
        )}
      >
        <Plus className={cn('h-6 w-6 transition-transform duration-200', open && 'rotate-45')} />
      </button>
    </div>
  )
}
