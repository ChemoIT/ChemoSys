---
phase: 12-phase-10b-vehicle-suppliers-admin-settings-ui-mot-api-integration
plan: 02
subsystem: api, ui, fleet
tags: [mot-api, data.gov.il, fleet-settings, env-vars, server-actions, vehicle-sync]

# Dependency graph
requires:
  - phase: 11-phase-10a-vehicle-card-database-storage
    provides: vehicles table + vehicle_tests table for MOT sync writes
  - phase: 12-phase-10b-plan-01
    provides: FleetSettings component + settings.ts patterns to extend

provides:
  - syncVehicleFromMot() Server Action — fetches vehicle data from MOT API, updates vehicles table, inserts vehicle_tests
  - testMotApiConnection() Server Action — validates data.gov.il API reachability
  - MotVehicleData type with all 15 MOT API fields
  - parseMoedAliya() helper — converts MOT "YYYY-M" format to PostgreSQL DATE "YYYY-MM-01"
  - FleetSettingsData extended with 4 vehicle threshold fields (test/insurance yellow/red)
  - Fleet Settings UI: vehicle test + insurance threshold sections + MOT API test button
  - 4 new env vars: FLEET_TEST_YELLOW_DAYS, FLEET_TEST_RED_DAYS, FLEET_INSURANCE_YELLOW_DAYS, FLEET_INSURANCE_RED_DAYS

affects:
  - phase-13: vehicle computed status (uses test/insurance thresholds from env)
  - phase-14: VehicleCard tabs — calls syncVehicleFromMot when adding/editing vehicle
  - phase-15: AddVehicleDialog — MOT API auto-fill on license plate entry

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MOT API fetch: Number(plate) not String — API requires numeric mispar_rechev"
    - "parseMoedAliya: YYYY-M → YYYY-MM-01 for PostgreSQL DATE column"
    - "Env thresholds: all fleet alert days read via readEnvFile() → ENV_KEY_MAP → writeEnvValues()"
    - "use server constraint: constants/types must NOT be in use server files — use @/lib/fleet/ instead"
    - "Independent useTransition for MOT test button (separate from save transition)"

key-files:
  created:
    - src/actions/fleet/mot-sync.ts
    - src/lib/fleet/supplier-types.ts
  modified:
    - src/actions/settings.ts
    - src/components/admin/settings/FleetSettings.tsx
    - src/actions/fleet/vehicle-suppliers.ts
    - src/components/admin/vehicle-suppliers/VehicleSuppliersPage.tsx

key-decisions:
  - "MOT API requires mispar_rechev as NUMBER not string — strip non-digits then convert with Number()"
  - "parseMoedAliya uses day=01 (first of month) — MOT only provides year+month"
  - "vehicle_tests INSERT is simple (not upsert) — test history accumulates; no unique constraint on vehicle_id+test_date"
  - "testMotApiConnection uses plate 6242255 (public bus) — always present in MOT registry"
  - "SUPPLIER_TYPE_LABELS moved to @/lib/fleet/supplier-types.ts — use server files can only export async functions"
  - "Vehicle threshold defaults: yellow=60 days, red=30 days (mirrors existing driver thresholds)"

patterns-established:
  - "fleet-constants pattern: shared non-async values live in @/lib/fleet/*.ts, imported by both server actions and client components"

# Metrics
duration: 8min
completed: 2026-03-07
---

# Phase 12 Plan 02: MOT API + Fleet Settings Vehicle Thresholds Summary

**MOT API Server Action fetching vehicle data from data.gov.il with numeric plate conversion, parseMoedAliya date helper, and Fleet Settings extended with vehicle test/insurance thresholds + API connectivity test button**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-07T17:54:17Z
- **Completed:** 2026-03-07T18:02:55Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `syncVehicleFromMot()` — full MOT sync: plate→Number conversion, vehicle UPDATE (15 MOT fields), vehicle_tests INSERT when dates available, revalidatePath
- `testMotApiConnection()` — tests API reachability via known plate (bus 6242255), returns TestResult
- Fleet Settings UI extended with 4 new threshold sections (vehicle test yellow/red, vehicle insurance yellow/red)
- MOT API test button with independent loading state and sonner toast feedback
- All 4 new env vars wired through existing ENV_KEY_MAP pipeline

## Task Commits

1. **Task 1: MOT API Server Action** - `6d1b2b9` (feat)
2. **Task 2: Fleet Settings Extension** - `bee1890` (feat)
3. **Cleanup: remove redundant fleet-constants.ts** - `9bcb727` (fix)

## Files Created/Modified

- `src/actions/fleet/mot-sync.ts` — New: syncVehicleFromMot, testMotApiConnection, MotVehicleData type, parseMoedAliya helper
- `src/actions/settings.ts` — Extended FleetSettingsData with 4 vehicle threshold fields + ENV_KEY_MAP + getIntegrationSettings
- `src/components/admin/settings/FleetSettings.tsx` — Extended UI: 4 new threshold sections + MOT test button + 4 new state vars + validation
- `src/lib/fleet/supplier-types.ts` — New: VehicleSupplier type + SUPPLIER_TYPE_LABELS (extracted from use server file)
- `src/actions/fleet/vehicle-suppliers.ts` — Fixed: removed object export (use server constraint), imports from fleet-constants
- `src/components/admin/vehicle-suppliers/VehicleSuppliersPage.tsx` — Fixed: imports from correct source files

## Decisions Made

- MOT API requires `mispar_rechev` as **NUMBER** — strip non-digits then `Number()`. String values silently return empty results.
- `parseMoedAliya("2017-3")` → `"2017-03-01"` — day fixed to 01 since MOT only provides year+month.
- `vehicle_tests` INSERT (not upsert) — test history accumulates; duplicate test dates are acceptable.
- Test connectivity using plate `6242255` (public bus) — always in MOT registry, never changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SUPPLIER_TYPE_LABELS object export in `use server` file**
- **Found during:** Task 2 (build verification)
- **Issue:** `vehicle-suppliers.ts` had `export const SUPPLIER_TYPE_LABELS = {...}` — Next.js 16 throws "A 'use server' file can only export async functions, found object"
- **Fix:** Created `src/lib/fleet/supplier-types.ts` with VehicleSupplier type + SUPPLIER_TYPE_LABELS. Updated vehicle-suppliers.ts to import from there (removed export). Updated VehicleSuppliersPage.tsx imports.
- **Files modified:** src/lib/fleet/supplier-types.ts (created), src/actions/fleet/vehicle-suppliers.ts, src/components/admin/vehicle-suppliers/VehicleSuppliersPage.tsx
- **Verification:** `npm run build` passes cleanly
- **Committed in:** bee1890 + 9bcb727

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug)
**Impact on plan:** Fix was required for production build to succeed. Pattern `@/lib/fleet/` established for shared non-async fleet constants.

## Issues Encountered

- First `npm run build` run showed MODULE_NOT_FOUND errors — second run succeeded (transient Turbopack worker issue, not a real error)

## Self-Check: PASSED

- [x] `src/actions/fleet/mot-sync.ts` — EXISTS
- [x] `src/actions/settings.ts` — EXISTS (testYellowDays/testRedDays/insuranceYellowDays/insuranceRedDays in FleetSettingsData + ENV_KEY_MAP)
- [x] `src/components/admin/settings/FleetSettings.tsx` — EXISTS (4 new sections + MOT test button)
- [x] `src/lib/fleet/supplier-types.ts` — EXISTS
- [x] Commits `6d1b2b9`, `bee1890`, `9bcb727` — verified in git log
- [x] `npx tsc --noEmit` — PASSES
- [x] `npm run build` — PASSES

## Next Phase Readiness

- **Phase 13 (10C):** Vehicle Server Actions + shared fleet components — can use `syncVehicleFromMot()` directly. Threshold env vars ready for computed status logic.
- **Phase 14 (10E):** VehicleCard tabs — MOT sync button can call `syncVehicleFromMot(vehicleId, plate)`.
- **Phase 15 (10F):** AddVehicleDialog — MOT auto-fill on plate entry via `syncVehicleFromMot`.

---
*Phase: 12-phase-10b-vehicle-suppliers-admin-settings-ui-mot-api-integration*
*Completed: 2026-03-07*
