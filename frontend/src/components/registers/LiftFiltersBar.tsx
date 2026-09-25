import { useState } from 'react'
import { ChevronDown, Download, SlidersHorizontal } from 'lucide-react'
import { FilterBar } from '../ui/CommandPalette'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { MultiSelect } from '../ui/MultiSelect'
import { Select } from '../ui/Select'
import {
  clearLiftFilterField,
  emptyLiftFilters,
  getLiftFilterChips,
  type LiftFilterState,
} from '../../lib/liftFilters'
import { AppliedFilterChips, DateFilterPicker } from './DateFilterPicker'
import { cn } from '../../lib/utils'

interface LiftFiltersBarProps {
  search: string
  onSearchChange: (value: string) => void
  filters: LiftFilterState
  onFiltersChange: (filters: LiftFilterState) => void
  items: string[]
  parties: string[]
  brokers: string[]
  spots: string[]
  onExport: () => void
}

export function LiftFiltersBar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  items,
  parties,
  brokers,
  spots,
  onExport,
}: LiftFiltersBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)

  const setFilter = <K extends keyof LiftFilterState>(key: K, value: LiftFilterState[K]) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const chips = getLiftFilterChips(filters, search)

  const handleRemoveChip = (id: string) => {
    if (id === 'search') {
      onSearchChange('')
      return
    }
    onFiltersChange(clearLiftFilterField(filters, id))
  }

  const handleClearAll = () => {
    onSearchChange('')
    onFiltersChange(emptyLiftFilters)
  }

  return (
    <div className="space-y-3 mb-4">
      <FilterBar>
        <div className="w-full sm:w-64">
          <Input
            icon
            placeholder="Search lifts, PO/SO, tanker..."
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <DateFilterPicker
            label="Created date"
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            onChange={(dateFrom, dateTo) => onFiltersChange({ ...filters, dateFrom, dateTo })}
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
            label="Party"
            placeholder="All parties"
            searchPlaceholder="Search buyers or sellers..."
            options={parties.map(party => ({ value: party, label: party }))}
            values={filters.parties}
            onChange={values => setFilter('parties', values)}
            emptyMessage="No parties in list"
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
          <Select
            label="Lift type"
            placeholder="All lifts"
            searchable={false}
            options={[
              { value: 'all', label: 'All lifts' },
              { value: 'self', label: 'Self lift' },
            ]}
            value={filters.selfLiftOnly ? 'self' : 'all'}
            onChange={e => setFilter('selfLiftOnly', e.target.value === 'self')}
          />
        </div>

        <AppliedFilterChips chips={chips} onRemove={handleRemoveChip} onClearAll={handleClearAll} />
      </div>
    </div>
  )
}
