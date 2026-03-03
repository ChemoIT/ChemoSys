-- =============================================================================
-- Migration: 00006_fix_soft_delete_policies.sql
-- Phase:     02 — Employee Management
-- Purpose:   Fix UPDATE policies to allow soft-delete (setting deleted_at).
--
-- Problem:   The UPDATE policy's WITH CHECK clause may be blocking soft-delete
--            because it evaluates the NEW row. If WITH CHECK has
--            (deleted_at IS NULL), setting deleted_at to a non-NULL value fails.
--            The fix: ensure WITH CHECK (true) so any column value is allowed.
--
-- Diagnostic evidence:
--   UPDATE employees SET notes=... WHERE id=X  → OK (notes doesn't change deleted_at)
--   UPDATE employees SET deleted_at=NOW() WHERE id=X  → RLS error (42501)
--   This proves WITH CHECK is rejecting non-NULL deleted_at values.
--
-- This migration drops and recreates UPDATE policies on ALL soft-deletable
-- tables to prevent the same issue elsewhere.
-- =============================================================================

-- ── employees ──
DROP POLICY IF EXISTS "employees_update" ON employees;
CREATE POLICY "employees_update" ON employees
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── companies ──
DROP POLICY IF EXISTS "companies_update" ON companies;
CREATE POLICY "companies_update" ON companies
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── departments ──
DROP POLICY IF EXISTS "departments_update" ON departments;
CREATE POLICY "departments_update" ON departments
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── role_tags ──
DROP POLICY IF EXISTS "role_tags_update" ON role_tags;
CREATE POLICY "role_tags_update" ON role_tags
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── role_templates ──
DROP POLICY IF EXISTS "role_templates_update" ON role_templates;
CREATE POLICY "role_templates_update" ON role_templates
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── users ──
DROP POLICY IF EXISTS "users_update" ON users;
CREATE POLICY "users_update" ON users
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── projects ──
DROP POLICY IF EXISTS "projects_update" ON projects;
CREATE POLICY "projects_update" ON projects
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- Verification: show all UPDATE policies (run SELECT below to confirm)
-- SELECT policyname, tablename, cmd, qual, with_check
-- FROM pg_policies
-- WHERE cmd = 'UPDATE' AND schemaname = 'public';
-- =============================================================================
