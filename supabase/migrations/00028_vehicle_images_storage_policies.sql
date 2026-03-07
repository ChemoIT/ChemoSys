-- =============================================================================
-- Migration: 00028_vehicle_images_storage_policies.sql
-- Purpose:   Storage policies for the 'vehicle-images' private bucket.
--            Allows authenticated users to INSERT, SELECT, UPDATE, DELETE
--            their vehicle images.
-- Depends on: 00027_vehicle_card_redesign (vehicle_images table)
-- Run in:    Supabase SQL Editor
-- Idempotent: YES — all policies use DROP POLICY IF EXISTS before CREATE
--
-- PREREQUISITE: Create the 'vehicle-images' bucket (Private) manually in
--   Supabase Dashboard → Storage → New Bucket → Name: vehicle-images,
--   Public: OFF → before running this migration.
--
-- Storage path pattern: {vehicle_id}/{position}.{ext}
--   e.g. "abc123.../1.jpg", "abc123.../2.png"
-- =============================================================================

-- ── INSERT — authenticated users may upload vehicle images ────────────────────
DROP POLICY IF EXISTS "authenticated_insert_vehicle_images" ON storage.objects;
CREATE POLICY "authenticated_insert_vehicle_images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vehicle-images');

-- ── SELECT — authenticated users may view/download vehicle images ─────────────
DROP POLICY IF EXISTS "authenticated_select_vehicle_images" ON storage.objects;
CREATE POLICY "authenticated_select_vehicle_images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vehicle-images');

-- ── UPDATE — authenticated users may replace vehicle images ──────────────────
DROP POLICY IF EXISTS "authenticated_update_vehicle_images" ON storage.objects;
CREATE POLICY "authenticated_update_vehicle_images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vehicle-images');

-- ── DELETE — authenticated users may remove vehicle images ───────────────────
DROP POLICY IF EXISTS "authenticated_delete_vehicle_images" ON storage.objects;
CREATE POLICY "authenticated_delete_vehicle_images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vehicle-images');
