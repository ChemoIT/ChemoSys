-- =============================================================================
-- Migration: 00008_bulk_upsert_employees.sql
-- Phase:     02 — Employee Management
-- Purpose:   Bulk upsert function for Excel import — processes all rows in one
--            DB round-trip instead of one RPC call per row.
--
-- Performance: ~2600 rows in <5 seconds (vs ~10 minutes with per-row RPC).
--
-- Input:  p_rows JSONB[] — array of objects with employee fields
--         p_company_id UUID — company all rows belong to
--         p_imported_by UUID — user performing the import
--
-- Returns: TABLE(new_count INT, updated_count INT)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.bulk_upsert_employees(
  p_rows        JSONB,
  p_company_id  UUID,
  p_imported_by UUID
)
RETURNS TABLE(new_count INT, updated_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row          JSONB;
  v_new          INT := 0;
  v_updated      INT := 0;
  v_existing_id  UUID;
BEGIN
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    -- Check if employee already exists (non-deleted)
    SELECT id INTO v_existing_id
      FROM employees
     WHERE employee_number = v_row->>'employee_number'
       AND company_id      = p_company_id
       AND deleted_at      IS NULL;

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
      v_row->>'employee_number',
      p_company_id,
      v_row->>'first_name',
      v_row->>'last_name',
      v_row->>'id_number',
      v_row->>'gender',
      v_row->>'street',
      v_row->>'house_number',
      v_row->>'city',
      v_row->>'mobile_phone',
      v_row->>'additional_phone',
      v_row->>'email',
      (v_row->>'date_of_birth')::DATE,
      (v_row->>'start_date')::DATE,
      (v_row->>'end_date')::DATE,
      (v_row->>'department_id')::UUID,
      (v_row->>'sub_department_id')::UUID,
      v_row->>'passport_number',
      v_row->>'citizenship',
      v_row->>'status',
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
      updated_at         = NOW();

    IF v_existing_id IS NOT NULL THEN
      v_updated := v_updated + 1;
    ELSE
      v_new := v_new + 1;
    END IF;
  END LOOP;

  new_count     := v_new;
  updated_count := v_updated;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_upsert_employees TO authenticated;
