-- Role-Based Access Control (RBAC) System
-- Implements user roles and permissions for enterprise access control

-- User roles enum
CREATE TYPE user_role AS ENUM ('user', 'support', 'admin', 'super_admin');

-- Add role column to user profiles (create table if doesn't exist)
DO $$
BEGIN
  -- Check if user_profiles table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
    -- Add role column if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'role') THEN
      ALTER TABLE user_profiles ADD COLUMN role user_role DEFAULT 'user';
    END IF;
  ELSE
    -- Create user_profiles table with role
    CREATE TABLE user_profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      role user_role DEFAULT 'user',
      full_name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- Create index on role for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Permissions table for fine-grained access control
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role permissions mapping
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role user_role NOT NULL,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role, permission_id)
);

-- Insert default permissions
INSERT INTO permissions (name, description) VALUES
  -- User permissions
  ('transactions:read', 'View own transactions'),
  ('transactions:write', 'Edit own transactions'),
  ('accounts:read', 'View own accounts'),
  ('accounts:write', 'Link/unlink accounts'),
  ('budgets:read', 'View own budgets'),
  ('budgets:write', 'Create/edit budgets'),
  ('ai:chat', 'Use AI chat feature'),
  ('ai:reports', 'Generate AI reports'),
  ('settings:read', 'View own settings'),
  ('settings:write', 'Edit own settings'),
  -- Support permissions
  ('users:read', 'View user information'),
  ('users:support', 'Provide user support'),
  ('audit:read', 'View audit logs'),
  -- Admin permissions
  ('users:write', 'Edit user information'),
  ('users:delete', 'Delete user accounts'),
  ('system:settings', 'Manage system settings'),
  ('reports:admin', 'Access admin reports'),
  -- Super admin permissions
  ('roles:manage', 'Manage user roles'),
  ('system:all', 'Full system access')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to roles
-- User role permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'user'::user_role, id FROM permissions WHERE name IN (
  'transactions:read', 'transactions:write',
  'accounts:read', 'accounts:write',
  'budgets:read', 'budgets:write',
  'ai:chat', 'ai:reports',
  'settings:read', 'settings:write'
) ON CONFLICT DO NOTHING;

-- Support role permissions (includes user permissions)
INSERT INTO role_permissions (role, permission_id)
SELECT 'support'::user_role, id FROM permissions WHERE name IN (
  'transactions:read', 'transactions:write',
  'accounts:read', 'accounts:write',
  'budgets:read', 'budgets:write',
  'ai:chat', 'ai:reports',
  'settings:read', 'settings:write',
  'users:read', 'users:support', 'audit:read'
) ON CONFLICT DO NOTHING;

-- Admin role permissions (includes support permissions)
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin'::user_role, id FROM permissions WHERE name IN (
  'transactions:read', 'transactions:write',
  'accounts:read', 'accounts:write',
  'budgets:read', 'budgets:write',
  'ai:chat', 'ai:reports',
  'settings:read', 'settings:write',
  'users:read', 'users:support', 'audit:read',
  'users:write', 'users:delete',
  'system:settings', 'reports:admin'
) ON CONFLICT DO NOTHING;

-- Super admin role permissions (all permissions)
INSERT INTO role_permissions (role, permission_id)
SELECT 'super_admin'::user_role, id FROM permissions
ON CONFLICT DO NOTHING;

-- Function to check if a user has a specific permission
CREATE OR REPLACE FUNCTION has_permission(user_id UUID, permission_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_role_val user_role;
BEGIN
  -- Get user's role
  SELECT role INTO user_role_val
  FROM user_profiles
  WHERE id = user_id;

  -- Default to 'user' if no profile exists
  IF user_role_val IS NULL THEN
    user_role_val := 'user';
  END IF;

  -- Check if role has permission
  RETURN EXISTS (
    SELECT 1 FROM role_permissions rp
    JOIN permissions p ON rp.permission_id = p.id
    WHERE rp.role = user_role_val
    AND p.name = permission_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS user_role AS $$
DECLARE
  role_val user_role;
BEGIN
  SELECT role INTO role_val
  FROM user_profiles
  WHERE id = user_id;

  RETURN COALESCE(role_val, 'user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is admin or higher
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role(user_id) IN ('admin', 'super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is support or higher
CREATE OR REPLACE FUNCTION is_support_or_higher(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role(user_id) IN ('support', 'admin', 'super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS for permissions tables
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Only admins can view permissions
CREATE POLICY "Admins can view permissions"
  ON permissions FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can view role permissions"
  ON role_permissions FOR SELECT
  USING (is_admin(auth.uid()));

-- Only super admins can modify permissions
CREATE POLICY "Super admins can manage permissions"
  ON permissions FOR ALL
  USING (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Super admins can manage role permissions"
  ON role_permissions FOR ALL
  USING (get_user_role(auth.uid()) = 'super_admin');

-- Update audit_logs RLS to allow support/admin to view all logs
DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_logs;

CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  USING (
    auth.uid() = user_id
    OR is_support_or_higher(auth.uid())
  );

-- Add policy for admins to view all transactions (for support)
CREATE POLICY "Support can view all transactions"
  ON transactions FOR SELECT
  USING (is_support_or_higher(auth.uid()));

-- Add policy for admins to view all accounts (for support)
CREATE POLICY "Support can view all accounts"
  ON accounts FOR SELECT
  USING (is_support_or_higher(auth.uid()));

COMMENT ON TABLE permissions IS 'Available permissions in the system';
COMMENT ON TABLE role_permissions IS 'Mapping of roles to their permissions';
COMMENT ON FUNCTION has_permission IS 'Check if a user has a specific permission';
COMMENT ON FUNCTION get_user_role IS 'Get the role of a user';
COMMENT ON FUNCTION is_admin IS 'Check if user is admin or super_admin';
