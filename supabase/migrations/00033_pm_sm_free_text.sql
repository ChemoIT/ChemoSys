-- =============================================================================
-- Migration: 00033_pm_sm_free_text.sql
-- Purpose:   Add is_employee toggle + name field for PM and SM,
--            mirroring the existing CVC pattern (cvc_is_employee, cvc_name).
--            When pm_is_employee=false, project_manager_id is NULL and
--            pm_name/pm_email/pm_phone store the free-text contact.
--            Same for SM.
--
-- Run via: Supabase Dashboard → SQL Editor
-- =============================================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS pm_is_employee BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pm_name        TEXT,
  ADD COLUMN IF NOT EXISTS sm_is_employee BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sm_name        TEXT;
