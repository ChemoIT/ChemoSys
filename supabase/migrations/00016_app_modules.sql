-- =============================================================================
-- Migration: 00016_app_modules.sql
-- Phase:     06 — DB + Auth Foundation
-- Purpose:   Seed the modules table with 18 app_* module keys for ChemoSys.
--            These drive the permission matrix for field-worker facing pages.
--
--            Top-level modules (2):
--              app_fleet     — צי רכב (Fleet management)
--              app_equipment — צמ"ה (Heavy equipment — sub-modules TBD)
--
--            Fleet sub-modules (16, parent_key = 'app_fleet'):
--              app_fleet_vehicles, app_fleet_drivers, app_fleet_mileage,
--              app_fleet_fuel, app_fleet_tolls, app_fleet_violations,
--              app_fleet_safety, app_fleet_maintenance, app_fleet_spare_parts,
--              app_fleet_exceptions, app_fleet_ev_charging, app_fleet_rentals,
--              app_fleet_invoices, app_fleet_expenses, app_fleet_camp_vehicles,
--              app_fleet_reports
--
-- Key prefix: app_* — prevents collision with admin module keys.
-- Idempotent: Uses ON CONFLICT (key) DO NOTHING — safe to re-run.
-- =============================================================================

INSERT INTO modules (key, name_he, parent_key, sort_order, icon)
VALUES
  -- Top-level modules
  ('app_fleet',              'צי רכב',          NULL,        0,  'Truck'),
  ('app_equipment',          'צמ"ה',             NULL,        1,  'HardHat'),

  -- Fleet sub-modules (parent_key = 'app_fleet')
  ('app_fleet_vehicles',     'רכבים',            'app_fleet', 0,  'Car'),
  ('app_fleet_drivers',      'נהגים',            'app_fleet', 1,  'UserCheck'),
  ('app_fleet_mileage',      'קילומטראז''',      'app_fleet', 2,  'Gauge'),
  ('app_fleet_fuel',         'דלק',              'app_fleet', 3,  'Fuel'),
  ('app_fleet_tolls',        'כבישי אגרה',       'app_fleet', 4,  'SquareActivity'),
  ('app_fleet_violations',   'דוחות תנועה',      'app_fleet', 5,  'FileWarning'),
  ('app_fleet_safety',       'בטיחות',           'app_fleet', 6,  'ShieldCheck'),
  ('app_fleet_maintenance',  'טיפולים',          'app_fleet', 7,  'Wrench'),
  ('app_fleet_spare_parts',  'חלקי חילוף',       'app_fleet', 8,  'Settings2'),
  ('app_fleet_exceptions',   'חריגים',           'app_fleet', 9,  'AlertTriangle'),
  ('app_fleet_ev_charging',  'טעינה חשמלית',     'app_fleet', 10, 'Zap'),
  ('app_fleet_rentals',      'רכבי שכירות',      'app_fleet', 11, 'KeyRound'),
  ('app_fleet_invoices',     'חשבוניות',         'app_fleet', 12, 'Receipt'),
  ('app_fleet_expenses',     'הוצאות',           'app_fleet', 13, 'Wallet'),
  ('app_fleet_camp_vehicles','רכבי מחנה',        'app_fleet', 14, 'Tent'),
  ('app_fleet_reports',      'דוחות',            'app_fleet', 15, 'BarChart2')
ON CONFLICT (key) DO NOTHING;
