---
phase: 13-phase-10c-vehicle-server-actions-shared-fleet-components-extraction
plan: "02"
subsystem: fleet-ui-shared
tags: [refactor, components, shared, extraction, vehicle-fitness]
dependency_graph:
  requires:
    - "Phase 9 driver card components (DriverDocumentsSection, DriverLicenseSection, DriverViolationsSection)"
  provides:
    - "src/components/app/fleet/shared/ — 6 reusable fleet UI components"
    - "FleetDateInput, AlertToggle, ExpiryIndicator, FleetFilePreview, FleetUploadZone for driver + vehicle"
    - "VehicleFitnessLight + computeVehicleFitnessStatus for vehicle list/card"
  affects:
    - "Phase 14 (VehicleCard tabs) — imports shared components directly"
    - "Phase 15 (VehicleList) — uses VehicleFitnessLight"
tech_stack:
  added: []
  patterns:
    - "Shared component extraction — move from feature-specific to shared/ directory"
    - "VehicleFitnessLight separate from driver FitnessLight — avoid mega-generic component"
key_files:
  created:
    - src/components/app/fleet/shared/FleetDateInput.tsx
    - src/components/app/fleet/shared/AlertToggle.tsx
    - src/components/app/fleet/shared/ExpiryIndicator.tsx
    - src/components/app/fleet/shared/FleetFilePreview.tsx
    - src/components/app/fleet/shared/FleetUploadZone.tsx
    - src/components/app/fleet/shared/VehicleFitnessLight.tsx
  modified:
    - src/components/app/fleet/drivers/DriverDocumentsSection.tsx
    - src/components/app/fleet/drivers/DriverLicenseSection.tsx
    - src/components/app/fleet/drivers/DriverViolationsSection.tsx
  deleted:
    - src/components/app/fleet/drivers/FleetDateInput.tsx
decisions:
  - "VehicleFitnessLight uses separate red logic: test expired OR insurance expired = red (vs driver where only license = red)"
  - "DriverLicenseSection UploadZone (image upload) intentionally NOT extracted — different signature from FleetUploadZone (file+camera for docs/violations)"
  - "FitnessLight.tsx stays in drivers/ — driver-specific, separate from vehicle fitness"
metrics:
  duration: "~15 minutes"
  completed: "2026-03-07"
  tasks_completed: 2
  files_created: 6
  files_modified: 3
  files_deleted: 1
---

# Phase 13 Plan 02: Shared Fleet Components Extraction Summary

Extracted 5 reusable UI components from driver-specific files into `src/components/app/fleet/shared/`, and created `VehicleFitnessLight` for vehicle card use in Phase 14+.

## What Was Built

### Task 1 — Extract 5 Shared Components + Update Driver Imports

**New components in `src/components/app/fleet/shared/`:**

| Component | Extracted From | Purpose |
|-----------|---------------|---------|
| `FleetDateInput.tsx` | `drivers/FleetDateInput.tsx` (moved) | Three-select date picker (dd/mm/yyyy) |
| `AlertToggle.tsx` | Inline in DriverDocumentsSection + DriverLicenseSection (duplicated) | Bell toggle switch for alert_enabled fields |
| `ExpiryIndicator.tsx` | Inline in DriverDocumentsSection | Expiry date + days-remaining with color coding |
| `FleetFilePreview.tsx` | Inline `FilePreview` in DriverDocumentsSection + DriverViolationsSection | PDF/image preview with open/clear |
| `FleetUploadZone.tsx` | Inline `UploadZone` in DriverDocumentsSection | Drag-drop upload + camera button |

**Driver files updated:**
- `DriverDocumentsSection.tsx` — removed 4 inline components, added 4 shared imports, cleaned unused lucide imports
- `DriverLicenseSection.tsx` — removed inline `AlertToggle`, updated `FleetDateInput` import path, removed `Bell`/`Switch` imports
- `DriverViolationsSection.tsx` — updated `FleetDateInput` import path, replaced `FilePreview` with `FleetFilePreview`, removed `Eye`/`X` imports

### Task 2 — Create VehicleFitnessLight

**`src/components/app/fleet/shared/VehicleFitnessLight.tsx`:**

```typescript
export function computeVehicleFitnessStatus(
  testExpiryDate: string | null,
  insuranceMinExpiry: string | null,
  documentMinExpiry: string | null,
  yellowDays: number
): VehicleFitnessStatus
```

Vehicle-specific logic (different from driver FitnessLight):
- **Red:** test expired OR any insurance expired (road legality)
- **Yellow:** any of the 3 within yellowDays of expiry
- **Green:** all clear (null dates treated as green — no record yet)

`VehicleFitnessLight` renders a colored dot (`h-2.5 w-2.5 rounded-full`) with `animate-pulse` on red, tooltip text in Hebrew.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DriverLicenseSection had inline AlertToggle that needed full removal**
- **Found during:** Task 1 — TypeScript error after import update
- **Issue:** After adding `import { AlertToggle }`, the local `function AlertToggle` caused conflict error 2440; `Bell` and `Switch` also became undefined without the local function
- **Fix:** Removed the local `AlertToggle` function block + removed now-unused `Bell` and `Switch` imports
- **Files modified:** `src/components/app/fleet/drivers/DriverLicenseSection.tsx`
- **Commit:** `0fdaad4`

### Design Decisions

**DriverLicenseSection UploadZone not extracted:**
- The `UploadZone` in `DriverLicenseSection` handles image-only upload (front/back license photos) with a completely different props signature (`side`, `url`, `onFile`) compared to the generic `FleetUploadZone` (file+PDF, drag-drop, camera).
- Extracting it would require either: a complex union type, a separate component, or breaking the "simple generic" contract of `FleetUploadZone`.
- Decision: leave it as a local component in `DriverLicenseSection` — it is license-image-specific and won't be reused by vehicles (vehicles use different image handling).

## Commits

| Hash | Message |
|------|---------|
| `0fdaad4` | feat(13-02): extract shared fleet UI components from driver sections |
| `0c4d1aa` | feat(13-02): add VehicleFitnessLight shared component |

## Verification

- `npx tsc --noEmit` — zero errors
- `npm run build` — build succeeds, all fleet routes rendered
- `shared/` has exactly 6 files: FleetDateInput, AlertToggle, ExpiryIndicator, FleetFilePreview, FleetUploadZone, VehicleFitnessLight
- `drivers/FleetDateInput.tsx` deleted (moved to shared/)
- No inline AlertToggle/ExpiryIndicator/FilePreview/UploadZone remain in driver sections
- `drivers/FitnessLight.tsx` unchanged (confirmed via `git diff`)

## Self-Check: PASSED
