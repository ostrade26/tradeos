import { storageGet, storageSet } from '../storage'

export type ExceptionStatus = 'Open' | 'Under Review' | 'Resolved' | 'Ignored'

export interface ExceptionOverlay {
  status: ExceptionStatus
  assignee?: string
  resolution?: string
  resolvedAt?: string
  notes?: string
}

const KEY = 'tradeal.audit-exceptions'

export function loadExceptionOverlay(): Record<string, ExceptionOverlay> {
  try {
    const raw = storageGet(KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, ExceptionOverlay>
  } catch {
    return {}
  }
}

export function saveExceptionOverlay(id: string, patch: ExceptionOverlay) {
  const all = loadExceptionOverlay()
  all[id] = { ...all[id], ...patch }
  storageSet(KEY, JSON.stringify(all))
}
