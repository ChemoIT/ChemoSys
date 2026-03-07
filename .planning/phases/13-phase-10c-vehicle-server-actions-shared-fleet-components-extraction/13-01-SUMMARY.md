---
phase: 13-phase-10c-vehicle-server-actions-shared-fleet-components-extraction
plan: 01
subsystem: api
tags: [supabase, server-actions, fleet, vehicles, typescript]

# Dependency graph
requires:
  - phase: 12-phase-10b-vehicle-suppliers-admin-mot-api
    provides: "supplier-types.ts pattern, vehicle DB schema (00025), RPCs for soft-delete and update"
  - phase: 11-phase-10a-vehicle-card-database-storage
    provides: "vehicles table, vehicle_tests, vehicle_insurance, vehicle_documents, vehicle_document_names tables + RPCs"
provides:
  - "vehicle-types.ts — 6 TypeScript types + 3 display constants (no 'use server')"
  - "vehicles.ts — 21 server action functions for complete vehicle CRUD"
  - "Full CRUD for vehicle sub-entities: tests, insurance, documents"
  - "Driver assignment actions (getActiveDriversForAssignment + assignDriverToVehicle)"
affects:
  - "Phase 14 (VehicleCard UI) — depends entirely on these server actions"
  - "Phase 15 (VehicleList) — depends on getVehiclesList and createVehicle"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared types in src/lib/fleet/*.ts — separate from 'use server' files (Turbopack constraint)"
    - "verifyAppUser() guard pattern for ChemoSys server actions (not admin verifySession)"
    - "Soft-delete via RPC exclusively — never direct .update({deleted_at})"
    - "vehicle_tests INSERT always — accumulates history, no upsert"

key-files:
  created:
    - src/lib/fleet/vehicle-types.ts
    - src/actions/fleet/vehicles.ts
  modified: []

key-decisions:
  - "vehicle-types.ts has NO 'use server' directive — Turbopack enforces server action files export only async functions; constants/types must live in separate non-server files"
  - "getVehicleById uses foreign key hints for multi-join: leasing:vehicle_suppliers!leasing_company_id etc."
  - "assignDriverToVehicle uses direct .update (not RPC) — vehicles table UPDATE policy USING(true) allows it"
  - "deleteVehicleWithPassword delegates to softDeleteVehicle after password check — avoids code duplication"

patterns-established:
  - "All 21 vehicle server actions follow verifyAppUser() -> supabase -> revalidatePath pattern"
  - "Input types defined inline in the same file (UpdateVehicleInput, AddVehicleTestInput, etc.)"

# Metrics
duration: 15min
completed: 2026-03-07
---

# Phase 13 Plan 01: Vehicle Types + Server Actions Summary

**21 vehicle CRUD server actions + shared TypeScript types/constants covering the full vehicle data layer for the fleet module**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-07T00:00:00Z
- **Completed:** 2026-03-07T00:15:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `vehicle-types.ts` with 6 TypeScript types (VehicleListItem, VehicleFull, VehicleTest, VehicleInsurance, VehicleDocument, DriverOptionForAssignment) and 3 display constant objects (VEHICLE_TYPE_LABELS, OWNERSHIP_TYPE_LABELS, INSURANCE_TYPE_LABELS) — no 'use server' directive, importable by both server and client code
- Created `vehicles.ts` with all 21 server actions: vehicle CRUD (getVehiclesList, getVehicleById, createVehicle, updateVehicleDetails, softDeleteVehicle, deleteVehicleWithPassword), vehicle tests (4), vehicle insurance (4), vehicle documents (5 + autocomplete), driver assignment (2)
- All functions use `verifyAppUser()` guard (ChemoSys auth), soft-delete via RPCs only, Hebrew error messages

## Task Commits

Each task was committed atomically:

1. **Task 1: Create vehicle-types.ts shared types and constants** - `16cdc3a` (feat)
2. **Task 2: Create vehicles.ts complete CRUD server actions** - `fb143fc` (feat)

## Files Created/Modified

- `src/lib/fleet/vehicle-types.ts` — TypeScript types for vehicles, tests, insurance, documents + display label constants
- `src/actions/fleet/vehicles.ts` — 21 async server action functions for complete vehicle CRUD

## Decisions Made

- `getVehicleById` uses Supabase foreign key hints syntax (`leasing:vehicle_suppliers!leasing_company_id`) for multi-supplier joins — necessary because vehicles table has 4 different FK columns all pointing to vehicle_suppliers
- `assignDriverToVehicle` uses direct `.update()` (not RPC) — the vehicles table UPDATE policy uses `USING (true)`, which allows direct updates without the RLS interaction problem that affects soft-delete
- `deleteVehicleWithPassword` delegates to `softDeleteVehicle` to avoid code duplication — same pattern as drivers.ts

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Phase 14 (VehicleCard UI)** — all server actions ready. Can build all VehicleCard tabs: פרטי רכב, טסטים, ביטוח, מסמכים, שיוך נהג
- **Phase 15 (VehicleList + AddVehicleDialog)** — `getVehiclesList()` and `createVehicle()` ready
- No blockers.

---
*Phase: 13-phase-10c-vehicle-server-actions-shared-fleet-components-extraction*
*Completed: 2026-03-07*
