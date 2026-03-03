-- Migration 00010: Storage RLS policies for employee-photos bucket
--
-- Supabase Storage uses RLS on storage.objects.
-- Creating a bucket as "public" only controls anonymous *download* access.
-- Authenticated users still need explicit INSERT/SELECT/UPDATE/DELETE policies.
--
-- Run this in Supabase SQL Editor AFTER creating the employee-photos bucket.
-- If the bucket does not exist yet, create it first:
--   Storage → New Bucket → Name: employee-photos → Public: ON

-- Allow authenticated users to upload photos (INSERT)
CREATE POLICY "authenticated_upload_employee_photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'employee-photos');

-- Allow public (anyone) to view/download photos (SELECT)
-- Needed so photo_url links work in the browser without auth headers
CREATE POLICY "public_read_employee_photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'employee-photos');

-- Allow authenticated users to overwrite/update their uploads (UPDATE)
CREATE POLICY "authenticated_update_employee_photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'employee-photos');

-- Allow authenticated users to delete photos (DELETE)
CREATE POLICY "authenticated_delete_employee_photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'employee-photos');
