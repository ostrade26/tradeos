import { useState } from 'react'
import { ChevronDown, Download, SlidersHorizontal } from 'lucide-react'
import { FilterBar } from '../ui/CommandPalette'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { MultiSelect } from '../ui/MultiSelect'
import { Select } from '../ui/Select'
import {
  clearFilterField,
  emptyOrderFilters,
  getAppliedFilterChips,
  type OrderFilterState,
} from '../../lib/orderFilters'
import { AppliedFilterChips, DateFilterPicker } from './DateFilterPicker'
import { cn } from '../../lib/utils'

interface OrderFiltersBarProps {
  shortLabel: string
  partyLabel: string
  search: string
  onSearchChange: (value: string) => void
  filters: OrderFilterState
  onFiltersChange: (filters: OrderFilterState) => void
  items: string[]
  parties: string[]
  brokers: string[]
  spots: string[]
  onExport: () => void
  /** Show Unlinked-only control (sales orders). */
  showUnlinkedFilter?: boolean
}

export function OrderFiltersBar({
  shortLabel,
  partyLabel,
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  items,
  parties,
  brokers,
  spots,
  onExport,
  showUnlinkedFilter = false,
}: OrderFiltersBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)

  const setFilter = <K extends keyof OrderFilterState>(key: K, value: OrderFilterState[K]) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const chips = getAppliedFilterChips(filters, partyLabel, search)

  const handleRemoveChip = (id: string) => {
    if (id === 'search') {
      onSearchChange('')
      return
    }
    onFiltersChange(clearFilterField(filters, id))
  }

  const handleClearAll = () => {
    onSearchChange('')
    onFiltersChange(emptyOrderFilters)
  }

  return (
    <div className="space-y-3 mb-4">
      <FilterBar>
        <div className="w-full sm:w-64">
          <Input
            icon
            placeholder={`Search ${shortLabel}s...`}
            value={search}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="md"
          className="lg:hidden"
          onClick={() => setFiltersOpen(v => !v)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters{chips.length > 0 ? ` (${chips.length})` : ''}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', filtersOpen && 'rotate-180')} />
        </Button>
        <Button variant="outline" size="md" onClick={onExport}>
          <Download className="h-4 w-4" /> Export
        </Button>
      </FilterBar>

      <div className={cn(
        'rounded-md border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-card',
        !filtersOpen && 'hidden lg:block',
      )}>
        <div className={cn(
          'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3',
          showUnlinkedFilter ? 'xl:grid-cols-7' : 'xl:grid-cols-6',
        )}>
          <DateFilterPicker
            label="Created date"
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            onChange={(dateFrom, dateTo) => onFiltersChange({ ...filters, dateFrom, dateTo })}
          />
          <DateFilterPicker
            label="Delivery period"
            dateFrom={filters.deliveryPeriodFrom}
            dateTo={filters.deliveryPeriodTo}
            onChange={(deliveryPeriodFrom, deliveryPeriodTo) =>
              onFiltersChange({ ...filters, deliveryPeriodFrom, deliveryPeriodTo })
            }
          />
          <MultiSelect
            label="Item"
            placeholder="All items"
            searchPlaceholder="Search items..."
            options={items.map(item => ({ value: item, label: item }))}
            values={filters.items}
            onChange={values => setFilter('items', values)}
            emptyMessage="No items in list"
          />
          <MultiSelect
            label={partyLabel}
            placeholder={`All ${partyLabel.toLowerCase()}s`}
            searchPlaceholder={`Search ${partyLabel.toLowerCase()}s...`}
            options={parties.map(party => ({ value: party, label: party }))}
            values={filters.parties}
            onChange={values => setFilter('parties', values)}
            emptyMessage={`No ${partyLabel.toLowerCase()}s in list`}
          />
          <MultiSelect
            label="Broker"
            placeholder="All brokers"
            searchPlaceholder="Search brokers..."
            options={brokers.map(broker => ({ value: broker, label: broker }))}
            values={filters.brokers}
            onChange={values => setFilter('brokers', values)}
            emptyMessage="No brokers in list"
          />
          <MultiSelect
            label="Spot / location"
            placeholder="All spots"
            searchPlaceholder="Search spots..."
            options={spots.map(spot => ({ value: spot, label: spot }))}
            values={filters.spots}
            onChange={values => setFilter('spots', values)}
            emptyMessage="No spots in list"
          />
          {showUnlinkedFilter ? (
            <Select
              label="PO link"
              placeholder="All SOs"
              searchable={false}
              options={[
                { value: 'all', label: 'All SOs' },
                { value: 'unlinked', label: 'Unlinked only' },
              ]}
              value={filters.unlinkedOnly ? 'unlinked' : 'all'}
              onChange={e => setFilter('unlinkedOnly', e.target.value === 'unlinked')}
            />
          ) : null}
        </div>

        <AppliedFilterChips chips={chips} onRemove={handleRemoveChip} onClearAll={handleClearAll} />
      </div>
    </div>
  )
}
