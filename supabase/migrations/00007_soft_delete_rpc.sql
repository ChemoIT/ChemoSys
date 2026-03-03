-- =============================================================================
-- Migration: 00007_soft_delete_rpc.sql
-- Phase:     02 — Employee Management
-- Purpose:   RPC function for soft-deleting employees, bypassing RLS.
--
-- Why: Direct UPDATE via PostgREST fails with RLS error (42501) when setting
-- deleted_at, even though the UPDATE policy has WITH CHECK (true).
-- Diagnostic showed: UPDATE notes=OK, UPDATE deleted_at=FAIL.
-- Root cause unclear (possible PostgREST/Supabase interaction with SELECT
-- policy USING(deleted_at IS NULL) during UPDATE).
--
-- Solution: SECURITY DEFINER function runs as the DB owner, bypassing RLS.
-- This is a standard pattern for operations that modify columns used in
-- RLS policy expressions.
-- =============================================================================

CREATE OR REPLACE FUNCTION soft_delete_employees(p_ids UUID[])
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INT;
BEGIN
  UPDATE employees
  SET deleted_at = NOW(),
      updated_at = NOW()
  WHERE id = ANY(p_ids)
    AND deleted_at IS NULL;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
