import { formatDateInput } from '../orderFilters'

export interface FinancialYear {
  id: string
  label: string
  from: string
  to: string
}

export function financialYearStarting(startYear: number): FinancialYear {
  const endYear = startYear + 1
  return {
    id: `${startYear}-${String(endYear).slice(2)}`,
    label: `FY ${startYear}-${String(endYear).slice(2)}`,
    from: `${startYear}-04-01`,
    to: `${endYear}-03-31`,
  }
}

export function financialYearForDate(date = new Date()): FinancialYear {
  const startYear = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1
  return financialYearStarting(startYear)
}

export function listFinancialYears(count = 5, now = new Date()): FinancialYear[] {
  const current = financialYearForDate(now)
  const startYear = Number(current.id.slice(0, 4))
  return Array.from({ length: count }, (_, i) => financialYearStarting(startYear - i))
}

export function todayIso(): string {
  return formatDateInput(new Date())
}
