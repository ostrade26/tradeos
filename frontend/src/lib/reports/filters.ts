export interface ReportFilters {
  dateFrom: string
  dateTo: string
  fyId: string
  item: string
  customer: string
  supplier: string
  broker: string
  status: string
  search: string
}

export const emptyReportFilters = (): ReportFilters => ({
  dateFrom: '',
  dateTo: '',
  fyId: '',
  item: '',
  customer: '',
  supplier: '',
  broker: '',
  status: '',
  search: '',
})

export interface FilterableRow {
  date?: string
  item?: string
  customer?: string
  supplier?: string
  broker?: string
  status?: string
  search?: string
}

export function applyReportFilters<T extends FilterableRow>(rows: T[], filters: ReportFilters): T[] {
  const q = filters.search.trim().toLowerCase()
  return rows.filter(row => {
    if (filters.dateFrom && (row.date || '') && row.date! < filters.dateFrom) return false
    if (filters.dateTo && (row.date || '') && row.date! > filters.dateTo) return false
    if (filters.item && row.item !== filters.item) return false
    if (filters.customer && row.customer !== filters.customer) return false
    if (filters.supplier && row.supplier !== filters.supplier) return false
    if (filters.broker && row.broker !== filters.broker) return false
    if (filters.status && row.status !== filters.status) return false
    if (q && !(row.search || '').toLowerCase().includes(q)) return false
    return true
  })
}
