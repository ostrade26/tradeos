import { storageGet, storageSet } from './storage'

const READ_KEY = 'tradeal-notifications-read'

function readIds(): Set<string> {
  try {
    const raw = storageGet(READ_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

function persist(ids: Set<string>) {
  storageSet(READ_KEY, JSON.stringify([...ids]))
}

export function getReadNotificationIds(): Set<string> {
  return readIds()
}

export function markNotificationRead(id: string) {
  const ids = readIds()
  ids.add(id)
  persist(ids)
}

export function markAllNotificationsRead(ids: string[]) {
  const set = readIds()
  for (const id of ids) set.add(id)
  persist(set)
}

export function countUnread(ids: string[]): number {
  const read = readIds()
  return ids.filter(id => !read.has(id)).length
}
