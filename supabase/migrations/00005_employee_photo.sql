-- 00005_employee_photo.sql
-- Add photo_url column to employees table for employee profile pictures.
-- Photos are stored in Supabase Storage bucket 'employee-photos'.

ALTER TABLE employees ADD COLUMN photo_url TEXT;
