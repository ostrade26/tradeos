import { roleLabel, type AuthSession } from './auth'
import type { UserProfile } from './userProfile'

export function profileFromSession(session: AuthSession | null): UserProfile {
  if (!session) {
    return { name: '', location: '', email: '', phone: '', role: '' }
  }
  return {
    name: session.name ?? '',
    email: session.email ?? session.username ?? '',
    phone: session.phone ?? '',
    location: session.location ?? '',
    role: roleLabel(session),
  }
}
