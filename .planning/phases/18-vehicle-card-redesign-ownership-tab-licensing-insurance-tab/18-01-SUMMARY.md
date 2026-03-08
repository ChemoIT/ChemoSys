---
phase: 18-vehicle-card-redesign-ownership-tab-licensing-insurance-tab
plan: 01
subsystem: database
tags: [supabase, typescript, server-actions, fleet, vehicles, ownership]

# Dependency graph
requires:
  - phase: 16-vehicle-card-database-schema-redesign
    provides: "migration 00027 — vehicles schema with ownership_supplier_id, contract_number, vehicle_group, vehicle_monthly_costs table"
provides:
  - "migration 00029 — contract_file_url column on vehicles"
  - "OWNERSHIP_TYPE_LABELS corrected to match 00027 DB CHECK constraint (company/rental/operational_leasing/mini_leasing)"
  - "VEHICLE_TYPE_LABELS trailer label fix (ניגרר → נגרר)"
  - "VehicleFull type with 5 new ownership fields: ownershipSupplierId/Name, contractNumber/FileUrl, vehicleGroup"
  - "VehicleMonthlyCost type (activity journal pattern)"
  - "getVehicleById returns all ownership fields including ownershipSupplierName (joined)"
  - "UpdateVehicleInput + updateVehicleDetails accept 4 new optional ownership fields"
  - "vehicle-ownership.ts: 3 Server Actions for monthly costs CRUD"
affects:
  - phase: 18-02 (VehicleOwnershipSection UI)
  - phase: 18-03 (VehicleInsuranceLicensingSection UI)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Activity journal — single active record per vehicle (end_date IS NULL), immutable financial history"
    - "FK alias joins in Supabase: ownership_co:vehicle_suppliers!ownership_supplier_id"
    - "Spread operator pattern for optional DB fields in updateVehicleDetails"

key-files:
  created:
    - supabase/migrations/00029_add_contract_file_url.sql
    - src/actions/fleet/vehicle-ownership.ts
  modified:
    - src/lib/fleet/vehicle-types.ts
    - src/actions/fleet/vehicles.ts

key-decisions:
  - "[18-01] OWNERSHIP_TYPE_LABELS corrected to company/rental/operational_leasing/mini_leasing — previous keys (company_owned/leased/rented/employee_owned) did not match 00027 DB CHECK constraint"
  - "[18-01] VehicleMonthlyCost lives in vehicle-ownership.ts (separate file) — keeps vehicles.ts manageable at 1270 lines"
  - "[18-01] updateVehicleMonthlyCost uses direct .update() — no RPC needed because vehicle_monthly_costs has no deleted_at RLS filter"
  - "[18-01] addVehicleMonthlyCost closes previous active record before insert — enforced in Server Action, NOT in DB trigger (follows project pattern)"

patterns-established:
  - "Monthly cost activity journal: UPDATE end_date IS NULL before INSERT (same pattern as driver/project journals)"
  - "Ownership supplier FK hint: ownership_co:vehicle_suppliers!ownership_supplier_id disambiguates multiple FKs to same table"

# Metrics
duration: 25min
completed: 2026-03-08
---

# Phase 18 Plan 01: DB Migration + Types + Server Actions Foundation Summary

**Migration 00029 (contract_file_url), corrected OWNERSHIP_TYPE_LABELS/VEHICLE_TYPE_LABELS, 5 new VehicleFull ownership fields, VehicleMonthlyCost type, extended getVehicleById/updateVehicleDetails, and new vehicle-ownership.ts with 3 monthly-cost Server Actions**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-03-08
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- Migration 00029 adds `contract_file_url TEXT` column to vehicles (missed from 00027)
- `OWNERSHIP_TYPE_LABELS` corrected to match 00027 DB CHECK constraint: company/rental/operational_leasing/mini_leasing
- `VehicleFull` type extended with 5 ownership fields + `VehicleMonthlyCost` type added
- `getVehicleById` now returns all ownership fields including joined `ownershipSupplierName`
- `vehicle-ownership.ts` created with `getVehicleMonthlyCosts`, `addVehicleMonthlyCost`, `updateVehicleMonthlyCost` — all guarded with `verifyAppUser()`

## Task Commits

1. **Task 1: Migration 00029 + vehicle-types.ts update** - `bb89ef6` (feat)
2. **Task 2: Extend vehicles.ts + create vehicle-ownership.ts** - `f21d056` (feat)

## Files Created/Modified

- `supabase/migrations/00029_add_contract_file_url.sql` — ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS contract_file_url TEXT
- `src/lib/fleet/vehicle-types.ts` — corrected OWNERSHIP/VEHICLE_TYPE_LABELS, extended VehicleFull (5 fields), new VehicleMonthlyCost type
- `src/actions/fleet/vehicles.ts` — extended getVehicleById SELECT + return map, extended UpdateVehicleInput + updateVehicleDetails for 4 ownership fields
- `src/actions/fleet/vehicle-ownership.ts` — new file: 3 exported Server Actions for vehicle_monthly_costs table

## Decisions Made

- **OWNERSHIP_TYPE_LABELS correction:** Previous keys (company_owned/leased/rented/employee_owned) were wrong — 00027 DB CHECK constraint uses company/rental/operational_leasing/mini_leasing. Fixed to match DB.
- **VehicleMonthlyCost in separate file:** vehicle-ownership.ts keeps vehicles.ts manageable. Pattern follows project convention of splitting large action files.
- **Direct .update() for updateVehicleMonthlyCost:** No RPC needed — vehicle_monthly_costs has no `deleted_at` filter in its RLS SELECT policy, so direct UPDATE works without SECURITY DEFINER bypass.
- **Immutable cost history:** No delete action exposed — financial audit trail enforced at Server Action layer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed VEHICLE_TYPE_LABELS trailer label typo**
- **Found during:** Task 1 (reading existing vehicle-types.ts)
- **Issue:** `trailer` label was `ניגרר` (wrong spelling) instead of `נגרר`
- **Fix:** Corrected Hebrew label
- **Files modified:** `src/lib/fleet/vehicle-types.ts`
- **Verification:** TypeScript passes, text verified correct
- **Committed in:** bb89ef6 (Task 1 commit)

**2. [Rule 1 - Bug] Removed VehicleMonthlyCost from vehicles.ts imports**
- **Found during:** Task 2 (adding import per plan instruction)
- **Issue:** Plan said to add VehicleMonthlyCost to vehicles.ts imports, but it is not used in that file — unused imports cause noise and potential lint errors
- **Fix:** Added to vehicle-ownership.ts only (where it is actually used)
- **Files modified:** `src/actions/fleet/vehicles.ts`
- **Verification:** TypeScript passes with zero errors
- **Committed in:** f21d056 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both fixes improve correctness with no scope change.

## Issues Encountered

None — plan executed smoothly. vehicle-types.ts already had `vehicleStatus` and `fleetExitDate` in VehicleFull from Phase 19-01, so only 5 new fields were needed (not 7 as stated — vehicleStatus and fleetExitDate were already present).

## User Setup Required

**Migration 00029 must be applied in Supabase before Phase 18-02 UI can use `contract_file_url`.**

```sql
-- Run in Supabase SQL Editor:
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS contract_file_url TEXT;
```

Or apply via Supabase CLI: `supabase db push`

## Next Phase Readiness

- Wave 2 (Plans 18-02 and 18-03) unblocked:
  - `VehicleOwnershipSection` can receive all ownership fields via `vehicle` prop from `getVehicleById`
  - `vehicle-ownership.ts` actions ready for `VehicleCostsSection` / ownership journal
  - `updateVehicleDetails` ready for ownership save button
- Zero TypeScript errors

---
*Phase: 18-vehicle-card-redesign-ownership-tab-licensing-insurance-tab*
*Completed: 2026-03-08*
