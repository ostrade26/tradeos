import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Filter } from 'lucide-react'
import { PageHeader, FilterBar } from '../components/ui/CommandPalette'
import { Breadcrumb, EmptyState } from '../components/ui/Tabs'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { formatDateTime, formatDateGroupHeading, cn } from '../lib/utils'
import { useTradeStore } from '../store/TradeStore'
import { activityEntityHref } from '../lib/activityHref'
import { activityTypeConfig as typeConfig } from '../lib/activityDisplay'

export function ActivityPage() {
  const { activities } = useTradeStore()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const filtered = activities.filter(a => {
    const matchSearch = a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase()) ||
      a.user.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'all' || a.type === typeFilter
    return matchSearch && matchType
  })

  const grouped = filtered.reduce<Record<string, typeof activities>>((acc, a) => {
    const date = formatDateGroupHeading(a.timestamp)
    if (!acc[date]) acc[date] = []
    acc[date].push(a)
    return acc
  }, {})

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Activity Timeline"
        subtitle="Every saved change in Tradeal — not the same as the Action inbox, which only lists work still open."
        breadcrumb={<Breadcrumb items={[{ label: 'Tradeal', href: '/' }, { label: 'Activity' }]} />}
      />

      <FilterBar>
        <div className="w-64">
          <Input icon placeholder="Search activity..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select
          options={[
            { value: 'all', label: 'All Types' },
            { value: 'po_created', label: 'Purchase orders' },
            { value: 'so_created', label: 'Sales orders' },
            { value: 'lift_recorded', label: 'Lifts' },
            { value: 'po_buy_back', label: 'Buy backs' },
            { value: 'contract_created', label: 'Contracts' },
            { value: 'payment_received', label: 'Payments' },
            { value: 'goods_dispatched', label: 'Dispatches' },
            { value: 'stock_allocated', label: 'Allocations' },
            { value: 'inventory_sold', label: 'Sales' },
            { value: 'delivery_completed', label: 'Deliveries' },
            { value: 'order_updated', label: 'Updates' },
            { value: 'order_deleted', label: 'Deleted' },
            { value: 'order_deletion_scheduled', label: 'Deletion scheduled' },
            { value: 'balance_cash_settled', label: 'Cash settled' },
            { value: 'order_closed_carried', label: 'Carried forward' },
            { value: 'order_short_closed', label: 'Short closed' },
          ]}
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        />
        {(search.trim() || typeFilter !== 'all') && (
          <Button variant="outline" size="md" onClick={() => { setSearch(''); setTypeFilter('all') }}>
            <Filter className="h-4 w-4" /> Clear filters
          </Button>
        )}
      </FilterBar>

      <div className="space-y-8">
        {filtered.length === 0 ? (
          <EmptyState
            card
            icon={<FileText className="h-10 w-10" />}
            title={search.trim() || typeFilter !== 'all' ? 'No activity matches your filters' : 'No activity yet'}
            description={search.trim() || typeFilter !== 'all'
              ? 'Try adjusting your search or filters.'
              : 'Trade operations will appear here as they happen.'}
            action={
              search.trim() || typeFilter !== 'all' ? (
                <Button variant="outline" size="sm" onClick={() => { setSearch(''); setTypeFilter('all') }}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : Object.entries(grouped).map(([date, items]) => (
          <div key={date}>
            <div className="py-2 mb-3">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">{date}</p>
            </div>

            <div className="space-y-0">
                {items.map((a, index) => {
                  const config = typeConfig[a.type]
                  const Icon = config.icon
                  const isLast = index === items.length - 1
                  const showConnector = items.length > 1 && !isLast
                  return (
                    <div key={a.id} className={cn('flex gap-4', !isLast && 'pb-3')}>
                      <div className="flex flex-col items-center w-10 shrink-0">
                        <div className={cn('flex h-10 w-10 items-center justify-center rounded-full shrink-0', config.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        {showConnector && (
                          <div className="w-px flex-1 min-h-4 bg-zinc-200 dark:bg-zinc-800 mt-1" aria-hidden />
                        )}
                      </div>
                      <Card padding={false} className="flex-1 min-w-0 hover:shadow-md transition-shadow">
                        <div className="p-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-heading">{a.title}</p>
                            <Badge variant="default">{config.label}</Badge>
                            {a.entityRef && (() => {
                              const href = activityEntityHref(a.entityRef)
                              return href ? (
                                <Link to={href} className="text-xs font-mono text-accent hover:underline">
                                  {a.entityRef}
                                </Link>
                              ) : (
                                <span className="text-xs font-mono text-muted">{a.entityRef}</span>
                              )
                            })()}
                          </div>
                          <p className="text-sm text-muted mt-0.5">{a.description}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-xs text-muted">{a.user}</span>
                            <span className="text-xs text-muted">·</span>
                            <span className="text-xs text-muted">{formatDateTime(a.timestamp)}</span>
                          </div>
                        </div>
                      </Card>
                    </div>
                  )
                })}
              </div>
          </div>
        ))}
      </div>
    </div>
  )
}
