---
phase: 15-phase-10f-vehiclelist-addvehicledialog-mot-api-auto-fill-pages-integration
plan: 01
subsystem: ui
tags: [mot-api, fleet, vehicle, dialog, server-actions, nextjs, supabase]

# Dependency graph
requires:
  - phase: 14-phase-10e-vehiclecard-tabs-4-8-assignment-costs-documents-notes-km-placeholder
    provides: VehicleCard + createVehicle + syncVehicleFromMot existing infrastructure

provides:
  - lookupVehicleFromMot: read-only MOT preview action (no DB write)
  - syncVehicleFromMot: fixed to use verifyAppUser (ChemoSys guard)
  - testMotApiConnection: kept on verifySession (admin-only)
  - getCompaniesForSelect: active companies list for dialog dropdown
  - AddVehicleDialog: two-step plate input -> MOT preview -> confirm+create flow

affects:
  - phase 15 plans 02+: VehicleList page that will use AddVehicleDialog
  - any future ChemoSys page calling MOT sync (now correctly guarded)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Two-step dialog pattern with useTransition for async steps
    - lookupVehicleFromMot: read-only API preview action separate from write action
    - syncVehicleFromMot fire-and-forget after createVehicle (non-blocking MOT sync)

key-files:
  created:
    - src/components/app/fleet/vehicles/AddVehicleDialog.tsx
  modified:
    - src/actions/fleet/mot-sync.ts
    - src/actions/fleet/vehicles.ts

key-decisions:
  - "lookupVehicleFromMot is read-only (no DB write) — separate from syncVehicleFromMot which writes"
  - "syncVehicleFromMot fixed to verifyAppUser — was incorrectly using verifySession (admin-only guard)"
  - "testMotApiConnection kept on verifySession — called from admin FleetSettings, not ChemoSys"
  - "syncVehicleFromMot called fire-and-forget after createVehicle — MOT failure doesn't block card creation"
  - "AddVehicleDialog step 2 back button returns to input with plate+company preserved (no reset)"
  - "getCompaniesForSelect uses native <select> (not shadcn Select) — simpler RTL styling"

patterns-established:
  - "Two-step dialog: step 1 = input+lookup, step 2 = preview+confirm. useTransition for both async ops."
  - "Fire-and-forget MOT sync: syncVehicleFromMot().then(result => toast.warning if failed) — never blocks navigation"

# Metrics
duration: 25min
completed: 2026-03-07
---

# Phase 15 Plan 01: Server Actions + AddVehicleDialog Summary

**Read-only MOT lookup action + fixed ChemoSys auth guards + two-step AddVehicleDialog with plate input -> MOT preview -> create vehicle flow**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-07T19:24:00Z
- **Completed:** 2026-03-07T19:49:16Z
- **Tasks:** 2
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments

- Added `lookupVehicleFromMot` — read-only MOT API fetch returning `MotVehicleData` without DB writes
- Fixed `syncVehicleFromMot` auth guard: `verifySession` -> `verifyAppUser` (ChemoSys is employee-facing, not admin)
- Added `getCompaniesForSelect` — active companies list for the AddVehicleDialog dropdown
- Built `AddVehicleDialog` with two-step flow: plate input -> MOT preview card -> confirm create

## Task Commits

Each task was committed atomically:

1. **Task 1: Add lookupVehicleFromMot + fix auth guards + getCompaniesForSelect** - `3dd99a3` (feat)
2. **Task 2: Build AddVehicleDialog two-step component** - `7941a2d` (feat)

**Plan metadata:** (this summary commit)

## Files Created/Modified

- `src/actions/fleet/mot-sync.ts` — added `lookupVehicleFromMot`, fixed `syncVehicleFromMot` guard, kept `testMotApiConnection` on verifySession
- `src/actions/fleet/vehicles.ts` — added `getCompaniesForSelect` action
- `src/components/app/fleet/vehicles/AddVehicleDialog.tsx` — new two-step vehicle creation dialog (235 lines)

## Decisions Made

- `lookupVehicleFromMot` is strictly read-only — no DB write. `syncVehicleFromMot` (write) called separately after card creation.
- `syncVehicleFromMot` fixed: was `verifySession` (admin guard) — changed to `verifyAppUser` (ChemoSys). `testMotApiConnection` intentionally stays on `verifySession` (admin FleetSettings only).
- MOT sync after create is fire-and-forget: failure shows `toast.warning` but doesn't block card creation or navigation.
- Back button in step 2 preserves plate + companyId (no reset) for quick re-lookup.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. TypeScript and build passed on first attempt.

## Next Phase Readiness

- `AddVehicleDialog` is ready to be integrated into the VehicleList page (Phase 15 Plan 02+)
- `lookupVehicleFromMot` and `getCompaniesForSelect` exported and typed correctly
- `syncVehicleFromMot` now correctly uses ChemoSys guard — safe for employee-facing pages

---
*Phase: 15-phase-10f-vehiclelist-addvehicledialog-mot-api-auto-fill-pages-integration*
*Completed: 2026-03-07*
