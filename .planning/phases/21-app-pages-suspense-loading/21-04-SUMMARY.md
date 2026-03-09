---
phase: 21-app-pages-suspense-loading
plan: 04
subsystem: ui
tags: [suspense, skeleton, driver-card, fleet, performance, loading]

# Dependency graph
requires:
  - phase: 20-performance-standards
    provides: FuelPageSkeleton pattern + shimmer animation + performance-standard.md
  - phase: 21-app-pages-suspense-loading/21-01
    provides: Suspense pattern established for fleet pages

provides:
  - DriverCardSkeleton component for driver card detail page
  - Suspense boundary on /app/fleet/driver-card/[id] — no blank screen on load
  - Inner async DriverCardContent component pattern

affects:
  - phase-22 (admin pages)
  - any future refactor of driver card to lazy-load tab data

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Suspense wrapper pattern: sync page.tsx (auth + Suspense) + inner async Content component
    - DriverCardSkeleton mirrors real card: breadcrumb + header with accent bar + avatar + action buttons + 5-tab strip + content rows

key-files:
  created:
    - src/components/app/fleet/drivers/DriverCardSkeleton.tsx
  modified:
    - src/app/(app)/app/fleet/driver-card/[id]/page.tsx

key-decisions:
  - "Tab loading indicators NOT needed — DriverCard fetches all tab data upfront via Promise.all; no tab-switch lazy loading exists"
  - "DriverCardContent inner async component holds all Promise.all fetching + env reads (yellowDays, redDays, docYellowDays)"

patterns-established:
  - "DriverCard uses max-w-4xl (not max-w-[calc(100%-6cm)]) — skeleton must match this container width"
  - "Teal accent bar on card header must be replicated in skeleton (linear-gradient, same colors)"

# Metrics
duration: 15min
completed: 2026-03-09
---

# Phase 21 Plan 04: DriverCard Suspense + Skeleton Summary

**DriverCard detail page gets Suspense boundary with custom skeleton mirroring tabbed card layout — shimmer bar + breadcrumb + header with avatar + 5-tab strip + content rows**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-09T19:05:00Z
- **Completed:** 2026-03-09T19:20:00Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 refactored)

## Accomplishments

- Created DriverCardSkeleton with animated shimmer bar, teal accent bar, breadcrumb, 4 action buttons, avatar, name placeholder, 5-tab strip, and 6 content rows
- Refactored [id]/page.tsx: sync shell with Suspense + inner async DriverCardContent with all Promise.all fetching
- notFound() preserved inside DriverCardContent — invalid IDs still return 404 correctly
- TypeScript compilation: zero errors

## Task Commits

1. **Task 1: Create DriverCardSkeleton component** - `1809e6e` (feat)
2. **Task 2: Refactor driver-card page.tsx with Suspense boundary** - `5426600` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/components/app/fleet/drivers/DriverCardSkeleton.tsx` — Skeleton for driver card detail page: shimmer bar + breadcrumb + card header with teal accent bar + action buttons + avatar + 5-tab strip + content rows
- `src/app/(app)/app/fleet/driver-card/[id]/page.tsx` — Refactored: sync page shell with Suspense + DriverCardContent inner async component

## Decisions Made

- Tab loading indicators (LOAD-04) not needed: DriverCard fetches ALL tab data upfront in a single Promise.all — no lazy loading per tab exists. If tabs are refactored to lazy-load in the future, add useTransition + LoadingIndicator at that point.
- DriverCardSkeleton uses max-w-4xl to match real DriverCard container (not max-w-[calc(100%-6cm)] like fuel page)
- Teal gradient accent bar replicated in skeleton for visual continuity

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SKEL-APP-04 and LOAD-04 requirements both satisfied
- All 4 plans of Phase 21 are complete: driver list, fuel, dashboard, driver card
- Phase 22 (Admin pages Suspense + Loading) ready to begin

---
*Phase: 21-app-pages-suspense-loading*
*Completed: 2026-03-09*
