-- 00030: Add fleet entry/exit tracking columns to vehicles table
-- Required for the new "חוזה" (Contract) tab — chronological fleet lifecycle fields.
-- fleet_entry_date + fleet_entry_km: when the vehicle entered the fleet
-- fleet_exit_km: mileage when vehicle left the fleet (fleet_exit_date already exists from 00027)

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS fleet_entry_date DATE,
  ADD COLUMN IF NOT EXISTS fleet_entry_km INT,
  ADD COLUMN IF NOT EXISTS fleet_exit_km INT;
