-- =============================================================================
-- Migration: 00002_rls_policies.sql
-- Phase:     01 — Foundation
-- Purpose:   Enable Row Level Security on all tables and apply Phase 1
--            permissive authenticated-user policies.
--
-- Design principle (Phase 1):
--   Business logic enforcement happens in Server Actions, NOT in RLS.
--   RLS here acts as a safety net — not the primary access control layer.
--   This keeps Phase 1 simple and avoids premature RLS complexity.
--   Phase 3 (user management) will tighten these policies using the
--   get_user_permissions() SECURITY DEFINER function.
--
-- IMPORTANT — Pitfall 9 (soft-delete UPDATE collision):
--   UPDATE policies use USING (true), NOT USING (deleted_at IS NULL).
--   A SELECT policy with USING (deleted_at IS NULL) combined with an UPDATE
--   policy with the same USING clause would block the soft-delete UPDATE that
--   sets deleted_at. PostgreSQL re-checks USING after the UPDATE, finds the
--   row now has deleted_at set, and returns 0 rows (silently failing).
--   The UPDATE policy MUST use USING (true) to allow soft-delete operations.
-- =============================================================================

-- =============================================================================
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- Must come before CREATE POLICY statements.
-- =============================================================================
ALTER TABLE companies           ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_tags           ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees           ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_role_tags  ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules             ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- CRUD TABLES (companies, departments, role_tags, employees, role_templates,
--              users, projects)
-- Policy: Any authenticated user can read, insert, update (incl. soft-delete).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
CREATE POLICY "companies_select" ON companies
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "companies_insert" ON companies
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- USING (true) — allows the soft-delete UPDATE that sets deleted_at (Pitfall 9)
CREATE POLICY "companies_update" ON companies
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- departments
-- ---------------------------------------------------------------------------
CREATE POLICY "departments_select" ON departments
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "departments_insert" ON departments
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "departments_update" ON departments
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- role_tags
-- ---------------------------------------------------------------------------
CREATE POLICY "role_tags_select" ON role_tags
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "role_tags_insert" ON role_tags
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "role_tags_update" ON role_tags
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- employees
-- ---------------------------------------------------------------------------
CREATE POLICY "employees_select" ON employees
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "employees_insert" ON employees
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "employees_update" ON employees
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- role_templates
-- ---------------------------------------------------------------------------
CREATE POLICY "role_templates_select" ON role_templates
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "role_templates_insert" ON role_templates
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "role_templates_update" ON role_templates
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE POLICY "users_select" ON users
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "users_insert" ON users
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "users_update" ON users
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
CREATE POLICY "projects_select" ON projects
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "projects_insert" ON projects
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "projects_update" ON projects
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- JUNCTION TABLES (employee_role_tags, user_permissions, template_permissions)
-- No soft delete — rows are inserted and deleted directly.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- employee_role_tags
-- ---------------------------------------------------------------------------
CREATE POLICY "employee_role_tags_select" ON employee_role_tags
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "employee_role_tags_insert" ON employee_role_tags
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "employee_role_tags_delete" ON employee_role_tags
  FOR DELETE TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- user_permissions
-- NOTE: This table is protected in Phase 3 by the get_user_permissions()
-- SECURITY DEFINER function. Direct SELECT via RLS is allowed here for
-- Phase 1 simplicity. Phase 3 will tighten this policy.
-- ---------------------------------------------------------------------------
CREATE POLICY "user_permissions_select" ON user_permissions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "user_permissions_insert" ON user_permissions
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "user_permissions_delete" ON user_permissions
  FOR DELETE TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- template_permissions
-- ---------------------------------------------------------------------------
CREATE POLICY "template_permissions_select" ON template_permissions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "template_permissions_insert" ON template_permissions
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "template_permissions_delete" ON template_permissions
  FOR DELETE TO authenticated
  USING (true);

-- =============================================================================
-- SPECIAL TABLES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- audit_log — read + insert only (no update, no delete via RLS)
-- Writes happen via service role in Server Actions for immutability.
-- ---------------------------------------------------------------------------
CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "audit_log_insert" ON audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- modules — read-only for all authenticated users (seeded, never user-edited)
-- ---------------------------------------------------------------------------
CREATE POLICY "modules_select" ON modules
  FOR SELECT TO authenticated
  USING (true);
