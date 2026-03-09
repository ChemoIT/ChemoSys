-- =============================================================================
-- Migration: 00036_fuel_performance.sql
-- Purpose:   Performance optimizations for fuel records:
--            1. Enriched view (driver+project via LATERAL JOIN — single query)
--            2. Stats RPC (SUM in DB — replaces 10K-row JS loop)
--            3. Composite index for common filter patterns
--
-- Run via: Supabase Dashboard → SQL Editor
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. fuel_records_enriched — view with driver & project names at fueling date
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.fuel_records_enriched AS
SELECT
  fr.*,
  TRIM(COALESCE(driver_emp.first_name, '') || ' ' || COALESCE(driver_emp.last_name, '')) AS driver_name,
  proj.name AS project_name
FROM public.fuel_records fr
LEFT JOIN LATERAL (
  SELECT d.employee_id
  FROM public.vehicle_driver_journal vdj
  JOIN public.drivers d ON d.id = vdj.driver_id
  WHERE vdj.vehicle_id = fr.vehicle_id
    AND vdj.start_date <= fr.fueling_date
    AND (vdj.end_date IS NULL OR vdj.end_date >= fr.fueling_date)
  ORDER BY vdj.start_date DESC
  LIMIT 1
) drv ON TRUE
LEFT JOIN public.employees driver_emp ON driver_emp.id = drv.employee_id
LEFT JOIN LATERAL (
  SELECT vpj.project_id
  FROM public.vehicle_project_journal vpj
  WHERE vpj.vehicle_id = fr.vehicle_id
    AND vpj.start_date <= fr.fueling_date
    AND (vpj.end_date IS NULL OR vpj.end_date >= fr.fueling_date)
  ORDER BY vpj.start_date DESC
  LIMIT 1
) prj ON TRUE
LEFT JOIN public.projects proj ON proj.id = prj.project_id;

-- Grant access (view inherits RLS from underlying table)
GRANT SELECT ON public.fuel_records_enriched TO authenticated, anon, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. get_fuel_stats — RPC for aggregate stats (replaces JS-side loop)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_fuel_stats(
  p_from_date DATE,
  p_to_date   DATE,
  p_supplier   TEXT     DEFAULT NULL,
  p_fuel_type  TEXT     DEFAULT NULL,
  p_plate_search TEXT   DEFAULT NULL,
  p_vehicle_ids UUID[]  DEFAULT NULL
)
RETURNS TABLE (
  total_records BIGINT,
  total_liters  NUMERIC,
  total_gross   NUMERIC,
  total_net     NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    COUNT(*)::BIGINT                      AS total_records,
    COALESCE(SUM(quantity_liters), 0)     AS total_liters,
    COALESCE(SUM(gross_amount), 0)        AS total_gross,
    COALESCE(SUM(net_amount), 0)          AS total_net
  FROM public.fuel_records
  WHERE fueling_date >= p_from_date
    AND fueling_date <= p_to_date
    AND (p_supplier IS NULL    OR fuel_supplier = p_supplier)
    AND (p_fuel_type IS NULL   OR fuel_type = p_fuel_type)
    AND (p_plate_search IS NULL OR license_plate ILIKE '%' || p_plate_search || '%')
    AND (p_vehicle_ids IS NULL OR vehicle_id = ANY(p_vehicle_ids))
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION public.get_fuel_stats TO authenticated, anon, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Composite index for common filter combinations
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS fuel_records_date_supplier_type_idx
  ON public.fuel_records (fueling_date DESC, fuel_supplier, fuel_type, vehicle_id);

-- Index on journal tables for LATERAL JOIN performance
CREATE INDEX IF NOT EXISTS vehicle_driver_journal_vehicle_dates_idx
  ON public.vehicle_driver_journal (vehicle_id, start_date DESC);

CREATE INDEX IF NOT EXISTS vehicle_project_journal_vehicle_dates_idx
  ON public.vehicle_project_journal (vehicle_id, start_date DESC);
