import { AlertCircle, Clock, Package, Truck } from 'lucide-react'
import { cn } from '../lib/utils'

const stats = [
  { label: 'Inventory value', value: '₹2.14 Cr', detail: '186.4 MT on hand', icon: Package },
  { label: 'PO pending', value: '7', detail: '92.0 MT to lift', icon: AlertCircle },
  { label: 'SO pending', value: '11', detail: '64.5 MT to lift', icon: Clock },
  { label: 'Lifts in transit', value: '4', detail: '3 tankers today', icon: Truck },
]

const inbox = [
  { title: 'Lift remaining on PO-1042', meta: 'DVC Process Tech · 18.0 MT palm oil' },
  { title: 'SO-2218 unlinked to a PO', meta: 'Haldiram Foods · RBD palmolein' },
  { title: 'Mark tanker delivered', meta: 'MH-04-CX-2291 · 24.5 MT planned' },
]

export function ProductPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className="select-none overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[var(--shadow-md)]"
      aria-hidden
    >
      <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
        <span className="ml-3 flex items-center gap-2 text-xs font-medium text-muted">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-success" />
          Tradeal · Live
        </span>
      </div>

      <div className="flex bg-[#f2f2f7]">
        <div className="hidden w-[4.5rem] shrink-0 border-r border-gray-200 bg-white py-4 sm:block">
          <div className="mx-auto mb-4 flex h-8 w-8 items-center justify-center rounded-md bg-accent">
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
              <path d="M2 12L7 7L10 10L14 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="mx-auto space-y-2 px-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`h-8 rounded-lg ${i === 1 ? 'bg-accent-muted' : 'bg-gray-100'}`} />
            ))}
          </div>
        </div>

        <div className={cn('min-w-0 flex-1', compact ? 'p-4' : 'p-5')}>
          <p className="text-sm font-semibold text-heading">Today</p>
          <p className="text-xs text-muted mt-0.5">Thursday, 20 Aug · 4 pending actions</p>

          <div className={cn('mt-4 grid grid-cols-2', compact ? 'gap-2' : 'gap-3')}>
            {stats.map(stat => (
              <div key={stat.label} className="rounded-md bg-white p-3 shadow-[var(--shadow-card)]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-muted truncate">{stat.label}</p>
                    <p className={cn('font-semibold tabular-nums text-heading mt-0.5', compact ? 'text-base' : 'text-lg')}>
                      {stat.value}
                    </p>
                  </div>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-muted text-accent">
                    <stat.icon className="h-3.5 w-3.5" />
                  </span>
                </div>
                <p className="text-[11px] text-muted mt-2 truncate">{stat.detail}</p>
              </div>
            ))}
          </div>

          {!compact && (
            <div className="mt-4 rounded-md bg-white p-4 shadow-[var(--shadow-card)]">
              <p className="text-sm font-semibold text-heading">Action inbox</p>
              <p className="text-xs text-muted mt-0.5">3 items need attention</p>
              <ul className="mt-3 space-y-2">
                {inbox.map(item => (
                  <li key={item.title} className="rounded-md border border-gray-100 bg-gray-50/80 px-3 py-2">
                    <p className="text-xs font-medium text-heading">{item.title}</p>
                    <p className="text-[11px] text-muted mt-0.5">{item.meta}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
