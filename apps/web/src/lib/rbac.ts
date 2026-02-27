import { createClient } from '@/lib/supabase/server'
import { log } from './logger'

export type UserRole = 'user' | 'support' | 'admin' | 'super_admin'

export type Permission =
  | 'transactions:read'
  | 'transactions:write'
  | 'accounts:read'
  | 'accounts:write'
  | 'budgets:read'
  | 'budgets:write'
  | 'ai:chat'
  | 'ai:reports'
  | 'settings:read'
  | 'settings:write'
  | 'users:read'
  | 'users:support'
  | 'audit:read'
  | 'users:write'
  | 'users:delete'
  | 'system:settings'
  | 'reports:admin'
  | 'roles:manage'
  | 'system:all'

const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 0,
  support: 1,
  admin: 2,
  super_admin: 3,
}

const BASE_PERMISSIONS: Permission[] = [
  'transactions:read',
  'transactions:write',
  'accounts:read',
  'accounts:write',
  'budgets:read',
  'budgets:write',
  'ai:chat',
  'ai:reports',
  'settings:read',
  'settings:write',
]

const ROLE_EXTRA_PERMISSIONS: Record<UserRole, Permission[]> = {
  user: [],
  support: ['users:read', 'users:support', 'audit:read'],
  admin: ['users:read', 'users:support', 'audit:read', 'users:write', 'users:delete', 'system:settings', 'reports:admin'],
  super_admin: ['users:read', 'users:support', 'audit:read', 'users:write', 'users:delete', 'system:settings', 'reports:admin', 'roles:manage', 'system:all'],
}

function getPermissions(role: UserRole): Permission[] {
  return [...BASE_PERMISSIONS, ...ROLE_EXTRA_PERMISSIONS[role]]
}

export async function getUserRole(userId?: string): Promise<UserRole> {
  try {
    const supabase = await createClient()

    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id
    }

    if (!userId) return 'user'

    const { data, error } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (error || !data?.role) return 'user'

    return data.role as UserRole
  } catch (error) {
    log.error('Failed to get user role', error)
    return 'user'
  }
}

export async function hasPermission(permission: Permission, userId?: string): Promise<boolean> {
  const role = await getUserRole(userId)
  return getPermissions(role).includes(permission)
}

export async function hasRole(requiredRole: UserRole, userId?: string): Promise<boolean> {
  const userRole = await getUserRole(userId)
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

export async function requirePermission(permission: Permission, userId?: string): Promise<void> {
  const allowed = await hasPermission(permission, userId)
  if (!allowed) {
    log.warn('Permission denied', { permission, userId })
    throw new Error(`Permission denied: ${permission}`)
  }
}

export async function requireRole(requiredRole: UserRole, userId?: string): Promise<void> {
  const allowed = await hasRole(requiredRole, userId)
  if (!allowed) {
    log.warn('Role access denied', { requiredRole, userId })
    throw new Error(`Access denied: requires ${requiredRole} role`)
  }
}

export async function updateUserRole(
  targetUserId: string,
  newRole: UserRole,
  actingUserId?: string
): Promise<void> {
  const canManageRoles = await hasPermission('roles:manage', actingUserId)
  if (!canManageRoles) {
    throw new Error('Only super admins can manage roles')
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('user_profiles')
    .update({ role: newRole })
    .eq('id', targetUserId)

  if (error) {
    log.error('Failed to update user role', error, { targetUserId, newRole })
    throw new Error('Failed to update user role')
  }

  log.info('User role updated', { targetUserId, newRole, actingUserId })
}
