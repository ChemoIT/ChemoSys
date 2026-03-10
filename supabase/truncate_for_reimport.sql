-- =============================================================================
-- Script: truncate_for_reimport.sql
-- Purpose: Delete all data imported from .top files (Liberty Basic serial dates)
--          to allow clean re-import with corrected date formula.
--
-- AFFECTED:  12 tables (drivers, vehicles, fuel — and their child tables)
-- NOT AFFECTED: employees, projects, attendance_clocks, document_names
--
-- WHY: All .top files use Liberty Basic serial dates (0 = 01/01/1901)
--      but import code used Excel serial formula (1 = 01/01/1900).
--      Result: all dates are off by 367 days (~1 year).
--      CarLog also has separate off-by-one bug (1 day).
--
-- Run via: Supabase Dashboard → SQL Editor
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Fuel & KM tables (from CarLog.top) — child tables first
-- ─────────────────────────────────────────────────────────────────────────────
TRUNCATE public.fuel_records CASCADE;
TRUNCATE public.vehicle_km_log CASCADE;
TRUNCATE public.fuel_import_batches CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Vehicle child tables (from CarList.top)
-- ─────────────────────────────────────────────────────────────────────────────
TRUNCATE public.vehicle_replacement_records CASCADE;
TRUNCATE public.vehicle_documents CASCADE;
TRUNCATE public.vehicle_monthly_costs CASCADE;
TRUNCATE public.vehicle_driver_journal CASCADE;
TRUNCATE public.vehicle_project_journal CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Driver child tables (from Drivers.top)
-- ─────────────────────────────────────────────────────────────────────────────
TRUNCATE public.driver_licenses CASCADE;
TRUNCATE public.driver_documents CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Parent tables — LAST (after children are cleared)
-- ─────────────────────────────────────────────────────────────────────────────
TRUNCATE public.vehicles CASCADE;
TRUNCATE public.drivers CASCADE;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification: all counts should be 0
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'fuel_records' AS tbl, COUNT(*) FROM public.fuel_records
UNION ALL SELECT 'vehicle_km_log', COUNT(*) FROM public.vehicle_km_log
UNION ALL SELECT 'fuel_import_batches', COUNT(*) FROM public.fuel_import_batches
UNION ALL SELECT 'vehicle_replacement_records', COUNT(*) FROM public.vehicle_replacement_records
UNION ALL SELECT 'vehicle_documents', COUNT(*) FROM public.vehicle_documents
UNION ALL SELECT 'vehicle_monthly_costs', COUNT(*) FROM public.vehicle_monthly_costs
UNION ALL SELECT 'vehicle_driver_journal', COUNT(*) FROM public.vehicle_driver_journal
UNION ALL SELECT 'vehicle_project_journal', COUNT(*) FROM public.vehicle_project_journal
UNION ALL SELECT 'driver_licenses', COUNT(*) FROM public.driver_licenses
UNION ALL SELECT 'driver_documents', COUNT(*) FROM public.driver_documents
UNION ALL SELECT 'vehicles', COUNT(*) FROM public.vehicles
UNION ALL SELECT 'drivers', COUNT(*) FROM public.drivers;
