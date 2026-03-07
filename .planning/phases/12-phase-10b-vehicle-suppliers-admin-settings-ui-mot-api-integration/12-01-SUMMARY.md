---
phase: 12-phase-10b-vehicle-suppliers-admin-settings-ui-mot-api-integration
plan: 01
subsystem: ui
tags: [vehicle-suppliers, crud, admin, datatable, server-actions, shadcn]

requires:
  - phase: 11-phase-10a-vehicle-card-database-storage
    provides: vehicle_suppliers table + soft_delete_vehicle_supplier RPC in Supabase

provides:
  - Admin CRUD page at /admin/vehicle-suppliers (list, add, edit, toggle active, soft-delete)
  - Server Actions: getVehicleSuppliers, createVehicleSupplier, updateVehicleSupplier, toggleSupplierActive, deleteVehicleSupplier
  - Sidebar nav link "ספקי רכב" with Truck icon
  - Shared lib: src/lib/fleet/supplier-types.ts (VehicleSupplier type + SUPPLIER_TYPE_LABELS)

affects:
  - phase 13 (vehicle card — needs supplier IDs for FK fields: leasing, insurance, fuel card, garage)
  - phase 15 (AddVehicleDialog — supplier dropdowns use this data)

tech-stack:
  added: []
  patterns:
    - "Constants/types extracted to separate lib file when used by both 'use server' actions and 'use client' components (Next.js 16 Turbopack restriction: 'use server' cannot export non-async values)"
    - "Supplier phone normalization: attempt normalizePhone() for mobile, fallback to stripped raw for landlines"
    - "Re-usable SupplierFormDialog handles both add/edit via optional supplier prop"

key-files:
  created:
    - src/actions/fleet/vehicle-suppliers.ts
    - src/lib/fleet/supplier-types.ts
    - src/app/(admin)/admin/vehicle-suppliers/page.tsx
    - src/components/admin/vehicle-suppliers/VehicleSuppliersPage.tsx
    - src/components/ui/textarea.tsx
  modified:
    - src/components/shared/SidebarNav.tsx

key-decisions:
  - "SUPPLIER_TYPE_LABELS constant lives in src/lib/fleet/supplier-types.ts (not in 'use server' file) — Next.js 16 Turbopack enforces that 'use server' files can ONLY export async functions; re-exporting a const object causes build failure"
  - "Supplier phone allows landlines — normalizePhone() attempted first, raw stripped fallback if not mobile (relaxation of project mobile-only IRON RULE for vendor use case)"
  - "Textarea.tsx added to src/components/ui/ — was missing from shadcn install, needed for notes field"

patterns-established:
  - "Fleet shared types: src/lib/fleet/ directory for constants/types shared between server actions and client components"

duration: 35min
completed: 2026-03-07
---

# Phase 12 Plan 01: Vehicle Suppliers Admin CRUD Summary

**Full admin CRUD UI for vehicle suppliers (leasing, insurance, fuel card, garage) at /admin/vehicle-suppliers with DataTable, type filter, add/edit dialog, soft-delete via RPC, and sidebar link**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-03-07T00:00:00Z
- **Completed:** 2026-03-07
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- 5 Server Actions (getVehicleSuppliers, createVehicleSupplier, updateVehicleSupplier, toggleSupplierActive, deleteVehicleSupplier) — all with verifySession() guard + audit logging
- Soft-delete via `soft_delete_vehicle_supplier` RPC (project pattern maintained)
- Full CRUD client UI: DataTable with 7 columns, type filter buttons (הכל + per type), SupplierFormDialog (add+edit in one component), DeleteConfirmDialog, toggle active
- Badge colors per supplier type: leasing=blue, insurance=purple, fuel_card=amber, garage=green, other=gray
- Responsive: hidden columns on mobile, dialog with max-h-[90dvh], touch targets ≥44px
- Admin sidebar "ספקי רכב" link with Truck icon positioned before "הגדרות מערכת"

## Task Commits

1. **Task 1: Vehicle Suppliers Server Actions + Admin Sidebar Link** - `8d9fd8c` (feat)
2. **Task 2: Vehicle Suppliers Admin Page + CRUD UI** - `b31d95d` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/actions/fleet/vehicle-suppliers.ts` — 5 Server Actions with verifySession + audit + soft-delete RPC
- `src/lib/fleet/supplier-types.ts` — VehicleSupplier type + SUPPLIER_TYPE_LABELS constant (shared lib)
- `src/app/(admin)/admin/vehicle-suppliers/page.tsx` — Server page with verifySession + getVehicleSuppliers
- `src/components/admin/vehicle-suppliers/VehicleSuppliersPage.tsx` — Full CRUD client component
- `src/components/ui/textarea.tsx` — shadcn Textarea component (was missing)
- `src/components/shared/SidebarNav.tsx` — Added Truck icon + ספקי רכב nav item

## Decisions Made

- `SUPPLIER_TYPE_LABELS` extracted to `src/lib/fleet/supplier-types.ts` — Next.js 16 Turbopack enforces that `'use server'` files can ONLY export async functions; attempting to re-export a const object causes a build-time error ("A 'use server' file can only export async functions, found object").
- Supplier phones support landlines — `normalizePhone()` attempted first; if null (non-mobile number like `03-XXXXXXX`), stores stripped raw value. This is a deliberate relaxation of the project's mobile-only IRON RULE for vendor/supplier contact data.
- Single `SupplierFormDialog` component handles both add and edit via optional `supplier` prop — matches plan spec, reduces code duplication.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extracted SUPPLIER_TYPE_LABELS to separate lib file**
- **Found during:** Task 2 (production build)
- **Issue:** Next.js 16 Turbopack `'use server'` build error: "A 'use server' file can only export async functions, found object" — SUPPLIER_TYPE_LABELS was exported as a const from the server actions file
- **Fix:** Created `src/lib/fleet/supplier-types.ts` with VehicleSupplier type + SUPPLIER_TYPE_LABELS. Client component imports directly from lib; server action imports for internal use only (no re-export of objects)
- **Files modified:** src/lib/fleet/supplier-types.ts (created), src/actions/fleet/vehicle-suppliers.ts, src/components/admin/vehicle-suppliers/VehicleSuppliersPage.tsx
- **Verification:** `npm run build` passes cleanly, page appears in build output
- **Committed in:** b31d95d (Task 2 commit)

**2. [Rule 3 - Blocking] Added missing Textarea component**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** `@/components/ui/textarea` import not found — shadcn Textarea was not installed
- **Fix:** Created `src/components/ui/textarea.tsx` with standard shadcn Textarea implementation
- **Files modified:** src/components/ui/textarea.tsx (created)
- **Verification:** TypeScript passes, notes field renders in dialog
- **Committed in:** b31d95d (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were necessary for build/compile success. No scope creep — both items were implicit requirements of the plan's specified implementation.

## Issues Encountered

- Next.js 16 Turbopack is stricter than webpack about `'use server'` exports — even re-exports of non-async values cause build failure. This is a new constraint not yet documented in project patterns. Added to this SUMMARY as a pattern for future phases.

## User Setup Required

None — no external service configuration required. Vehicle suppliers table already exists from Phase 11 migration 00025.

## Next Phase Readiness

- Vehicle suppliers data can now be managed by admin
- Supplier IDs are available as FK targets for Phase 13 (vehicle card tabs — insurance, leasing, fuel card, garage dropdowns)
- Phase 12 Plan 02 (Fleet Settings + MOT API) can proceed in parallel (different feature area)

---
*Phase: 12-phase-10b-vehicle-suppliers-admin-settings-ui-mot-api-integration*
*Completed: 2026-03-07*

## Self-Check: PASSED
All files verified present. All commit hashes verified in git log.
