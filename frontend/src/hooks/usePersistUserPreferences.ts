import { authApi } from '../api/tradeApi'
import type { UserPreferences } from '../lib/auth'
import { loadAuthSession, saveAuthSession } from '../lib/auth'
import { sessionFromApi } from '../lib/authSession'

let persistTimer: ReturnType<typeof setTimeout> | null = null

export function schedulePersistPreferences(partial: UserPreferences): void {
  const session = loadAuthSession()
  if (!session?.token) return
  const merged: UserPreferences = { ...session.preferences, ...partial }
  saveAuthSession({ ...session, preferences: merged })

  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    void authApi.updatePreferences(partial).then(result => {
      const current = loadAuthSession()
      if (!current?.token) return
      saveAuthSession(sessionFromApi(result, current.token))
    }).catch(() => {
      /* local cache remains */
    })
  }, 400)
}
