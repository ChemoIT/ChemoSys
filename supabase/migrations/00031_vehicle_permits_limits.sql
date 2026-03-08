-- 00031: Add permits & limits columns to vehicles table
-- Required for the new "אשרות והגבלים" (Permits & Limits) tab in the vehicle card.
--
-- Right column fields:
--   toll_road_permits TEXT[]  — multi-select: kvish6 / hotzefon / carmel / nativ
--   weekend_holiday_permit BOOLEAN — on/off switch
--   pascal_number TEXT — digits-only identifier
--
-- Left column fields:
--   service_interval_km INT — maintenance interval in km
--   service_interval_alert BOOLEAN — enable/disable alert
--   annual_km_limit INT — yearly km cap
--   annual_km_limit_alert BOOLEAN — enable/disable alert
--   monthly_fuel_limit_liters INT — monthly fuel cap in liters
--   monthly_fuel_limit_alert BOOLEAN — enable/disable alert

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS toll_road_permits TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS weekend_holiday_permit BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pascal_number TEXT,
  ADD COLUMN IF NOT EXISTS service_interval_km INT,
  ADD COLUMN IF NOT EXISTS service_interval_alert BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS annual_km_limit INT,
  ADD COLUMN IF NOT EXISTS annual_km_limit_alert BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS monthly_fuel_limit_liters INT,
  ADD COLUMN IF NOT EXISTS monthly_fuel_limit_alert BOOLEAN DEFAULT FALSE;
