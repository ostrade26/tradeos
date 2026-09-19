import { FilterBar } from '../ui/CommandPalette'
import { Input } from '../ui/Input'
import { SegmentedControl } from '../ui/SegmentedControl'
import type { InboxBox } from '../../api/inboxApi'

export type InboxStatusFilter = 'open' | 'all'

export function InboxFiltersBar({
  box,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  openCount,
  openFilterLabel = 'Unread',
}: {
  box: InboxBox
  search: string
  onSearchChange: (value: string) => void
  statusFilter: InboxStatusFilter
  onStatusFilterChange: (value: InboxStatusFilter) => void
  openCount: number
  /** Received “needs attention” segment label (Unread for both org and platform). */
  openFilterLabel?: string
}) {
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
    </FilterBar>
  )
}
