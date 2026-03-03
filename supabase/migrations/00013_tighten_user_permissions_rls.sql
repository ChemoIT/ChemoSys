-- 00013: Tighten user_permissions RLS to admin-only writes
-- Security hardening: Previously any authenticated user could INSERT/UPDATE/DELETE
-- on user_permissions (WITH CHECK (true)), which means a non-admin user could
-- grant themselves permissions by direct DB access (bypassing Server Actions).
--
-- This migration replaces permissive write policies with admin-only checks.
-- The SELECT policy remains permissive (authenticated users can read permissions).
--
-- Depends on: 00002_rls_policies.sql (original policies), 00012_access_control.sql (is_admin column + UPDATE policy)

-- 1. Drop the existing permissive write policies
DROP POLICY IF EXISTS "user_permissions_insert" ON user_permissions;
DROP POLICY IF EXISTS "user_permissions_update" ON user_permissions;
DROP POLICY IF EXISTS "user_permissions_delete" ON user_permissions;

-- Also drop the 00012 UPDATE policy (it was also WITH CHECK (true))
DROP POLICY IF EXISTS "user_permissions_update_admin" ON user_permissions;

-- 2. Create admin-only INSERT policy
-- Only users with is_admin=true in public.users can insert permissions.
CREATE POLICY "user_permissions_insert_admin" ON user_permissions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
        AND is_admin = true
        AND deleted_at IS NULL
    )
  );

-- 3. Create admin-only UPDATE policy
-- USING (true) allows the update to match any row; WITH CHECK restricts who can do it.
CREATE POLICY "user_permissions_update_admin" ON user_permissions
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
        AND is_admin = true
        AND deleted_at IS NULL
    )
  );

-- 4. Create admin-only DELETE policy
CREATE POLICY "user_permissions_delete_admin" ON user_permissions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
        AND is_admin = true
        AND deleted_at IS NULL
    )
  );

-- NOTE: The SELECT policy ("user_permissions_select") from 00002 remains unchanged.
-- All authenticated users can still READ permissions (needed for get_user_permissions RPC
-- which is SECURITY DEFINER anyway, but keeping SELECT open is harmless).
