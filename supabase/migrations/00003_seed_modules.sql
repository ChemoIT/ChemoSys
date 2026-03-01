-- =============================================================================
-- Migration: 00003_seed_modules.sql
-- Phase:     01 — Foundation
-- Purpose:   Seed the modules table with the 9 admin tab entries.
--            These drive the permission matrix in Phase 3 (user management).
--
-- Ordering:  Runs AFTER 00002_rls_policies.sql (RLS must be enabled first
--            so this INSERT respects the modules_select policy).
--
-- Idempotent: Uses ON CONFLICT DO NOTHING so re-running is safe.
-- =============================================================================

INSERT INTO modules (key, name_he, parent_key, sort_order, icon)
VALUES
  ('dashboard',    'דשבורד',            NULL, 0, 'LayoutDashboard'),
  ('companies',    'ניהול חברות',        NULL, 1, 'Building2'),
  ('departments',  'ניהול מחלקות',       NULL, 2, 'Network'),
  ('role_tags',    'תגיות תפקיד',        NULL, 3, 'Tags'),
  ('employees',    'ניהול עובדים',        NULL, 4, 'Users'),
  ('users',        'ניהול יוזרים',        NULL, 5, 'UserCog'),
  ('templates',    'תבניות הרשאות',      NULL, 6, 'Shield'),
  ('projects',     'ניהול פרויקטים',      NULL, 7, 'FolderKanban'),
  ('settings',     'הגדרות מערכת',       NULL, 8, 'Settings')
ON CONFLICT (key) DO NOTHING;
