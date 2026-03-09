---
phase: 20-performance-standards
plan: 02
subsystem: ui
tags: [skeleton, loading, boilerplate, react, tailwind, shimmer]

# Dependency graph
requires:
  - phase: 20-performance-standards/20-01
    provides: IRON RULE standards document and RULE-03 requirement for shared boilerplate
provides:
  - PageSkeleton configurable skeleton generator (table + cards + filters + chips)
  - LoadingIndicator standardized spinner + Hebrew text component
  - Shared component foundation for Phases 21-22 page skeletons
affects:
  - 21-app-pages-performance
  - 22-admin-pages-performance

# Tech tracking
tech-stack:
  added: []
  patterns:
    - PageSkeleton config object pattern — generate skeleton from titleWidth/chips/filters/table/cards
    - LoadingIndicator isLoading prop pattern — renders null when false, safe to render unconditionally
    - Animated shimmer progress bar at page top (sky-500/70, translateX animation)

key-files:
  created:
    - src/components/shared/PageSkeleton.tsx
    - src/components/shared/LoadingIndicator.tsx
  modified: []

key-decisions:
  - "PageSkeleton is a starting point — custom skeleton components still needed for unique layouts (tabs, etc.)"
  - "LoadingIndicator marked 'use client' even though it has no hooks — it receives client state as prop"
  - "Default maxWidth matches fleet pages: max-w-[calc(100%-6cm)]"
  - "Size variants (sm/default) added to LoadingIndicator for flexibility beyond fuel page pattern"

patterns-established:
  - "PageSkeleton pattern: <PageSkeleton config={{ titleWidth, chips, filters, table }} /> for all list pages"
  - "LoadingIndicator pattern: <LoadingIndicator isLoading={isPending} /> replaces inline Loader2 JSX"

# Metrics
duration: 8min
completed: 2026-03-09
---

# Phase 20 Plan 02: Reusable Skeleton + Loading Boilerplate Summary

**Configurable PageSkeleton generator and standardized LoadingIndicator extracted from FuelPageSkeleton — shared boilerplate ready for Phases 21-22**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-09T18:37:53Z
- **Completed:** 2026-03-09T18:45:00Z
- **Tasks:** 2
- **Files modified:** 2 created

## Accomplishments
- PageSkeleton component generates complete page loading skeletons from a simple config object — shimmer bar, title, chips, filters, table (with pagination), or card grid
- LoadingIndicator extracts the inline Loader2 + "מעדכן נתונים..." pattern from FuelRecordsPage into a reusable client component
- Both components are TypeScript-strict with proper interfaces and JSDoc usage examples
- RULE-03 requirement satisfied — new page skeletons now take minutes instead of 30+ minutes of manual layout

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PageSkeleton configurable boilerplate component** - `bdf03c6` (feat)
2. **Task 2: Create LoadingIndicator shared component** - `2183da2` (feat)

## Files Created/Modified
- `src/components/shared/PageSkeleton.tsx` — Configurable skeleton generator: shimmer bar, header, chips, filters, table/cards from config object
- `src/components/shared/LoadingIndicator.tsx` — Standard spinner + Hebrew text, controlled by isLoading prop, size variants sm/default

## Decisions Made
- PageSkeleton is a starting point for list/dashboard pages. Pages with unique layouts (vehicle card with 8 tabs) should still create custom skeleton components — but can save significant time for the common pattern.
- LoadingIndicator marked as `'use client'` because it is a purely presentational component that receives client state (isPending from useTransition) as a prop. No server rendering needed.
- Added `size="sm"` variant to LoadingIndicator beyond the original fuel page pattern — useful for inline loading in smaller UI sections.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Both shared components ready for immediate use in Phase 21 (App pages — Suspense + Skeleton + loading)
- Phase 22 (Admin pages) can also import from `@/components/shared/PageSkeleton` and `@/components/shared/LoadingIndicator`
- Migration 00036 (fuel_records_enriched view) must still be run in Supabase SQL Editor before Phase 21

---
*Phase: 20-performance-standards*
*Completed: 2026-03-09*
