---
phase: 18-vehicle-card-redesign-ownership-tab-licensing-insurance-tab
plan: 03
subsystem: ui
tags: [react, nextjs, vehicle-card, tabs, fleet, licensing, insurance, ownership]

# Dependency graph
requires:
  - phase: 18-01
    provides: VehicleMonthlyCost type + getVehicleMonthlyCosts server action + vehicle-ownership.ts
  - phase: 18-02
    provides: VehicleOwnershipSection.tsx + VehicleOwnershipJournal.tsx (Tab 2 ownership UI)
  - phase: 19-02
    provides: 7-tab VehicleCard shell (deleted CostsSection, added assignment tab)
provides:
  - VehicleLicensingSection.tsx — merged wrapper combining VehicleTestsSection + VehicleInsuranceSection
  - VehicleCard.tsx with final 7-tab structure (details/ownership/licensing/assignment/documents/notes/km)
  - page.tsx fetches monthly costs and passes to VehicleCard
affects: [future-km-tab, future-replacement-tab]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - VehicleLicensingSection OR-merges dirty states from two sub-sections into single onEditingChange
    - Tab restructure: import swap + TAB_LABELS update + TabsList array + TabsContent replacement

key-files:
  created:
    - src/components/app/fleet/vehicles/VehicleLicensingSection.tsx
  modified:
    - src/components/app/fleet/vehicles/VehicleCard.tsx
    - src/app/(app)/app/fleet/vehicle-card/[id]/page.tsx

key-decisions:
  - "VehicleLicensingSection uses useRef booleans (not useState) to OR dirty states — avoids re-render on sub-section dirty change"
  - "VehicleInsuranceSection self-fetches suppliers on mount — no suppliers prop passed from VehicleCard"
  - "docYellowDays (not yellowDays) passed to VehicleLicensingSection — test/insurance use doc thresholds, not license thresholds"
  - "VehicleOwnershipSection renders its own border/padding wrapper — Tab 2 TabsContent has no outer wrapper div"

# Metrics
duration: 6min
completed: 2026-03-08
---

# Phase 18 Plan 03: VehicleLicensingSection + VehicleCard Tab Restructure Summary

**7-tab VehicleCard with merged "רישוי וביטוח" tab (VehicleTestsSection + VehicleInsuranceSection) and new "בעלות" tab (VehicleOwnershipSection), page.tsx fetches monthly costs via getVehicleMonthlyCosts**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-08T06:40:24Z
- **Completed:** 2026-03-08T06:45:41Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Created VehicleLicensingSection.tsx — thin wrapper merging VehicleTestsSection + VehicleInsuranceSection with OR dirty state logic
- Restructured VehicleCard from tests/insurance separate tabs to ownership/licensing combined tabs (7 tabs total)
- page.tsx now fetches VehicleMonthlyCosts in parallel with other vehicle data and passes to VehicleCard
- Zero TypeScript errors across all modified files

## Task Commits

Each task was committed atomically:

1. **Task 1: Create VehicleLicensingSection.tsx + delete VehicleCostsSection.tsx** - `b353d73` (feat)
2. **Task 2: Update VehicleCard.tsx (7 tabs) + page.tsx (monthly costs fetch)** - `a44b844` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `src/components/app/fleet/vehicles/VehicleLicensingSection.tsx` — merged licensing tab wrapper (VehicleTestsSection + divider + VehicleInsuranceSection), ORs dirty states
- `src/components/app/fleet/vehicles/VehicleCard.tsx` — 7-tab restructure: ownership/licensing tabs replace tests/insurance tabs, costs prop added
- `src/app/(app)/app/fleet/vehicle-card/[id]/page.tsx` — getVehicleMonthlyCosts added to Promise.all, costs passed to VehicleCard

## Decisions Made
- VehicleLicensingSection uses `useRef<boolean>` (not `useState`) for sub-section dirty tracking — no re-renders on dirty change, single `onEditingChange` callback upstream
- VehicleInsuranceSection self-fetches insurance suppliers internally — no suppliers prop needed or passed from VehicleCard
- `docYellowDays` (not `yellowDays`) passed to VehicleLicensingSection — tests and insurance documents use the document threshold, consistent with VehicleDocumentsSection
- VehicleOwnershipSection renders its own outer container (border/padding) — Tab 2 TabsContent has no extra wrapper div to avoid double-border

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

**Note:** VehicleCostsSection.tsx was already deleted in commit `fe22dc6` (feat(19-02)), and VehicleOwnershipSection.tsx was already created in commit `0860c29` (feat(18-02)). Both prerequisites existed before this plan ran.

## Issues Encountered
- STATE.md showed "Plan 01 COMPLETE" but Plans 02+03 (from Phase 19-02) were already committed. History was non-sequential (Phase 19 ran before Phase 18 due to roadmap evolution). No impact on execution.
- VehicleCostsSection.tsx already deleted — Task 1B was a no-op (correct behavior).
- VehicleOwnershipSection.tsx already existed (committed in 18-02) — no stub needed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- VehicleCard now has the final 7-tab structure: פרטי הרכב, בעלות, רישוי וביטוח, צמידות, מסמכים, הערות, ק"מ
- Ownership tab fully functional (VehicleOwnershipSection + VehicleOwnershipJournal)
- Licensing tab fully functional (VehicleTestsSection + VehicleInsuranceSection merged)
- Monthly costs fetched server-side in parallel with other vehicle data
- Phase 18 complete — VehicleCard redesign shipped

---
*Phase: 18-vehicle-card-redesign-ownership-tab-licensing-insurance-tab*
*Completed: 2026-03-08*
