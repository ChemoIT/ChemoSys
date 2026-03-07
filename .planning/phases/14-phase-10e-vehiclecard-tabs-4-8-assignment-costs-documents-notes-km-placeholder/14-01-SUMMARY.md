---
phase: 14-phase-10e-vehiclecard-tabs-4-8-assignment-costs-documents-notes-km-placeholder
plan: 01
subsystem: ui
tags: [nextjs, supabase, react, tailwind, vehicle-card, fleet, shadcn]

# Dependency graph
requires:
  - phase: 13-phase-10c-vehicle-server-actions-shared-fleet-components
    provides: vehicle server actions (getVehicleById, getVehicleTests, getVehicleInsurance, getVehicleDocuments, updateVehicleDetails, addVehicleTest, updateVehicleTest, deleteVehicleTest, addVehicleInsurance, updateVehicleInsurance, deleteVehicleInsurance, deleteVehicleWithPassword), VehicleFitnessLight, FleetDateInput, AlertToggle, ExpiryIndicator, FleetUploadZone

provides:
  - VehicleCard page at /app/fleet/vehicle-card/[id] with 8-tab shell
  - getActiveSuppliersByType() server action for supplier dropdowns
  - VehicleDetailsSection (Tab 1) — MOT read-only + operational editable fields with save
  - VehicleTestsSection (Tab 2) — test history CRUD with file upload and quick expiry
  - VehicleInsuranceSection (Tab 3) — insurance policies CRUD with supplier dropdown
  - Tabs 4-8 as placeholders (שיוך נהג, עלויות, מסמכים, הערות, ק"מ)
  - Dirty tracking infrastructure + unsaved changes Dialog

affects:
  - 14-02 (plan 02 populates tabs 4-8 with real content)
  - 15-phase-10f-vehiclelist (vehicle card page ready for navigation from vehicle list)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - VehicleCard mirrors DriverCard pattern (controlled tabs, dirty tracking via useRef, unsaved Dialog)
    - Server page fetches all data in parallel via Promise.all + passes as props
    - Supplier dropdowns fetched client-side on mount via getActiveSuppliersByType
    - PlaceholderTab component for future tabs 4-8
    - Signed URLs (1-year) for fleet-vehicle-documents bucket uploads

key-files:
  created:
    - src/app/(app)/app/fleet/vehicle-card/[id]/page.tsx
    - src/components/app/fleet/vehicles/VehicleCard.tsx
    - src/components/app/fleet/vehicles/VehicleDetailsSection.tsx
    - src/components/app/fleet/vehicles/VehicleTestsSection.tsx
    - src/components/app/fleet/vehicles/VehicleInsuranceSection.tsx
  modified:
    - src/actions/fleet/vehicles.ts

key-decisions:
  - "[14-01] getActiveSuppliersByType uses verifyAppUser (not verifySession) — ChemoSys context; filters is_active=true + deleted_at IS NULL"
  - "[14-01] Companies fetched directly via supabase in server page (no getCompanies action) — pattern: query simple reference data inline"
  - "[14-01] syncVehicleFromMot uses verifySession (admin) — MOT sync is admin-only operation; VehicleDetailsSection calls it correctly"
  - "[14-01] VehicleCard avatar = first 2 chars of plate digits — visually identifies vehicle type"
  - "[14-01] Tabs 4-8 = PlaceholderTab component — separated cleanly for Plan 14-02 to fill"
  - "[14-01] onNotesEditingChange passed in VehicleCard but Tab 7 is placeholder — ready for Plan 14-02"

patterns-established:
  - "VehicleCard pattern: server page fetches all data → client VehicleCard receives as props → sections get subset props"
  - "Supplier dropdown pattern: getActiveSuppliersByType('type') called in useEffect on mount, stored in local state"
  - "MOT read-only column: gray rounded box with all MOT fields + sync button at bottom"

# Metrics
duration: 45min
completed: 2026-03-07
---

# Phase 14 Plan 01: VehicleCard Infrastructure + Tabs 1-3 Summary

**VehicleCard page at /app/fleet/vehicle-card/[id] with 8-tab shell, MOT read-only details section, vehicle test history CRUD, and insurance policy CRUD — all with file upload and dirty tracking**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-03-07T19:16:31Z
- **Completed:** 2026-03-07T~20:00Z
- **Tasks:** 2
- **Files modified:** 6 (1 modified + 5 created)

## Accomplishments
- VehicleCard server page at `/app/fleet/vehicle-card/[id]` with parallel data fetch for vehicle, tests, insurance, documents + companies
- VehicleCard client shell with header (avatar, formatted license plate, fitness light, status badge), 8 RTL tabs, controlled tab switching, dirty tracking via `useRef<Record<string, boolean>>`, unsaved changes Dialog
- VehicleDetailsSection: two-column grid — MOT fields read-only (gray box, 13 fields) + operational editable (vehicle type, ownership, company, is_active, 4 supplier dropdowns) with save
- VehicleTestsSection: test history list with passed/failed badge, ExpiryIndicator, cost, file link, add/edit/delete form with FleetDateInput + quick expiry buttons + AlertToggle + FleetUploadZone
- VehicleInsuranceSection: insurance policies list with type label, supplier name, expiry, policy number, add/edit/delete form with supplier dropdown (fetched from insurance suppliers)
- Build passes with zero TypeScript errors — `/app/fleet/vehicle-card/[id]` dynamic route confirmed

## Task Commits

1. **Task 1: getActiveSuppliersByType + VehicleCard server page + shell** - `1c01979` (feat)
2. **Task 2: VehicleDetailsSection + VehicleTestsSection + VehicleInsuranceSection** - `b7e4568` (feat)

## Files Created/Modified
- `src/actions/fleet/vehicles.ts` — added `getActiveSuppliersByType()` server action
- `src/app/(app)/app/fleet/vehicle-card/[id]/page.tsx` — server page with Promise.all data fetch + companies query
- `src/components/app/fleet/vehicles/VehicleCard.tsx` — 8-tab shell, header, dirty tracking, delete dialog, unsaved dialog
- `src/components/app/fleet/vehicles/VehicleDetailsSection.tsx` — Tab 1: MOT read-only + operational editable
- `src/components/app/fleet/vehicles/VehicleTestsSection.tsx` — Tab 2: test history CRUD + file upload
- `src/components/app/fleet/vehicles/VehicleInsuranceSection.tsx` — Tab 3: insurance policies CRUD + supplier dropdown

## Decisions Made
- `getActiveSuppliersByType` uses `verifyAppUser()` not `verifySession()` — ChemoSys context, not admin
- Companies fetched inline in server page via supabase (no dedicated action needed for simple reference data)
- `syncVehicleFromMot` uses `verifySession()` (admin guard) — intentional, MOT sync is admin-level operation
- Avatar shows first 2 chars of license plate digits for quick visual identification
- Tabs 4-8 render `PlaceholderTab` component — clean separation for Plan 14-02

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — build passed on first attempt with zero TypeScript errors.

## Next Phase Readiness
- VehicleCard page fully functional for tabs 1-3 (פרטי הרכב, טסטים, ביטוח)
- Tabs 4-8 placeholders ready for Plan 14-02 (שיוך נהג, עלויות, מסמכים, הערות, ק"מ)
- Plan 14-02 can import VehicleCard and replace PlaceholderTab instances with real content
- No blockers

---
*Phase: 14-phase-10e-vehiclecard-tabs-4-8-assignment-costs-documents-notes-km-placeholder*
*Completed: 2026-03-07*
