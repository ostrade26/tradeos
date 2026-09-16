import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  loadTableDensity,
  storeTableDensity,
  tableDensityClasses,
  type TableDensity,
} from '../lib/tableDensity'
import { schedulePersistPreferences } from './usePersistUserPreferences'
import { useAuth } from './useAuth'

interface TableDensityContextValue {
  density: TableDensity
  setDensity: (density: TableDensity) => void
  classes: ReturnType<typeof tableDensityClasses>
}

const TableDensityContext = createContext<TableDensityContextValue | null>(null)

export function TableDensityProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userKey = session?.username ?? null
  const [density, setDensityState] = useState<TableDensity>(() => loadTableDensity(userKey))

  useEffect(() => {
    setDensityState(loadTableDensity(userKey))
  }, [userKey])

  const setDensity = (next: TableDensity) => {
    setDensityState(next)
    storeTableDensity(next, userKey)
    schedulePersistPreferences({ tableDensity: next })
  }

  const value = useMemo<TableDensityContextValue>(() => ({
    density,
    setDensity,
    classes: tableDensityClasses(density),
  }), [density, userKey])

  return (
    <TableDensityContext.Provider value={value}>
      {children}
    </TableDensityContext.Provider>
  )
}

export function useTableDensity() {
  const ctx = useContext(TableDensityContext)
  if (ctx) return ctx

  const density = loadTableDensity()
  return {
    density,
    setDensity: (next: TableDensity) => storeTableDensity(next),
    classes: tableDensityClasses(density),
  }
}
