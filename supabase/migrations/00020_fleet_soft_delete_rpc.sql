-- =============================================================================
-- Migration: 00020_fleet_soft_delete_rpc.sql
-- Phase:     09 — Driver Card
-- Purpose:   RPC functions for soft-deleting fleet records, bypassing RLS.
--
-- Same pattern as 00007_soft_delete_rpc.sql — SECURITY DEFINER needed because
-- direct UPDATE of deleted_at fails due to PostgREST interaction with
-- SELECT policy USING(deleted_at IS NULL).
-- =============================================================================

-- ── Soft delete driver documents ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION soft_delete_driver_document(p_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE driver_documents
  SET deleted_at = NOW(),
      updated_at = NOW(),
      updated_by = p_user_id
  WHERE id = p_id
    AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;

-- ── Soft delete driver violations ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION soft_delete_driver_violation(p_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE driver_violations
  SET deleted_at = NOW(),
      updated_at = NOW(),
      updated_by = p_user_id
  WHERE id = p_id
    AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;

-- ── Update driver document ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_driver_document(
  p_id UUID,
  p_user_id UUID,
  p_document_name TEXT DEFAULT NULL,
  p_file_url TEXT DEFAULT NULL,
  p_expiry_date DATE DEFAULT NULL,
  p_alert_enabled BOOLEAN DEFAULT FALSE,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE driver_documents
  SET document_name = COALESCE(p_document_name, document_name),
      file_url      = COALESCE(p_file_url, file_url),
      expiry_date   = p_expiry_date,
      alert_enabled = p_alert_enabled,
      notes         = p_notes,
      updated_at    = NOW(),
      updated_by    = p_user_id
  WHERE id = p_id
    AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;

-- ── Update driver violation ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_driver_violation(
  p_id UUID,
  p_user_id UUID,
  p_violation_number TEXT DEFAULT NULL,
  p_violation_date DATE DEFAULT NULL,
  p_violation_type TEXT DEFAULT NULL,
  p_vehicle_number TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_points INT DEFAULT NULL,
  p_amount NUMERIC DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_file_url TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE driver_violations
  SET violation_number = p_violation_number,
      violation_date   = p_violation_date,
      violation_type   = p_violation_type,
      vehicle_number   = p_vehicle_number,
      location         = p_location,
      points           = COALESCE(p_points, 0),
      amount           = p_amount,
      description      = p_description,
      notes            = p_notes,
      file_url         = p_file_url,
      updated_at       = NOW(),
      updated_by       = p_user_id
  WHERE id = p_id
    AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;
