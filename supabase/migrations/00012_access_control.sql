-- 00012: Access Control Support
-- Adds UPDATE policy for user_permissions, is_admin flag, and block check helper

-- 1. Add UPDATE policy to user_permissions (currently only SELECT/INSERT/DELETE exist)
CREATE POLICY "user_permissions_update" ON user_permissions
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. Add is_admin flag to users table
-- Default FALSE. The first admin sets this manually in Supabase Dashboard.
-- requirePermission() short-circuits for is_admin users.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Helper function: check if caller's auth user is blocked
-- Used in AdminLayout (NOT in proxy.ts — Edge Runtime unreliable for table queries).
CREATE OR REPLACE FUNCTION is_current_user_blocked()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_blocked FROM users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL),
    false
  );
$$;

-- 4. Update get_user_permissions() to also return is_admin status
-- This avoids a second DB call in requirePermission().
-- If user is is_admin, the function returns ALL modules with level 2.
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID)
RETURNS TABLE(module_key TEXT, level SMALLINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Check if user is admin
  SELECT m.key::TEXT AS module_key, 2::SMALLINT AS level
  FROM modules m
  WHERE EXISTS (
    SELECT 1 FROM users u
    WHERE u.auth_user_id = p_user_id
      AND u.is_admin = true
      AND u.deleted_at IS NULL
  )
  UNION ALL
  -- Non-admin: return actual permissions
  SELECT up.module_key::TEXT, up.level
  FROM user_permissions up
  INNER JOIN users u ON u.id = up.user_id
  WHERE u.auth_user_id = p_user_id
    AND u.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM users u2
      WHERE u2.auth_user_id = p_user_id
        AND u2.is_admin = true
        AND u2.deleted_at IS NULL
    );
$$;
