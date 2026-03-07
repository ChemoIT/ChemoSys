-- =============================================================================
-- PRE-MIGRATION CHECK — run this in Supabase SQL Editor BEFORE running 00018/19/20
-- Shows what already exists so you know what's safe to run.
-- =============================================================================

-- 1) Check if fleet tables exist
SELECT 'TABLES' AS check_type, table_name, 'EXISTS' AS status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('drivers', 'driver_licenses', 'driver_document_names', 'driver_documents', 'driver_violations')
ORDER BY table_name;

-- 2) Check if alert_enabled column exists on driver_documents
SELECT 'COLUMN alert_enabled' AS check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'driver_documents' AND column_name = 'alert_enabled'
  ) THEN 'EXISTS' ELSE 'MISSING' END AS status;

-- 3) Check RLS policies on fleet tables
SELECT 'RLS POLICY' AS check_type, policyname AS name, tablename AS table_name
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('drivers', 'driver_licenses', 'driver_document_names', 'driver_documents', 'driver_violations')
ORDER BY tablename, policyname;

-- 4) Check storage policies for fleet buckets
SELECT 'STORAGE POLICY' AS check_type, policyname AS name
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE '%fleet%'
ORDER BY policyname;

-- 5) Check RPC functions
SELECT 'RPC FUNCTION' AS check_type, routine_name AS name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'increment_document_name_usage',
    'soft_delete_driver_document',
    'soft_delete_driver_violation',
    'update_driver_document',
    'update_driver_violation'
  )
ORDER BY routine_name;

-- 6) Check view
SELECT 'VIEW' AS check_type, table_name AS name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name = 'driver_computed_status';

-- 7) Check storage buckets
SELECT 'BUCKET' AS check_type, name, public AS is_public
FROM storage.buckets
WHERE name IN ('fleet-licenses', 'fleet-documents');
