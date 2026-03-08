-- 00032: Change vehicles unique index from (license_plate) to (license_plate, contract_number)
-- Required for CarList.top import: the same vehicle (plate) can re-enter the fleet
-- with a different contract number (e.g., rental vehicle returned and re-rented).
-- COALESCE handles NULL contract_number (company-owned vehicles with no contract).

DROP INDEX IF EXISTS vehicles_license_plate_active_key;

CREATE UNIQUE INDEX vehicles_license_plate_active_key
  ON public.vehicles (license_plate, COALESCE(contract_number, ''))
  WHERE deleted_at IS NULL;
