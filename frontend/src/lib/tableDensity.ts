import { storageGet, storageSet } from './storage'

export type TableDensity = 'compact' | 'relaxed'

const STORAGE_KEY = 'tradeos-table-density'

export function loadTableDensity(): TableDensity {
  try {
    const stored = storageGet(STORAGE_KEY)
    if (stored === 'compact' || stored === 'relaxed') return stored
  } catch {
    /* ignore */
  }
  return 'relaxed'
}

export function storeTableDensity(density: TableDensity) {
  try {
    storageSet(STORAGE_KEY, density)
  } catch {
    /* ignore */
  }
}

export function tableDensityLabel(density: TableDensity): string {
  return density === 'compact' ? 'Compact' : 'Relaxed'
}

export function tableDensityClasses(density: TableDensity) {
  if (density === 'compact') {
    return {
      cellX: 'px-2.5',
      headerY: 'py-1.5',
      bodyY: 'py-1.5',
      actionsY: 'py-0',
      text: 'text-sm',
      leading: 'leading-snug',
      mobileRow: 'px-3 py-2.5',
      footerNote: 'px-3 py-1.5',
      groupHeaderCell: 'px-3 py-2',
      groupBodyCell: 'px-3 py-1.5',
      groupTotalCell: 'px-3 py-1.5',
      menuTrigger: 'h-7 w-7',
    }
  }
  return {
    cellX: 'px-5',
    headerY: 'py-3',
    bodyY: 'py-3',
    actionsY: 'py-2.5',
    text: 'text-sm',
    leading: 'leading-normal',
    mobileRow: 'px-5 py-4',
    footerNote: 'px-5 py-3',
    groupHeaderCell: 'px-5 py-3',
    groupBodyCell: 'px-5 py-3',
    groupTotalCell: 'px-5 py-3',
    menuTrigger: 'h-8 w-8',
  }
}
