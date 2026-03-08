---
phase: 17-vehicle-card-redesign-details-images-replacement
plan: "01"
subsystem: fleet-vehicles
tags:
  - vehicle-types
  - vehicle-replacement
  - vehicle-images
  - vehicle-details-section
  - add-vehicle-dialog
  - fleet-date-input
dependency_graph:
  requires:
    - "16-02: migrations 00027+00028 verified in Supabase"
  provides:
    - "VehicleImage, VehicleFuelCard, VehicleReplacementRecord types"
    - "VEHICLE_STATUS_LABELS, REPLACEMENT_REASON_LABELS constants"
    - "vehicle-replacement.ts: 6 server actions"
    - "getVehicleImages, addVehicleImage, deleteVehicleImage in vehicles.ts"
    - "VehicleImageGallery component"
    - "VehicleDetailsSection rebuilt with lock logic + gallery"
    - "AddVehicleDialog without company selector"
  affects:
    - "17-02: ReplacementVehicleDialog consumes vehicle-replacement.ts"
tech_stack:
  added:
    - "VehicleImageGallery — 5-slot gallery with Supabase storage upload + lightbox"
  patterns:
    - "Lock pattern: LOCKED_STATUSES array drives isLocked boolean, disables all selects except vehicle_status"
    - "Image position conflict: addVehicleImage deletes existing before insert (server-side)"
    - "is_active derived from vehicle_status (not separate field)"
key_files:
  created:
    - src/actions/fleet/vehicle-replacement.ts
    - src/components/app/fleet/vehicles/VehicleImageGallery.tsx
  modified:
    - src/lib/fleet/vehicle-types.ts
    - src/actions/fleet/vehicles.ts
    - src/components/app/fleet/vehicles/VehicleDetailsSection.tsx
    - src/components/app/fleet/vehicles/AddVehicleDialog.tsx
    - src/components/app/fleet/shared/FleetDateInput.tsx
decisions:
  - "[17-01] VEHICLE_TYPE_LABELS: 4 values (private/commercial/truck/trailer) matching migration 00027 CHECK constraint"
  - "[17-01] is_active derived from vehicle_status in updateVehicleDetails — not separate field"
  - "[17-01] vehicle_fuel_cards: hard-delete (consistent with [16-01] decision for binary assets)"
  - "[17-01] VehicleImageGallery: client-side upload to storage, then server action for metadata — avoids base64 overhead"
  - "[17-01] FleetDateInput: disabled prop added (auto-fix Rule 2 — missing functionality for lock support)"
metrics:
  duration_minutes: 60
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 5
  completed_date: "2026-03-08"
---

# Phase 17 Plan 01: Vehicle Types + Images + Replacement Infrastructure Summary

**One-liner:** TypeScript types/constants, 6 vehicle-replacement server actions, 3 image server actions, VehicleImageGallery component, and VehicleDetailsSection rebuilt with vehicle_status lock logic and image gallery.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | vehicle-types.ts + vehicle-replacement.ts | d538a32 | vehicle-types.ts, vehicle-replacement.ts, vehicles.ts |
| 2 | vehicles.ts updates (createVehicle + image actions) | d538a32 | vehicles.ts |
| 3 | AddVehicleDialog + VehicleImageGallery + VehicleDetailsSection | a665c75 | AddVehicleDialog.tsx, VehicleImageGallery.tsx, VehicleDetailsSection.tsx, FleetDateInput.tsx |

## What Was Built

### vehicle-types.ts
- `VEHICLE_TYPE_LABELS`: 4 values (private/commercial/truck/trailer) — replacing old 7-value set
- `VEHICLE_STATUS_LABELS`: 5 values (active/suspended/returned/sold/decommissioned)
- `REPLACEMENT_REASON_LABELS`: 4 values (maintenance/test/accident/other)
- `VehicleImage`, `VehicleFuelCard`, `VehicleReplacementRecord` types added
- `VehicleFull` extended with `vehicleStatus` and `fleetExitDate`

### vehicle-replacement.ts (new)
6 server actions with `verifyAppUser()` guard:
- `getVehicleReplacementRecords` — fetches with fuel cards join
- `addVehicleReplacementRecord` — validates active-only-one rule, sets vehicle to suspended
- `updateVehicleReplacementRecord` — updates record, restores vehicle to active if returned
- `deleteVehicleReplacementRecord` — RPC soft_delete_vehicle_replacement_record
- `addVehicleFuelCard` — digits-only validation
- `deleteVehicleFuelCard` — hard-delete (decision [16-01])

### vehicles.ts
- `createVehicle(licensePlate)` — removed companyId requirement
- `UpdateVehicleInput` — replaced `isActive` with `vehicleStatus` + `fleetExitDate`
- `updateVehicleDetails` — `is_active` now derived from `vehicle_status`
- `getVehicleImages`, `addVehicleImage`, `deleteVehicleImage` added

### VehicleImageGallery.tsx (new)
- 5 slots always visible (empty/uploading/filled states)
- Client-side upload to `vehicle-images` bucket via Supabase browser client
- Server action `addVehicleImage` saves metadata after upload
- Lightbox dialog for full-size view
- Delete button on hover (position-aware)
- `isLocked` prop disables all interactions

### VehicleDetailsSection.tsx (rebuilt)
- Removed `isActive` switch
- Added `vehicleStatus` select (always enabled — even when locked)
- Added `fleetExitDate` FleetDateInput
- All other selects disabled when `isLocked`
- Amber lock badge when locked
- `VehicleImageGallery` embedded at top of edit column
- "ניהול רכב חלופי" button (placeholder for Plan 17-02)
- Validation: locked status requires fleetExitDate before save

### AddVehicleDialog.tsx
- Removed company selector entirely
- `createVehicle(plate)` — no companyId
- `handleLookup()` requires plate only
- Step 1 description updated

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Functionality] FleetDateInput missing disabled prop**
- **Found during:** Task 3
- **Issue:** VehicleDetailsSection needed to disable FleetDateInput when card is locked, but the component had no `disabled` prop
- **Fix:** Added `disabled?: boolean` prop to FleetDateInputProps, passed to all 3 `<select>` elements
- **Files modified:** `src/components/app/fleet/shared/FleetDateInput.tsx`
- **Commit:** a665c75

**2. [Rule 1 - Bug] vehicles.ts duplicate vehicleStatus in getVehicleById return**
- **Found during:** Task 2 verification (TypeScript error TS1117)
- **Issue:** Two separate scripts both added vehicleStatus/fleetExitDate to the return object (file was modified between read and write operations)
- **Fix:** Removed duplicate vehicleStatus + fleetExitDate lines at position 221-222
- **Files modified:** `src/actions/fleet/vehicles.ts`
- **Commit:** d538a32

## Self-Check: PASSED

All files verified:
- FOUND: vehicle-replacement.ts (6 exported async functions)
- FOUND: VehicleImageGallery.tsx
- FOUND: vehicle-types.ts (VEHICLE_STATUS_LABELS, VehicleImage, VehicleReplacementRecord, vehicleStatus in VehicleFull)
- FOUND: VehicleDetailsSection.tsx (VehicleImageGallery, LOCKED_STATUSES)
- FOUND: AddVehicleDialog.tsx (createVehicle(plate) — no companyId state)
- Commits verified: d538a32, a665c75
- TypeScript: zero errors
- Build: passed
