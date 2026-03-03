-- =============================================================================
-- Migration: 00011_departments_global.sql
-- Purpose:   Remove company_id dependency from departments table.
--            Departments are global across all companies — a department like
--            "לוגיסטיקה חשמלאי" (dept 10) is shared by all companies.
--
-- Changes:
--   1. Drop company-scoped unique index (dept_number, company_id)
--   2. Make company_id nullable (keeps existing data intact)
--   3. Set all existing company_id values to NULL
--   4. Create new unique index on dept_number alone (active records only)
--
-- Run in Supabase SQL Editor AFTER backing up if needed.
-- =============================================================================

-- Step 1: Drop the old company-scoped unique index
DROP INDEX IF EXISTS departments_number_company_active;

-- Step 2: Make company_id nullable (was NOT NULL)
ALTER TABLE public.departments
  ALTER COLUMN company_id DROP NOT NULL;

-- Step 3: Clear company_id on all records (departments are now global)
UPDATE public.departments
  SET company_id = NULL;

-- Step 4: New unique index — dept_number is globally unique (active records only)
CREATE UNIQUE INDEX departments_number_active
  ON public.departments (dept_number)
  WHERE deleted_at IS NULL;
