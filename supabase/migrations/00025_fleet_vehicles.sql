-- =============================================================================
-- Migration: 00025_fleet_vehicles.sql
-- Purpose: Vehicle module tables, views, RLS, RPCs for fleet management
-- Tables: vehicle_suppliers, vehicles, vehicle_tests, vehicle_insurance,
--         vehicle_documents, vehicle_document_names
-- Depends on: 00018_fleet_drivers (drivers table for FK),
--             00001 (companies, update_updated_at_column trigger function)
-- Run in: Supabase SQL Editor
-- =============================================================================

-- =============================================================================
-- TABLE: vehicle_suppliers
-- Suppliers/vendors associated with vehicles:
--   leasing companies, insurance providers, fuel card vendors, garages, etc.
-- MUST be created before vehicles (FK dependency).
-- Soft-delete: deleted_at IS NOT NULL = supplier removed.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.vehicle_suppliers (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_type  TEXT        NOT NULL CHECK (supplier_type IN ('leasing','insurance','fuel_card','garage','other')),
  name           TEXT        NOT NULL,
  contact_name   TEXT,
  phone          TEXT,
  email          TEXT,
  address        TEXT,
  notes          TEXT,
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     UUID        REFERENCES auth.users(id),
  updated_by     UUID        REFERENCES auth.users(id),
  deleted_at     TIMESTAMPTZ DEFAULT NULL   -- soft delete
);

-- Index for filtering suppliers by type (leasing/insurance/etc.)
CREATE INDEX IF NOT EXISTS vehicle_suppliers_type_idx
  ON public.vehicle_suppliers (supplier_type);

-- Trigger: auto-update updated_at on every UPDATE
DROP TRIGGER IF EXISTS vehicle_suppliers_updated_at ON public.vehicle_suppliers;
CREATE TRIGGER vehicle_suppliers_updated_at
  BEFORE UPDATE ON public.vehicle_suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABLE: vehicles
-- Core vehicle registry.
--
-- MOT API identity fields (nullable — populated by Phase 12 API sync):
--   license_plate, tozeret_nm, degem_nm, kinuy_mishari, shnat_yitzur,
--   tzeva_rechev, sug_delek_nm, misgeret, degem_manoa, ramat_gimur,
--   kvutzat_zihum, baalut, moed_aliya_lakvish, mot_last_sync_at
--
-- Partial unique index on license_plate (WHERE deleted_at IS NULL) —
--   NOT a table UNIQUE constraint — supports soft-delete reuse.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.vehicles (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- MOT API fields (populated by MOT sync — may be NULL until synced)
  license_plate           TEXT        NOT NULL,
  tozeret_nm              TEXT,        -- manufacturer name (Hebrew)
  degem_nm                TEXT,        -- model name
  kinuy_mishari           TEXT,        -- commercial nickname
  shnat_yitzur            INT,         -- year of manufacture
  tzeva_rechev            TEXT,        -- vehicle color
  sug_delek_nm            TEXT,        -- fuel type name
  misgeret                TEXT,        -- chassis/frame number
  degem_manoa             TEXT,        -- engine model
  ramat_gimur             TEXT,        -- trim level
  kvutzat_zihum           TEXT,        -- pollution group
  baalut                  TEXT,        -- ownership from MOT (e.g. company name)
  moed_aliya_lakvish      DATE,        -- date vehicle first registered on road
  mot_last_sync_at        TIMESTAMPTZ, -- when MOT data was last fetched

  -- Operational / classification fields
  vehicle_type            TEXT        CHECK (vehicle_type IN ('private','minibus','light_commercial','heavy','forklift','equipment','other')),
  ownership_type          TEXT        CHECK (ownership_type IN ('company_owned','leased','rented','employee_owned')),
  company_id              INT         REFERENCES public.companies(id),
  is_active               BOOLEAN     NOT NULL DEFAULT TRUE,

  -- Driver / supplier associations
  assigned_driver_id      UUID        REFERENCES public.drivers(id),
  leasing_company_id      UUID        REFERENCES public.vehicle_suppliers(id),
  insurance_company_id    UUID        REFERENCES public.vehicle_suppliers(id),
  fuel_card_supplier_id   UUID        REFERENCES public.vehicle_suppliers(id),
  garage_id               UUID        REFERENCES public.vehicle_suppliers(id),

  notes                   TEXT,

  -- Audit + soft-delete
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by              UUID        REFERENCES auth.users(id),
  updated_by              UUID        REFERENCES auth.users(id),
  deleted_at              TIMESTAMPTZ DEFAULT NULL   -- soft delete
);

-- Partial unique index: license plate must be unique among non-deleted vehicles only.
-- This allows re-creating a vehicle card for a re-acquired plate after soft-delete.
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_license_plate_active_key
  ON public.vehicles (license_plate)
  WHERE deleted_at IS NULL;

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS vehicles_company_id_idx
  ON public.vehicles (company_id);

CREATE INDEX IF NOT EXISTS vehicles_assigned_driver_id_idx
  ON public.vehicles (assigned_driver_id);

-- Trigger: auto-update updated_at
DROP TRIGGER IF EXISTS vehicles_updated_at ON public.vehicles;
CREATE TRIGGER vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABLE: vehicle_tests (טסטים)
-- MOT roadworthiness tests. Each vehicle may have many test records over time.
-- Soft-delete supported for correction/rollback without data loss.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.vehicle_tests (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id     UUID         NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  test_date      DATE         NOT NULL,
  expiry_date    DATE         NOT NULL,
  passed         BOOLEAN      NOT NULL DEFAULT TRUE,
  test_station   TEXT,
  cost           DECIMAL(10,2),
  notes          TEXT,
  file_url       TEXT,        -- fleet-documents bucket
  alert_enabled  BOOLEAN      NOT NULL DEFAULT TRUE,  -- expiry alert toggle
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by     UUID         REFERENCES auth.users(id),
  updated_by     UUID         REFERENCES auth.users(id),
  deleted_at     TIMESTAMPTZ  DEFAULT NULL   -- soft delete
);

-- Indexes for lookups
CREATE INDEX IF NOT EXISTS vehicle_tests_vehicle_id_idx
  ON public.vehicle_tests (vehicle_id);

CREATE INDEX IF NOT EXISTS vehicle_tests_expiry_date_idx
  ON public.vehicle_tests (expiry_date);

-- Trigger: auto-update updated_at
DROP TRIGGER IF EXISTS vehicle_tests_updated_at ON public.vehicle_tests;
CREATE TRIGGER vehicle_tests_updated_at
  BEFORE UPDATE ON public.vehicle_tests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABLE: vehicle_insurance (ביטוח)
-- Insurance policies attached to a vehicle.
-- insurance_type: mandatory = חובה, comprehensive = מקיף, third_party = צד ג
-- Each vehicle may carry multiple concurrent policies (e.g. mandatory + comprehensive).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.vehicle_insurance (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id      UUID         NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  insurance_type  TEXT         NOT NULL CHECK (insurance_type IN ('mandatory','comprehensive','third_party')),
  policy_number   TEXT,
  supplier_id     UUID         REFERENCES public.vehicle_suppliers(id),
  start_date      DATE,
  expiry_date     DATE         NOT NULL,
  cost            DECIMAL(10,2),
  notes           TEXT,
  file_url        TEXT,        -- fleet-documents bucket
  alert_enabled   BOOLEAN      NOT NULL DEFAULT TRUE,  -- expiry alert toggle
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by      UUID         REFERENCES auth.users(id),
  updated_by      UUID         REFERENCES auth.users(id),
  deleted_at      TIMESTAMPTZ  DEFAULT NULL   -- soft delete
);

-- Indexes for lookups
CREATE INDEX IF NOT EXISTS vehicle_insurance_vehicle_id_idx
  ON public.vehicle_insurance (vehicle_id);

CREATE INDEX IF NOT EXISTS vehicle_insurance_expiry_date_idx
  ON public.vehicle_insurance (expiry_date);

-- Trigger: auto-update updated_at
DROP TRIGGER IF EXISTS vehicle_insurance_updated_at ON public.vehicle_insurance;
CREATE TRIGGER vehicle_insurance_updated_at
  BEFORE UPDATE ON public.vehicle_insurance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABLE: vehicle_documents
-- Arbitrary documents attached to a vehicle (e.g. vehicle license, permits, etc.)
-- document_name is freetext; when added, name is upserted into vehicle_document_names.
-- Soft-delete supported.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.vehicle_documents (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id      UUID         NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  document_name   TEXT         NOT NULL,
  file_url        TEXT,        -- fleet-documents bucket
  expiry_date     DATE,
  alert_enabled   BOOLEAN      NOT NULL DEFAULT FALSE,  -- expiry alert toggle
  notes           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by      UUID         REFERENCES auth.users(id),
  updated_by      UUID         REFERENCES auth.users(id),
  deleted_at      TIMESTAMPTZ  DEFAULT NULL   -- soft delete
);

-- Trigger: auto-update updated_at
DROP TRIGGER IF EXISTS vehicle_documents_updated_at ON public.vehicle_documents;
CREATE TRIGGER vehicle_documents_updated_at
  BEFORE UPDATE ON public.vehicle_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABLE: vehicle_document_names
-- Autocomplete lookup: stores unique document names typed by users.
-- usage_count allows ordering suggestions by frequency (most-used first).
-- No soft-delete — names are permanent reference data.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.vehicle_document_names (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT  NOT NULL UNIQUE,
  usage_count  INT   NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ROW LEVEL SECURITY
-- Same pattern as driver tables (00018_fleet_drivers.sql):
--   SELECT: active rows only (deleted_at IS NULL for soft-deletable tables)
--   INSERT: any authenticated user (WITH CHECK true)
--   UPDATE: USING (true) — required for soft-delete RPCs to function correctly
--           (PostgREST SELECT policy USING(deleted_at IS NULL) would block
--            soft-delete UPDATE otherwise — see Pitfall 9 in project notes)
-- =============================================================================

-- ── vehicle_suppliers ─────────────────────────────────────────────────────────
ALTER TABLE public.vehicle_suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicle_suppliers_select" ON public.vehicle_suppliers;
CREATE POLICY "vehicle_suppliers_select" ON public.vehicle_suppliers
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "vehicle_suppliers_insert" ON public.vehicle_suppliers;
CREATE POLICY "vehicle_suppliers_insert" ON public.vehicle_suppliers
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "vehicle_suppliers_update" ON public.vehicle_suppliers;
CREATE POLICY "vehicle_suppliers_update" ON public.vehicle_suppliers
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── vehicles ──────────────────────────────────────────────────────────────────
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicles_select" ON public.vehicles;
CREATE POLICY "vehicles_select" ON public.vehicles
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "vehicles_insert" ON public.vehicles;
CREATE POLICY "vehicles_insert" ON public.vehicles
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "vehicles_update" ON public.vehicles;
CREATE POLICY "vehicles_update" ON public.vehicles
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── vehicle_tests ─────────────────────────────────────────────────────────────
ALTER TABLE public.vehicle_tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicle_tests_select" ON public.vehicle_tests;
CREATE POLICY "vehicle_tests_select" ON public.vehicle_tests
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "vehicle_tests_insert" ON public.vehicle_tests;
CREATE POLICY "vehicle_tests_insert" ON public.vehicle_tests
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "vehicle_tests_update" ON public.vehicle_tests;
CREATE POLICY "vehicle_tests_update" ON public.vehicle_tests
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── vehicle_insurance ─────────────────────────────────────────────────────────
ALTER TABLE public.vehicle_insurance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicle_insurance_select" ON public.vehicle_insurance;
CREATE POLICY "vehicle_insurance_select" ON public.vehicle_insurance
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "vehicle_insurance_insert" ON public.vehicle_insurance;
CREATE POLICY "vehicle_insurance_insert" ON public.vehicle_insurance
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "vehicle_insurance_update" ON public.vehicle_insurance;
CREATE POLICY "vehicle_insurance_update" ON public.vehicle_insurance
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── vehicle_documents ─────────────────────────────────────────────────────────
ALTER TABLE public.vehicle_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicle_documents_select" ON public.vehicle_documents;
CREATE POLICY "vehicle_documents_select" ON public.vehicle_documents
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "vehicle_documents_insert" ON public.vehicle_documents;
CREATE POLICY "vehicle_documents_insert" ON public.vehicle_documents
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "vehicle_documents_update" ON public.vehicle_documents;
CREATE POLICY "vehicle_documents_update" ON public.vehicle_documents
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── vehicle_document_names ────────────────────────────────────────────────────
ALTER TABLE public.vehicle_document_names ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicle_document_names_select" ON public.vehicle_document_names;
CREATE POLICY "vehicle_document_names_select" ON public.vehicle_document_names
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "vehicle_document_names_insert" ON public.vehicle_document_names;
CREATE POLICY "vehicle_document_names_insert" ON public.vehicle_document_names
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "vehicle_document_names_update" ON public.vehicle_document_names;
CREATE POLICY "vehicle_document_names_update" ON public.vehicle_document_names
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- VIEW: vehicle_computed_status
-- Computes vehicle active/inactive without a stored status column.
-- security_invoker = true → view respects RLS of underlying vehicles table.
-- =============================================================================
CREATE OR REPLACE VIEW public.vehicle_computed_status
  WITH (security_invoker = true)
AS
SELECT
  v.id,
  CASE
    WHEN v.deleted_at IS NOT NULL THEN 'inactive'
    WHEN v.is_active = FALSE      THEN 'inactive'
    ELSE                               'active'
  END AS computed_status
FROM public.vehicles v;

-- =============================================================================
-- VIEW: driver_computed_status (UPDATED)
-- Replaces the version from 00018_fleet_drivers.sql (and view security from 00023).
-- Adds vehicle assignment condition: a driver is 'active' if they have at least
-- one active, non-deleted vehicle currently assigned to them.
--
-- WHEN order (priority):
--   1. Employee inactive or deleted → inactive
--   2. Driver card deleted → inactive
--   3. Has assigned vehicle → active  ← NEW in Phase 10A
--   4. is_occasional_camp_driver OR is_equipment_operator → active
--   5. Else → inactive
-- =============================================================================
CREATE OR REPLACE VIEW public.driver_computed_status
  WITH (security_invoker = true)
AS
SELECT
  d.id,
  d.employee_id,
  CASE
    WHEN e.status != 'active' OR e.deleted_at IS NOT NULL THEN 'inactive'
    WHEN d.deleted_at IS NOT NULL                          THEN 'inactive'
    WHEN (
      SELECT COUNT(*)
      FROM public.vehicles veh
      WHERE veh.assigned_driver_id = d.id
        AND veh.deleted_at IS NULL
        AND veh.is_active = TRUE
    ) > 0                                                  THEN 'active'
    WHEN d.is_occasional_camp_driver OR d.is_equipment_operator THEN 'active'
    ELSE                                                        'inactive'
  END AS computed_status
FROM public.drivers d
JOIN public.employees e ON e.id = d.employee_id;

-- =============================================================================
-- SOFT-DELETE RPCs
-- All 5 soft-delete functions use SECURITY DEFINER + SET search_path = public.
-- This is required because the SELECT RLS policy (USING deleted_at IS NULL)
-- would otherwise block the UPDATE that sets deleted_at (PostgREST interaction).
-- Pattern: identical to soft_delete_driver() in 00022_soft_delete_driver_rpc.sql
-- =============================================================================

-- ── soft_delete_vehicle ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.soft_delete_vehicle(p_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.vehicles
  SET deleted_at = NOW(),
      updated_at = NOW(),
      updated_by = p_user_id
  WHERE id = p_id
    AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;

-- ── soft_delete_vehicle_document ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.soft_delete_vehicle_document(p_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.vehicle_documents
  SET deleted_at = NOW(),
      updated_at = NOW(),
      updated_by = p_user_id
  WHERE id = p_id
    AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;

-- ── soft_delete_vehicle_test ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.soft_delete_vehicle_test(p_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.vehicle_tests
  SET deleted_at = NOW(),
      updated_at = NOW(),
      updated_by = p_user_id
  WHERE id = p_id
    AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;

-- ── soft_delete_vehicle_insurance ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.soft_delete_vehicle_insurance(p_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.vehicle_insurance
  SET deleted_at = NOW(),
      updated_at = NOW(),
      updated_by = p_user_id
  WHERE id = p_id
    AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;

-- ── soft_delete_vehicle_supplier ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.soft_delete_vehicle_supplier(p_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.vehicle_suppliers
  SET deleted_at = NOW(),
      updated_at = NOW(),
      updated_by = p_user_id
  WHERE id = p_id
    AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;

-- =============================================================================
-- UPDATE RPCs
-- 3 RPCs for updating child records (tests, insurance, documents).
-- SECURITY DEFINER needed for same RLS reason as soft-delete RPCs.
-- All params explicitly named; NULL allowed for optional fields.
-- =============================================================================

-- ── update_vehicle_document ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_vehicle_document(
  p_id            UUID,
  p_user_id       UUID,
  p_document_name TEXT,
  p_file_url      TEXT,
  p_expiry_date   DATE,
  p_alert_enabled BOOLEAN,
  p_notes         TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.vehicle_documents
  SET document_name = p_document_name,
      file_url      = p_file_url,
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

-- ── update_vehicle_test ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_vehicle_test(
  p_id           UUID,
  p_user_id      UUID,
  p_test_date    DATE,
  p_expiry_date  DATE,
  p_passed       BOOLEAN,
  p_test_station TEXT,
  p_cost         DECIMAL,
  p_notes        TEXT,
  p_file_url     TEXT,
  p_alert_enabled BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.vehicle_tests
  SET test_date     = p_test_date,
      expiry_date   = p_expiry_date,
      passed        = p_passed,
      test_station  = p_test_station,
      cost          = p_cost,
      notes         = p_notes,
      file_url      = p_file_url,
      alert_enabled = p_alert_enabled,
      updated_at    = NOW(),
      updated_by    = p_user_id
  WHERE id = p_id
    AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;

-- ── update_vehicle_insurance ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_vehicle_insurance(
  p_id             UUID,
  p_user_id        UUID,
  p_insurance_type TEXT,
  p_policy_number  TEXT,
  p_supplier_id    UUID,
  p_start_date     DATE,
  p_expiry_date    DATE,
  p_cost           DECIMAL,
  p_notes          TEXT,
  p_file_url       TEXT,
  p_alert_enabled  BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.vehicle_insurance
  SET insurance_type = p_insurance_type,
      policy_number  = p_policy_number,
      supplier_id    = p_supplier_id,
      start_date     = p_start_date,
      expiry_date    = p_expiry_date,
      cost           = p_cost,
      notes          = p_notes,
      file_url       = p_file_url,
      alert_enabled  = p_alert_enabled,
      updated_at     = NOW(),
      updated_by     = p_user_id
  WHERE id = p_id
    AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;

-- =============================================================================
-- AUTOCOMPLETE RPC
-- increment_vehicle_document_name_usage
-- Called after adding a vehicle document to upsert the name and increment its
-- usage counter. Same pattern as increment_document_name_usage() for drivers.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.increment_vehicle_document_name_usage(p_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.vehicle_document_names (name, usage_count)
  VALUES (p_name, 1)
  ON CONFLICT (name) DO UPDATE
    SET usage_count = vehicle_document_names.usage_count + 1;
END;
$$;
