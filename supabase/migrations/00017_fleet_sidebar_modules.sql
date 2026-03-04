-- Migration: 00017_fleet_sidebar_modules.sql
-- Phase: 09 — Fleet Home
-- Purpose: Add 2 module keys missing from 00016 for the 9-item fleet sidebar.
--          Sharon's session #16 characterization changed the sub-module list from 16 to 9,
--          introducing 2 new items that weren't in the original migration.
-- Idempotent: ON CONFLICT (key) DO NOTHING — safe to re-run.

INSERT INTO modules (key, name_he, parent_key, sort_order, icon)
VALUES
  ('app_fleet_charging_stations', 'מעקב עמדות טעינה', 'app_fleet', 16, 'MapPin'),
  ('app_fleet_forms',             'טפסים',            'app_fleet', 17, 'ClipboardList')
ON CONFLICT (key) DO NOTHING;
