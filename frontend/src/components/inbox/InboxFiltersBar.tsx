import { FilterBar } from '../ui/CommandPalette'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { SegmentedControl } from '../ui/SegmentedControl'
import type { InboxBox } from '../../api/inboxApi'
import { requestRecipientLabel } from '../feedback/SendToTradealModal'
import { inboxTypeLabel } from '../../lib/notificationDisplay'
import type { UnifiedInboxItem } from '../../lib/unifiedInbox'

export type InboxStatusFilter = 'open' | 'all'

const ALL = 'all'

export function inboxPartyLabel(item: UnifiedInboxItem): string {
  if (item.category !== 'sent') return item.from.trim() || '—'
  if (item.productRequest && !item.send) return requestRecipientLabel('tradeal')
  if (item.send && item.kind === 'product_request' && item.productRequest?.organisation_name) {
    return item.productRequest.organisation_name
  }
  const count = item.send?.sent_count
  if (count == null) return item.from.trim() || '—'
  return `${count} ${count === 1 ? 'person' : 'people'}`
}

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(value => value && value !== '—'))]
    .sort((a, b) => a.localeCompare(b))
}

export function InboxFiltersBar({
  box,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  openCount,
  openFilterLabel = 'Unread',
  fromFilter,
  onFromFilterChange,
  fromOptions,
  typeFilter,
  onTypeFilterChange,
  typeOptions,
}: {
  box: InboxBox
  search: string
  onSearchChange: (value: string) => void
  statusFilter: InboxStatusFilter
  onStatusFilterChange: (value: InboxStatusFilter) => void
  openCount: number
  /** Received “needs attention” segment label (Unread for both org and platform). */
  openFilterLabel?: string
  fromFilter: string
  onFromFilterChange: (value: string) => void
  fromOptions: string[]
  typeFilter: string
  onTypeFilterChange: (value: string) => void
  typeOptions: string[]
}) {
  const partyLabel = box === 'sent' ? 'Sent to' : 'From'
  return (
    <FilterBar>
      <div className="w-full sm:w-64">
        <Input
          icon
          placeholder={box === 'sent' ? 'Search sent…' : 'Search inbox…'}
          value={search}
          onChange={e => onSearchChange(e.target.value)}
        />
      </div>
      {box === 'received' ? (
        <SegmentedControl
          size="field"
          ariaLabel="Status"
          value={statusFilter}
          onChange={onStatusFilterChange}
          options={[
            { id: 'all', label: 'All' },
            {
              id: 'open',
              label: openCount > 0 ? `${openFilterLabel} (${openCount})` : openFilterLabel,
            },
          ]}
        />
      ) : null}
      <div className="w-full sm:w-52">
        <Select
          placeholder={`All ${partyLabel.toLowerCase()}`}
          options={[
            { value: ALL, label: `All ${partyLabel.toLowerCase()}` },
            ...fromOptions.map(name => ({ value: name, label: name })),
          ]}
          value={fromFilter}
          onChange={e => onFromFilterChange(e.target.value)}
        />
      </div>
      <div className="w-full sm:w-52">
        <Select
          placeholder="All types"
          options={[
            { value: ALL, label: 'All types' },
            ...typeOptions.map(name => ({ value: name, label: name })),
          ]}
          value={typeFilter}
          onChange={e => onTypeFilterChange(e.target.value)}
        />
      </div>
    </FilterBar>
  )
}

export function matchesInboxParty(item: UnifiedInboxItem, fromFilter: string): boolean {
  if (fromFilter === ALL) return true
  return inboxPartyLabel(item) === fromFilter
}

export function matchesInboxType(item: UnifiedInboxItem, typeFilter: string): boolean {
  if (typeFilter === ALL) return true
  return inboxTypeLabel(item) === typeFilter
}
