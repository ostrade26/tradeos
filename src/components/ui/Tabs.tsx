import { cn } from '../../lib/utils'
import type { KeyboardEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Tab {
  id: string
  label: string
  count?: number
}

interface TabsProps {
  tabs: Tab[]
  active: string
  onChange: (id: string) => void
  className?: string
  buttonClassName?: string
  panelIdPrefix?: string
}

export function Tabs({ tabs, active, onChange, className, buttonClassName, panelIdPrefix = 'tabpanel' }: TabsProps) {
  const onKeyDown = (e: KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      onChange(tabs[(index + 1) % tabs.length]!.id)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      onChange(tabs[(index - 1 + tabs.length) % tabs.length]!.id)
    }
  }

  return (
    <div
      role="tablist"
      aria-label="View tabs"
      className={cn('flex gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto scrollbar-none', className)}
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          id={`tab-${tab.id}`}
          role="tab"
          type="button"
          aria-selected={active === tab.id}
          aria-controls={`${panelIdPrefix}-${tab.id}`}
          tabIndex={active === tab.id ? 0 : -1}
          onKeyDown={e => onKeyDown(e, index)}
          onClick={() => onChange(tab.id)}
          className={cn(
            'relative pb-2.5 text-sm font-medium transition-colors cursor-pointer shrink-0 attex-focus',
            buttonClassName ?? 'px-4 pt-2.5',
            active === tab.id
              ? 'text-heading'
              : 'text-muted hover:text-gray-700 dark:hover:text-gray-300',
          )}
        >
          <span className="relative inline-flex items-center gap-2">
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-xs',
                active === tab.id ? 'bg-gray-100 dark:bg-gray-700/50' : 'bg-gray-50 dark:bg-card'
              )}>
                {tab.count}
              </span>
            )}
            {active === tab.id && (
              <span className="absolute left-0 right-0 -bottom-2.5 h-0.5 bg-accent rounded-full" />
            )}
          </span>
        </button>
      ))}
    </div>
  )
}

export function TabPanel({
  id,
  active,
  children,
  panelIdPrefix = 'tabpanel',
}: {
  id: string
  active: boolean
  children: ReactNode
  panelIdPrefix?: string
}) {
  if (!active) return null
  return (
    <div
      role="tabpanel"
      id={`${panelIdPrefix}-${id}`}
      aria-labelledby={`tab-${id}`}
      tabIndex={0}
    >
      {children}
    </div>
  )
}

interface StepperProps {
  steps: { id: string; label: string; description?: string }[]
  current: number
}

export function Stepper({ steps, current }: StepperProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors',
              i < current && 'bg-accent text-white',
              i === current && 'bg-accent text-white ring-4 ring-accent/20',
              i > current && 'bg-gray-100 text-muted dark:bg-zinc-800 dark:text-muted'
            )}>
              {i < current ? '✓' : i + 1}
            </div>
            <div className="hidden sm:block">
              <p className={cn('text-xs font-medium', i <= current ? 'text-heading' : 'text-muted')}>
                {step.label}
              </p>
            </div>
          </div>
          {i < steps.length - 1 && (
            <div className={cn('h-px w-8 sm:w-12', i < current ? 'bg-accent' : 'bg-gray-200 dark:bg-gray-600')} />
          )}
        </div>
      ))}
    </div>
  )
}

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm overflow-x-auto scrollbar-none">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5 shrink-0">
          {i > 0 && <span className="text-gray-300 dark:text-gray-600">/</span>}
          {item.href ? (
            <Link to={item.href} className="text-muted hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-heading font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

export function Timeline({ items }: { items: { title: string; description?: string; time: string; icon?: ReactNode; status?: 'completed' | 'current' | 'upcoming' }[] }) {
  return (
    <div className="space-y-0">
      {items.map((item, i) => (
        <div key={i} className="flex gap-3 pb-6 last:pb-0">
          <div className="flex flex-col items-center">
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full border-2 shrink-0',
              item.status === 'completed' && 'border-emerald-500 bg-emerald-50 text-success dark:bg-emerald-950',
              item.status === 'current' && 'border-accent bg-blue-50 text-accent dark:bg-blue-950',
              item.status === 'upcoming' && 'border-gray-200 bg-gray-50 text-muted dark:border-gray-600 dark:bg-zinc-800',
              !item.status && 'border-gray-200 bg-white dark:border-gray-600 dark:bg-card'
            )}>
              {item.icon || <span className="text-xs font-semibold">{i + 1}</span>}
            </div>
            {i < items.length - 1 && (
              <div className={cn('w-px flex-1 mt-1', item.status === 'completed' ? 'bg-emerald-200 dark:bg-emerald-800' : 'bg-gray-200 dark:bg-gray-600')} />
            )}
          </div>
          <div className="pt-1 min-w-0">
            <p className="text-sm font-medium text-heading">{item.title}</p>
            {item.description && <p className="text-xs text-muted mt-0.5">{item.description}</p>}
            <p className="text-xs text-muted mt-1">{item.time}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  card?: boolean
}

export const emptyStateShellClass = 'rounded-md bg-card shadow-[var(--shadow-card)]'

export function EmptyState({ icon, title, description, action, card = false }: EmptyStateProps) {
  const content = (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-4 text-gray-300 dark:text-gray-600">{icon}</div>}
      <h3 className="text-sm font-semibold text-heading">{title}</h3>
      {description && <p className="text-xs text-muted mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
  if (!card) return content
  return <div className={emptyStateShellClass}>{content}</div>
}
