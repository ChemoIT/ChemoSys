---
phase: 21-app-pages-suspense-loading
plan: 02
subsystem: ui
tags: [suspense, skeleton, loading, next.js, vehicle-card, react]

# Dependency graph
requires:
  - phase: 20-performance-standards
    provides: "FuelPageSkeleton reference pattern + shimmer animation + performance standard document"
provides:
  - "VehicleCardSkeleton component — shimmer bar + breadcrumb + header + 8-tab strip + content area"
  - "vehicle-card/[id]/page.tsx with Suspense boundary using VehicleCardSkeleton fallback"
affects:
  - 21-app-pages-suspense-loading (plans 03, 04 — driver card + remaining app pages)
  - 22-admin-pages-suspense-loading

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Suspense wrapper pattern: thin page.tsx (auth only) + inner VehicleCardContent async component"
    - "Custom skeleton for unique layouts (card with tabs) — PageSkeleton reuse not appropriate"

key-files:
  created:
    - src/components/app/fleet/vehicles/VehicleCardSkeleton.tsx
  modified:
    - src/app/(app)/app/fleet/vehicle-card/[id]/page.tsx

key-decisions:
  - "VehicleCard page split: page.tsx owns only auth + Suspense; VehicleCardContent owns all data fetching"
  - "No tab-switch loading indicator needed — all tab data fetched upfront via Promise.all (LOAD-03 satisfied by design)"
  - "Custom skeleton required (not PageSkeleton) — vehicle card has unique layout with tabs + card header"

patterns-established:
  - "Vehicle card Suspense pattern: verifyAppUser() + Suspense(VehicleCardSkeleton) + VehicleCardContent(id)"
  - "Custom card skeleton: shimmer bar at top → breadcrumb → accent-gradient header → tab strip → form content area"

# Metrics
duration: 3min
completed: 2026-03-09
---

# Phase 21 Plan 02: Vehicle Card Suspense + Skeleton Summary

**VehicleCardSkeleton with shimmer bar + 8-tab strip replaces blank screen on /app/fleet/vehicle-card/[id], page.tsx refactored to Suspense wrapper + inner async VehicleCardContent component**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-09T19:11:32Z
- **Completed:** 2026-03-09T19:14:27Z
- **Tasks:** 2 of 2
- **Files modified:** 2

## Accomplishments
- Created VehicleCardSkeleton mirroring exact VehicleCard layout: animated shimmer bar + RTL breadcrumb + card header (teal accent + avatar + action buttons) + 8-tab strip + form content area skeleton
- Refactored vehicle-card/[id]/page.tsx to Suspense pattern: thin auth wrapper renders `<Suspense fallback={<VehicleCardSkeleton />}>` around VehicleCardContent inner async component
- All data fetching (Promise.all with 7 queries + companies query + env reads + expiry computations) moved into VehicleCardContent — `notFound()` correctly placed after data fetch
- TypeScript clean, Next.js build passes, SKEL-APP-02 and LOAD-03 requirements satisfied

## Task Commits

Each task was committed atomically:

1. **Task 1: Create VehicleCardSkeleton component** - `275e258` (feat)
2. **Task 2: Refactor vehicle-card/[id]/page.tsx with Suspense boundary** - `abb65a7` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `src/components/app/fleet/vehicles/VehicleCardSkeleton.tsx` - Custom skeleton for vehicle card detail page: shimmer bar + breadcrumb + card header (teal accent gradient, avatar, 2 action button skeletons) + 8-tab strip + 3 form section placeholders. max-w-[calc(100%-6cm)], dir=rtl
- `src/app/(app)/app/fleet/vehicle-card/[id]/page.tsx` - Refactored to Suspense wrapper: page.tsx = auth + Suspense only; inner VehicleCardContent async component owns all data fetching

## Decisions Made
- VehicleCard tab data all fetched upfront via Promise.all — no lazy loading on tab switch currently → LOAD-03 satisfied by design (no useTransition needed for tab switches). If tabs are later refactored to lazy-load, add LoadingIndicator at that point.
- PageSkeleton (from Plan 01) not reused — vehicle card is a unique card-with-tabs layout, not a standard list/table page
- notFound() kept inside VehicleCardContent (correct: needs data to determine 404)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
- Stale `.next/lock` file from a prior build process blocked `npm run build` — removed manually, build succeeded on retry.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- SKEL-APP-02 complete: vehicle-card/[id] page shows skeleton immediately, no blank screen
- LOAD-03 satisfied: tab data fetched upfront, no tab-switch loading indicator needed
- Ready for Plan 03 (driver card) and Plan 04 (remaining app pages)
- Pattern established: thin page.tsx + inner async content component is the standard for all remaining app pages in Phase 21

---
*Phase: 21-app-pages-suspense-loading*
*Completed: 2026-03-09*

## Self-Check: PASSED

- [x] `src/components/app/fleet/vehicles/VehicleCardSkeleton.tsx` — FOUND
- [x] `src/app/(app)/app/fleet/vehicle-card/[id]/page.tsx` — FOUND (contains Suspense + VehicleCardSkeleton)
- [x] `.planning/phases/21-app-pages-suspense-loading/21-02-SUMMARY.md` — FOUND
- [x] Commit `275e258` — feat(21-02): create VehicleCardSkeleton component — FOUND
- [x] Commit `abb65a7` — feat(21-02): refactor vehicle-card page with Suspense boundary — FOUND
