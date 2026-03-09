-- =============================================================================
-- Migration: 00037_db_optimization.sql
-- Purpose:   Dashboard RPC + composite indexes for heavy pages
--
--            1. get_dashboard_stats() RPC — replaces 6 separate COUNT queries
--               on every dashboard load with a single DB round-trip.
--            2. Composite indexes for admin list pages (employees, vehicles,
--               projects, users, drivers).
--            3. Vehicle card index — vehicle_documents.vehicle_id (missing from
--               migration 00025 which created the table without an index).
--            4. audit_log index documentation — migration 00001 already has
--               sufficient indexes; documented here for completeness.
--
-- Reference: get_fuel_stats() in migration 00036 (same LANGUAGE sql STABLE
--            SECURITY INVOKER pattern).
--
-- Run via: Supabase Dashboard → SQL Editor
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. get_dashboard_stats — RPC for dashboard stat cards (replaces 6 COUNTs)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Returns a single row with exactly 6 BIGINT columns matching the 6 keys
-- expected by StatsCards.tsx:
--   employees_count, projects_count, users_count,
--   companies_count, departments_count, role_tags_count
--
-- Uses SECURITY INVOKER (read-only, no need to bypass RLS).
-- Each sub-query is a plain COUNT(*) with soft-delete filter.

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS TABLE (
  employees_count   BIGINT,
  projects_count    BIGINT,
  users_count       BIGINT,
  companies_count   BIGINT,
  departments_count BIGINT,
  role_tags_count   BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    (SELECT COUNT(*) FROM public.employees   WHERE deleted_at IS NULL)::BIGINT AS employees_count,
    (SELECT COUNT(*) FROM public.projects    WHERE deleted_at IS NULL)::BIGINT AS projects_count,
    (SELECT COUNT(*) FROM public.users       WHERE deleted_at IS NULL)::BIGINT AS users_count,
    (SELECT COUNT(*) FROM public.companies   WHERE deleted_at IS NULL)::BIGINT AS companies_count,
    (SELECT COUNT(*) FROM public.departments WHERE deleted_at IS NULL)::BIGINT AS departments_count,
    (SELECT COUNT(*) FROM public.role_tags   WHERE deleted_at IS NULL)::BIGINT AS role_tags_count
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats TO authenticated, anon, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Composite indexes for admin list pages
-- ─────────────────────────────────────────────────────────────────────────────
--
-- These partial indexes (WHERE deleted_at IS NULL) support the most common
-- admin list queries: list active records + order by created_at or status.
-- Verified as NOT existing in migrations 00001–00036.

CREATE INDEX IF NOT EXISTS drivers_active_idx
  ON public.drivers (deleted_at, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS employees_status_active_idx
  ON public.employees (status, deleted_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS vehicles_active_status_idx
  ON public.vehicles (status, deleted_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS projects_active_status_idx
  ON public.projects (deleted_at, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS users_active_idx
  ON public.users (deleted_at)
  WHERE deleted_at IS NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Vehicle card index — vehicle_documents (DBOPT-02)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Migration 00025 created the vehicle_documents table but did not add an index
-- on vehicle_id. The vehicle card fetches documents by vehicle_id on every tab
-- open — this index makes those lookups fast.

CREATE INDEX IF NOT EXISTS vehicle_documents_vehicle_id_idx
  ON public.vehicle_documents (vehicle_id)
  WHERE deleted_at IS NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. audit_log indexes — documentation only (DBOPT-04)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- VERIFIED: migration 00001 already provides sufficient indexes for all current
-- audit_log query patterns. No additional indexes are needed at this time.
--
--   idx_audit_log_user   (user_id, created_at DESC) — dashboard activity feed
--   idx_audit_log_entity (entity_type, entity_id, created_at DESC) — entity lookups
--   idx_audit_log_date   (created_at DESC) — chronological queries
--
-- No additional audit_log indexes needed at this time.
