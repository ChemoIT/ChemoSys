-- =============================================================================
-- Migration: 00014_project_number_sequence.sql
-- Phase:     04 — Projects, Map, Dashboard
-- Purpose:   Auto-number generation sequence and RPCs for the projects table.
--
-- Creates:
--   1. project_number_seq     — monotonically increasing sequence (no year reset)
--   2. generate_project_number() — returns 'PR' + 2-digit-year + 6-digit-seq
--                                  e.g. PR26000001
--   3. soft_delete_project(p_id) — SECURITY DEFINER soft-delete for projects
--
-- Why SECURITY DEFINER:
--   Direct UPDATE on deleted_at via PostgREST fails with RLS error (42501)
--   when the SELECT policy uses USING(deleted_at IS NULL). Running as DB owner
--   bypasses RLS entirely — the same pattern as 00007_soft_delete_rpc.sql.
--
-- Note: Run this file in the Supabase SQL Editor before testing project CRUD.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Sequence — monotonically increasing, never resets between years
-- ---------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS project_number_seq
  START WITH 1
  INCREMENT BY 1
  CACHE 1;

-- ---------------------------------------------------------------------------
-- 2. generate_project_number() — called by createProject Server Action
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION generate_project_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_val  BIGINT;
  year_part TEXT;
BEGIN
  next_val  := nextval('project_number_seq');
  year_part := to_char(CURRENT_DATE, 'YY');
  RETURN 'PR' || year_part || LPAD(next_val::TEXT, 6, '0');
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. soft_delete_project(p_id UUID) — called by softDeleteProject Server Action
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION soft_delete_project(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE projects
  SET deleted_at = NOW(),
      updated_at = NOW()
  WHERE id = p_id
    AND deleted_at IS NULL;
END;
$$;
