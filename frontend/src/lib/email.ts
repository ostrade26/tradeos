/** Optional contact email shape. Empty is allowed. */
const LOGIN_EMAIL_RE =
  /^[a-z0-9](?:[a-z0-9._%+\-]{0,62}[a-z0-9])?@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i

export function contactEmailError(value: string): string | null {
  const email = value.trim().toLowerCase()
  if (!email) return null
  if (email.length > 254 || !LOGIN_EMAIL_RE.test(email)) return 'Enter a valid email address'
  return null
}

export function loginEmailError(value: string): string | null {
  const email = value.trim().toLowerCase()
  if (!email) return 'Email is required'
  return contactEmailError(email)
}

export function isWellFormedLoginEmail(value: string): boolean {
  return loginEmailError(value) == null
}
