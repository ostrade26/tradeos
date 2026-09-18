import { authApi } from '../api/tradeApi'
import type { UserPreferences } from '../lib/auth'
import { loadAuthSession, saveAuthSession } from '../lib/auth'
import { sessionFromApi } from '../lib/authSession'

let persistTimer: ReturnType<typeof setTimeout> | null = null
let pendingPartial: UserPreferences | null = null
let flushWaiters: Array<() => void> = []

function resolveFlushWaiters() {
  const waiters = flushWaiters
  flushWaiters = []
  for (const resolve of waiters) resolve()
}

async function sendPreferences(partial: UserPreferences): Promise<void> {
  const result = await authApi.updatePreferences(partial)
  const current = loadAuthSession()
  if (!current?.token) return
  saveAuthSession(sessionFromApi(result, current.token))
}

export function schedulePersistPreferences(partial: UserPreferences): void {
  const session = loadAuthSession()
  if (!session?.token) return
  const merged: UserPreferences = { ...session.preferences, ...partial }
  saveAuthSession({ ...session, preferences: merged })
  pendingPartial = { ...pendingPartial, ...partial }

  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    const toSend = pendingPartial
    pendingPartial = null
    if (!toSend) {
      resolveFlushWaiters()
      return
    }
    void sendPreferences(toSend)
      .catch(() => {
        /* local cache remains */
      })
      .finally(() => {
        resolveFlushWaiters()
      })
  }, 400)
}

/** Flush any debounced preference writes before a critical save (e.g. account setup). */
export function flushPersistPreferences(): Promise<void> {
  if (!persistTimer && !pendingPartial) return Promise.resolve()
  return new Promise(resolve => {
    flushWaiters.push(resolve)
    if (persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = null
    }
    const toSend = pendingPartial
    pendingPartial = null
    if (!toSend) {
      resolveFlushWaiters()
      return
    }
    void sendPreferences(toSend)
      .catch(() => {
        /* local cache remains */
      })
      .finally(() => {
        resolveFlushWaiters()
      })
  })
}
