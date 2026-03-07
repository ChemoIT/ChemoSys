-- =============================================================================
-- SAFE FIX for 00018 — idempotent: safe to run multiple times
-- Handles the case where tables/triggers already exist from a partial run.
-- =============================================================================

-- ── 1) Tables (IF NOT EXISTS — safe) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.drivers (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id              UUID NOT NULL UNIQUE REFERENCES public.employees(id),
  phone_override           TEXT,
  is_occasional_camp_driver BOOLEAN NOT NULL DEFAULT FALSE,
  is_equipment_operator    BOOLEAN NOT NULL DEFAULT FALSE,
  opened_at                DATE NOT NULL DEFAULT CURRENT_DATE,
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by               UUID REFERENCES auth.users(id),
  updated_by               UUID REFERENCES auth.users(id),
  deleted_at               TIMESTAMPTZ DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS public.driver_licenses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id           UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  license_number      TEXT,
  license_categories  TEXT[] NOT NULL DEFAULT '{}',
  issue_year          INT,
  expiry_date         DATE,
  front_image_url     TEXT,
  back_image_url      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID REFERENCES auth.users(id),
  updated_by          UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.driver_document_names (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  usage_count  INT NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.driver_documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id      UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  document_name  TEXT NOT NULL,
  file_url       TEXT,
  expiry_date    DATE,
  alert_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     UUID REFERENCES auth.users(id),
  updated_by     UUID REFERENCES auth.users(id),
  deleted_at     TIMESTAMPTZ DEFAULT NULL
);

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
  file_url         TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID REFERENCES auth.users(id),
  updated_by       UUID REFERENCES auth.users(id),
  deleted_at       TIMESTAMPTZ DEFAULT NULL
);

-- ── 2) Add alert_enabled if missing ──────────────────────────────────────────

ALTER TABLE public.driver_documents
  ADD COLUMN IF NOT EXISTS alert_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 3) Triggers (DROP + CREATE — safe) ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS drivers_updated_at ON public.drivers;
CREATE TRIGGER drivers_updated_at
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS driver_licenses_updated_at ON public.driver_licenses;
CREATE TRIGGER driver_licenses_updated_at
  BEFORE UPDATE ON public.driver_licenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS driver_documents_updated_at ON public.driver_documents;
CREATE TRIGGER driver_documents_updated_at
  BEFORE UPDATE ON public.driver_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS driver_violations_updated_at ON public.driver_violations;
CREATE TRIGGER driver_violations_updated_at
  BEFORE UPDATE ON public.driver_violations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 4) View (CREATE OR REPLACE — safe) ───────────────────────────────────────

CREATE OR REPLACE VIEW public.driver_computed_status AS
SELECT
  d.id,
  d.employee_id,
  CASE
    WHEN e.status != 'active' OR e.deleted_at IS NOT NULL THEN 'inactive'
    WHEN d.deleted_at IS NOT NULL                          THEN 'inactive'
    WHEN d.is_occasional_camp_driver OR d.is_equipment_operator THEN 'active'
    ELSE 'inactive'
  END AS computed_status
FROM public.drivers d
JOIN public.employees e ON e.id = d.employee_id;

-- ── 5) RLS policies (DROP IF EXISTS + CREATE — safe) ─────────────────────────

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_document_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_violations ENABLE ROW LEVEL SECURITY;

-- drivers
DROP POLICY IF EXISTS "drivers_select" ON public.drivers;
CREATE POLICY "drivers_select" ON public.drivers FOR SELECT TO authenticated USING (deleted_at IS NULL);
DROP POLICY IF EXISTS "drivers_insert" ON public.drivers;
CREATE POLICY "drivers_insert" ON public.drivers FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "drivers_update" ON public.drivers;
CREATE POLICY "drivers_update" ON public.drivers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- driver_licenses
DROP POLICY IF EXISTS "driver_licenses_select" ON public.driver_licenses;
CREATE POLICY "driver_licenses_select" ON public.driver_licenses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "driver_licenses_insert" ON public.driver_licenses;
CREATE POLICY "driver_licenses_insert" ON public.driver_licenses FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "driver_licenses_update" ON public.driver_licenses;
CREATE POLICY "driver_licenses_update" ON public.driver_licenses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "driver_licenses_delete" ON public.driver_licenses;
CREATE POLICY "driver_licenses_delete" ON public.driver_licenses FOR DELETE TO authenticated USING (true);

-- driver_document_names
DROP POLICY IF EXISTS "driver_document_names_select" ON public.driver_document_names;
CREATE POLICY "driver_document_names_select" ON public.driver_document_names FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "driver_document_names_insert" ON public.driver_document_names;
CREATE POLICY "driver_document_names_insert" ON public.driver_document_names FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "driver_document_names_update" ON public.driver_document_names;
CREATE POLICY "driver_document_names_update" ON public.driver_document_names FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- driver_documents
DROP POLICY IF EXISTS "driver_documents_select" ON public.driver_documents;
CREATE POLICY "driver_documents_select" ON public.driver_documents FOR SELECT TO authenticated USING (deleted_at IS NULL);
DROP POLICY IF EXISTS "driver_documents_insert" ON public.driver_documents;
CREATE POLICY "driver_documents_insert" ON public.driver_documents FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "driver_documents_update" ON public.driver_documents;
CREATE POLICY "driver_documents_update" ON public.driver_documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- driver_violations
DROP POLICY IF EXISTS "driver_violations_select" ON public.driver_violations;
CREATE POLICY "driver_violations_select" ON public.driver_violations FOR SELECT TO authenticated USING (deleted_at IS NULL);
DROP POLICY IF EXISTS "driver_violations_insert" ON public.driver_violations;
CREATE POLICY "driver_violations_insert" ON public.driver_violations FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "driver_violations_update" ON public.driver_violations;
CREATE POLICY "driver_violations_update" ON public.driver_violations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── 6) RPC: increment_document_name_usage (CREATE OR REPLACE — safe) ─────────

CREATE OR REPLACE FUNCTION public.increment_document_name_usage(p_name TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.driver_document_names (name, usage_count)
  VALUES (p_name, 1)
  ON CONFLICT (name) DO UPDATE SET usage_count = driver_document_names.usage_count + 1;
END;
$$;

-- ── 7) Storage policies (DROP IF EXISTS + CREATE — safe) ─────────────────────

DROP POLICY IF EXISTS "authenticated_insert_fleet_licenses" ON storage.objects;
CREATE POLICY "authenticated_insert_fleet_licenses" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fleet-licenses');
DROP POLICY IF EXISTS "authenticated_select_fleet_licenses" ON storage.objects;
CREATE POLICY "authenticated_select_fleet_licenses" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'fleet-licenses');
DROP POLICY IF EXISTS "authenticated_update_fleet_licenses" ON storage.objects;
CREATE POLICY "authenticated_update_fleet_licenses" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'fleet-licenses');
DROP POLICY IF EXISTS "authenticated_delete_fleet_licenses" ON storage.objects;
CREATE POLICY "authenticated_delete_fleet_licenses" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'fleet-licenses');

DROP POLICY IF EXISTS "authenticated_insert_fleet_documents" ON storage.objects;
CREATE POLICY "authenticated_insert_fleet_documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fleet-documents');
DROP POLICY IF EXISTS "authenticated_select_fleet_documents" ON storage.objects;
CREATE POLICY "authenticated_select_fleet_documents" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'fleet-documents');
DROP POLICY IF EXISTS "authenticated_update_fleet_documents" ON storage.objects;
CREATE POLICY "authenticated_update_fleet_documents" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'fleet-documents');
DROP POLICY IF EXISTS "authenticated_delete_fleet_documents" ON storage.objects;
CREATE POLICY "authenticated_delete_fleet_documents" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'fleet-documents');
