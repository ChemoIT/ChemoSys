-- =============================================================================
-- Migration: 00035_fuel_records.sql
-- Purpose:   Create fuel_records, fuel_import_batches, and vehicle_km_log tables
--            for fleet fuel tracking and km monitoring.
--
-- Run via: Supabase Dashboard → SQL Editor
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. fuel_import_batches — tracks each monthly Excel import
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fuel_import_batches (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  import_month    INT         NOT NULL CHECK (import_month BETWEEN 1 AND 12),
  import_year     INT         NOT NULL CHECK (import_year BETWEEN 2020 AND 2100),
  fuel_supplier   TEXT        NOT NULL CHECK (fuel_supplier IN ('delek','tapuz','dalkal')),
  record_count    INT,
  matched_count   INT,
  unmatched_count INT,
  status          TEXT        CHECK (status IN ('completed','partial')),
  file_name       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID        REFERENCES auth.users(id)
);

ALTER TABLE public.fuel_import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fuel_import_batches_select"
  ON public.fuel_import_batches FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "fuel_import_batches_insert"
  ON public.fuel_import_batches FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "fuel_import_batches_update"
  ON public.fuel_import_batches FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. fuel_records — individual fueling transactions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fuel_records (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id       UUID          NOT NULL REFERENCES public.vehicles(id),
  license_plate    TEXT          NOT NULL,
  fueling_date     DATE          NOT NULL,
  fueling_time     TIME,
  fuel_supplier    TEXT          NOT NULL CHECK (fuel_supplier IN ('delek','tapuz','dalkal')),
  fuel_type        TEXT          NOT NULL CHECK (fuel_type IN ('benzine','diesel','urea')),
  fueling_method   TEXT          CHECK (fueling_method IN ('device','card')),
  quantity_liters  NUMERIC(10,2) NOT NULL,
  station_name     TEXT,
  gross_amount     NUMERIC(10,2),
  net_amount       NUMERIC(10,2),
  odometer_km      INT,
  import_month     INT           NOT NULL,
  import_year      INT           NOT NULL,
  import_batch_id  UUID          REFERENCES public.fuel_import_batches(id),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by       UUID          REFERENCES auth.users(id)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS fuel_records_vehicle_date_idx
  ON public.fuel_records (vehicle_id, fueling_date);

CREATE INDEX IF NOT EXISTS fuel_records_period_idx
  ON public.fuel_records (import_year, import_month);

CREATE INDEX IF NOT EXISTS fuel_records_plate_idx
  ON public.fuel_records (license_plate);

CREATE INDEX IF NOT EXISTS fuel_records_batch_idx
  ON public.fuel_records (import_batch_id);

-- Dedup: prevent importing the same record twice.
-- COALESCE handles NULL fueling_time (PostgreSQL treats NULLs as distinct).
CREATE UNIQUE INDEX IF NOT EXISTS fuel_records_dedup_idx
  ON public.fuel_records (
    license_plate,
    fueling_date,
    COALESCE(fueling_time, '00:00:00'::TIME),
    fuel_supplier,
    quantity_liters
  );

ALTER TABLE public.fuel_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fuel_records_select"
  ON public.fuel_records FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "fuel_records_insert"
  ON public.fuel_records FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "fuel_records_update"
  ON public.fuel_records FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. vehicle_km_log — odometer readings from all sources
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehicle_km_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id       UUID        NOT NULL REFERENCES public.vehicles(id),
  license_plate    TEXT        NOT NULL,
  recorded_date    DATE        NOT NULL,
  km_reading       INT         NOT NULL,
  source           TEXT        NOT NULL CHECK (source IN ('manual','sms','whatsapp','fuel_device','import')),
  is_trusted       BOOLEAN     NOT NULL DEFAULT true,
  source_record_id UUID,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID        REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS vehicle_km_log_vehicle_date_idx
  ON public.vehicle_km_log (vehicle_id, recorded_date);

ALTER TABLE public.vehicle_km_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicle_km_log_select"
  ON public.vehicle_km_log FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "vehicle_km_log_insert"
  ON public.vehicle_km_log FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "vehicle_km_log_update"
  ON public.vehicle_km_log FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
