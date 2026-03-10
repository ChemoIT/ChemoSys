-- =============================================================================
-- Check Pending Migrations (00030–00037)
-- Paste in Supabase Dashboard → SQL Editor → Run
-- Each row shows: migration name, status (✅ APPLIED / ❌ MISSING)
-- =============================================================================

SELECT
  migration,
  CASE WHEN applied THEN '✅ APPLIED' ELSE '❌ MISSING' END AS status
FROM (
  VALUES
    -- 00030: fleet_entry_date, fleet_entry_km, fleet_exit_km on vehicles
    ('00030_fleet_entry_exit_fields',
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'fleet_entry_date'
      )
    ),

    -- 00031: toll_road_permits, pascal_number, service_interval_km, etc. on vehicles
    ('00031_vehicle_permits_limits',
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'toll_road_permits'
      )
    ),

    -- 00032: unique index changed to (license_plate, contract_number)
    ('00032_vehicle_plate_contract_unique',
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'vehicles' AND indexname = 'vehicles_license_plate_active_key'
          AND indexdef LIKE '%contract_number%'
      )
    ),

    -- 00033: pm_is_employee, pm_name, sm_is_employee, sm_name on projects
    ('00033_pm_sm_free_text',
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'pm_is_employee'
      )
    ),

    -- 00034: vehicle_type 'other' + vehicle_type_note column
    ('00034_vehicle_type_other',
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'vehicle_type_note'
      )
    ),

    -- 00035: fuel_import_batches, fuel_records, vehicle_km_log tables
    ('00035_fuel_records',
      EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'fuel_import_batches'
      )
    ),

    -- 00036: fuel_records_enriched view + get_fuel_stats RPC + composite indexes
    ('00036_fuel_performance',
      EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'get_fuel_stats' AND pronamespace = 'public'::regnamespace
      )
    ),

    -- 00037: get_dashboard_stats RPC + admin composite indexes + vehicle_documents index
    ('00037_db_optimization',
      EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'get_dashboard_stats' AND pronamespace = 'public'::regnamespace
      )
    )

) AS checks(migration, applied)
ORDER BY migration;
