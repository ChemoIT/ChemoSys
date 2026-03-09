---
phase: 23-db-optimization
plan: 01
subsystem: database
tags: [rpc, postgresql, supabase, nextjs, server-actions, indexes, performance]

# Dependency graph
requires:
  - phase: 22-admin-skeleton
    provides: Dashboard page with Suspense boundary and DashboardSkeleton — the page being optimized here

provides:
  - get_dashboard_stats() PostgreSQL RPC function replacing 6 COUNT queries
  - getDashboardStats() server action in src/actions/admin/dashboard.ts
  - Refactored dashboard page using single RPC call
  - Migration 00037 with composite indexes for admin list pages + vehicle card index

affects:
  - phase: 23-02 (React.cache + save states)
  - future admin pages needing aggregated stats patterns

# Tech tracking
tech-stack:
  added: []
  patterns:
    - get_dashboard_stats() RPC pattern — no-arg RETURNS TABLE aggregation function
    - getDashboardStats() server action — verifySession guard + rpc() call + camelCase mapping
    - Promise.all([statsRpc(), auditLogQuery]) — 2-item parallel fetch pattern for dashboard

key-files:
  created:
    - supabase/migrations/00037_db_optimization.sql
    - src/actions/admin/dashboard.ts
  modified:
    - src/app/(admin)/admin/dashboard/page.tsx

key-decisions:
  - "SECURITY INVOKER used for get_dashboard_stats() — read-only stats RPC, no need to bypass RLS"
  - "getDashboardStats() wraps RPC + mapping in server action — dashboard page remains clean, error handling centralized"
  - "Activity feed entity name resolution code left intact in page.tsx — moving it would risk regressions on complex lookup logic"
  - "VehicleSuppliersPage.tsx useTransition refactor — stash revealed pre-existing loading→isPending migration, TypeScript now clean"

patterns-established:
  - "No-arg RPC pattern: RETURNS TABLE with sub-SELECT COUNTs — reference for any future aggregation dashboard"
  - "Server action wrapper for RPC: verifySession → supabase.rpc() → array[0] → camelCase mapping → zero fallback"

# Metrics
duration: 3min
completed: 2026-03-09
---

# Phase 23 Plan 01: DB Optimization — Dashboard RPC Summary

**get_dashboard_stats() PostgreSQL RPC replaces 6 separate COUNT queries on dashboard load — 5 fewer DB round-trips per page view, with composite partial indexes for all admin list tables**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-09T19:55:23Z
- **Completed:** 2026-03-09T19:58:26Z
- **Tasks:** 2
- **Files modified:** 3 (1 created migration, 1 created server action, 1 modified page)

## Accomplishments
- Created `get_dashboard_stats()` PostgreSQL function — returns 6 BIGINT columns matching StatsCards.tsx keys in a single RPC round-trip
- Created `getDashboardStats()` server action in `src/actions/admin/dashboard.ts` — verifySession guard, rpc() call, camelCase mapping, zero fallback on error
- Refactored dashboard page to use 2-item Promise.all (stats RPC + audit_log) instead of 7-item; activity feed code preserved verbatim
- Added 5 composite partial indexes for admin list pages (drivers, employees, vehicles, projects, users) + vehicle_documents vehicle_id index
- Documented audit_log index sufficiency (migration 00001 already has 3 composite indexes covering all patterns)

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration 00037** - `b373550` (chore)
2. **Task 2: Dashboard server action + page refactor** - `f6e87e6` (feat)

## Files Created/Modified
- `supabase/migrations/00037_db_optimization.sql` — get_dashboard_stats() RPC + 6 composite indexes + audit_log documentation
- `src/actions/admin/dashboard.ts` — getDashboardStats() server action, DashboardStats type export
- `src/app/(admin)/admin/dashboard/page.tsx` — refactored to use getDashboardStats(), Promise.all reduced to 2 items

## Decisions Made
- SECURITY INVOKER (not DEFINER) for the RPC — read-only stats need no privilege escalation
- Server action wraps RPC mapping — keeps page clean, error handling and zero-fallback in one place
- Activity feed code kept inline in page.tsx — complex lookup chain with 8 entity types, too risky to move
- `DashboardStats` type exported from server action file for reuse by future consumers

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
- VehicleSuppliersPage.tsx had a pre-existing `loading` variable refactored to `isPending` (from useTransition) that was in the working tree as an unstaged change. Git stash/pop surfaced this. TypeScript compiled clean once the change was applied. Not related to this plan's scope.

## User Setup Required

**Migration 00037 must be run manually in Supabase SQL Editor.**

File: `supabase/migrations/00037_db_optimization.sql`

Steps:
1. Open Supabase Dashboard → SQL Editor
2. Paste contents of `supabase/migrations/00037_db_optimization.sql`
3. Run

This creates:
- `get_dashboard_stats()` function (required for dashboard to load stats)
- 6 composite indexes (performance improvement — non-blocking if delayed)

## Next Phase Readiness
- Plan 23-02 (React.cache + save states) can start immediately
- Migration 00037 must run in Supabase before the dashboard RPC is live in production

---
*Phase: 23-db-optimization*
*Completed: 2026-03-09*
