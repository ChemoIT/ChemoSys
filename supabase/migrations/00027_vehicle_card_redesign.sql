-- =============================================================================
-- Migration: 00027_vehicle_card_redesign.sql
-- Purpose:   Extend the vehicle schema for the full Vehicle Card Redesign.
--            Adds 9 new columns to vehicles, updates CHECK constraints,
--            adds 'ownership' supplier type, creates 6 new tables,
--            updates both computed status views, and adds a soft-delete RPC
--            for vehicle_replacement_records.
-- Depends on: 00025_fleet_vehicles (vehicles, vehicle_suppliers, drivers tables)
-- Run in:    Supabase SQL Editor
-- Idempotent: YES — safe to run multiple times (IF NOT EXISTS, DROP ... IF EXISTS,
--             CREATE OR REPLACE patterns used throughout)
-- =============================================================================

-- =============================================================================
-- SECTION 1: ALTER TABLE vehicles — clear incompatible constraint values
-- Must run BEFORE dropping old CHECK constraints.
-- Any vehicle with a vehicle_type not in the new enum is nullified.
-- (In practice, test data may have old values like 'minibus' or 'heavy'.)
-- =============================================================================

UPDATE public.vehicles
  SET vehicle_type = NULL
  WHERE vehicle_type NOT IN ('private','commercial','truck','trailer')
    AND vehicle_type IS NOT NULL;

UPDATE public.vehicles
  SET ownership_type = NULL
  WHERE ownership_type NOT IN ('company','rental','operational_leasing','mini_leasing')
    AND ownership_type IS NOT NULL;

-- =============================================================================
-- SECTION 2: ALTER TABLE vehicles — drop old CHECK constraints
-- PostgreSQL auto-names inline CHECK constraints as {table}_{column}_check.
-- DROP CONSTRAINT IF EXISTS is safe — no error if constraint doesn't exist.
-- =============================================================================

ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_vehicle_type_check;
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_ownership_type_check;

-- =============================================================================
-- SECTION 3: ALTER TABLE vehicles — add 9 new columns (IF NOT EXISTS)
-- All columns are nullable OR have a DEFAULT so existing rows are not rejected.
-- vehicle_status NOT NULL DEFAULT 'active' — existing vehicles become 'active'.
-- =============================================================================

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS vehicle_status          TEXT        NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS fleet_exit_date         DATE,
  ADD COLUMN IF NOT EXISTS vehicle_category        TEXT,
  ADD COLUMN IF NOT EXISTS camp_responsible_type   TEXT,
  ADD COLUMN IF NOT EXISTS camp_responsible_name   TEXT,
  ADD COLUMN IF NOT EXISTS camp_responsible_phone  TEXT,
  ADD COLUMN IF NOT EXISTS ownership_supplier_id   UUID        REFERENCES public.vehicle_suppliers(id),
  ADD COLUMN IF NOT EXISTS contract_number         TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_group           INT;

-- =============================================================================
-- SECTION 4: ALTER TABLE vehicles — add new CHECK constraints
-- PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS — must DROP first.
-- Drop each constraint individually so partial re-runs don't fail.
-- =============================================================================

-- vehicle_type: 4 values for the fleet module (forklifts/equipment = צמ"ה module)
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_vehicle_type_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_vehicle_type_check
  CHECK (vehicle_type IN ('private','commercial','truck','trailer'));

-- ownership_type: financial arrangement for the vehicle
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_ownership_type_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_ownership_type_check
  CHECK (ownership_type IN ('company','rental','operational_leasing','mini_leasing'));

-- vehicle_status: operational lifecycle status
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_vehicle_status_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_vehicle_status_check
  CHECK (vehicle_status IN ('active','suspended','returned','sold','decommissioned'));

-- vehicle_category: how the vehicle is assigned (camp pool vs. dedicated driver)
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_vehicle_category_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_vehicle_category_check
  CHECK (vehicle_category IN ('camp','assigned'));

-- camp_responsible_type: who is responsible for a camp vehicle
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_camp_responsible_type_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_camp_responsible_type_check
  CHECK (camp_responsible_type IN ('project_manager','other'));

-- vehicle_group: group classification 1-7
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_vehicle_group_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_vehicle_group_check
  CHECK (vehicle_group BETWEEN 1 AND 7);

-- =============================================================================
-- SECTION 5: ALTER TABLE vehicle_suppliers — add 'ownership' supplier type
-- Ownership suppliers are companies that provide company-owned vehicles
-- (e.g., חמו אהרון בע"מ, Blue Sky, Kal Auto, etc.)
-- =============================================================================

ALTER TABLE public.vehicle_suppliers DROP CONSTRAINT IF EXISTS vehicle_suppliers_supplier_type_check;
ALTER TABLE public.vehicle_suppliers ADD CONSTRAINT vehicle_suppliers_supplier_type_check
  CHECK (supplier_type IN ('leasing','insurance','fuel_card','garage','other','ownership'));

-- =============================================================================
-- TABLE: vehicle_images
-- Up to 5 gallery images per vehicle, stored in the 'vehicle-images' bucket.
-- No soft-delete: images are hard-deleted when replaced or removed.
-- No updated_at: images are replaced (delete + insert), not in-place updated.
-- position 1-5 is enforced by a UNIQUE INDEX (not a DB trigger).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.vehicle_images (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id   UUID        NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  storage_path TEXT        NOT NULL,   -- path in 'vehicle-images' bucket: {vehicle_id}/{position}.{ext}
  position     INT         NOT NULL CHECK (position BETWEEN 1 AND 5),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID        REFERENCES auth.users(id)
);

-- Ensures at most one image per gallery slot per vehicle.
-- Server Actions validate this before INSERT to get a clear error message.
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_images_vehicle_position_key
  ON public.vehicle_images (vehicle_id, position);

-- =============================================================================
-- TABLE: vehicle_replacement_records
-- Tracks temporary replacement vehicles (רכב חלופי) assigned while the main
-- vehicle is out of service for maintenance, test, accident, etc.
-- Soft-delete supported for correction / rollback.
-- Each record may have multiple fuel cards (vehicle_fuel_cards table).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.vehicle_replacement_records (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id     UUID        NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  license_plate  TEXT        NOT NULL,    -- replacement vehicle plate
  mot_data       JSONB,                   -- raw MOT API response for replacement vehicle
  entry_date     DATE        NOT NULL,
  entry_km       INT,
  return_date    DATE,
  return_km      INT,
  reason         TEXT        NOT NULL
    CHECK (reason IN ('maintenance','test','accident','other')),
  reason_other   TEXT,                    -- required when reason = 'other' (validated in Server Action)
  status         TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','returned')),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     UUID        REFERENCES auth.users(id),
  updated_by     UUID        REFERENCES auth.users(id),
  deleted_at     TIMESTAMPTZ DEFAULT NULL   -- soft delete
);

-- Index for fast per-vehicle listing
CREATE INDEX IF NOT EXISTS vehicle_replacement_records_vehicle_id_idx
  ON public.vehicle_replacement_records (vehicle_id);

-- Trigger: auto-update updated_at on every UPDATE
DROP TRIGGER IF EXISTS vehicle_replacement_records_updated_at ON public.vehicle_replacement_records;
CREATE TRIGGER vehicle_replacement_records_updated_at
  BEFORE UPDATE ON public.vehicle_replacement_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABLE: vehicle_fuel_cards
-- Fuel card numbers associated with a replacement vehicle record.
-- Each replacement record can have multiple cards (add/remove during the period).
-- No soft-delete: cards are hard-deleted when removed (parent cascade applies).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.vehicle_fuel_cards (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  replacement_record_id UUID        NOT NULL
    REFERENCES public.vehicle_replacement_records(id) ON DELETE CASCADE,
  card_number           TEXT        NOT NULL,   -- digits only (validated in Server Action)
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID        REFERENCES auth.users(id)
);

-- Index for fetching cards by replacement record
CREATE INDEX IF NOT EXISTS vehicle_fuel_cards_replacement_record_id_idx
  ON public.vehicle_fuel_cards (replacement_record_id);

-- =============================================================================
-- TABLE: vehicle_driver_journal
-- Activity journal for driver ↔ vehicle assignment history (יומן צמידות נהגים).
-- end_date IS NULL = currently active assignment.
-- Business rule: only one active assignment per vehicle at a time
--   — enforced in Server Actions (close current before opening new).
-- No soft-delete: journal records are historical facts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.vehicle_driver_journal (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  UUID        NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id   UUID        NOT NULL REFERENCES public.drivers(id),
  start_date  DATE        NOT NULL,
  end_date    DATE,                        -- NULL = currently active
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID        REFERENCES auth.users(id)
);

-- Partial index: fast lookup of current active driver for a vehicle
CREATE INDEX IF NOT EXISTS vehicle_driver_journal_vehicle_active_idx
  ON public.vehicle_driver_journal (vehicle_id)
  WHERE end_date IS NULL;

-- =============================================================================
-- TABLE: vehicle_project_journal
-- Activity journal for project ↔ vehicle assignment history (יומן שיוך פרויקטים).
-- end_date IS NULL = currently active assignment.
-- Business rule: only one active project per vehicle — enforced in Server Actions.
-- No soft-delete: journal records are historical facts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.vehicle_project_journal (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  UUID        NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  project_id  UUID        NOT NULL REFERENCES public.projects(id),
  start_date  DATE        NOT NULL,
  end_date    DATE,                        -- NULL = currently active
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID        REFERENCES auth.users(id)
);

-- Partial index: fast lookup of current active project for a vehicle
CREATE INDEX IF NOT EXISTS vehicle_project_journal_vehicle_active_idx
  ON public.vehicle_project_journal (vehicle_id)
  WHERE end_date IS NULL;

-- =============================================================================
-- TABLE: vehicle_monthly_costs
-- Activity journal for monthly lease/rental cost history (יומן עלות חודשית).
-- start_date / end_date define the period this amount applies.
-- end_date IS NULL = currently active rate.
-- No soft-delete: cost history is permanent (financial audit trail).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.vehicle_monthly_costs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  UUID        NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  start_date  DATE        NOT NULL,
  end_date    DATE,
  amount      NUMERIC     NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID        REFERENCES auth.users(id),
  updated_by  UUID        REFERENCES auth.users(id)
);

-- Trigger: auto-update updated_at on every UPDATE
DROP TRIGGER IF EXISTS vehicle_monthly_costs_updated_at ON public.vehicle_monthly_costs;
CREATE TRIGGER vehicle_monthly_costs_updated_at
  BEFORE UPDATE ON public.vehicle_monthly_costs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY — all 6 new tables
-- Pattern (identical to 00025_fleet_vehicles.sql):
--   • Tables WITH soft-delete (vehicle_replacement_records):
--       SELECT USING (deleted_at IS NULL), INSERT WITH CHECK (true),
--       UPDATE USING (true) WITH CHECK (true)
--   • Tables WITHOUT soft-delete (all others):
--       SELECT USING (true), INSERT WITH CHECK (true),
--       UPDATE USING (true) WITH CHECK (true)
--   • Tables that allow hard DELETE (vehicle_images, vehicle_fuel_cards):
--       Also add DELETE USING (true)
-- All policies use DROP POLICY IF EXISTS before CREATE POLICY (idempotency).
-- =============================================================================

-- ── vehicle_images ────────────────────────────────────────────────────────────
ALTER TABLE public.vehicle_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicle_images_select" ON public.vehicle_images;
CREATE POLICY "vehicle_images_select" ON public.vehicle_images
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "vehicle_images_insert" ON public.vehicle_images;
CREATE POLICY "vehicle_images_insert" ON public.vehicle_images
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "vehicle_images_update" ON public.vehicle_images;
CREATE POLICY "vehicle_images_update" ON public.vehicle_images
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "vehicle_images_delete" ON public.vehicle_images;
CREATE POLICY "vehicle_images_delete" ON public.vehicle_images
  FOR DELETE TO authenticated USING (true);

-- ── vehicle_replacement_records ───────────────────────────────────────────────
ALTER TABLE public.vehicle_replacement_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicle_replacement_records_select" ON public.vehicle_replacement_records;
CREATE POLICY "vehicle_replacement_records_select" ON public.vehicle_replacement_records
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "vehicle_replacement_records_insert" ON public.vehicle_replacement_records;
CREATE POLICY "vehicle_replacement_records_insert" ON public.vehicle_replacement_records
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "vehicle_replacement_records_update" ON public.vehicle_replacement_records;
CREATE POLICY "vehicle_replacement_records_update" ON public.vehicle_replacement_records
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── vehicle_fuel_cards ────────────────────────────────────────────────────────
ALTER TABLE public.vehicle_fuel_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicle_fuel_cards_select" ON public.vehicle_fuel_cards;
CREATE POLICY "vehicle_fuel_cards_select" ON public.vehicle_fuel_cards
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "vehicle_fuel_cards_insert" ON public.vehicle_fuel_cards;
CREATE POLICY "vehicle_fuel_cards_insert" ON public.vehicle_fuel_cards
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "vehicle_fuel_cards_update" ON public.vehicle_fuel_cards;
CREATE POLICY "vehicle_fuel_cards_update" ON public.vehicle_fuel_cards
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "vehicle_fuel_cards_delete" ON public.vehicle_fuel_cards;
CREATE POLICY "vehicle_fuel_cards_delete" ON public.vehicle_fuel_cards
  FOR DELETE TO authenticated USING (true);

-- ── vehicle_driver_journal ────────────────────────────────────────────────────
ALTER TABLE public.vehicle_driver_journal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicle_driver_journal_select" ON public.vehicle_driver_journal;
CREATE POLICY "vehicle_driver_journal_select" ON public.vehicle_driver_journal
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "vehicle_driver_journal_insert" ON public.vehicle_driver_journal;
CREATE POLICY "vehicle_driver_journal_insert" ON public.vehicle_driver_journal
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "vehicle_driver_journal_update" ON public.vehicle_driver_journal;
CREATE POLICY "vehicle_driver_journal_update" ON public.vehicle_driver_journal
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── vehicle_project_journal ───────────────────────────────────────────────────
ALTER TABLE public.vehicle_project_journal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicle_project_journal_select" ON public.vehicle_project_journal;
CREATE POLICY "vehicle_project_journal_select" ON public.vehicle_project_journal
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "vehicle_project_journal_insert" ON public.vehicle_project_journal;
CREATE POLICY "vehicle_project_journal_insert" ON public.vehicle_project_journal
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "vehicle_project_journal_update" ON public.vehicle_project_journal;
CREATE POLICY "vehicle_project_journal_update" ON public.vehicle_project_journal
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── vehicle_monthly_costs ─────────────────────────────────────────────────────
ALTER TABLE public.vehicle_monthly_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicle_monthly_costs_select" ON public.vehicle_monthly_costs;
CREATE POLICY "vehicle_monthly_costs_select" ON public.vehicle_monthly_costs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "vehicle_monthly_costs_insert" ON public.vehicle_monthly_costs;
CREATE POLICY "vehicle_monthly_costs_insert" ON public.vehicle_monthly_costs
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "vehicle_monthly_costs_update" ON public.vehicle_monthly_costs;
CREATE POLICY "vehicle_monthly_costs_update" ON public.vehicle_monthly_costs
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- =============================================================================
-- VIEW: vehicle_computed_status (UPDATED)
-- Replaces the version from 00025_fleet_vehicles.sql.
-- Now uses vehicle_status as the primary status indicator.
-- Logic:
--   deleted_at IS NOT NULL                              → 'inactive'
--   vehicle_status IN ('returned','sold','decommissioned') → 'inactive'
--   vehicle_status = 'suspended'                        → 'suspended'
--   ELSE (vehicle_status = 'active')                   → 'active'
-- security_invoker = true → view respects RLS of underlying vehicles table.
-- =============================================================================

CREATE OR REPLACE VIEW public.vehicle_computed_status
  WITH (security_invoker = true)
AS
SELECT
  v.id,
  CASE
    WHEN v.deleted_at IS NOT NULL                                       THEN 'inactive'
    WHEN v.vehicle_status IN ('returned','sold','decommissioned')       THEN 'inactive'
    WHEN v.vehicle_status = 'suspended'                                 THEN 'suspended'
    ELSE                                                                     'active'
  END AS computed_status
FROM public.vehicles v;

-- =============================================================================
-- VIEW: driver_computed_status (UPDATED)
-- Replaces the version from 00025_fleet_vehicles.sql (and 00023 security fix).
-- Updated to filter vehicles by vehicle_status in addition to is_active.
-- A driver is 'active' via vehicle assignment only if the vehicle is:
--   - not deleted
--   - is_active = TRUE (existing column, kept for compatibility)
--   - vehicle_status NOT IN ('returned','sold','decommissioned')
--
-- WHEN order (priority):
--   1. Employee inactive or deleted       → inactive
--   2. Driver card deleted                → inactive
--   3. Has assigned active vehicle        → active  (updated condition)
--   4. is_occasional_camp_driver OR is_equipment_operator → active
--   5. Else                               → inactive
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
        AND veh.vehicle_status NOT IN ('returned','sold','decommissioned')
    ) > 0                                                  THEN 'active'
    WHEN d.is_occasional_camp_driver OR d.is_equipment_operator THEN 'active'
    ELSE                                                        'inactive'
  END AS computed_status
FROM public.drivers d
JOIN public.employees e ON e.id = d.employee_id;

-- =============================================================================
-- SOFT-DELETE RPC: soft_delete_vehicle_replacement_record
-- Required because the SELECT RLS policy (USING deleted_at IS NULL) would
-- block a direct UPDATE that sets deleted_at on the same row.
-- Same SECURITY DEFINER + SET search_path = public pattern as all project RPCs.
-- Pattern source: soft_delete_vehicle() in 00025_fleet_vehicles.sql
-- =============================================================================

CREATE OR REPLACE FUNCTION public.soft_delete_vehicle_replacement_record(
  p_id      UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.vehicle_replacement_records
  SET deleted_at = NOW(),
      updated_at = NOW(),
      updated_by = p_user_id
  WHERE id = p_id
    AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;
