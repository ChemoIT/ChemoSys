---
phase: 20-performance-standards
plan: 01
subsystem: documentation
tags: [performance, suspense, skeleton, react-cache, useTransition, rpc, nextjs]

# Dependency graph
requires: []
provides:
  - "IRON RULE: Performance Standard in CLAUDE.md — 7 mandatory rules for all new pages"
  - ".planning/performance-standard.md — comprehensive reference with code examples from fuel page"
affects: [21-app-pages, 22-admin-pages, 23-db-optimization]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "page.tsx = Suspense wrapper only, async content in inner component"
    - "FuelPageSkeleton = shimmer bar + layout-matching skeleton blocks"
    - "useTransition + isPending = loading indicator for filter/search/pagination"
    - "React.cache() = deduplication of shared Server Action calls in one render pass"
    - "get_fuel_stats RPC = DB aggregation instead of JS loops over rows"

key-files:
  created:
    - "c:/Sharon_ClaudeCode/CLAUDE.md (new section — root workspace, not ChemoSystem repo)"
    - ".planning/performance-standard.md"
  modified: []

key-decisions:
  - "IRON RULE defined in shared CLAUDE.md so it applies to ALL Claude agents working on the project"
  - "performance-standard.md placed in .planning/ (project-scoped) for easy @context reference in PLAN.md files"
  - "Fuel page (Session #40) chosen as canonical reference implementation for all patterns"

patterns-established:
  - "Performance pattern: Suspense + Skeleton + shimmer bar + useTransition + React.cache + DB RPC"
  - "Naming: {PageName}Skeleton (VehicleListSkeleton, DriverCardSkeleton, etc.)"
  - "Loading text: always 'מעדכן נתונים...' + Loader2 spinner"

# Metrics
duration: 15min
completed: 2026-03-09
---

# Phase 20 Plan 01: Performance Standards Summary

**IRON RULE added to CLAUDE.md + comprehensive performance-standard.md with 6 sections and full code examples from fuel page (Suspense, Skeleton, shimmer bar, useTransition, React.cache, DB RPC)**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-09T18:25:00Z
- **Completed:** 2026-03-09T18:40:31Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `כלל ברזל: ביצועים — Performance Standard` section to shared `CLAUDE.md` with 7 mandatory rules — every Claude agent working on ChemoSystem will now see and follow these standards
- Created `.planning/performance-standard.md` with 6 fully-documented sections, complete copy-pasteable code examples from the fuel page reference implementation
- Both files cross-reference each other — CLAUDE.md points to performance-standard.md for full details

## Task Commits

Each task was committed atomically:

1. **Task 1: Add IRON RULE to CLAUDE.md** - `ae24d26` (docs) — committed to root workspace git repo (`c:/Sharon_ClaudeCode`)
2. **Task 2: Create performance-standard.md** - `9641a5f` (docs) — committed to ChemoSystem repo

**Plan metadata:** (below)

## Files Created/Modified

- `c:/Sharon_ClaudeCode/CLAUDE.md` — new section `כלל ברזל: ביצועים — Performance Standard` with 7 rules, guiding principle, and cross-reference to performance-standard.md
- `.planning/performance-standard.md` — 392-line reference doc: page structure pattern, skeleton pattern, loading indicator pattern, React.cache pattern, DB RPC aggregation pattern, pre-ship checklist

## Decisions Made

- **CLAUDE.md in root workspace**: Shared file applies to all projects — IRON RULE visible to all agents working on ChemoSystem or other projects in the workspace
- **performance-standard.md in .planning/**: Project-scoped — can be @referenced in PLAN.md context sections for automatic loading into agent context
- **Fuel page as canonical reference**: Sessions #36-40 produced the best-practice pattern — cited directly in all documentation

## Deviations from Plan

None — plan executed exactly as written. Note: CLAUDE.md commit went to the root workspace git repo (`c:/Sharon_ClaudeCode`) rather than ChemoSystem repo, because the file is outside the ChemoSystem repository boundary.

## Issues Encountered

- **CLAUDE.md git repo boundary**: `git add C:/Sharon_ClaudeCode/CLAUDE.md` failed from ChemoSystem repo — file is in parent workspace. Resolved by running the commit from `c:/Sharon_ClaudeCode` (root repo). This is expected behavior per the workspace architecture.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 20 Plan 01 complete — RULE-01 and RULE-02 satisfied
- Phase 21 (App pages — Suspense + Skeleton + loading) can now begin
- Any new page task in Phases 21-23 should include `@.planning/performance-standard.md` in context

---

*Phase: 20-performance-standards*
*Completed: 2026-03-09*
