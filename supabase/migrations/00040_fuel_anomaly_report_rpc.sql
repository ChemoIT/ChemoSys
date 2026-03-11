-- =============================================================================
-- Migration: 00040_fuel_anomaly_report_rpc.sql
-- Purpose:   RPC for fuel anomaly report export.
--
--            Returns one row per fuel_record for a given month with enriched
--            vehicle, driver, and project info needed for anomaly detection:
--            - Vehicle not in fleet (vehicle_id IS NULL)
--            - Vehicle not active at fueling date
--            - Monthly quantity exceeds monthly_fuel_limit_liters
--
--            All temporal lookups (driver, project, replacement) are resolved
--            at the fueling_date via LATERAL JOINs — no pagination issues.
--
-- Run via: Supabase Dashboard -> SQL Editor
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_fuel_anomaly_report(
  p_month  INT,
  p_year   INT
)
RETURNS TABLE (
  -- Fuel record fields
  license_plate       TEXT,
  fueling_date        DATE,
  fueling_time        TEXT,
  fuel_supplier       TEXT,
  fuel_type           TEXT,
  fueling_method      TEXT,
  fuel_card_number    TEXT,
  quantity_liters     NUMERIC,
  net_amount          NUMERIC,
  gross_amount        NUMERIC,
  odometer_km         INT,
  station_name        TEXT,
  -- Vehicle fields
  vehicle_id          UUID,
  vehicle_category    TEXT,
  vehicle_status      TEXT,
  owner_name          TEXT,
  vehicle_group       TEXT,
  tozeret_nm          TEXT,
  degem_nm            TEXT,
  monthly_fuel_limit  INT,
  -- Driver fields
  driver_name         TEXT,
  employee_number     TEXT,
  -- Project field
  project_name        TEXT,
  -- Replacement
  original_plate      TEXT,
  -- TRUE if this vehicle (by vehicle_id) has an active replacement at fueling_date
  has_active_replacement BOOLEAN
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
  -- Resolve replacement vehicles: if plate matches a replacement record,
  -- find the original vehicle for driver/project lookups
  fuel_base AS (
    SELECT
      fr.license_plate,
      fr.fueling_date,
      fr.fueling_time::TEXT,
      fr.fuel_supplier,
      fr.fuel_type,
      fr.fueling_method,
      fr.fuel_card_number,
      fr.quantity_liters,
      fr.net_amount,
      fr.gross_amount,
      fr.odometer_km,
      fr.station_name,
      fr.vehicle_id,
      COALESCE(rep.original_vehicle_id, fr.vehicle_id) AS effective_vehicle_id,
      rep.original_plate
    FROM public.fuel_records fr
    CROSS JOIN date_range dr
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
      AND fr.quantity_liters > 0
  )
  SELECT
    fb.license_plate,
    fb.fueling_date,
    fb.fueling_time,
    fb.fuel_supplier,
    fb.fuel_type,
    fb.fueling_method,
    fb.fuel_card_number,
    fb.quantity_liters,
    fb.net_amount,
    fb.gross_amount,
    fb.odometer_km,
    fb.station_name,
    fb.vehicle_id,
    v.vehicle_category,
    v.vehicle_status,
    COALESCE(
      (SELECT vs.name FROM public.vehicle_suppliers vs WHERE vs.id = v.ownership_supplier_id),
      ''
    ) AS owner_name,
    COALESCE(v.vehicle_group::TEXT, '') AS vehicle_group,
    v.tozeret_nm,
    v.degem_nm,
    v.monthly_fuel_limit_liters AS monthly_fuel_limit,
    -- Driver from journal (temporal match)
    COALESCE(
      drv_j.driver_name,
      drv_fb.driver_name,
      CASE WHEN v.vehicle_category = 'camp' THEN 'רכב מחנה' ELSE NULL END
    ) AS driver_name,
    COALESCE(drv_j.employee_number, drv_fb.employee_number) AS employee_number,
    -- Project (temporal match)
    proj.project_name,
    fb.original_plate,
    -- Check if THIS vehicle has a replacement vehicle active at fueling_date
    -- (meaning this vehicle should be suspended and NOT fueling)
    COALESCE(active_rep.has_replacement, FALSE) AS has_active_replacement
  FROM fuel_base fb
  LEFT JOIN public.vehicles v ON v.id = fb.effective_vehicle_id
  -- Driver from journal
  LEFT JOIN LATERAL (
    SELECT
      e.first_name || ' ' || e.last_name AS driver_name,
      e.employee_number
    FROM public.vehicle_driver_journal vdj
    JOIN public.drivers d ON d.id = vdj.driver_id
    JOIN public.employees e ON e.id = d.employee_id
    WHERE vdj.vehicle_id = fb.effective_vehicle_id
      AND vdj.start_date <= fb.fueling_date
      AND (vdj.end_date IS NULL OR vdj.end_date >= fb.fueling_date)
    ORDER BY vdj.start_date DESC
    LIMIT 1
  ) drv_j ON TRUE
  -- Driver fallback from assigned_driver_id
  LEFT JOIN LATERAL (
    SELECT
      e.first_name || ' ' || e.last_name AS driver_name,
      e.employee_number
    FROM public.drivers d
    JOIN public.employees e ON e.id = d.employee_id
    WHERE d.id = v.assigned_driver_id
  ) drv_fb ON drv_j.employee_number IS NULL
  -- Project from journal
  LEFT JOIN LATERAL (
    SELECT p.name AS project_name
    FROM public.vehicle_project_journal vpj
    JOIN public.projects p ON p.id = vpj.project_id
    WHERE vpj.vehicle_id = fb.effective_vehicle_id
      AND vpj.start_date <= fb.fueling_date
      AND (vpj.end_date IS NULL OR vpj.end_date >= fb.fueling_date)
    ORDER BY vpj.start_date DESC
    LIMIT 1
  ) proj ON TRUE
  -- Check if vehicle has an active replacement (reverse lookup)
  LEFT JOIN LATERAL (
    SELECT TRUE AS has_replacement
    FROM public.vehicle_replacement_records vrr2
    WHERE vrr2.vehicle_id = fb.vehicle_id
      AND vrr2.entry_date <= fb.fueling_date
      AND (vrr2.return_date IS NULL OR vrr2.return_date >= fb.fueling_date)
      AND vrr2.deleted_at IS NULL
    LIMIT 1
  ) active_rep ON fb.vehicle_id IS NOT NULL
  ORDER BY fb.license_plate, fb.fueling_date, fb.fueling_time;
$$;

-- Grant execute to all relevant roles
GRANT EXECUTE ON FUNCTION public.get_fuel_anomaly_report(INT, INT) TO anon, authenticated, service_role;
