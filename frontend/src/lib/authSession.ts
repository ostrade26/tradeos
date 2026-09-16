import type { AuthMeResponse } from '../api/tradeApi'
import type { AuthSession, RoleSlug, UserRole } from './auth'

export function sessionFromApi(result: AuthMeResponse, token: string): AuthSession {
  return {
    token,
    userId: result.userId,
    username: result.username,
    email: result.email,
    name: result.name,
    phone: result.phone,
    location: result.location,
    preferences: result.preferences,
    role: result.role as UserRole,
    roleSlug: (result.roleSlug ?? result.role) as RoleSlug,
    roleName: result.roleName ?? '',
    organisationId: result.organisationId ?? null,
    organisationName: result.organisationName ?? null,
    accountType: result.accountType ?? 'wholesaler_retailer',
    permissions: result.permissions ?? [],
    isPlatformAdmin: !!result.isPlatformAdmin,
    organisationSandboxTools: !!result.organisationSandboxTools,
    appliedUpdates: result.appliedUpdates ?? [],
    appliedVersion: result.appliedVersion ?? '',
  }
}
