import { DatePicker } from '../ui/DatePicker'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { listFinancialYears } from '../../lib/reports/fy'
import { emptyReportFilters, type ReportFilters } from '../../lib/reports/filters'

interface ReportFiltersBarProps {
  filters: ReportFilters
  onChange: (next: ReportFilters) => void
  items: string[]
  customers: string[]
  suppliers: string[]
  brokers: string[]
  statuses: string[]
}

export function ReportFiltersBar({
  filters,
  onChange,
  items,
  customers,
  suppliers,
  brokers,
  statuses,
}: ReportFiltersBarProps) {
  const years = listFinancialYears()
  const set = (patch: Partial<ReportFilters>) => onChange({ ...filters, ...patch })
  const opt = (values: string[]) => [{ value: '', label: 'All' }, ...values.map(v => ({ value: v, label: v }))]

  return (
    <div className="rounded-md bg-card shadow-[var(--shadow-card)] p-4 mb-4 print:hidden">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Select
          label="Financial year"
          value={filters.fyId}
          options={[{ value: '', label: 'Custom range' }, ...years.map(y => ({ value: y.id, label: y.label }))]}
          onChange={e => {
            const fy = years.find(y => y.id === e.target.value)
            if (!fy) {
              set({ fyId: '', dateFrom: '', dateTo: '' })
              return
            }
            set({ fyId: fy.id, dateFrom: fy.from, dateTo: fy.to })
          }}
        />
        <DatePicker label="From" value={filters.dateFrom} onChange={dateFrom => set({ dateFrom, fyId: '' })} />
        <DatePicker label="To" value={filters.dateTo} onChange={dateTo => set({ dateTo, fyId: '' })} />
        <Input
          icon
          label="Search"
          placeholder="Ref, party, product…"
          value={filters.search}
          onChange={e => set({ search: e.target.value })}
        />
        <Select label="Product" value={filters.item} options={opt(items)} onChange={e => set({ item: e.target.value })} />
        <Select label="Customer" value={filters.customer} options={opt(customers)} onChange={e => set({ customer: e.target.value })} />
        <Select label="Supplier" value={filters.supplier} options={opt(suppliers)} onChange={e => set({ supplier: e.target.value })} />
        <Select label="Broker" value={filters.broker} options={opt(brokers)} onChange={e => set({ broker: e.target.value })} />
        <Select label="Status" value={filters.status} options={opt(statuses)} onChange={e => set({ status: e.target.value })} />
      </div>
      <button
        type="button"
        className="mt-3 text-xs text-accent hover:underline cursor-pointer"
        onClick={() => onChange(emptyReportFilters())}
      >
        Clear filters
      </button>
    </div>
  )
}
