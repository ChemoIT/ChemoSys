-- =============================================================================
-- Migration: 00039_priority_fuel_report_rpc.sql
-- Purpose:   RPC for Priority ERP fuel report export.
--
--            Returns one row per fuel_record with all enriched fields needed
--            for the Priority report:
--            - vehicle_category (camp/assigned)
--            - employee_number (from driver journal or fallback assigned_driver_id)
--            - project fields (project_number, project_name, expense_number) for camp
--            - replacement vehicle original plate
--            - quantity_liters, net_amount for price_per_liter calc
--
--            CRITICAL: When a fuel record's plate matches a replacement vehicle,
--            driver and project lookups use the ORIGINAL vehicle (not the replacement).
--            This matches the Liberty Basic GetOrgCarFromRepCar$ logic.
--
--            All temporal lookups (driver, project, replacement) are resolved
--            at the fueling_date via LATERAL JOINs — no pagination issues.
--
-- Run via: Supabase Dashboard → SQL Editor
-- =============================================================================


CREATE OR REPLACE FUNCTION public.get_priority_fuel_report(
  p_month  INT,
  p_year   INT,
  p_supplier TEXT
)
RETURNS TABLE (
  license_plate      TEXT,
  vehicle_category   TEXT,
  employee_number    TEXT,
  project_number     TEXT,
  project_name       TEXT,
  expense_number     TEXT,
  quantity_liters    NUMERIC,
  net_amount         NUMERIC,
  fueling_date       DATE,
  original_plate     TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH date_range AS (
    SELECT
      make_date(p_year, p_month, 1) AS start_date,
      (make_date(p_year, p_month, 1) + INTERVAL '1 month - 1 day')::DATE AS end_date
  ),
  -- Step 1: Get fuel records with replacement vehicle resolution
  -- If a plate matches a replacement vehicle record, resolve the original vehicle.
  -- effective_vehicle_id = original vehicle (for driver/project lookups)
  fuel_with_replacement AS (
    SELECT
      fr.license_plate,
      fr.fueling_date,
      fr.quantity_liters,
      fr.net_amount,
      fr.vehicle_id,
      -- Use original vehicle_id if replacement found, else fuel record's vehicle_id
      COALESCE(rep.original_vehicle_id, fr.vehicle_id) AS effective_vehicle_id,
      rep.original_plate
    FROM public.fuel_records fr
    CROSS JOIN date_range dr
    -- Replacement vehicle lookup
    LEFT JOIN LATERAL (
      SELECT vrr.vehicle_id AS original_vehicle_id, rv.license_plate AS original_plate
      FROM public.vehicle_replacement_records vrr
      JOIN public.vehicles rv ON rv.id = vrr.vehicle_id
      WHERE vrr.license_plate = fr.license_plate
        AND vrr.entry_date <= fr.fueling_date
        AND (vrr.return_date IS NULL OR vrr.return_date >= fr.fueling_date)
        AND vrr.deleted_at IS NULL
      ORDER BY vrr.entry_date DESC
      LIMIT 1
    ) rep ON TRUE
    WHERE fr.fueling_date >= dr.start_date
      AND fr.fueling_date <= dr.end_date
      AND fr.fuel_supplier = p_supplier
      AND fr.quantity_liters > 0
  )
  -- Step 2: Enrich with vehicle info, driver, project using effective_vehicle_id
  SELECT
    fwr.license_plate,
    -- NULL = vehicle not in fleet (anomaly), otherwise camp/assigned
    CASE WHEN v.id IS NOT NULL THEN COALESCE(v.vehicle_category, 'assigned') ELSE NULL END AS vehicle_category,
    -- Driver: journal first, then fallback to assigned_driver_id
    COALESCE(drv_journal.employee_number, drv_fallback.employee_number) AS employee_number,
    -- Project fields (camp vehicles only)
    proj.project_number,
    proj.project_name,
    proj.expense_number,
    fwr.quantity_liters,
    fwr.net_amount,
    fwr.fueling_date,
    fwr.original_plate
  FROM fuel_with_replacement fwr
  -- Vehicle info from the EFFECTIVE vehicle (original if replacement)
  LEFT JOIN public.vehicles v ON v.id = fwr.effective_vehicle_id
  -- Driver from journal using EFFECTIVE vehicle_id (temporal match at fueling_date)
  LEFT JOIN LATERAL (
    SELECT e.employee_number
    FROM public.vehicle_driver_journal vdj
    JOIN public.drivers d ON d.id = vdj.driver_id
    JOIN public.employees e ON e.id = d.employee_id
    WHERE vdj.vehicle_id = fwr.effective_vehicle_id
      AND vdj.start_date <= fwr.fueling_date
      AND (vdj.end_date IS NULL OR vdj.end_date >= fwr.fueling_date)
    ORDER BY vdj.start_date DESC
    LIMIT 1
  ) drv_journal ON TRUE
  -- Driver fallback: assigned_driver_id on effective vehicle record
  LEFT JOIN LATERAL (
    SELECT e.employee_number
    FROM public.drivers d
    JOIN public.employees e ON e.id = d.employee_id
    WHERE d.id = v.assigned_driver_id
  ) drv_fallback ON drv_journal.employee_number IS NULL
  -- Project info for camp vehicles using EFFECTIVE vehicle_id
  LEFT JOIN LATERAL (
    SELECT p.project_number, p.name AS project_name, p.expense_number
    FROM public.vehicle_project_journal vpj
    JOIN public.projects p ON p.id = vpj.project_id
    WHERE vpj.vehicle_id = fwr.effective_vehicle_id
      AND vpj.start_date <= fwr.fueling_date
      AND (vpj.end_date IS NULL OR vpj.end_date >= fwr.fueling_date)
    ORDER BY vpj.start_date DESC
    LIMIT 1
  ) proj ON v.vehicle_category = 'camp';
$$;


-- Grant execute to all relevant roles
GRANT EXECUTE ON FUNCTION public.get_priority_fuel_report(INT, INT, TEXT) TO anon, authenticated, service_role;
