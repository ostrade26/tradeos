import { useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Download, SlidersHorizontal } from 'lucide-react'
import { FilterBar } from '../ui/CommandPalette'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { DatePicker } from '../ui/DatePicker'
import { MultiSelect } from '../ui/MultiSelect'
import {
  clearDaybookFilterField,
  daybookFilterChips,
  emptyDaybookFilters,
  type DaybookFilterState,
} from '../../lib/daybookFilters'
import { AppliedFilterChips } from './DateFilterPicker'
import { RATE_COLUMN_HEADER } from '../../lib/orderRate'
import { cn } from '../../lib/utils'

interface DaybookFiltersBarProps {
  broker: boolean
  day: string
  isToday: boolean
  onDayChange: (day: string) => void
  onPreviousDay: () => void
  onNextDay: () => void
  onJumpToday: () => void
  search: string
  onSearchChange: (value: string) => void
  filters: DaybookFilterState
  onFiltersChange: (filters: DaybookFilterState) => void
  items: string[]
  parties: string[]
  buyers: string[]
  sellers: string[]
  brokers: string[]
  spots: string[]
  rates: string[]
  onExport?: () => void
  exportDisabled?: boolean
}

export function DaybookFiltersBar({
  broker,
  day,
  isToday,
  onDayChange,
  onPreviousDay,
  onNextDay,
  onJumpToday,
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  items,
  parties,
  buyers,
  sellers,
  brokers,
  spots,
  rates,
  onExport,
  exportDisabled,
}: DaybookFiltersBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const partyLabel = broker ? 'Buyer' : 'Buyer / Seller'

  const setFilter = <K extends keyof DaybookFilterState>(key: K, value: DaybookFilterState[K]) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const chips = daybookFilterChips(filters, partyLabel, search)

  const handleRemoveChip = (id: string) => {
    if (id === 'search') {
      onSearchChange('')
      return
    }
    onFiltersChange(clearDaybookFilterField(filters, id))
  }

  const handleClearAll = () => {
    onSearchChange('')
    onFiltersChange(emptyDaybookFilters)
  }

  return (
    <div className="space-y-3 mb-4">
      <FilterBar>
        <div className="w-full sm:w-64">
          <Input
            icon
            placeholder="Search daybook…"
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
        {onExport ? (
          <Button variant="outline" size="md" onClick={onExport} disabled={exportDisabled}>
            <Download className="h-4 w-4" /> Export
          </Button>
        ) : null}
      </FilterBar>

      <div className={cn(
        'rounded-md border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-card',
        !filtersOpen && 'hidden lg:block',
      )}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="sm:col-span-2 xl:col-span-1">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Day</span>
              <div className="flex items-start gap-1">
                <Button type="button" variant="outline" size="md" className="h-11 shrink-0 px-2.5 sm:h-9" aria-label="Previous day" onClick={onPreviousDay}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <DatePicker
                  className="min-w-0 flex-1"
                  value={day}
                  onChange={onDayChange}
                  placeholder="DD/MM/YYYY"
                />
                <Button type="button" variant="outline" size="md" className="h-11 shrink-0 px-2.5 sm:h-9" aria-label="Next day" onClick={onNextDay}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              {!isToday ? (
                <button
                  type="button"
                  onClick={onJumpToday}
                  className="text-xs font-medium text-accent hover:underline text-left w-fit"
                >
                  Jump to today
                </button>
              ) : null}
            </div>
          </div>
          <MultiSelect
            label="Item"
            placeholder="All items"
            searchPlaceholder="Search items..."
            options={items.map(item => ({ value: item, label: item }))}
            values={filters.items}
            onChange={values => setFilter('items', values)}
            emptyMessage="No items in list"
          />
          {broker ? (
            <>
              <MultiSelect
                label="Buyer"
                placeholder="All buyers"
                searchPlaceholder="Search buyers..."
                options={buyers.map(name => ({ value: name, label: name }))}
                values={filters.buyers}
                onChange={values => setFilter('buyers', values)}
                emptyMessage="No buyers in list"
              />
              <MultiSelect
                label="Seller"
                placeholder="All sellers"
                searchPlaceholder="Search sellers..."
                options={sellers.map(name => ({ value: name, label: name }))}
                values={filters.sellers}
                onChange={values => setFilter('sellers', values)}
                emptyMessage="No sellers in list"
              />
            </>
          ) : (
            <MultiSelect
              label="Buyer / Seller"
              placeholder="All parties"
              searchPlaceholder="Search parties..."
              options={parties.map(name => ({ value: name, label: name }))}
              values={filters.parties}
              onChange={values => setFilter('parties', values)}
              emptyMessage="No parties in list"
            />
          )}
          {!broker ? (
            <MultiSelect
              label="Broker"
              placeholder="All brokers"
              searchPlaceholder="Search brokers..."
              options={brokers.map(name => ({ value: name, label: name }))}
              values={filters.brokers}
              onChange={values => setFilter('brokers', values)}
              emptyMessage="No brokers in list"
            />
          ) : null}
          <MultiSelect
            label="Spot / location"
            placeholder="All spots"
            searchPlaceholder="Search spots..."
            options={spots.map(spot => ({ value: spot, label: spot }))}
            values={filters.spots}
            onChange={values => setFilter('spots', values)}
            emptyMessage="No spots in list"
          />
          <MultiSelect
            label={RATE_COLUMN_HEADER}
            placeholder="All rates"
            searchPlaceholder="Search rates..."
            options={rates.map(rate => ({ value: rate, label: rate }))}
            values={filters.rates}
            onChange={values => setFilter('rates', values)}
            emptyMessage="No rates in list"
          />
        </div>

        <AppliedFilterChips chips={chips} onRemove={handleRemoveChip} onClearAll={handleClearAll} />
      </div>
    </div>
  )
}
