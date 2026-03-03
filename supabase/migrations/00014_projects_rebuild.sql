-- =============================================================================
-- Migration: 00014_projects_rebuild.sql
-- Phase:     04 — Projects
-- Purpose:   Full rebuild of the projects table with all required fields:
--            PM, SM, CVC, client, supervision, location, attendance_clocks,
--            project number auto-generation (PR26XXXXXX), soft-delete RPC,
--            RLS policies, and Storage policies for client logos.
--
-- SAFE TO RUN: DROP TABLE projects CASCADE — Phase 4 code was fully reverted
--              in the 2026-03-03 revert. No production data exists in projects.
--
-- Run via: Supabase Dashboard → SQL Editor
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Drop old projects stub (safe — no production data, Phase 4 reverted)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS attendance_clocks CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- ---------------------------------------------------------------------------
-- Sequence for auto-generating project numbers (PR26XXXXXX)
-- ---------------------------------------------------------------------------
DROP SEQUENCE IF EXISTS projects_number_seq;
CREATE SEQUENCE projects_number_seq START 1;

-- ---------------------------------------------------------------------------
-- projects table
-- ---------------------------------------------------------------------------
CREATE TABLE projects (
  -- Primary key
  id                          UUID          DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Basic info
  name                        TEXT          NOT NULL,
  project_number              TEXT          NOT NULL DEFAULT '',       -- Filled by trigger
  open_date                   DATE,
  expense_number              TEXT,
  description                 TEXT,
  project_type                TEXT          CHECK (project_type IN ('project', 'staging_area', 'storage_area')),
  status                      TEXT          NOT NULL DEFAULT 'active'
                                            CHECK (status IN ('active', 'view_only', 'inactive')),

  -- Project Manager (PM)
  project_manager_id          UUID          REFERENCES employees(id),
  pm_email                    TEXT,
  pm_phone                    TEXT,
  pm_notifications            BOOLEAN       NOT NULL DEFAULT TRUE,

  -- Site Manager (SM)
  site_manager_id             UUID          REFERENCES employees(id),
  sm_email                    TEXT,
  sm_phone                    TEXT,
  sm_notifications            BOOLEAN       NOT NULL DEFAULT TRUE,

  -- Camp/Vehicle Coordinator (CVC) — may be employee or external contact
  camp_vehicle_coordinator_id UUID          REFERENCES employees(id),  -- NULL when cvc_is_employee=false
  cvc_is_employee             BOOLEAN       NOT NULL DEFAULT TRUE,
  cvc_phone                   TEXT,

  -- Client
  client_name                 TEXT,
  client_logo_url             TEXT,         -- Supabase Storage URL

  -- Supervision company
  supervision_company         TEXT,
  supervision_contact         TEXT,
  supervision_email           TEXT,
  supervision_phone           TEXT,
  supervision_notifications   BOOLEAN       NOT NULL DEFAULT FALSE,
  supervision_attach_reports  BOOLEAN       NOT NULL DEFAULT FALSE,

  -- Location (for map display + clock-in radius enforcement)
  latitude                    DECIMAL(10, 7),
  longitude                   DECIMAL(10, 7),
  radius                      INTEGER       NOT NULL DEFAULT 100,      -- Meters

  -- Universal audit columns
  created_at  TIMESTAMPTZ   DEFAULT NOW()  NOT NULL,
  updated_at  TIMESTAMPTZ   DEFAULT NOW()  NOT NULL,
  created_by  UUID          REFERENCES auth.users(id),
  updated_by  UUID          REFERENCES auth.users(id),
  deleted_at  TIMESTAMPTZ   DEFAULT NULL                               -- NULL = active
);

-- Partial unique index: project_number unique among active projects only.
-- project_number = '' is excluded (pre-trigger state, never conflicts).
CREATE UNIQUE INDEX projects_number_active
  ON projects(project_number)
  WHERE deleted_at IS NULL AND project_number != '';

-- auto-updated_at trigger (reuses existing set_updated_at function from 00001)
CREATE TRIGGER trigger_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Project number auto-generation trigger (PR26XXXXXX format)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_project_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only generate if project_number is empty/null (insert only, not update)
  IF NEW.project_number IS NULL OR NEW.project_number = '' THEN
    NEW.project_number := 'PR26' || LPAD(nextval('projects_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_generate_project_number
  BEFORE INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION generate_project_number();

-- ---------------------------------------------------------------------------
-- attendance_clocks — clock devices assigned to a project
-- ---------------------------------------------------------------------------
CREATE TABLE attendance_clocks (
  id          UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  UUID          NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  clock_id    TEXT          NOT NULL,                                  -- Device ID (string)
  created_at  TIMESTAMPTZ   DEFAULT NOW() NOT NULL,
  created_by  UUID          REFERENCES auth.users(id)
);

-- A clock device can only be assigned to one project at a time (unique per project)
CREATE UNIQUE INDEX attendance_clocks_project_clock_unique
  ON attendance_clocks(project_id, clock_id);

-- ---------------------------------------------------------------------------
-- RLS — Row Level Security
-- ---------------------------------------------------------------------------

-- projects: Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users can read non-deleted projects
CREATE POLICY "authenticated_select_projects"
  ON projects FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- INSERT: authenticated users can insert
CREATE POLICY "authenticated_insert_projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: authenticated users can update (includes setting deleted_at for soft-delete)
CREATE POLICY "authenticated_update_projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- attendance_clocks: Enable RLS
ALTER TABLE attendance_clocks ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users can read all clocks
CREATE POLICY "authenticated_select_attendance_clocks"
  ON attendance_clocks FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: authenticated users can insert clocks
CREATE POLICY "authenticated_insert_attendance_clocks"
  ON attendance_clocks FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- DELETE: authenticated users can delete clocks (for replace-all pattern on project update)
CREATE POLICY "authenticated_delete_attendance_clocks"
  ON attendance_clocks FOR DELETE
  TO authenticated
  USING (true);

-- UPDATE: authenticated users can update clocks
CREATE POLICY "authenticated_update_attendance_clocks"
  ON attendance_clocks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- soft_delete_projects — SECURITY DEFINER RPC (bypasses RLS for soft-delete)
-- Same pattern as soft_delete_employees in 00007_soft_delete_rpc.sql
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION soft_delete_projects(p_ids UUID[])
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INT;
BEGIN
  UPDATE projects
  SET deleted_at = NOW(),
      updated_at = NOW()
  WHERE id = ANY(p_ids)
    AND deleted_at IS NULL;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- ---------------------------------------------------------------------------
-- Storage policies for client-logos bucket
--
-- NOTE: The bucket itself must be created in the Supabase Dashboard:
--   Storage → New Bucket → Name: client-logos → Public: ON
--
-- These SQL policies only work AFTER the bucket exists.
-- Run this migration AFTER creating the bucket manually.
-- ---------------------------------------------------------------------------

-- Allow authenticated users to upload client logos (INSERT)
CREATE POLICY "authenticated_upload_client_logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'client-logos');

-- Allow anyone (public) to view/download logos (SELECT)
-- Needed so client_logo_url links render in the browser without auth headers.
CREATE POLICY "public_read_client_logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'client-logos');

-- Allow authenticated users to overwrite/update logos (UPDATE)
CREATE POLICY "authenticated_update_client_logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'client-logos');

-- Allow authenticated users to delete logos (DELETE)
CREATE POLICY "authenticated_delete_client_logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'client-logos');
