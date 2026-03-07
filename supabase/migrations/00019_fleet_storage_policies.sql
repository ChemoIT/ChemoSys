-- Migration 00019: Storage RLS policies for fleet-licenses and fleet-documents buckets
--
-- Supabase Storage uses RLS on storage.objects.
-- Creating a bucket as "private" (Public: OFF) means authenticated users
-- still need explicit INSERT/SELECT/UPDATE/DELETE policies.
--
-- Run this in Supabase SQL Editor AFTER creating the two buckets:
--   Storage → New Bucket → Name: fleet-licenses  → Public: OFF
--   Storage → New Bucket → Name: fleet-documents → Public: OFF

-- ─── fleet-licenses (license front/back images) ──────────────

CREATE POLICY "authenticated_insert_fleet_licenses"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'fleet-licenses');

CREATE POLICY "authenticated_select_fleet_licenses"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'fleet-licenses');

CREATE POLICY "authenticated_update_fleet_licenses"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'fleet-licenses');

CREATE POLICY "authenticated_delete_fleet_licenses"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'fleet-licenses');

-- ─── fleet-documents (driver docs + violations) ───────────────

CREATE POLICY "authenticated_insert_fleet_documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'fleet-documents');

CREATE POLICY "authenticated_select_fleet_documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'fleet-documents');

CREATE POLICY "authenticated_update_fleet_documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'fleet-documents');

CREATE POLICY "authenticated_delete_fleet_documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'fleet-documents');
