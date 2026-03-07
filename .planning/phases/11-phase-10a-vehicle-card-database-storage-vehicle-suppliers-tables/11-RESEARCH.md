# Phase 11: Phase 10A — Vehicle Card Database + Storage + Vehicle Suppliers tables — Research

**Researched:** 2026-03-07
**Domain:** PostgreSQL / Supabase schema design — Israeli fleet management vehicle database
**Confidence:** HIGH (patterns from existing codebase) / MEDIUM (Israeli vehicle domain knowledge)

---

## Summary

This phase is a pure backend phase — no UI whatsoever. The goal is to design and migrate all database tables, storage buckets, and RLS policies required for the Vehicle Card module. The UI for the vehicle card is built in later phases (13, 14, 15). This phase also introduces a `vehicle_suppliers` lookup table, which is a new concept not present in the driver card module.

The most important architectural decision in this phase is the schema for the `vehicles` table. This table must support: (1) data imported from the Israeli Ministry of Transport open API (`data.gov.il`), which has 24 known fields and is integrated in Phase 12; (2) company-specific operational data not in the MOT API (owner, assignment, insurance, costs); and (3) soft-delete patterns identical to the existing `drivers` table.

The `vehicle_suppliers` table is a general-purpose lookup table for any external service provider — garages, leasing companies, insurance companies, fuel card providers. It should be simple and not over-engineered in this phase since the UI for managing it is Phase 12.

**Primary recommendation:** Model `vehicles` to mirror the driver card's patterns exactly (soft-delete RPC, SECURITY DEFINER, RLS with `deleted_at IS NULL` on SELECT, computed status view). Separate MOT-sourced read-only fields from operational editable fields using column comments. Design `vehicle_suppliers` as a simple lookup with a `supplier_type` enum.

---

## Standard Stack

### Core (no new libraries needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase PostgreSQL | existing | All tables, RLS, RPCs | Already in use across all phases |
| Supabase Storage | existing | Vehicle documents, photos, insurance | Already used for fleet-licenses/fleet-documents |
| Next.js Server Actions | existing | All mutations go through Server Actions | Project-wide security rule |

### No new npm packages required for this phase

This phase is 100% database migration + storage bucket configuration. No new frontend or backend libraries are needed.

---

## Architecture Patterns

### Pattern 1: Migration File Numbering

The last migration is `00024_employee_locked_fields.sql`. This phase introduces:

- `00025_fleet_vehicles.sql` — vehicles, vehicle_documents, vehicle_document_names, vehicle_tests, vehicle_suppliers tables + computed status view
- `00026_fleet_vehicles_storage_policies.sql` — storage policies for new buckets

**Why two files:** Following the established split between table creation (00018) and storage policies (00019).

### Pattern 2: Soft-Delete RPC (MANDATORY)

**CRITICAL LESSON FROM DRIVER CARD:** Direct `UPDATE` of `deleted_at` via PostgREST fails because the SELECT policy `USING (deleted_at IS NULL)` prevents the UPDATE from seeing the already-deleted row. All soft-deletes MUST use `SECURITY DEFINER` RPCs.

```sql
-- Source: supabase/migrations/00022_soft_delete_driver_rpc.sql (verified from codebase)
CREATE OR REPLACE FUNCTION soft_delete_vehicle(p_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE vehicles
  SET deleted_at = NOW(),
      updated_at = NOW(),
      updated_by = p_user_id
  WHERE id = p_id
    AND deleted_at IS NULL;
  RETURN FOUND;
END;
$$;
```

### Pattern 3: Computed Status View

The driver card has `driver_computed_status` view. The vehicle card needs an analogous `vehicle_computed_status`. The vehicle status logic is:
- `inactive` if `deleted_at IS NOT NULL`
- `inactive` if `is_active = FALSE` (manually deactivated)
- `active` otherwise

Note: In the driver module, the view has a `TODO Phase 10` comment for `assigned_vehicle`. That comment becomes relevant here — once vehicles exist, the `driver_computed_status` view should be updated to set a driver as `active` when they have an assigned vehicle. **This is an important cross-table dependency to document.**

```sql
-- Source: Pattern from supabase/migrations/00023_fix_view_security.sql (verified)
-- Views must use SECURITY INVOKER (not SECURITY DEFINER) to respect RLS
CREATE OR REPLACE VIEW public.vehicle_computed_status
WITH (security_invoker = true) AS
SELECT
  v.id,
  CASE
    WHEN v.deleted_at IS NOT NULL THEN 'inactive'
    WHEN v.is_active = FALSE       THEN 'inactive'
    ELSE 'active'
  END AS computed_status
FROM public.vehicles v;
```

### Pattern 4: RLS Policies

All tables follow the same pattern established in `00018_fleet_drivers.sql`:
- `SELECT`: `USING (deleted_at IS NULL)` for soft-deletable tables, `USING (true)` for lookup tables
- `INSERT`: `WITH CHECK (true)` for authenticated users
- `UPDATE`: `USING (true) WITH CHECK (true)` — allows soft-delete updates
- No DELETE policy needed (soft-delete only)

### Pattern 5: Autocomplete Names Table

The driver module has `driver_document_names` with `usage_count` for autocomplete. This pattern should be replicated for `vehicle_document_names`. The RPC `increment_document_name_usage` should be mirrored as `increment_vehicle_document_name_usage`.

---

## Proposed Table Schema

### Table: `vehicles`

The core vehicle record. Columns are grouped into: identity (from MOT API), operational (company-specific), and audit/soft-delete.

```sql
CREATE TABLE IF NOT EXISTS public.vehicles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Identity (MOT API fields — data.gov.il resource 053cea08) ──────────────
  -- These fields map directly to the Israeli government vehicle dataset.
  -- They are populated by MOT API lookup in Phase 12, then read-only in UI.
  license_plate         TEXT NOT NULL UNIQUE,    -- mispar_rechev (e.g. "123-45-678")
  tozeret_nm            TEXT,                    -- manufacturer name (e.g. "TOYOTA")
  degem_nm              TEXT,                    -- model name (e.g. "COROLLA")
  kinuy_mishari         TEXT,                    -- commercial name / trim
  shnat_yitzur          INT,                     -- manufacturing year
  tzeva_rechev          TEXT,                    -- color (Hebrew, e.g. "לבן")
  sug_delek_nm          TEXT,                    -- fuel type (e.g. "בנזין", "חשמל", "דיזל")
  misgeret              TEXT,                    -- chassis/VIN number
  degem_manoa           TEXT,                    -- engine model code
  ramat_gimur           TEXT,                    -- finish level (e.g. "LUXURY")
  kvutzat_zihum         TEXT,                    -- pollution/emission category
  baalut                TEXT,                    -- ownership type from MOT (e.g. "פרטי", "ליסינג")
  moed_aliya_lakvish    DATE,                    -- road entry date (first registration)
  mot_last_sync_at      TIMESTAMPTZ,             -- when MOT data was last fetched

  -- ── Operational (company-specific fields) ─────────────────────────────────
  vehicle_type          TEXT CHECK (vehicle_type IN (
                          'private',    -- רכב פרטי (M1)
                          'minibus',    -- מיניבוס (M2)
                          'light_commercial', -- מסחרי קל עד 3.5 טון (N1)
                          'heavy',      -- משאית (N2/N3)
                          'forklift',   -- מלגזה
                          'equipment',  -- צמ"ה אחר
                          'other'
                        )),
  ownership_type        TEXT CHECK (ownership_type IN (
                          'company_owned',  -- בבעלות החברה
                          'leased',         -- ליסינג
                          'rented',         -- שכור
                          'employee_owned'  -- רכב עובד
                        )),
  company_id            INT REFERENCES public.companies(id),   -- which company owns it
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_driver_id    UUID REFERENCES public.drivers(id),    -- current assigned driver (nullable)
  leasing_company_id    UUID REFERENCES public.vehicle_suppliers(id),  -- if leased
  insurance_company_id  UUID REFERENCES public.vehicle_suppliers(id),  -- insurance provider
  fuel_card_supplier_id UUID REFERENCES public.vehicle_suppliers(id),  -- fuel card provider
  garage_id             UUID REFERENCES public.vehicle_suppliers(id),  -- primary garage
  notes                 TEXT,

  -- ── Audit + soft-delete ───────────────────────────────────────────────────
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID REFERENCES auth.users(id),
  updated_by            UUID REFERENCES auth.users(id),
  deleted_at            TIMESTAMPTZ DEFAULT NULL
);
```

**Design rationale for MOT fields:**
- Keep MOT field names in Hebrew transliteration (`tozeret_nm`, `shnat_yitzur`, etc.) to make Phase 12 (MOT API sync) trivial — the API response keys map 1:1
- `mot_last_sync_at` allows UI to show "last synced" and enables future background refresh
- MOT fields are nullable because vehicles can be added manually before MOT lookup

### Table: `vehicle_suppliers`

A simple lookup table for external service providers. Used as FK from `vehicles` for multiple supplier types.

```sql
CREATE TABLE IF NOT EXISTS public.vehicle_suppliers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_type TEXT NOT NULL CHECK (supplier_type IN (
                  'leasing',    -- חברת ליסינג
                  'insurance',  -- חברת ביטוח
                  'fuel_card',  -- ספק כרטיס דלק
                  'garage',     -- מוסך
                  'other'       -- אחר
                )),
  name          TEXT NOT NULL,
  contact_name  TEXT,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID REFERENCES auth.users(id),
  updated_by    UUID REFERENCES auth.users(id),
  deleted_at    TIMESTAMPTZ DEFAULT NULL
);
```

**Design rationale:**
- Single table, not separate tables per supplier type — avoids proliferation of near-identical tables
- `supplier_type` enum handles filtering — a garage won't appear in the insurance dropdown
- No `UNIQUE(name)` constraint — two different garages can have the same name in different cities
- Soft-delete (same pattern as all other tables)

### Table: `vehicle_tests` (טסט)

Annual/biannual vehicle roadworthiness tests.

```sql
CREATE TABLE IF NOT EXISTS public.vehicle_tests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id      UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  test_date       DATE NOT NULL,
  expiry_date     DATE NOT NULL,         -- next test due date
  passed          BOOLEAN NOT NULL DEFAULT TRUE,
  test_station    TEXT,                  -- name of test station
  cost            DECIMAL(10, 2),
  notes           TEXT,
  file_url        TEXT,                  -- fleet-vehicle-documents bucket
  alert_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES auth.users(id),
  updated_by      UUID REFERENCES auth.users(id),
  deleted_at      TIMESTAMPTZ DEFAULT NULL
);
```

**Israeli טסט rules (MEDIUM confidence, from search results):**
- Private vehicles: annual test
- Vehicles over 20 years: twice per year
- New vehicles (first 3 years): no physical test, only registration fee
- Test expiry = when next test is due (1 year or 6 months depending on vehicle age)

### Table: `vehicle_insurance`

Insurance policy tracking per vehicle.

```sql
CREATE TABLE IF NOT EXISTS public.vehicle_insurance (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id          UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  insurance_type      TEXT NOT NULL CHECK (insurance_type IN (
                        'mandatory',    -- ביטוח חובה (MUST have, annual)
                        'comprehensive', -- ביטוח מקיף
                        'third_party'   -- צד ג'
                      )),
  policy_number       TEXT,
  supplier_id         UUID REFERENCES public.vehicle_suppliers(id),  -- insurance company
  start_date          DATE,
  expiry_date         DATE NOT NULL,
  cost                DECIMAL(10, 2),
  notes               TEXT,
  file_url            TEXT,             -- policy document in fleet-vehicle-documents
  alert_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID REFERENCES auth.users(id),
  updated_by          UUID REFERENCES auth.users(id),
  deleted_at          TIMESTAMPTZ DEFAULT NULL
);
```

### Table: `vehicle_documents`

General documents (same pattern as `driver_documents`).

```sql
CREATE TABLE IF NOT EXISTS public.vehicle_documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id     UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  document_name  TEXT NOT NULL,
  file_url       TEXT,              -- fleet-vehicle-documents bucket
  expiry_date    DATE,
  alert_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     UUID REFERENCES auth.users(id),
  updated_by     UUID REFERENCES auth.users(id),
  deleted_at     TIMESTAMPTZ DEFAULT NULL
);
```

### Table: `vehicle_document_names`

Autocomplete for document names (mirrors `driver_document_names`).

```sql
CREATE TABLE IF NOT EXISTS public.vehicle_document_names (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  usage_count  INT NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Storage Buckets

### New buckets required

| Bucket Name | Visibility | Purpose |
|-------------|------------|---------|
| `fleet-vehicle-documents` | Private | Vehicle docs, test certs, insurance policies, photos |

**Why one bucket instead of multiple:** The driver module uses two buckets (`fleet-licenses` for license images, `fleet-documents` for everything else). For vehicles, a single `fleet-vehicle-documents` bucket is simpler — documents are distinguished by their DB record, not by bucket. Storage path pattern: `{vehicle_id}/{document_type}/{filename}`.

**Note on existing buckets:** The `fleet-documents` bucket is currently used for driver violations. Vehicle documents should NOT share this bucket to keep vehicle and driver assets clearly separated.

### Storage RLS policies (migration 00026)

Follow the exact same pattern as `00019_fleet_storage_policies.sql`:

```sql
CREATE POLICY "authenticated_insert_fleet_vehicle_documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'fleet-vehicle-documents');

CREATE POLICY "authenticated_select_fleet_vehicle_documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'fleet-vehicle-documents');

CREATE POLICY "authenticated_update_fleet_vehicle_documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'fleet-vehicle-documents');

CREATE POLICY "authenticated_delete_fleet_vehicle_documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'fleet-vehicle-documents');
```

---

## RPCs Required

### Soft-delete RPCs (in migration 00025 or a separate 00027)

Following the pattern from `00020_fleet_soft_delete_rpc.sql` + `00022_soft_delete_driver_rpc.sql`:

```sql
-- soft_delete_vehicle(p_id, p_user_id) RETURNS BOOLEAN
-- soft_delete_vehicle_document(p_id, p_user_id) RETURNS BOOLEAN
-- soft_delete_vehicle_test(p_id, p_user_id) RETURNS BOOLEAN
-- soft_delete_vehicle_insurance(p_id, p_user_id) RETURNS BOOLEAN
-- soft_delete_vehicle_supplier(p_id, p_user_id) RETURNS BOOLEAN
-- increment_vehicle_document_name_usage(p_name TEXT) RETURNS VOID
```

All RPCs: `SECURITY DEFINER`, `SET search_path = public`.

### Update RPCs (for complex updates that need to bypass RLS)

```sql
-- update_vehicle_document(p_id, p_user_id, p_document_name, p_file_url, p_expiry_date, p_alert_enabled, p_notes)
-- update_vehicle_test(p_id, p_user_id, ...)
-- update_vehicle_insurance(p_id, p_user_id, ...)
```

---

## Driver-Vehicle Relationship

The `vehicles.assigned_driver_id` column creates a FK to `drivers.id`. This enables:

1. **Driver card `driver_computed_status` view UPDATE** — The existing view has a `TODO Phase 10` comment:
   ```sql
   -- TODO Phase 10: WHEN (vehicle assigned) THEN 'active'
   ```
   This migration should update `driver_computed_status` to include:
   ```sql
   WHEN (SELECT COUNT(*) FROM vehicles v WHERE v.assigned_driver_id = d.id AND v.deleted_at IS NULL) > 0 THEN 'active'
   ```

2. **One-to-one assignment** — A vehicle has one assigned driver (nullable). A driver can be assigned to multiple vehicles over time but only one active assignment per vehicle at a time. For this phase, `assigned_driver_id` on `vehicles` is sufficient. A full assignment history table is a future consideration.

---

## Israeli Vehicle Domain Facts

### MOT API (data.gov.il)

**Source:** `data.gov.il` resource ID `053cea08-09bc-40ec-8f7a-156f0677aff3`
**Confidence:** HIGH (verified by direct API call in research)

The 24 fields returned by the Israeli government open data API:

| API Field | Meaning | DB Column |
|-----------|---------|-----------|
| `mispar_rechev` | License plate number | `license_plate` |
| `tozeret_nm` | Manufacturer name | `tozeret_nm` |
| `degem_nm` | Model name | `degem_nm` |
| `kinuy_mishari` | Commercial/trade name | `kinuy_mishari` |
| `shnat_yitzur` | Manufacturing year | `shnat_yitzur` |
| `tzeva_rechev` | Vehicle color (Hebrew) | `tzeva_rechev` |
| `sug_delek_nm` | Fuel type | `sug_delek_nm` |
| `misgeret` | Chassis/VIN number | `misgeret` |
| `degem_manoa` | Engine model | `degem_manoa` |
| `ramat_gimur` | Finish/trim level | `ramat_gimur` |
| `kvutzat_zihum` | Emission category | `kvutzat_zihum` |
| `baalut` | Ownership type (MOT record) | `baalut` |
| `moed_aliya_lakvish` | Road entry date | `moed_aliya_lakvish` |
| `mivchan_acharon_dt` | Last inspection date | Stored in `vehicle_tests` |
| `tokef_dt` | License validity expiration | Stored in `vehicle_tests.expiry_date` |
| `tozeret_cd` | Manufacturer code | Not stored (derived from name) |
| `sug_degem` | Model type code | Not stored |
| `degem_cd` | Model code | Not stored |
| `ramat_eivzur_betihuty` | Safety belt rating | Not stored |
| `tzeva_cd` | Color code | Not stored |
| `zmig_kidmi` | Front tires spec | Not stored (operational detail) |
| `zmig_ahori` | Rear tires spec | Not stored |
| `horaat_rishum` | Registration directive | Not stored |

**Note:** `mivchan_acharon_dt` and `tokef_dt` from the MOT API should populate the `vehicle_tests` table, not the `vehicles` table. This keeps the history of tests intact.

### Vehicle Classification (Israeli law, EU-aligned)

**Confidence:** MEDIUM (from multiple search results, consistent with EU 2018/858)

| Code | Type | Description |
|------|------|-------------|
| M1 | Private passenger | Up to 8 seats + driver |
| M2 | Minibus | Passenger vehicle, heavier |
| M3 | Bus | Large passenger vehicle |
| N1 | Light commercial | Up to 3.5 tons GVW |
| N2 | Medium truck | 3.5–12 tons GVW |
| N3 | Heavy truck | Over 12 tons GVW |

For ChemoSys purposes, the `vehicle_type` TEXT enum is sufficient — no need to store the EU code.

### Vehicle Test (טסט) Cycle

**Confidence:** MEDIUM (from search, not verified against official MOT regulations)

- New vehicles (0–3 years): no physical test required, only registration fee payment
- Standard vehicles: annual test
- Vehicles over 20 years: twice per year (semi-annual)
- Mandatory insurance (`ביטוח חובה`) must be presented at test

### Ownership Types in Israel

**Confidence:** HIGH (common domain knowledge, consistent across sources)

- `company_owned` — החברה בעלים מלאים
- `leased` — ליסינג (common in Israeli corporate fleets)
- `rented` — השכרה לטווח קצר
- `employee_owned` — רכב צמוד / רכב עובד

---

## Indexes and Constraints

```sql
-- vehicles
CREATE UNIQUE INDEX vehicles_license_plate_key ON public.vehicles (license_plate)
  WHERE deleted_at IS NULL;  -- partial unique index (soft-delete aware)

CREATE INDEX vehicles_company_id_idx ON public.vehicles (company_id);
CREATE INDEX vehicles_assigned_driver_id_idx ON public.vehicles (assigned_driver_id);

-- vehicle_tests
CREATE INDEX vehicle_tests_vehicle_id_idx ON public.vehicle_tests (vehicle_id);
CREATE INDEX vehicle_tests_expiry_date_idx ON public.vehicle_tests (expiry_date);

-- vehicle_insurance
CREATE INDEX vehicle_insurance_vehicle_id_idx ON public.vehicle_insurance (vehicle_id);
CREATE INDEX vehicle_insurance_expiry_date_idx ON public.vehicle_insurance (expiry_date);

-- vehicle_suppliers
CREATE INDEX vehicle_suppliers_type_idx ON public.vehicle_suppliers (supplier_type);
```

**Key constraint decision:** `license_plate` UNIQUE should be a partial index (`WHERE deleted_at IS NULL`) so a deleted vehicle's plate can be re-registered without violating the constraint. This follows the same principle as the `drivers_employee_id_key` lesson (mentioned in MEMORY.md) where unique constraints on soft-deleted tables cause insert issues.

---

## Common Pitfalls

### Pitfall 1: Unique Constraint on Soft-Deleted Tables

**What goes wrong:** A `UNIQUE(license_plate)` constraint blocks re-registering a license plate if an old (soft-deleted) vehicle record exists with the same plate.

**Why it happens:** Standard `UNIQUE` constraint ignores `deleted_at` — it applies to all rows including deleted ones.

**How to avoid:** Use a **partial unique index**: `CREATE UNIQUE INDEX ON vehicles (license_plate) WHERE deleted_at IS NULL;`

**Source:** MEMORY.md lesson — `drivers_employee_id_key` blocks insert even if old row is soft-deleted. Fix: hard-delete old row first OR use partial unique index.

### Pitfall 2: Direct UPDATE Fails for Soft-Delete via PostgREST

**What goes wrong:** Client-side or Server Action that calls `supabase.from('vehicles').update({deleted_at: ...}).eq('id', id)` silently does nothing.

**Why it happens:** The SELECT RLS policy `USING (deleted_at IS NULL)` means PostgREST cannot "see" the row to update it once `deleted_at` is being set (or after it's set).

**How to avoid:** Always create `soft_delete_vehicle(p_id, p_user_id)` SECURITY DEFINER RPC and call it via `.rpc()`.

**Source:** Verified from `00020_fleet_soft_delete_rpc.sql` and `00022_soft_delete_driver_rpc.sql` comments.

### Pitfall 3: Forgetting to Update `driver_computed_status` View

**What goes wrong:** After adding vehicles, drivers assigned to vehicles still show as `inactive` because the view was never updated.

**Why it happens:** The `driver_computed_status` view in `00018_fleet_drivers.sql` has a `-- TODO Phase 10: WHEN (vehicle assigned) THEN 'active'` placeholder.

**How to avoid:** Include a `CREATE OR REPLACE VIEW driver_computed_status` update in migration `00025_fleet_vehicles.sql` that adds the vehicle assignment condition.

### Pitfall 4: MOT API Fields Stored Redundantly

**What goes wrong:** Storing `mivchan_acharon_dt` and `tokef_dt` both in `vehicles` table AND in `vehicle_tests` — causes data inconsistency.

**How to avoid:** MOT API test dates should only populate `vehicle_tests` table (insert/upsert a test record). The `vehicles` table does not duplicate test dates — they are read from `vehicle_tests` via JOIN.

### Pitfall 5: vehicle_suppliers FK Circular Dependency

**What goes wrong:** If `vehicle_suppliers` is defined AFTER `vehicles` in the migration, the FK `vehicles.leasing_company_id REFERENCES vehicle_suppliers(id)` will fail.

**How to avoid:** Define `vehicle_suppliers` table BEFORE `vehicles` in the migration file.

### Pitfall 6: Missing Storage Bucket Creation

**What goes wrong:** The migration for storage policies runs, but the bucket `fleet-vehicle-documents` was never created in Supabase dashboard → all storage operations fail silently.

**How to avoid:** Document clearly in migration file that the bucket must be created manually in Supabase Storage dashboard before running the storage policies migration. Pattern from `00019_fleet_storage_policies.sql` comment.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Soft delete bypass | Custom UPDATE logic in Server Action | SECURITY DEFINER RPC | PostgREST + RLS interaction, proven pattern in project |
| License plate validation | Custom regex | `normalizePhone()` pattern applied to plate | Use `formatLicensePlate()` already in `format.ts` |
| MOT API integration | Custom fetch in this phase | Leave for Phase 12 | This phase is DB-only — Phase 12 specifically handles MOT API |
| Vehicle status computation | Stored `status` column | `vehicle_computed_status` view | Prevents stale status, mirrors `driver_computed_status` pattern |

---

## Code Examples

### Example: Server Action guard pattern (from existing drivers.ts)

```typescript
// Source: src/actions/fleet/drivers.ts (verified from codebase)
'use server'
import { verifyAppUser } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'

export async function createVehicle(formData: FormData) {
  const user = await verifyAppUser()  // throws if not authenticated
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('create_vehicle', {
    p_license_plate: formData.get('license_plate') as string,
    p_user_id: user.authUserId,
    // ...
  })
  // ...
}
```

### Example: Autocomplete RPC (mirrors driver_document_names)

```sql
-- Source: Pattern from 00018_fleet_drivers.sql (verified from codebase)
CREATE OR REPLACE FUNCTION public.increment_vehicle_document_name_usage(p_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.vehicle_document_names (name, usage_count)
  VALUES (p_name, 1)
  ON CONFLICT (name) DO UPDATE
    SET usage_count = vehicle_document_names.usage_count + 1;
END;
$$;
```

### Example: vehicle_computed_status view with driver assignment

```sql
-- This view should also update driver_computed_status (see Pitfall 3)
CREATE OR REPLACE VIEW public.vehicle_computed_status
WITH (security_invoker = true)
AS
SELECT
  v.id,
  CASE
    WHEN v.deleted_at IS NOT NULL THEN 'inactive'
    WHEN v.is_active = FALSE       THEN 'inactive'
    ELSE 'active'
  END AS computed_status
FROM public.vehicles v;
```

---

## Migration File Plan

Recommended split:

### `00025_fleet_vehicles.sql`
1. `vehicle_suppliers` table (must be FIRST — vehicles FKs reference it)
2. `vehicles` table
3. `vehicle_tests` table
4. `vehicle_insurance` table
5. `vehicle_documents` table
6. `vehicle_document_names` table
7. `update_updated_at_column` triggers for all tables
8. `vehicle_computed_status` view (security_invoker)
9. Updated `driver_computed_status` view (adds vehicle assignment condition)
10. RLS policies for all tables
11. `soft_delete_vehicle` RPC
12. `soft_delete_vehicle_document` RPC
13. `soft_delete_vehicle_test` RPC
14. `soft_delete_vehicle_insurance` RPC
15. `soft_delete_vehicle_supplier` RPC
16. `update_vehicle_document` RPC
17. `update_vehicle_test` RPC
18. `update_vehicle_insurance` RPC
19. `increment_vehicle_document_name_usage` RPC

### `00026_fleet_vehicles_storage_policies.sql`
1. Storage INSERT/SELECT/UPDATE/DELETE policies for `fleet-vehicle-documents` bucket
2. Comment: "Create bucket in Supabase Storage dashboard before running this migration"

---

## Open Questions

1. **Driver-vehicle assignment: one-to-many or one-to-one?**
   - What we know: `vehicles.assigned_driver_id` FK supports one assigned driver per vehicle at a time
   - What's unclear: Should a driver be able to be assigned to multiple vehicles simultaneously? (e.g., מלגזה + רכב)
   - Recommendation: Start with `vehicles.assigned_driver_id` (nullable FK on vehicles). If multi-assignment is needed, add `vehicle_assignments` history table in a future phase.

2. **Should `vehicle_suppliers` be shared across vehicle types (צי רכב + צמ"ה)?**
   - What we know: Phase 14 handles equipment module
   - What's unclear: Will equipment (forklifts, mobile machines) use the same garages/suppliers as vehicles?
   - Recommendation: Yes — `vehicle_suppliers` should be company-wide. Both fleet and equipment modules reference the same supplier table. No `module_type` column needed — suppliers are generic.

3. **Vehicle registration fee tracking (`אגרת רישוי`)?**
   - What we know: Annual fee is required, amount varies by vehicle group (₪1,233–₪5,226 in 2025)
   - What's unclear: Does Sharon want to track payment of the registration fee?
   - Recommendation: This is a document/cost — add as `vehicle_documents` record with `document_name = 'אגרת רישוי'` and expiry date. No separate table needed.

4. **`company_id` on vehicles — which companies?**
   - What we know: Companies table exists (חמו אהרון, טקסה, וולדבוט)
   - What's unclear: Do all three companies have vehicles in the same fleet module?
   - Recommendation: Yes, include `company_id` as nullable FK — same pattern as employees.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Hardcoded status column | Computed status view | Status never stale, no sync issues |
| Direct soft-delete UPDATE | SECURITY DEFINER RPC | Works with PostgREST + RLS |
| Per-module storage bucket | Shared `fleet-vehicle-documents` | Simpler, fewer policies to manage |

---

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/00018_fleet_drivers.sql` — Table design patterns for fleet module (verified from codebase)
- `supabase/migrations/00019_fleet_storage_policies.sql` — Storage RLS policy pattern (verified from codebase)
- `supabase/migrations/00020_fleet_soft_delete_rpc.sql` — Soft-delete RPC pattern (verified from codebase)
- `supabase/migrations/00022_soft_delete_driver_rpc.sql` — Driver soft-delete RPC (verified from codebase)
- `supabase/migrations/00023_fix_view_security.sql` — View security_invoker pattern (verified from codebase)
- `data.gov.il` API direct call — 24 fields of Israeli vehicle registration dataset (HIGH confidence, direct API response)
- MEMORY.md — Unique constraint lesson with soft-deleted tables (verified project documentation)

### Secondary (MEDIUM confidence)
- [Israeli vehicle registration API blog](https://blog.dotnetframework.org/2020/05/25/car-registration-api-for-israel/) — API field mapping
- [Vehicle regulations in Israel](https://igarr.com/vehicle-regulations-in-israel/) — EU M/N classification system
- [אגרת רישוי 2025](https://autoboom.co.il/magazine/license-fee-in-israel-in-2025) — Vehicle test (טסט) cycles and fees
- [Anglo-List: Israel vehicle categories](https://anglo-list.com/israel-drivers-license-categories-classifications/) — Vehicle type classification

### Tertiary (LOW confidence)
- General fleet management best practices (industry sources, not Israeli-specific)

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — no new libraries, existing Supabase patterns
- Architecture/Schema: HIGH (patterns) / MEDIUM (domain-specific fields)
- MOT API fields: HIGH — verified against live API endpoint
- Israeli vehicle domain: MEDIUM — search-verified, not against official MOT documentation
- Pitfalls: HIGH — all derived from existing codebase lessons

**Research date:** 2026-03-07
**Valid until:** 2026-06-01 (schema patterns stable; MOT API field list stable unless gov.il changes dataset)
