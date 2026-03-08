-- =============================================================================
-- Migration: 00034_vehicle_type_other.sql
-- Purpose:   Add 'other' option to vehicle_type CHECK constraint
--            + vehicle_type_note TEXT field (required when type='other').
--
-- Run via: Supabase Dashboard → SQL Editor
-- =============================================================================

-- 1. Drop existing CHECK constraint on vehicle_type
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_vehicle_type_check;

-- 2. Re-create with 'other' added
ALTER TABLE vehicles ADD CONSTRAINT vehicles_vehicle_type_check
  CHECK (vehicle_type IN ('private','commercial','truck','trailer','other'));

-- 3. Add note field for 'other' type
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS vehicle_type_note TEXT;
