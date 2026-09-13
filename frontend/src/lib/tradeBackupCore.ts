import type { TradeData } from '../api/tradeApi'

export const BACKUP_VERSION = 1

export interface TradeBackup {
  exportedAt: string
  version: number
  data: TradeData
}

export function parseTradeBackup(json: unknown): TradeBackup {
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid backup file')
  }

  const obj = json as Record<string, unknown>
  let version = BACKUP_VERSION
  let data: Record<string, unknown>

  if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
    if (typeof obj.version === 'number') version = obj.version
    data = obj.data as Record<string, unknown>
  } else if (Array.isArray(obj.tradeOrders)) {
    data = obj
  } else {
    throw new Error('Unrecognized backup format')
  }

  if (version > BACKUP_VERSION) {
    throw new Error(`Backup version ${version} is newer than this app supports`)
  }
  if (!Array.isArray(data.tradeOrders)) {
    throw new Error('Backup is missing trade orders')
  }

  const exportedAt = typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString()

  return {
    exportedAt,
    version,
    data: data as unknown as TradeData,
  }
}
