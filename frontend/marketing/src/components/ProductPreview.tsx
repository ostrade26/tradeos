import type { ReactNode } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  FileText,
  History,
  LayoutDashboard,
  Link2,
  Package,
  Scale,
  Send,
  Truck,
} from 'lucide-react'
import { cn } from '../lib/utils'
import markUrl from '../assets/tradeal-mark-blue.png'

const stats = [
  {
    label: 'Inventory Value',
    value: '₹2.14 Cr',
    change: '186.4 MT on hand',
    details: ['12 active lots', '142.0 MT available to sell'],
    icon: Package,
  },
  {
    label: 'Open POs',
    value: '7',
    change: '92.0 MT to lift',
    details: ['20 total purchase orders', '3 partially lifted'],
    icon: FileText,
  },
  {
    label: 'Open SOs',
    value: '11',
    change: '64.5 MT to lift',
    details: ['18 total sales orders', '4 partially lifted'],
    icon: Send,
  },
  {
    label: 'Lifts',
    value: '18',
    change: '4 in transit',
    details: ['412.6 MT lifted overall', '20 PO · 18 SO'],
    icon: Truck,
  },
]

const nav = [
  { icon: LayoutDashboard, active: true },
  { icon: ArrowDownToLine, active: false },
  { icon: ArrowUpFromLine, active: false },
  { icon: Scale, active: false },
  { icon: Package, active: false },
]

const inbox = [
  { title: 'Lift remaining on PO-1042', subtitle: 'Supplier · 18.0 MT still to lift', icon: Truck, tone: 'high' as const },
  { title: 'SO-2218 unlinked to a PO', subtitle: 'Customer · 12.0 MT', icon: Link2, tone: 'medium' as const },
  { title: 'Mark lift delivered', subtitle: 'L-188 · 24.5 MT planned', icon: Clock, tone: 'low' as const },
]

const activity = [
  { title: 'PO-1042 created', meta: '100 MT · just now' },
  { title: 'Lift recorded', meta: 'L-188 · 40.0 MT' },
  { title: 'SO-2218 updated', meta: 'Remaining-to-lift 60 MT' },
]

const transit = [
  { ref: 'L-188', meta: '24.5 MT · SO-2218' },
  { ref: 'L-189', meta: '16.0 MT · SO-2220' },
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
        <div className={cn('hidden shrink-0 border-r border-gray-200 bg-white py-4 sm:block', compact ? 'w-16' : 'w-[4.5rem]')}>
          <div className="mx-auto mb-4 flex h-8 w-8 items-center justify-center rounded-md">
            <img src={markUrl} alt="" width={32} height={32} className="h-8 w-8 object-contain" />
          </div>
          <div className="mx-auto space-y-2 px-3">
            {nav.map((item, i) => (
              <div
                key={i}
                className={cn(
                  'flex h-8 items-center justify-center rounded-lg',
                  item.active ? 'bg-accent-muted text-accent' : 'text-muted',
                )}
              >
                <item.icon className="h-4 w-4" />
              </div>
            ))}
          </div>
        </div>

        <div className={cn('min-w-0 flex-1', compact ? 'p-5 sm:p-6' : 'p-5')}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={cn('font-semibold text-heading', compact ? 'text-base' : 'text-sm')}>Today</p>
              <p className="text-xs text-muted mt-0.5">Thursday, 20 Aug · 4 items need attention</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { icon: FileText, label: 'New PO' },
                { icon: Send, label: 'New SO' },
                { icon: Truck, label: 'Record lift' },
              ].map(action => (
                <span
                  key={action.label}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-xs font-medium text-heading"
                >
                  <action.icon className="h-3.5 w-3.5 text-muted" />
                  {action.label}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map(stat => (
              <div key={stat.label} className={cn('rounded-md bg-white shadow-[var(--shadow-card)]', compact ? 'p-4' : 'p-3')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-muted truncate">{stat.label}</p>
                    <p className={cn('font-semibold tabular-nums text-heading mt-0.5', compact ? 'text-xl' : 'text-lg')}>
                      {stat.value}
                    </p>
                  </div>
                  <span className={cn('flex shrink-0 items-center justify-center rounded-md bg-accent-muted text-accent', compact ? 'h-9 w-9' : 'h-8 w-8')}>
                    <stat.icon className={cn(compact ? 'h-4 w-4' : 'h-3.5 w-3.5')} />
                  </span>
                </div>
                <p className="text-[11px] text-muted mt-2 truncate">{stat.change}</p>
                {!compact
                  ? stat.details.map(line => (
                    <p key={line} className="text-[11px] text-muted truncate">{line}</p>
                  ))
                  : null}
              </div>
            ))}
          </div>

          {compact ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <Panel title="Action inbox" subtitle="4 items need attention">
                {inbox.map(item => (
                  <Row
                    key={item.title}
                    title={item.title}
                    meta={item.subtitle}
                    icon={item.icon}
                    tone={item.tone}
                  />
                ))}
              </Panel>
              <Panel title="In transit" subtitle="4 lifts pending delivery">
                {transit.map(item => (
                  <Row key={item.ref} title={item.ref} meta={item.meta} icon={Clock} tone="medium" />
                ))}
              </Panel>
            </div>
          ) : (
            <>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <Panel title="Action inbox" subtitle="4 items need attention">
                  {inbox.map(item => (
                    <Row
                      key={item.title}
                      title={item.title}
                      meta={item.subtitle}
                      icon={item.icon}
                      tone={item.tone}
                    />
                  ))}
                </Panel>
                <Panel title="Recent activity" subtitle="Latest changes across your desk">
                  {activity.map(item => (
                    <Row key={item.title} title={item.title} meta={item.meta} icon={History} tone="low" />
                  ))}
                </Panel>
                <Panel title="In transit" subtitle="4 lifts pending delivery">
                  {transit.map(item => (
                    <Row key={item.ref} title={item.ref} meta={item.meta} icon={Clock} tone="medium" />
                  ))}
                </Panel>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Snapshot
                  title="Compliance snapshot"
                  subtitle="From live order and lift data"
                  metrics={[
                    { label: 'Open exceptions', value: '3' },
                    { label: 'Critical', value: '1' },
                    { label: 'Missing docs', value: '2' },
                  ]}
                />
                <Snapshot
                  title="Inventory snapshot"
                  subtitle="2 lots need attention"
                  metrics={[
                    { label: 'Low stock', value: '2' },
                    { label: 'Zero available', value: '0' },
                    { label: 'Active lots', value: '12' },
                  ]}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="rounded-md bg-white p-4 shadow-[var(--shadow-card)]">
      <p className="text-sm font-semibold text-heading">{title}</p>
      <p className="text-[11px] text-muted mt-0.5">{subtitle}</p>
      <ul className="mt-3 space-y-1">{children}</ul>
    </div>
  )
}

function Row({
  title,
  meta,
  icon: Icon,
  tone,
}: {
  title: string
  meta: string
  icon: typeof Truck
  tone: 'high' | 'medium' | 'low'
}) {
  return (
    <li className="flex items-start gap-2.5 rounded-lg px-1 py-1.5">
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
          tone === 'high' && 'bg-red-50 text-danger',
          tone === 'medium' && 'bg-amber-50 text-warning',
          tone === 'low' && 'bg-gray-100 text-muted',
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0">
        <p className="text-xs font-medium text-heading truncate">{title}</p>
        <p className="text-[11px] text-muted truncate">{meta}</p>
      </span>
    </li>
  )
}

function Snapshot({
  title,
  subtitle,
  metrics,
}: {
  title: string
  subtitle: string
  metrics: { label: string; value: string }[]
}) {
  return (
    <div className="rounded-md bg-white p-4 shadow-[var(--shadow-card)]">
      <p className="text-sm font-semibold text-heading">{title}</p>
      <p className="text-[11px] text-muted mt-0.5">{subtitle}</p>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {metrics.map(m => (
          <div key={m.label} className="rounded-md bg-[#f2f2f7] px-2 py-2">
            <dt className="text-[10px] font-medium text-muted truncate">{m.label}</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-heading">{m.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
