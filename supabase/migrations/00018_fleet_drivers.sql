-- =============================================================================
-- Migration: 00018_fleet_drivers.sql
-- Phase:     09 — Fleet Module — Driver Card (כרטיס נהג)
-- Purpose:   Create all tables required for the driver management module:
--            drivers, driver_licenses, driver_document_names,
--            driver_documents, driver_violations.
--
-- RLS design (same pattern as existing tables):
--   authenticated users: read + insert + update (incl. soft-delete)
--   Business-logic enforcement happens in Server Actions, not RLS.
-- =============================================================================

-- =============================================================================
-- HELPER: update_updated_at_column
-- Creates (or re-creates) the trigger function used by all updated_at triggers.
-- Safe to run multiple times (CREATE OR REPLACE).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- TABLE: drivers
-- One row per employee who has an open driver card.
-- UNIQUE(employee_id) — one driver card per employee.
-- phone_override: if set, wins over employees.mobile_phone in all contexts.
--   Employee Excel import MUST NOT overwrite phone_override.
-- Soft-delete: deleted_at IS NOT NULL = card closed.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.drivers (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id              UUID NOT NULL UNIQUE REFERENCES public.employees(id),
  phone_override           TEXT,                          -- overrides employee.mobile_phone
  is_occasional_camp_driver BOOLEAN NOT NULL DEFAULT FALSE, -- נהג מזדמן על רכב מחנה
  is_equipment_operator    BOOLEAN NOT NULL DEFAULT FALSE, -- מפעיל צמ"ה
  opened_at                DATE NOT NULL DEFAULT CURRENT_DATE,
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by               UUID REFERENCES auth.users(id),
  updated_by               UUID REFERENCES auth.users(id),
  deleted_at               TIMESTAMPTZ DEFAULT NULL        -- soft delete
);

-- auto-update updated_at
CREATE TRIGGER drivers_updated_at
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABLE: driver_licenses
-- One license per driver (one-to-one in practice, but modeled 1-to-many
-- so a future multi-license scenario is supported without schema change).
-- license_categories: TEXT[] e.g. {'B','C1','D'}
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.driver_licenses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id           UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  license_number      TEXT,
  license_categories  TEXT[] NOT NULL DEFAULT '{}',   -- A1,A2,A,B,C1,C,D1,D2,D3,D
  issue_year          INT,
  expiry_date         DATE,
  front_image_url     TEXT,                           -- fleet-licenses bucket
  back_image_url      TEXT,                           -- fleet-licenses bucket
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID REFERENCES auth.users(id),
  updated_by          UUID REFERENCES auth.users(id)
);

CREATE TRIGGER driver_licenses_updated_at
  BEFORE UPDATE ON public.driver_licenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABLE: driver_document_names
-- Stores unique document names typed by users (freetext with autocomplete).
-- usage_count allows ordering suggestions by frequency.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.driver_document_names (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  usage_count  INT NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE: driver_documents
-- Arbitrary documents attached to a driver (medical cert, work-at-height, etc.)
-- document_name is freetext; when added, name is upserted into driver_document_names.
-- Soft-delete supported.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.driver_documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id      UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  document_name  TEXT NOT NULL,
  file_url       TEXT,                    -- fleet-documents bucket
  expiry_date    DATE,
  alert_enabled  BOOLEAN NOT NULL DEFAULT FALSE,  -- expiry alert toggle
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     UUID REFERENCES auth.users(id),
  updated_by     UUID REFERENCES auth.users(id),
  deleted_at     TIMESTAMPTZ DEFAULT NULL -- soft delete
);

CREATE TRIGGER driver_documents_updated_at
  BEFORE UPDATE ON public.driver_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABLE: driver_violations (תרבות נהיגה)
-- Traffic tickets, parking fines, and accidents linked to a driver.
-- vehicle_number: free text (linked to fleet vehicles in future).
-- Soft-delete supported.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.driver_violations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id        UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  violation_number TEXT,
  violation_date   DATE,
  violation_type   TEXT CHECK (violation_type IN ('traffic', 'parking', 'accident')),
  vehicle_number   TEXT,
  location         TEXT,
  points           INT NOT NULL DEFAULT 0,
  amount           DECIMAL(10, 2),
  description      TEXT,
  notes            TEXT,
  file_url         TEXT,                    -- fleet-documents bucket
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID REFERENCES auth.users(id),
  updated_by       UUID REFERENCES auth.users(id),
  deleted_at       TIMESTAMPTZ DEFAULT NULL -- soft delete
);

CREATE TRIGGER driver_violations_updated_at
  BEFORE UPDATE ON public.driver_violations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- VIEW: driver_computed_status
-- Computes driver active/inactive status without a stored column.
-- "assigned_vehicle" condition will be added in Phase 10 (vehicle card).
-- =============================================================================
CREATE OR REPLACE VIEW public.driver_computed_status AS
SELECT
  d.id,
  d.employee_id,
  CASE
    WHEN e.status != 'active' OR e.deleted_at IS NOT NULL THEN 'inactive'
    WHEN d.deleted_at IS NOT NULL                          THEN 'inactive'
    WHEN d.is_occasional_camp_driver OR d.is_equipment_operator THEN 'active'
    -- TODO Phase 10: WHEN (vehicle assigned) THEN 'active'
    ELSE 'inactive'
  END AS computed_status
FROM public.drivers d
JOIN public.employees e ON e.id = d.employee_id;

-- =============================================================================
-- ROW LEVEL SECURITY
-- Same pattern as existing tables (00002_rls_policies.sql):
--   SELECT: active rows only (deleted_at IS NULL)
--   INSERT: any authenticated user
--   UPDATE: USING (true) — allows soft-delete UPDATEs (Pitfall 9)
-- =============================================================================

-- drivers
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drivers_select" ON public.drivers
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "drivers_insert" ON public.drivers
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "drivers_update" ON public.drivers
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- driver_licenses (no soft-delete — UPDATE replaces, no deleted_at)
ALTER TABLE public.driver_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_licenses_select" ON public.driver_licenses
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "driver_licenses_insert" ON public.driver_licenses
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "driver_licenses_update" ON public.driver_licenses
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "driver_licenses_delete" ON public.driver_licenses
  FOR DELETE TO authenticated
  USING (true);

-- driver_document_names (no soft-delete)
ALTER TABLE public.driver_document_names ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_document_names_select" ON public.driver_document_names
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "driver_document_names_insert" ON public.driver_document_names
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "driver_document_names_update" ON public.driver_document_names
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- driver_documents
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_documents_select" ON public.driver_documents
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "driver_documents_insert" ON public.driver_documents
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "driver_documents_update" ON public.driver_documents
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- driver_violations
ALTER TABLE public.driver_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_violations_select" ON public.driver_violations
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "driver_violations_insert" ON public.driver_violations
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "driver_violations_update" ON public.driver_violations
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- RPC: increment_document_name_usage
-- Called after adding a driver document to increment the autocomplete counter.
-- Uses SECURITY DEFINER so it can bypass RLS on driver_document_names.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.increment_document_name_usage(p_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.driver_document_names (name, usage_count)
  VALUES (p_name, 1)
  ON CONFLICT (name) DO UPDATE
    SET usage_count = driver_document_names.usage_count + 1;
END;
$$;
