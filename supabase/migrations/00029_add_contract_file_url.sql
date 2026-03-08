-- 00029: Add contract_file_url column to vehicles table
-- The column contract_number was added in 00027 but contract_file_url was missed.
-- Required for Phase 18 ownership tab contract PDF upload.
-- Existing vehicles RLS policies cover all columns — no new policies needed.

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS contract_file_url TEXT;
