# Phase 16: Vehicle Card Redesign — DB Migration — Research

**Researched:** 2026-03-07
**Domain:** PostgreSQL / Supabase schema — ALTER TABLE, new tables, activity journal pattern, storage bucket
**Confidence:** HIGH (all patterns verified from existing codebase)

---

## Summary

Phase 16 is a pure-backend migration phase. It extends the existing vehicles schema (built in Phase 11 / migration 00025) to support the full Vehicle Card Redesign. This means the migration must use `ALTER TABLE` to add new columns to `vehicles` and `vehicle_suppliers`, and `CREATE TABLE` for 6 new tables.

**Critical discovery:** The existing `vehicles` table (00025) already has `vehicle_type` and `ownership_type` columns, but with **different CHECK constraint values** than what the redesign requires. Phase 16 must DROP the old constraints and ADD new ones — this is an `ALTER TABLE ... DROP CONSTRAINT / ADD CONSTRAINT` operation, not a simple `ADD COLUMN`. The existing `is_active BOOLEAN` column must coexist with the new `vehicle_status TEXT` column during transition (they serve different purposes now). The `vehicle_computed_status` VIEW in 00025 only uses `is_active` — it must be replaced to use `vehicle_status` instead.

The new tables follow two established patterns: (1) the standard fleet table pattern (soft-delete, RLS, SECURITY DEFINER RPCs, updated_at trigger) for `vehicle_images`, `vehicle_replacement_records`, `vehicle_fuel_cards`; and (2) the **Activity Journal pattern** for `vehicle_driver_journal`, `vehicle_project_journal`, `vehicle_monthly_costs` — these are date-ranged records with `start_date` / `end_date` where `end_date IS NULL` = currently active.

A new storage bucket `vehicle-images` (Private) is required, with 4 storage policies following the exact same pattern as `00026_fleet_vehicles_storage_policies.sql`.

**Primary recommendation:** One migration file (`00027_vehicle_card_redesign.sql`) + one storage policies file (`00028_vehicle_images_storage_policies.sql`). The migration must be idempotent: use `DROP CONSTRAINT IF EXISTS` before `ADD CONSTRAINT`, `ADD COLUMN IF NOT EXISTS` for all new columns, `CREATE TABLE IF NOT EXISTS` for new tables, and `CREATE OR REPLACE` for all RPCs and views.

---

## Standard Stack

### Core (no new libraries)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase PostgreSQL | existing | ALTER TABLE, new tables, RLS, RPCs | Already in use across all phases |
| Supabase Storage | existing | vehicle-images bucket | Already used for fleet-licenses, fleet-documents, fleet-vehicle-documents |
| Next.js Server Actions | existing | All mutations go through Server Actions | Project-wide security iron rule |

### No new npm packages required

This phase is 100% database migration + storage bucket configuration.

---

## Architecture Patterns

### Pattern 1: Migration File Numbering

The last migrations are `00025_fleet_vehicles.sql` and `00026_fleet_vehicles_storage_policies.sql`. Phase 16 introduces:

- `00027_vehicle_card_redesign.sql` — ALTER TABLE vehicles, ALTER TABLE vehicle_suppliers, 6 new tables, updated views, new RPCs
- `00028_vehicle_images_storage_policies.sql` — 4 storage policies for `vehicle-images` bucket

**Why two files:** Follows the established split between table/schema changes (odd file) and storage policies (even file). See: 00018+00019 (drivers), 00025+00026 (vehicles).

### Pattern 2: ALTER TABLE for Existing vehicles Columns

The `vehicles` table already has `vehicle_type` and `ownership_type` columns with CHECK constraints that use different enum values than what Phase 16 requires.

**Existing (00025):**
```sql
vehicle_type TEXT CHECK (vehicle_type IN ('private','minibus','light_commercial','heavy','forklift','equipment','other'))
ownership_type TEXT CHECK (ownership_type IN ('company_owned','leased','rented','employee_owned'))
```

**Required (Phase 16 requirements):**
```sql
-- vehicle_type: פרטי/מסחרי/משאית/ניגרר (4 English values)
vehicle_type TEXT CHECK (vehicle_type IN ('private','commercial','truck','trailer'))

-- ownership_type: company/rental/operational_leasing/mini_leasing
ownership_type TEXT CHECK (ownership_type IN ('company','rental','operational_leasing','mini_leasing'))
```

**Migration approach (idempotent):**
```sql
-- Source: PostgreSQL ALTER TABLE documentation
-- Drop old constraints by name first, then add new ones
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_vehicle_type_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_vehicle_type_check
  CHECK (vehicle_type IN ('private','commercial','truck','trailer'));

ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_ownership_type_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_ownership_type_check
  CHECK (ownership_type IN ('company','rental','operational_leasing','mini_leasing'));
```

**CRITICAL:** PostgreSQL auto-names CHECK constraints as `{tablename}_{columnname}_check`. Must verify actual constraint names in Supabase dashboard before running. The `DROP CONSTRAINT IF EXISTS` makes this safe even if names differ.

### Pattern 3: ADD COLUMN IF NOT EXISTS (idempotent)

All new columns must use `ADD COLUMN IF NOT EXISTS` to prevent errors on re-run:

```sql
-- Source: PostgreSQL 9.6+ syntax (verified against project codebase pattern)
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS vehicle_status TEXT DEFAULT 'active'
    CHECK (vehicle_status IN ('active','suspended','returned','sold','decommissioned')),
  ADD COLUMN IF NOT EXISTS fleet_exit_date DATE,
  ADD COLUMN IF NOT EXISTS vehicle_category TEXT
    CHECK (vehicle_category IN ('camp','assigned')),
  ADD COLUMN IF NOT EXISTS camp_responsible_type TEXT
    CHECK (camp_responsible_type IN ('project_manager','other')),
  ADD COLUMN IF NOT EXISTS camp_responsible_name TEXT,
  ADD COLUMN IF NOT EXISTS camp_responsible_phone TEXT,
  ADD COLUMN IF NOT EXISTS ownership_supplier_id UUID
    REFERENCES public.vehicle_suppliers(id),
  ADD COLUMN IF NOT EXISTS contract_number TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_group INT
    CHECK (vehicle_group BETWEEN 1 AND 7);
```

**Note on vehicle_status vs is_active:** The existing `is_active BOOLEAN DEFAULT TRUE` column stays. The new `vehicle_status` column replaces it semantically. The `vehicle_computed_status` view must be updated to use `vehicle_status` as the primary status indicator. `is_active` can be deprecated but NOT dropped (data exists, FK-used in `driver_computed_status` view).

### Pattern 4: ALTER TABLE vehicle_suppliers — Add 'ownership' Type

The existing `vehicle_suppliers.supplier_type` CHECK constraint allows: `'leasing','insurance','fuel_card','garage','other'`. Phase 16 adds `'ownership'`.

```sql
-- Drop old constraint, add new one with additional value
ALTER TABLE public.vehicle_suppliers DROP CONSTRAINT IF EXISTS vehicle_suppliers_supplier_type_check;
ALTER TABLE public.vehicle_suppliers ADD CONSTRAINT vehicle_suppliers_supplier_type_check
  CHECK (supplier_type IN ('leasing','insurance','fuel_card','garage','other','ownership'));
```

### Pattern 5: New Tables — Standard Fleet Pattern

New tables `vehicle_images`, `vehicle_replacement_records`, `vehicle_fuel_cards` follow the exact pattern from `00025_fleet_vehicles.sql`:

```sql
-- Source: 00025_fleet_vehicles.sql (verified from codebase)
CREATE TABLE IF NOT EXISTS public.vehicle_images (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id   UUID        NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  storage_path TEXT        NOT NULL,
  position     INT         NOT NULL CHECK (position BETWEEN 1 AND 5),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID        REFERENCES auth.users(id)
  -- No soft-delete: images are hard-deleted when removed
  -- No updated_at: images are replace-not-update
);

-- Unique constraint: one image per position per vehicle
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_images_vehicle_position_key
  ON public.vehicle_images (vehicle_id, position);
```

```sql
CREATE TABLE IF NOT EXISTS public.vehicle_replacement_records (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id     UUID        NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  license_plate  TEXT        NOT NULL,
  mot_data       JSONB,                    -- raw MOT API response
  entry_date     DATE        NOT NULL,
  entry_km       INT,
  return_date    DATE,
  return_km      INT,
  reason         TEXT        NOT NULL CHECK (reason IN ('maintenance','test','accident','other')),
  reason_other   TEXT,                     -- required if reason = 'other'
  status         TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','returned')),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     UUID        REFERENCES auth.users(id),
  updated_by     UUID        REFERENCES auth.users(id),
  deleted_at     TIMESTAMPTZ DEFAULT NULL  -- soft delete
);
```

```sql
CREATE TABLE IF NOT EXISTS public.vehicle_fuel_cards (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  replacement_record_id UUID        NOT NULL REFERENCES public.vehicle_replacement_records(id) ON DELETE CASCADE,
  card_number           TEXT        NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID        REFERENCES auth.users(id)
  -- No soft-delete: cards are hard-deleted when removed from a replacement record
);
```

### Pattern 6: Activity Journal Tables

The Activity Journal pattern (יומן פעילות) is used for date-ranged records. Key rules:
- `end_date IS NULL` = currently active record
- Business rule: only ONE active record per (vehicle_id, entity) at a time — enforced in Server Actions (NOT in DB constraints, following project pattern)
- No soft-delete on journal tables — records are historical facts

```sql
-- Source: requirements doc + project journal pattern (verified from codebase design)
CREATE TABLE IF NOT EXISTS public.vehicle_driver_journal (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  UUID  NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id   UUID  NOT NULL REFERENCES public.drivers(id),
  start_date  DATE  NOT NULL,
  end_date    DATE,                       -- NULL = currently active
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID  REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.vehicle_project_journal (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  UUID  NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  project_id  UUID  NOT NULL REFERENCES public.projects(id),
  start_date  DATE  NOT NULL,
  end_date    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID  REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.vehicle_monthly_costs (
  id          UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  UUID     NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  start_date  DATE     NOT NULL,
  end_date    DATE,
  amount      NUMERIC  NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID     REFERENCES auth.users(id),
  updated_by  UUID     REFERENCES auth.users(id)
  -- No soft-delete: cost history is permanent
);
```

**Index for journal queries:**
```sql
-- Fast lookup: current active record for a vehicle
CREATE INDEX IF NOT EXISTS vehicle_driver_journal_vehicle_active_idx
  ON public.vehicle_driver_journal (vehicle_id)
  WHERE end_date IS NULL;

CREATE INDEX IF NOT EXISTS vehicle_project_journal_vehicle_active_idx
  ON public.vehicle_project_journal (vehicle_id)
  WHERE end_date IS NULL;
```

### Pattern 7: Updated vehicle_computed_status View

The existing view in 00025 uses `is_active`. Phase 16 must update it to use `vehicle_status`:

```sql
-- Source: 00025_fleet_vehicles.sql — replace with vehicle_status logic
-- security_invoker = true is MANDATORY (from 00023_fix_view_security.sql lesson)
CREATE OR REPLACE VIEW public.vehicle_computed_status
  WITH (security_invoker = true)
AS
SELECT
  v.id,
  CASE
    WHEN v.deleted_at IS NOT NULL                              THEN 'inactive'
    WHEN v.vehicle_status IN ('returned','sold','decommissioned') THEN 'inactive'
    WHEN v.vehicle_status = 'suspended'                        THEN 'suspended'
    ELSE                                                            'active'
  END AS computed_status
FROM public.vehicles v;
```

**Note:** The `driver_computed_status` view also references `vehicles` (via `assigned_driver_id`). It uses `v.is_active = TRUE` and `v.deleted_at IS NULL`. This view should be updated to also check `v.vehicle_status NOT IN ('returned','sold','decommissioned')`.

### Pattern 8: Soft-Delete RPCs for New Tables

Following the mandatory pattern from the project:

```sql
-- Source: 00025_fleet_vehicles.sql soft_delete_vehicle pattern (verified from codebase)
CREATE OR REPLACE FUNCTION public.soft_delete_vehicle_replacement_record(p_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.vehicle_replacement_records
  SET deleted_at = NOW(),
      updated_at = NOW(),
      updated_by = p_user_id
  WHERE id = p_id
    AND deleted_at IS NULL;
  RETURN FOUND;
END;
$$;
```

### Pattern 9: RLS Policies for New Tables

All new soft-deletable tables follow the same 3-policy pattern (no DELETE policy):

```sql
-- Source: 00025_fleet_vehicles.sql RLS pattern (verified from codebase)
ALTER TABLE public.vehicle_replacement_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicle_replacement_records_select" ON public.vehicle_replacement_records;
CREATE POLICY "vehicle_replacement_records_select"
  ON public.vehicle_replacement_records FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "vehicle_replacement_records_insert" ON public.vehicle_replacement_records;
CREATE POLICY "vehicle_replacement_records_insert"
  ON public.vehicle_replacement_records FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "vehicle_replacement_records_update" ON public.vehicle_replacement_records;
CREATE POLICY "vehicle_replacement_records_update"
  ON public.vehicle_replacement_records FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
```

For tables WITHOUT soft-delete (vehicle_images, vehicle_fuel_cards, journal tables), use `USING (true)` on SELECT:

```sql
-- vehicle_images: no soft-delete, full SELECT access
CREATE POLICY "vehicle_images_select" ON public.vehicle_images
  FOR SELECT TO authenticated USING (true);
```

### Pattern 10: Storage Bucket — vehicle-images

New private bucket `vehicle-images` for vehicle photos (up to 5 per vehicle). Storage path pattern: `{vehicle_id}/{position}.{ext}`.

```sql
-- Source: 00026_fleet_vehicles_storage_policies.sql (verified from codebase)
-- In 00028_vehicle_images_storage_policies.sql:
DROP POLICY IF EXISTS "authenticated_insert_vehicle_images" ON storage.objects;
CREATE POLICY "authenticated_insert_vehicle_images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vehicle-images');

DROP POLICY IF EXISTS "authenticated_select_vehicle_images" ON storage.objects;
CREATE POLICY "authenticated_select_vehicle_images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vehicle-images');

DROP POLICY IF EXISTS "authenticated_update_vehicle_images" ON storage.objects;
CREATE POLICY "authenticated_update_vehicle_images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vehicle-images');

DROP POLICY IF EXISTS "authenticated_delete_vehicle_images" ON storage.objects;
CREATE POLICY "authenticated_delete_vehicle_images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vehicle-images');
```

**MANDATORY:** Bucket must be created manually in Supabase Dashboard → Storage BEFORE running 00028.

### Anti-Patterns to Avoid

- **Dropping and recreating existing tables:** Do NOT drop `vehicles` or `vehicle_suppliers`. They have data. Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` and `DROP CONSTRAINT IF EXISTS ... ADD CONSTRAINT`.
- **Adding NOT NULL columns without DEFAULT:** Existing rows will fail. All new columns must be nullable OR have a DEFAULT.
- **Adding `vehicle_status` without DEFAULT:** Existing vehicles would have NULL status. Always: `ADD COLUMN IF NOT EXISTS vehicle_status TEXT DEFAULT 'active'`.
- **Forgetting to update driver_computed_status view:** The view references `v.is_active`. After Phase 16, it should also check `vehicle_status` for the "assigned vehicle = driver active" condition.
- **Hard-coding constraint names in DROP CONSTRAINT:** PostgreSQL auto-generates constraint names like `vehicles_vehicle_type_check`. Use `IF EXISTS` to be safe.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Soft delete for new tables | Custom UPDATE in Server Action | SECURITY DEFINER RPC | PostgREST + RLS SELECT USING(deleted_at IS NULL) blocks direct UPDATE |
| Activity journal "close current record" | Complex UPDATE logic in migration | Simple Server Action: UPDATE SET end_date = NOW() WHERE end_date IS NULL | Business logic belongs in Server Actions, not DB triggers |
| Image position management | Custom trigger to enforce 5-image limit | Unique index on (vehicle_id, position) + Server Action validation | Simpler, no trigger complexity |
| CHECK constraint rename | Custom migration process | DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT | PostgreSQL standard pattern |
| vehicle_status auto-transitions | DB triggers | Server Action logic | Follows project pattern (no business logic in DB triggers) |

---

## Common Pitfalls

### Pitfall 1: Existing CHECK Constraint Conflict on vehicles.vehicle_type

**What goes wrong:** Phase 16 adds `vehicle_type IN ('private','commercial','truck','trailer')` but 00025 already has `vehicle_type IN ('private','minibus','light_commercial','heavy','forklift','equipment','other')`. Running `ADD COLUMN IF NOT EXISTS` won't conflict (column exists), but any existing data with old enum values will violate the new CHECK constraint.

**Why it happens:** The vehicles table was built in Phase 11 with different enum values than what Phase 16 requires.

**How to avoid:**
1. Before dropping old constraint: `UPDATE public.vehicles SET vehicle_type = NULL WHERE vehicle_type NOT IN ('private','commercial','truck','trailer');` — clear any incompatible values
2. Then: `DROP CONSTRAINT IF EXISTS vehicles_vehicle_type_check;`
3. Then: `ADD CONSTRAINT vehicles_vehicle_type_check CHECK (vehicle_type IN ('private','commercial','truck','trailer'));`

**Warning signs:** Migration fails with "violates check constraint" error.

### Pitfall 2: ADD COLUMN with NOT NULL Without DEFAULT

**What goes wrong:** `ALTER TABLE vehicles ADD COLUMN vehicle_status TEXT NOT NULL` fails if any existing rows exist.

**Why it happens:** PostgreSQL cannot add a NOT NULL column without a DEFAULT to a table with existing data.

**How to avoid:** Always: `ADD COLUMN IF NOT EXISTS vehicle_status TEXT DEFAULT 'active' CHECK (...)`. The DEFAULT fills existing rows.

### Pitfall 3: Missing Bucket Creation Before Storage Migration

**What goes wrong:** Migration 00028 runs and creates storage policies for `vehicle-images`, but the bucket was never created → all uploads return `Bucket not found` errors.

**How to avoid:** Document clearly in 00028 header comment: "PREREQUISITE: Create bucket 'vehicle-images' (Private) in Supabase Dashboard → Storage BEFORE running this migration."

**Source:** Established pattern in 00026_fleet_vehicles_storage_policies.sql.

### Pitfall 4: vehicle_computed_status View Not Updated

**What goes wrong:** The existing view in 00025 uses `is_active = FALSE` to determine inactive status. After Phase 16 adds `vehicle_status`, the view still uses only `is_active`. Vehicles with `vehicle_status = 'returned'` still show as `active` in the view.

**How to avoid:** Include `CREATE OR REPLACE VIEW public.vehicle_computed_status` in 00027 that uses `vehicle_status` as the primary status check. This is a `CREATE OR REPLACE` — safe to run without dropping the view.

### Pitfall 5: driver_computed_status View References is_active

**What goes wrong:** The `driver_computed_status` view (updated in 00025) checks `veh.is_active = TRUE` to determine if a driver is active via vehicle assignment. After Phase 16, a vehicle can be `is_active = TRUE` but `vehicle_status = 'returned'` — the driver would incorrectly show as active.

**How to avoid:** Update `driver_computed_status` in 00027 to also filter `veh.vehicle_status NOT IN ('returned','sold','decommissioned')` in the subquery.

### Pitfall 6: Unique Position Index for vehicle_images

**What goes wrong:** Without a unique index, multiple images can have `position = 1` for the same vehicle, causing undefined behavior in the gallery UI.

**How to avoid:** `CREATE UNIQUE INDEX IF NOT EXISTS vehicle_images_vehicle_position_key ON public.vehicle_images (vehicle_id, position);`

### Pitfall 7: ownership_supplier_id Without Supplier Type Guard

**What goes wrong:** A supplier of type `'garage'` could be selected as the `ownership_supplier_id` on a vehicle, when only `'ownership'` type suppliers should be allowed there.

**Why it happens:** The FK `ownership_supplier_id REFERENCES vehicle_suppliers(id)` doesn't check supplier_type.

**How to avoid:** This validation belongs in the Server Action / UI filter (only show `supplier_type = 'ownership'` in the dropdown). No DB-level enforcement needed — matches project pattern (business logic in Server Actions).

### Pitfall 8: replacement_record `reason_other` Not Validated

**What goes wrong:** A replacement record with `reason = 'other'` can be saved without `reason_other` text.

**How to avoid:** Validation in Server Action — if `reason = 'other'` AND `reason_other IS NULL OR reason_other = ''` → return validation error. Pattern: same as existing form validations in the project.

---

## Code Examples

### Full column additions for vehicles table (idempotent)

```sql
-- Source: PostgreSQL ALTER TABLE pattern + project migration conventions
-- Safe to run multiple times: ADD COLUMN IF NOT EXISTS + DROP CONSTRAINT IF EXISTS

-- Step 1: Clear incompatible vehicle_type values before constraint change
UPDATE public.vehicles
SET vehicle_type = NULL
WHERE vehicle_type NOT IN ('private','commercial','truck','trailer')
  AND vehicle_type IS NOT NULL;

-- Step 2: Update ownership_type values
UPDATE public.vehicles
SET ownership_type = NULL
WHERE ownership_type NOT IN ('company','rental','operational_leasing','mini_leasing')
  AND ownership_type IS NOT NULL;

-- Step 3: Drop old CHECK constraints
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_vehicle_type_check;
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_ownership_type_check;

-- Step 4: Add new columns (all nullable or with defaults)
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS vehicle_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS fleet_exit_date DATE,
  ADD COLUMN IF NOT EXISTS vehicle_category TEXT,
  ADD COLUMN IF NOT EXISTS camp_responsible_type TEXT,
  ADD COLUMN IF NOT EXISTS camp_responsible_name TEXT,
  ADD COLUMN IF NOT EXISTS camp_responsible_phone TEXT,
  ADD COLUMN IF NOT EXISTS ownership_supplier_id UUID REFERENCES public.vehicle_suppliers(id),
  ADD COLUMN IF NOT EXISTS contract_number TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_group INT;

-- Step 5: Add new constraints
ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_vehicle_type_check
    CHECK (vehicle_type IN ('private','commercial','truck','trailer')),
  ADD CONSTRAINT vehicles_ownership_type_check
    CHECK (ownership_type IN ('company','rental','operational_leasing','mini_leasing')),
  ADD CONSTRAINT vehicles_vehicle_status_check
    CHECK (vehicle_status IN ('active','suspended','returned','sold','decommissioned')),
  ADD CONSTRAINT vehicles_vehicle_category_check
    CHECK (vehicle_category IN ('camp','assigned')),
  ADD CONSTRAINT vehicles_camp_responsible_type_check
    CHECK (camp_responsible_type IN ('project_manager','other')),
  ADD CONSTRAINT vehicles_vehicle_group_check
    CHECK (vehicle_group BETWEEN 1 AND 7);
```

### vehicle_suppliers — add ownership type

```sql
ALTER TABLE public.vehicle_suppliers DROP CONSTRAINT IF EXISTS vehicle_suppliers_supplier_type_check;
ALTER TABLE public.vehicle_suppliers ADD CONSTRAINT vehicle_suppliers_supplier_type_check
  CHECK (supplier_type IN ('leasing','insurance','fuel_card','garage','other','ownership'));
```

### Activity journal — close current and open new

```typescript
// Source: Project Server Action pattern (verified from src/actions/fleet/drivers.ts)
// In src/actions/fleet/vehicles.ts:
export async function assignDriverToVehicle(vehicleId: string, driverId: string, startDate: string) {
  const user = await verifyAppUser()
  const supabase = await createClient()

  // 1. Close current active record
  await supabase
    .from('vehicle_driver_journal')
    .update({ end_date: startDate })
    .eq('vehicle_id', vehicleId)
    .is('end_date', null)

  // 2. Open new record
  await supabase
    .from('vehicle_driver_journal')
    .insert({
      vehicle_id: vehicleId,
      driver_id: driverId,
      start_date: startDate,
      end_date: null,
      created_by: user.authUserId,
    })
}
```

---

## Schema Conflict Analysis

This table documents all conflicts between the existing 00025 schema and Phase 16 requirements:

| Column | Current (00025) | Required (Phase 16) | Action |
|--------|----------------|---------------------|--------|
| `vehicles.vehicle_type` CHECK | `'private','minibus','light_commercial','heavy','forklift','equipment','other'` | `'private','commercial','truck','trailer'` | DROP old constraint + UPDATE NULL incompatible + ADD new constraint |
| `vehicles.ownership_type` CHECK | `'company_owned','leased','rented','employee_owned'` | `'company','rental','operational_leasing','mini_leasing'` | Same pattern |
| `vehicles.is_active` | EXISTS as primary status | Stays, but `vehicle_status` becomes primary | Keep column, update view to use `vehicle_status` |
| `vehicle_suppliers.supplier_type` CHECK | `'leasing','insurance','fuel_card','garage','other'` | Add `'ownership'` | DROP + ADD with extended list |
| `vehicle_computed_status` VIEW | Uses `is_active = FALSE` | Must use `vehicle_status IN (...)` | `CREATE OR REPLACE VIEW` |
| `driver_computed_status` VIEW | Checks `veh.is_active = TRUE` | Must also check `veh.vehicle_status` | `CREATE OR REPLACE VIEW` |

---

## Migration File Structure

### 00027_vehicle_card_redesign.sql

```
Section 1: ALTER TABLE vehicles
  - UPDATE to clear incompatible vehicle_type values
  - UPDATE to clear incompatible ownership_type values
  - DROP old CHECK constraints
  - ADD COLUMN IF NOT EXISTS for all new fields
  - ADD new CHECK constraints

Section 2: ALTER TABLE vehicle_suppliers
  - DROP old supplier_type CHECK constraint
  - ADD new supplier_type CHECK constraint (adds 'ownership')

Section 3: CREATE TABLE vehicle_images
  - Table definition
  - UNIQUE INDEX on (vehicle_id, position)
  - updated_at trigger (NOT needed — no updated_at column)
  - RLS policies (3: select/insert/update — no soft-delete)

Section 4: CREATE TABLE vehicle_replacement_records
  - Table definition
  - Indexes
  - updated_at trigger
  - RLS policies (3: select/insert/update)
  - soft_delete_vehicle_replacement_record RPC

Section 5: CREATE TABLE vehicle_fuel_cards
  - Table definition
  - Index on replacement_record_id
  - RLS policies (3: select/insert/delete — hard-delete allowed)

Section 6: CREATE TABLE vehicle_driver_journal
  - Table definition
  - Partial index WHERE end_date IS NULL
  - RLS policies (3: select/insert/update)

Section 7: CREATE TABLE vehicle_project_journal
  - Table definition
  - Partial index WHERE end_date IS NULL
  - RLS policies (3: select/insert/update)

Section 8: CREATE TABLE vehicle_monthly_costs
  - Table definition
  - updated_at trigger
  - RLS policies (3: select/insert/update)

Section 9: UPDATE VIEWS
  - CREATE OR REPLACE VIEW vehicle_computed_status (use vehicle_status)
  - CREATE OR REPLACE VIEW driver_computed_status (update vehicle filter)
```

### 00028_vehicle_images_storage_policies.sql

```
-- PREREQUISITE: Create bucket 'vehicle-images' (Private) in Supabase Dashboard → Storage

4 storage policies:
  - authenticated_insert_vehicle_images
  - authenticated_select_vehicle_images
  - authenticated_update_vehicle_images
  - authenticated_delete_vehicle_images
```

---

## Open Questions

1. **vehicle_type enum values for Hebrew UI**
   - What we know: Requirements say "פרטי/מסחרי/משאית/ניגרר" (4 values)
   - What's unclear: Do `'forklift'` and `'equipment'` types still exist (from old schema) or are they removed?
   - Recommendation: Replace with the 4 new values only. Forklifts/equipment belong to the equipment module (צמ"ה), not the vehicle fleet.

2. **vehicle_replacement_records — ownership_supplier_id FK needed?**
   - What we know: The replacement vehicle has a `license_plate` and `mot_data JSONB`
   - What's unclear: Does the replacement record need an `ownership_supplier_id` or `contract_number` for the replacement vehicle?
   - Recommendation: No — the replacement record is about tracking the temporary vehicle, not its ownership. Keep minimal per requirements.

3. **vehicle_monthly_costs — is it truly "monthly" or date-range?**
   - What we know: Requirements say `start_date, end_date, amount NUMERIC` with activity journal pattern
   - What's unclear: Does a monthly cost record need a `cost_type` (e.g., leasing fee vs. fuel)?
   - Recommendation: Keep simple per requirements. If cost types are needed, add in a future phase.

4. **vehicle_images: hard delete vs soft delete?**
   - What we know: Requirements say "עריכה ומחיקה של כל תמונה" (edit and delete each photo)
   - What's unclear: Does Sharon want a delete history for images?
   - Recommendation: Hard delete for images (no `deleted_at`). Images are binary assets — storage deletion is the "real" delete. DB row deletion is safe. Pattern: `vehicle_fuel_cards` (same approach).

5. **Existing vehicle data: how many rows currently exist?**
   - What we know: Migration 00025 ran, vehicles table exists with live data
   - What's unclear: Are there existing vehicles with `vehicle_type` or `ownership_type` values that will be nullified by the constraint change?
   - Recommendation: Before running 00027, check: `SELECT vehicle_type, COUNT(*) FROM vehicles WHERE deleted_at IS NULL GROUP BY vehicle_type;` — document findings before running migration.

---

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/00025_fleet_vehicles.sql` — existing vehicles schema, CHECK constraint names, RLS pattern, RPC pattern (verified from codebase)
- `supabase/migrations/00026_fleet_vehicles_storage_policies.sql` — storage policy pattern (verified from codebase)
- `supabase/migrations/00018_fleet_drivers.sql` — table pattern, trigger pattern (verified from codebase)
- `supabase/migrations/00020_fleet_soft_delete_rpc.sql` — soft-delete RPC pattern (verified from codebase)
- `.planning/vehicle-card-redesign-requirements.md` — Phase 16 requirements (authoritative source)
- `.planning/phases/11-phase-10a-vehicle-card-database-storage-vehicle-suppliers-tables/11-RESEARCH.md` — prior research with established patterns

### Secondary (MEDIUM confidence)
- PostgreSQL ALTER TABLE documentation — ADD COLUMN IF NOT EXISTS, DROP CONSTRAINT IF EXISTS syntax

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Migration approach (ALTER vs CREATE): HIGH — verified against existing schema in 00025
- Schema conflict analysis: HIGH — directly compared 00025 vs requirements
- Activity journal pattern: HIGH — described in requirements, consistent with project architecture
- RLS/RPC patterns: HIGH — verbatim from existing migrations
- Storage bucket pattern: HIGH — verbatim from 00026

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (schema patterns are stable; re-verify if additional migrations run before Phase 16 executes)
