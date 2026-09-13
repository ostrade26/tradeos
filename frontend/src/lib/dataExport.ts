import type { TradeData } from '../api/tradeApi'
import type { TradeStoreValue } from '../store/TradeStore'
import { exportTradeDataToCsv, exportTradeDataToExcel } from './spreadsheetBackup'
import { downloadFile } from './export'
import { BACKUP_VERSION, parseTradeBackup, type TradeBackup } from './tradeBackupCore'

export { BACKUP_VERSION, parseTradeBackup, type TradeBackup } from './tradeBackupCore'
export { readBackupFile, readMultipleSpreadsheetFiles, exportImportTemplate } from './spreadsheetBackup'

function tradeDataFromStore(store: TradeStoreValue): TradeData {
  return {
    tradeOrders: store.tradeOrders,
    lifts: store.lifts,
    contracts: store.contracts,
    lots: store.lots,
    payments: store.payments,
    deliveries: store.deliveries,
    brokers: store.brokers,
    producers: store.producers,
    retailers: store.retailers,
    companies: store.companies,
    activities: store.activities,
    balanceSettlements: store.balanceSettlements ?? [],
    spots: store.spots,
    items: store.items,
    counters: store.counters,
  }
}

export function buildTradeBackup(data: TradeData): TradeBackup {
  return {
    exportedAt: new Date().toISOString(),
    version: BACKUP_VERSION,
    data,
  }
}

export async function exportAllTradeData(store: TradeStoreValue, format: 'json' | 'excel' | 'csv' = 'json') {
  const data = tradeDataFromStore(store)
  if (format === 'excel') {
    await exportTradeDataToExcel(data)
    return
  }
  if (format === 'csv') {
    await exportTradeDataToCsv(data)
    return
  }
  const payload = buildTradeBackup(data)
  downloadFile(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    `tradeos-backup-${new Date().toISOString().slice(0, 10)}.json`,
  )
}

export function describeTradeBackup(data: TradeData): string {
  const orders = data.tradeOrders ?? []
  const pos = orders.filter(o => o.side === 'purchase').length
  const sos = orders.filter(o => o.side === 'sale').length
  const lifts = data.lifts?.length ?? 0
  const lots = data.lots?.length ?? 0
  const brokers = data.brokers?.length ?? 0
  const companies = data.companies?.length ?? 0
  return [
    `${pos} PO${pos === 1 ? '' : 's'}`,
    `${sos} SO${sos === 1 ? '' : 's'}`,
    `${lifts} lift${lifts === 1 ? '' : 's'}`,
    `${lots} lot${lots === 1 ? '' : 's'}`,
    `${brokers} broker${brokers === 1 ? '' : 's'}`,
    `${companies} ${companies === 1 ? 'company' : 'companies'}`,
  ].join(' · ')
}

export function describeImportResult(data: TradeData): { summary: string; hint?: string } {
  const orders = data.tradeOrders ?? []
  const pos = orders.filter(o => o.side === 'purchase')
  const sos = orders.filter(o => o.side === 'sale')
  const lifts = data.lifts?.length ?? 0
  const completedPos = pos.filter(o => o.status === 'completed').length
  const completedSos = sos.filter(o => o.status === 'completed').length
  const summary = describeTradeBackup(data)
  const allCompleted = orders.length > 0 && orders.every(o => o.status === 'completed' || o.status === 'cancelled')
  const hint = allCompleted
    ? 'Imported orders are fully lifted — open Register (completed) on PO, SO, or Lift pages to view them.'
    : (completedPos + completedSos > 0
      ? 'Some imported orders are fully lifted — use the Register tab on PO/SO pages for completed history.'
      : undefined)
  if (orders.length === 0 && lifts === 0) {
    return { summary: 'No rows recognized', hint: 'Check column headers against the Template, or name files PO.xlsx, SO.xlsx, Lift.xlsx.' }
  }
  return { summary, hint }
}

export async function readTradeBackupFile(file: File): Promise<TradeBackup> {
  const text = await file.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Backup file is not valid JSON')
  }
  return parseTradeBackup(parsed)
}
