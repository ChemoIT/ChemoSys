-- =============================================================================
-- Migration: 00038_fuel_upsert_rpcs.sql
-- Purpose:   Upsert RPCs for fuel_records and vehicle_km_log
--
--            Previously, CarLog import used INSERT-only — duplicate records were
--            silently skipped. This meant re-importing a file after billing data
--            updated (e.g. dalkal net_amount) would NOT update existing records.
--
--            These RPCs use INSERT ... ON CONFLICT ... DO UPDATE so that:
--            - New records are inserted as before
--            - Existing records (matched by dedup key) get their non-key fields
--              updated with the latest values from the import file
--
--            Dedup keys (from migration 00035):
--            - fuel_records:    (license_plate, fueling_date, COALESCE(fueling_time,'00:00:00'), quantity_liters)
--            - vehicle_km_log:  (license_plate, recorded_date, km_reading)
--
-- Run via: Supabase Dashboard → SQL Editor
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Rename duplicate_count → updated_count in fuel_import_batches
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.fuel_import_batches
  RENAME COLUMN duplicate_count TO updated_count;


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. upsert_fuel_records — bulk upsert fuel records from CarLog import
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Accepts a JSONB array of fuel record objects.
-- Returns a single row with inserted/updated counts.
-- Uses xmax = 0 trick: after INSERT ON CONFLICT, xmax=0 means new row, else updated.

CREATE OR REPLACE FUNCTION public.upsert_fuel_records(p_records JSONB)
RETURNS TABLE (inserted BIGINT, updated BIGINT)
LANGUAGE sql
SECURITY INVOKER
AS $$
  WITH input_rows AS (
    SELECT
      (r->>'vehicle_id')::UUID           AS vehicle_id,
      r->>'license_plate'                AS license_plate,
      (r->>'fueling_date')::DATE         AS fueling_date,
      (r->>'fueling_time')::TIME         AS fueling_time,
      r->>'fuel_supplier'                AS fuel_supplier,
      r->>'fuel_type'                    AS fuel_type,
      r->>'fueling_method'               AS fueling_method,
      r->>'fuel_card_number'             AS fuel_card_number,
      (r->>'quantity_liters')::NUMERIC(10,2) AS quantity_liters,
      r->>'station_name'                 AS station_name,
      (r->>'gross_amount')::NUMERIC(10,2)    AS gross_amount,
      (r->>'net_amount')::NUMERIC(10,2)      AS net_amount,
      r->>'actual_fuel_company'          AS actual_fuel_company,
      (r->>'odometer_km')::INT           AS odometer_km,
      r->>'match_status'                 AS match_status,
      (r->>'import_batch_id')::UUID      AS import_batch_id,
      (r->>'created_by')::UUID           AS created_by
    FROM jsonb_array_elements(p_records) AS r
  ),
  upserted AS (
    INSERT INTO public.fuel_records (
      vehicle_id, license_plate, fueling_date, fueling_time,
      fuel_supplier, fuel_type, fueling_method, fuel_card_number,
      quantity_liters, station_name, gross_amount, net_amount,
      actual_fuel_company, odometer_km, match_status, import_batch_id, created_by
    )
    SELECT
      vehicle_id, license_plate, fueling_date, fueling_time,
      fuel_supplier, fuel_type, fueling_method, fuel_card_number,
      quantity_liters, station_name, gross_amount, net_amount,
      actual_fuel_company, odometer_km, match_status, import_batch_id, created_by
    FROM input_rows
    ON CONFLICT (license_plate, fueling_date, COALESCE(fueling_time, '00:00:00'::TIME), quantity_liters)
    DO UPDATE SET
      vehicle_id          = EXCLUDED.vehicle_id,
      fuel_supplier       = EXCLUDED.fuel_supplier,
      fuel_type           = EXCLUDED.fuel_type,
      fueling_method      = EXCLUDED.fueling_method,
      fuel_card_number    = EXCLUDED.fuel_card_number,
      station_name        = EXCLUDED.station_name,
      gross_amount        = EXCLUDED.gross_amount,
      net_amount          = EXCLUDED.net_amount,
      actual_fuel_company = EXCLUDED.actual_fuel_company,
      odometer_km         = EXCLUDED.odometer_km,
      match_status        = EXCLUDED.match_status,
      import_batch_id     = EXCLUDED.import_batch_id
    RETURNING (xmax = 0) AS was_inserted
  )
  SELECT
    COUNT(*) FILTER (WHERE was_inserted)::BIGINT     AS inserted,
    COUNT(*) FILTER (WHERE NOT was_inserted)::BIGINT AS updated
  FROM upserted
$$;

GRANT EXECUTE ON FUNCTION public.upsert_fuel_records(JSONB) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. upsert_km_records — bulk upsert vehicle km log from CarLog import
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.upsert_km_records(p_records JSONB)
RETURNS TABLE (inserted BIGINT, updated BIGINT)
LANGUAGE sql
SECURITY INVOKER
AS $$
  WITH input_rows AS (
    SELECT
      (r->>'vehicle_id')::UUID       AS vehicle_id,
      r->>'license_plate'            AS license_plate,
      (r->>'recorded_date')::DATE    AS recorded_date,
      (r->>'km_reading')::INT        AS km_reading,
      r->>'source'                   AS source,
      (r->>'is_trusted')::BOOLEAN    AS is_trusted,
      r->>'match_status'             AS match_status,
      (r->>'import_batch_id')::UUID  AS import_batch_id,
      (r->>'created_by')::UUID       AS created_by
    FROM jsonb_array_elements(p_records) AS r
  ),
  upserted AS (
    INSERT INTO public.vehicle_km_log (
      vehicle_id, license_plate, recorded_date, km_reading,
      source, is_trusted, match_status, import_batch_id, created_by
    )
    SELECT
      vehicle_id, license_plate, recorded_date, km_reading,
      source, is_trusted, match_status, import_batch_id, created_by
    FROM input_rows
    ON CONFLICT (license_plate, recorded_date, km_reading)
    DO UPDATE SET
      vehicle_id      = EXCLUDED.vehicle_id,
      source          = EXCLUDED.source,
      is_trusted      = EXCLUDED.is_trusted,
      match_status    = EXCLUDED.match_status,
      import_batch_id = EXCLUDED.import_batch_id
    RETURNING (xmax = 0) AS was_inserted
  )
  SELECT
    COUNT(*) FILTER (WHERE was_inserted)::BIGINT     AS inserted,
    COUNT(*) FILTER (WHERE NOT was_inserted)::BIGINT AS updated
  FROM upserted
$$;

GRANT EXECUTE ON FUNCTION public.upsert_km_records(JSONB) TO authenticated, service_role;
