-- =============================================================================
-- Migration: 00021_license_category_years.sql
-- Phase:     09 — Driver Card (schema improvement for import)
-- Purpose:   Change issue_year (single INT) to category_issue_years (JSONB)
--            so each license category can store its own issue year.
--            Example: {"B": 2005, "C1": 2010}
-- =============================================================================

-- ── Step 1: Add new JSONB column ─────────────────────────────────────────────

ALTER TABLE driver_licenses
  ADD COLUMN IF NOT EXISTS category_issue_years JSONB NOT NULL DEFAULT '{}';

-- ── Step 2: Migrate existing data ────────────────────────────────────────────
-- If a row has issue_year set, apply it to all existing categories

UPDATE driver_licenses
SET category_issue_years = (
  SELECT COALESCE(jsonb_object_agg(cat, issue_year), '{}'::jsonb)
  FROM unnest(license_categories) AS cat
)
WHERE issue_year IS NOT NULL
  AND array_length(license_categories, 1) > 0;

-- ── Step 3: Drop old column ──────────────────────────────────────────────────

ALTER TABLE driver_licenses DROP COLUMN IF EXISTS issue_year;
