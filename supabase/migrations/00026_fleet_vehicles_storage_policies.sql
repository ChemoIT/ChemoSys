-- Migration: 00026_fleet_vehicles_storage_policies.sql
-- Purpose: Storage RLS policies for fleet-vehicle-documents bucket
-- PREREQUISITE: Create bucket "fleet-vehicle-documents" (Private) in Supabase Dashboard -> Storage BEFORE running this migration
-- Depends on: 00025_fleet_vehicles (tables that reference this bucket)

-- ─── fleet-vehicle-documents (vehicle tests, insurance, general docs) ──────────

DROP POLICY IF EXISTS "authenticated_insert_fleet_vehicle_documents" ON storage.objects;
CREATE POLICY "authenticated_insert_fleet_vehicle_documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'fleet-vehicle-documents');

DROP POLICY IF EXISTS "authenticated_select_fleet_vehicle_documents" ON storage.objects;
CREATE POLICY "authenticated_select_fleet_vehicle_documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'fleet-vehicle-documents');

DROP POLICY IF EXISTS "authenticated_update_fleet_vehicle_documents" ON storage.objects;
CREATE POLICY "authenticated_update_fleet_vehicle_documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'fleet-vehicle-documents');

DROP POLICY IF EXISTS "authenticated_delete_fleet_vehicle_documents" ON storage.objects;
CREATE POLICY "authenticated_delete_fleet_vehicle_documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'fleet-vehicle-documents');
