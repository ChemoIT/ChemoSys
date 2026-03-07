---
phase: 16-vehicle-card-redesign-db-migration
plan: 01
subsystem: database
tags: [postgresql, supabase, migration, rls, rpc, soft-delete, activity-journal, storage]

# Dependency graph
requires:
  - phase: 11-phase-10a-vehicle-card-database-storage-vehicle-suppliers-tables
    provides: vehicles, vehicle_suppliers tables (00025), RLS patterns, RPC patterns
  - phase: 09-phase-10d-driver-card-ui
    provides: drivers table (00018) — FK target for vehicle_driver_journal

provides:
  - "supabase/migrations/00027_vehicle_card_redesign.sql — complete schema extension"
  - "9 new columns on vehicles table with updated CHECK constraints"
  - "ownership type added to vehicle_suppliers"
  - "6 new tables: vehicle_images, vehicle_replacement_records, vehicle_fuel_cards, vehicle_driver_journal, vehicle_project_journal, vehicle_monthly_costs"
  - "vehicle_computed_status view updated to use vehicle_status"
  - "driver_computed_status view updated to filter by vehicle_status"
  - "soft_delete_vehicle_replacement_record RPC (SECURITY DEFINER)"
  - "supabase/migrations/00028_vehicle_images_storage_policies.sql — 4 storage policies for vehicle-images bucket"

affects:
  - 17-vehicle-card-redesign-ui-tab1-tab2
  - 18-vehicle-card-redesign-ui-tab3-tab4
  - 19-vehicle-card-redesign-ui-tab5-complete

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Activity journal pattern: vehicle_driver_journal, vehicle_project_journal, vehicle_monthly_costs — start_date/end_date with end_date IS NULL = currently active"
    - "Hard-delete pattern for binary assets: vehicle_images, vehicle_fuel_cards — no deleted_at, DELETE RLS policy USING(true)"
    - "Two-file migration split: 00027 (schema) + 00028 (storage policies) — matches 00025+00026 pattern"

key-files:
  created:
    - supabase/migrations/00027_vehicle_card_redesign.sql
    - supabase/migrations/00028_vehicle_images_storage_policies.sql
  modified: []

key-decisions:
  - "[16-01] 00028 storage policies file created in same plan as 00027 — research specified two-file split (schema + storage), matches 00025+00026 pattern"
  - "[16-01] vehicle_images and vehicle_fuel_cards use hard-delete (DELETE RLS policy) — binary assets and child records are replaced not versioned"
  - "[16-01] Activity journal tables (driver/project/monthly_costs) have no soft-delete — historical facts should never be removed"
  - "[16-01] Business rule for single-active-record-per-vehicle enforced in Server Actions, not DB triggers — follows project pattern"
  - "[16-01] vehicle_status NOT NULL DEFAULT 'active' — all existing vehicles automatically become 'active' when migration runs"

patterns-established:
  - "Activity journal: start_date/end_date range, partial index WHERE end_date IS NULL, close-current-then-insert-new in Server Action"
  - "Hard-delete tables: no deleted_at, DELETE RLS USING(true), cascade from parent table ON DELETE CASCADE"

# Metrics
duration: 3min
completed: 2026-03-07
---

# Phase 16 Plan 01: Vehicle Card Redesign DB Migration Summary

**PostgreSQL migration extending vehicles schema: 9 new columns + 6 new tables (images, replacement records, fuel cards, 3 activity journals) + updated status views + SECURITY DEFINER soft-delete RPC + storage policies for vehicle-images bucket**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-07T10:23:26Z
- **Completed:** 2026-03-07T10:25:54Z
- **Tasks:** 1
- **Files created:** 2

## Accomplishments

- Migration 00027 written: fully idempotent, covers all 14 specification sections from the plan
- Migration 00028 written: 4 storage policies for private `vehicle-images` bucket
- All verification checks passed: 6 CREATE TABLE, 6 RLS ENABLE, both views, soft-delete RPC, all CHECK constraint values

## Task Commits

1. **Task 1: Write migration 00027 + 00028** - `9b68f7b` (feat)

## Files Created/Modified

- `supabase/migrations/00027_vehicle_card_redesign.sql` — Main schema migration: ALTER TABLE vehicles (9 cols + CHECK constraints), ALTER TABLE vehicle_suppliers (ownership type), CREATE TABLE x6, RLS x6, updated views x2, soft-delete RPC
- `supabase/migrations/00028_vehicle_images_storage_policies.sql` — Storage policies for vehicle-images private bucket (INSERT/SELECT/UPDATE/DELETE for authenticated users)

## Decisions Made

- Created 00028 storage policies file in the same execution as 00027 — the research specified two-file migration split (schema + storage) matching the established 00025+00026 pattern. This is consistent with plan intent even though not explicitly listed as a separate task.
- `vehicle_images` and `vehicle_fuel_cards` use hard-delete pattern (DELETE RLS policy, no `deleted_at`) — images and fuel card entries are replaced/removed, not soft-deleted. Matches research recommendation.
- Activity journal tables (`vehicle_driver_journal`, `vehicle_project_journal`, `vehicle_monthly_costs`) have no soft-delete — journal records are permanent historical facts (audit trail).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Created 00028 storage policies file**

- **Found during:** Task 1 (writing 00027)
- **Issue:** The research document (16-RESEARCH.md) specified a two-file migration split (00027 schema + 00028 storage policies) as the established pattern, matching how 00025+00026 were structured. Without 00028, the vehicle-images bucket would have no storage policies and all image uploads would be blocked.
- **Fix:** Created `00028_vehicle_images_storage_policies.sql` with 4 authenticated storage policies (INSERT, SELECT, UPDATE, DELETE) for the `vehicle-images` bucket
- **Files modified:** `supabase/migrations/00028_vehicle_images_storage_policies.sql`
- **Verification:** File confirmed to contain all 4 DROP POLICY IF EXISTS + CREATE POLICY statements
- **Committed in:** `9b68f7b` (same task commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical file required for upload functionality)
**Impact on plan:** Necessary for correctness. Without storage policies, image uploads would fail at runtime.

## Issues Encountered

None — migration wrote cleanly following the established patterns from 00025 and research doc.

## User Setup Required

**Before running 00028 in Supabase:** Create the `vehicle-images` bucket manually:
1. Supabase Dashboard → Storage → New Bucket
2. Name: `vehicle-images`
3. Public: OFF (Private)
4. Then run 00028 to add the storage policies

Note: 00027 has no external dependencies and can be run immediately.

## Self-Check: PASSED

- `supabase/migrations/00027_vehicle_card_redesign.sql` — FOUND
- `supabase/migrations/00028_vehicle_images_storage_policies.sql` — FOUND
- Commit `9b68f7b` — FOUND
- grep CREATE TABLE IF NOT EXISTS → 6 (matches spec)
- grep ENABLE ROW LEVEL SECURITY → 6 (matches spec)
- grep CREATE OR REPLACE VIEW → 2 (vehicle_computed_status + driver_computed_status)
- grep soft_delete_vehicle_replacement_record → function found
- grep vehicle_status NOT IN → driver_computed_status filter found

## Next Phase Readiness

- Migration 00027 is ready to paste into Supabase SQL Editor and run
- Migration 00028 requires bucket creation first (documented above)
- After both migrations run, Phase 17 can begin building the redesigned Tab 1 (Vehicle Details with gallery) and Tab 2 (Ownership) UI components
- All TypeScript types for new tables need to be added to `src/lib/fleet/vehicle-types.ts` in Phase 17

---
*Phase: 16-vehicle-card-redesign-db-migration*
*Completed: 2026-03-07*
