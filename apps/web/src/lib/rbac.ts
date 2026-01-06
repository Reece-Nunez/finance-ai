import { createClient } from '@/lib/supabase/server'
import { log } from './logger'

// User roles in order of privilege (lowest to highest)
export type UserRole = 'user' | 'support' | 'admin' | 'super_admin'

// Permission types
export type Permission =
  // User permissions
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
  // Support permissions
  | 'users:read'
  | 'users:support'
  | 'audit:read'
  // Admin permissions
  | 'users:write'
  | 'users:delete'
  | 'system:settings'
  | 'reports:admin'
  // Super admin permissions
  | 'roles:manage'
  | 'system:all'

// Role hierarchy for comparison
const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 0,
  support: 1,
  admin: 2,
  super_admin: 3,
}

// Permissions for each role
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  user: [
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
  ],
  support: [
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
    'users:read',
    'users:support',
    'audit:read',
  ],
  admin: [
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
    'users:read',
    'users:support',
    'audit:read',
    'users:write',
    'users:delete',
    'system:settings',
    'reports:admin',
  ],
  super_admin: [
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
    'users:read',
    'users:support',
    'audit:read',
    'users:write',
    'users:delete',
    'system:settings',
    'reports:admin',
    'roles:manage',
    'system:all',
  ],
}

/**
 * Get the current user's role
 */
export async function getUserRole(userId?: string): Promise<UserRole> {
  try {
    const supabase = await createClient()

    // Get user ID if not provided
    if (!userId) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      userId = user?.id
    }

    if (!userId) {
      return 'user' // Default to basic user
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (error || !data?.role) {
      return 'user' // Default to basic user
    }

    return data.role as UserRole
  } catch (error) {
    log.error('Failed to get user role', error)
    return 'user'
  }
}

/**
 * Check if a user has a specific permission
 */
export async function hasPermission(
  permission: Permission,
  userId?: string
): Promise<boolean> {
  const role = await getUserRole(userId)
  return ROLE_PERMISSIONS[role].includes(permission)
}

/**
 * Check if a user has a specific role or higher
 */
export async function hasRole(
  requiredRole: UserRole,
  userId?: string
): Promise<boolean> {
  const userRole = await getUserRole(userId)
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

/**
 * Check if user is admin or higher
 */
export async function isAdmin(userId?: string): Promise<boolean> {
  return hasRole('admin', userId)
}

/**
 * Check if user is support or higher
 */
export async function isSupport(userId?: string): Promise<boolean> {
  return hasRole('support', userId)
}

/**
 * Check if user is super admin
 */
export async function isSuperAdmin(userId?: string): Promise<boolean> {
  return hasRole('super_admin', userId)
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role]
}

/**
 * Require a specific permission (throws if not authorized)
 */
export async function requirePermission(
  permission: Permission,
  userId?: string
): Promise<void> {
  const allowed = await hasPermission(permission, userId)
  if (!allowed) {
    log.warn('Permission denied', { permission, userId })
    throw new Error(`Permission denied: ${permission}`)
  }
}

/**
 * Require a specific role (throws if not authorized)
 */
export async function requireRole(
  requiredRole: UserRole,
  userId?: string
): Promise<void> {
  const allowed = await hasRole(requiredRole, userId)
  if (!allowed) {
    log.warn('Role access denied', { requiredRole, userId })
    throw new Error(`Access denied: requires ${requiredRole} role`)
  }
}

/**
 * Update a user's role (only super_admin can do this)
 */
export async function updateUserRole(
  targetUserId: string,
  newRole: UserRole,
  actingUserId?: string
): Promise<void> {
  // Check if acting user is super_admin
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

  log.info('User role updated', {
    targetUserId,
    newRole,
    actingUserId,
  })
}

/**
 * Middleware helper for API routes requiring permission
 */
export function withPermission(permission: Permission) {
  return async function <T extends (...args: unknown[]) => Promise<Response>>(
    handler: T
  ): Promise<Response> {
    try {
      await requirePermission(permission)
      return handler() as Promise<Response>
    } catch {
      return new Response(
        JSON.stringify({ error: 'Forbidden', message: `Permission denied: ${permission}` }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }
}

/**
 * Middleware helper for API routes requiring role
 */
export function withRole(role: UserRole) {
  return async function <T extends (...args: unknown[]) => Promise<Response>>(
    handler: T
  ): Promise<Response> {
    try {
      await requireRole(role)
      return handler() as Promise<Response>
    } catch {
      return new Response(
        JSON.stringify({ error: 'Forbidden', message: `Access denied: requires ${role} role` }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }
}
