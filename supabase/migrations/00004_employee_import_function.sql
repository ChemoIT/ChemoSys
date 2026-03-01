-- 00004_employee_import_function.sql
--
-- Creates the upsert_employee() RPC function used by the Excel import flow.
--
-- WHY A FUNCTION (not PostgREST .upsert()):
--   The employees table has a PARTIAL unique index:
--     UNIQUE (employee_number, company_id) WHERE deleted_at IS NULL
--   PostgREST's .upsert() sends ON CONFLICT(employee_number, company_id) without
--   the WHERE predicate — Postgres returns error 42P10 (ambiguous constraint).
--   A SECURITY DEFINER function can reference the partial index directly.
--
-- USAGE:
--   Called per-row from importEmployeesAction (Server Action).
--   Returns the employee UUID so the caller can count inserts vs updates.

CREATE OR REPLACE FUNCTION public.upsert_employee(
  p_employee_number    TEXT,
  p_company_id         UUID,
  p_first_name         TEXT,
  p_last_name          TEXT,
  p_id_number          TEXT,
  p_gender             TEXT,
  p_street             TEXT,
  p_house_number       TEXT,
  p_city               TEXT,
  p_mobile_phone       TEXT,
  p_additional_phone   TEXT,
  p_email              TEXT,
  p_date_of_birth      DATE,
  p_start_date         DATE,
  p_end_date           DATE,
  p_department_id      UUID,
  p_sub_department_id  UUID,
  p_passport_number    TEXT,
  p_citizenship        TEXT,
  p_status             TEXT,
  p_imported_by        UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id UUID;
  v_is_update   BOOLEAN;
BEGIN
  -- Check whether a live (non-deleted) record already exists for this composite key.
  -- Used to distinguish INSERT vs UPDATE for the return value / caller counting.
  SELECT id INTO v_employee_id
    FROM employees
   WHERE employee_number = p_employee_number
     AND company_id      = p_company_id
     AND deleted_at      IS NULL;

  v_is_update := FOUND;

  INSERT INTO employees (
    employee_number,
    company_id,
    first_name,
    last_name,
    id_number,
    gender,
    street,
    house_number,
    city,
    mobile_phone,
    additional_phone,
    email,
    date_of_birth,
    start_date,
    end_date,
    department_id,
    sub_department_id,
    passport_number,
    citizenship,
    status,
    created_by,
    updated_by
  )
  VALUES (
    p_employee_number,
    p_company_id,
    p_first_name,
    p_last_name,
    p_id_number,
    p_gender,
    p_street,
    p_house_number,
    p_city,
    p_mobile_phone,
    p_additional_phone,
    p_email,
    p_date_of_birth,
    p_start_date,
    p_end_date,
    p_department_id,
    p_sub_department_id,
    p_passport_number,
    p_citizenship,
    p_status,
    p_imported_by,
    p_imported_by
  )
  ON CONFLICT (employee_number, company_id) WHERE deleted_at IS NULL
  DO UPDATE SET
    first_name         = EXCLUDED.first_name,
    last_name          = EXCLUDED.last_name,
    id_number          = EXCLUDED.id_number,
    gender             = EXCLUDED.gender,
    street             = EXCLUDED.street,
    house_number       = EXCLUDED.house_number,
    city               = EXCLUDED.city,
    mobile_phone       = EXCLUDED.mobile_phone,
    additional_phone   = EXCLUDED.additional_phone,
    email              = EXCLUDED.email,
    date_of_birth      = EXCLUDED.date_of_birth,
    start_date         = EXCLUDED.start_date,
    end_date           = EXCLUDED.end_date,
    department_id      = EXCLUDED.department_id,
    sub_department_id  = EXCLUDED.sub_department_id,
    passport_number    = EXCLUDED.passport_number,
    citizenship        = EXCLUDED.citizenship,
    status             = EXCLUDED.status,
    updated_by         = EXCLUDED.updated_by,
    updated_at         = NOW()
  RETURNING id INTO v_employee_id;

  RETURN v_employee_id;
END;
$$;

-- Grant execute to authenticated users so Supabase RPC calls work.
GRANT EXECUTE ON FUNCTION public.upsert_employee TO authenticated;
