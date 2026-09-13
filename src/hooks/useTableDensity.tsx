import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  loadTableDensity,
  storeTableDensity,
  tableDensityClasses,
  type TableDensity,
} from '../lib/tableDensity'

interface TableDensityContextValue {
  density: TableDensity
  setDensity: (density: TableDensity) => void
  classes: ReturnType<typeof tableDensityClasses>
}

const TableDensityContext = createContext<TableDensityContextValue | null>(null)

export function TableDensityProvider({ children }: { children: ReactNode }) {
  const [density, setDensityState] = useState<TableDensity>(loadTableDensity)

  const setDensity = (next: TableDensity) => {
    setDensityState(next)
    storeTableDensity(next)
  }

  const value = useMemo<TableDensityContextValue>(() => ({
    density,
    setDensity,
    classes: tableDensityClasses(density),
  }), [density])

  return (
    <TableDensityContext.Provider value={value}>
      {children}
    </TableDensityContext.Provider>
  )
}

export function useTableDensity() {
  const ctx = useContext(TableDensityContext)
  if (ctx) return ctx

  // Fallback when provider is missing (e.g. HMR) — read persisted setting, no live updates.
  const density = loadTableDensity()
  return {
    density,
    setDensity: (next: TableDensity) => storeTableDensity(next),
    classes: tableDensityClasses(density),
  }
}
