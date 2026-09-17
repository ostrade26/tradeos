/** Login username: 3–32 characters — letters, numbers, dots, and underscores. */
const USERNAME_RE = /^(?=.*[a-z0-9])[a-z0-9._]{3,32}$/

const RESERVED = new Set([
  'admin',
  'administrator',
  'platform',
  'platform.admin',
  'root',
  'system',
  'support',
  'tradeal',
  'tradeos',
  'help',
  'null',
  'undefined',
])

export function loginUsernameError(value: string, options?: { allowCurrent?: string }): string | null {
  const username = value.trim().toLowerCase()
  const current = options?.allowCurrent?.trim().toLowerCase()
  if (!username) return 'Username is required'
  if (current && username === current) return null
  if (!USERNAME_RE.test(username)) {
    return 'Use 3–32 characters: letters, numbers, dots, and underscores'
  }
  if (RESERVED.has(username)) return 'That username is reserved. Choose another'
  return null
}
