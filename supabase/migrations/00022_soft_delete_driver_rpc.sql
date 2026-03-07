-- =============================================================================
-- Migration: 00022_soft_delete_driver_rpc.sql
-- Phase:     09 — Driver Card
-- Purpose:   RPC for soft-deleting a driver record (same pattern as documents/violations).
--            Direct UPDATE of deleted_at fails due to PostgREST + RLS interaction.
-- =============================================================================

CREATE OR REPLACE FUNCTION soft_delete_driver(p_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE drivers
  SET deleted_at = NOW(),
      updated_at = NOW(),
      updated_by = p_user_id
  WHERE id = p_id
    AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;
