---
phase: 06-db-auth-foundation
plan: 02
subsystem: auth
tags: [react-cache, dal, supabase-rpc, permissions, chemosys, next-js]

# Dependency graph
requires:
  - phase: 06-db-auth-foundation/06-01
    provides: migration 00016 with app_* module keys in modules table and get_user_permissions RPC

provides:
  - Shared cached RPC helper (getPermissionsRpc) eliminating duplicate DB calls per request
  - verifyAppUser() — ChemoSys session guard with blocked-user and app_* permission checks
  - getAppNavPermissions() — returns app_* module keys for top-header nav (Phase 8+)
  - Refactored admin DAL functions using shared cached RPC
  - Fixed admin login redirect to /admin/dashboard

affects:
  - Phase 7: loginApp() will be added to auth.ts (ChemoSys login action)
  - Phase 8: (app)/layout.tsx will call verifyAppUser() and getAppNavPermissions()
  - All future ChemoSys pages that need session or permission guards

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level React.cache() for RPC deduplication — stable function reference, single DB call per request"
    - "verifyAppUser wraps cache() at module level (same pattern as verifySession)"
    - "getAppNavPermissions is NOT cached — delegates to already-cached getPermissionsRpc"
    - "All DAL permission checks route through single getPermissionsRpc — zero direct supabase.rpc() calls"

key-files:
  created: []
  modified:
    - src/lib/dal.ts
    - src/actions/auth.ts

key-decisions:
  - "getPermissionsRpc is module-level const (not inside function) — required for React.cache() to deduplicate correctly"
  - "verifyAppUser does NOT block is_admin users — admins can use ChemoSys too"
  - "getAppNavPermissions is a plain async function (not cached) — deduplication comes from getPermissionsRpc"
  - "Admin login redirect changed to /admin/dashboard (was /admin/companies)"

patterns-established:
  - "DAL cache pattern: module-level const wrapping cache(async...) for any expensive shared DB call"
  - "ChemoSys guards: verifySession() first → getPermissionsRpc() → redirect('/chemosys') on failure"

# Metrics
duration: 12min
completed: 2026-03-04
---

# Phase 6 Plan 02: DAL Refactor + ChemoSys Auth Functions Summary

**React.cache() shared RPC helper in dal.ts eliminating duplicate DB calls, plus verifyAppUser() and getAppNavPermissions() as the auth foundation for ChemoSys (Phase 8+)**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-04T07:56:00Z
- **Completed:** 2026-03-04T08:08:57Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added module-level `getPermissionsRpc` cached helper — all DAL permission functions now make at most one `get_user_permissions` RPC call per HTTP request, regardless of how many are invoked
- Added `verifyAppUser()` — validates session, checks public.users row (not blocked, not deleted), checks at least one `app_*` permission with level >= 1; redirects to `/chemosys` on failure
- Added `getAppNavPermissions()` — returns filtered `app_*` module keys for ChemoSys top-header nav (Phase 8)
- Refactored `requirePermission()`, `getNavPermissions()`, `checkPagePermission()` to use shared `getPermissionsRpc` — removed all direct `supabase.rpc()` calls from these functions
- Fixed admin login redirect from `/admin/companies` → `/admin/dashboard`
- `npm run build` passes clean (0 TypeScript errors, 17 pages compiled)

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor dal.ts — cached RPC helper + verifyAppUser + getAppNavPermissions** - `8b9645b` (feat)
2. **Task 2: Fix admin login redirect to /admin/dashboard** - `366a330` (fix)

## Files Created/Modified

- `src/lib/dal.ts` — Added `getPermissionsRpc` module-level cached helper; refactored `requirePermission`, `getNavPermissions`, `checkPagePermission` to use it; added `AppUser` type, `verifyAppUser()`, `getAppNavPermissions()`
- `src/actions/auth.ts` — Changed `redirect("/admin/companies")` → `redirect("/admin/dashboard")` (code + JSDoc)

## Decisions Made

- `getPermissionsRpc` must be at module level (not inside a function body) — `React.cache()` creates a stable memoization key only when the function reference is stable. If declared inside a function, a new cache instance is created on every call, defeating deduplication.
- `verifyAppUser` is wrapped in `cache()` at module level (same as `verifySession`) — layout + nested server components can call it multiple times per render safely.
- `getAppNavPermissions` is a plain `async function` (NOT `cache()`) — it delegates to `getPermissionsRpc` which is already cached. Wrapping it again would add overhead without benefit.
- `verifyAppUser` does NOT reject `is_admin` users — admin users can access ChemoSys too (per CONTEXT.md decision).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — TypeScript compiled cleanly on first attempt. Build lock from a background process was resolved by killing the node process before running the second build.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 7 (ChemoSys login page + loginApp action): `src/actions/auth.ts` is ready to receive `loginApp()` — add after existing `login()` function
- Phase 8 (ChemoSys app shell layout): `verifyAppUser()` and `getAppNavPermissions()` are ready to import from `src/lib/dal.ts`
- Hard dependency: Migration 00016 must run in Supabase before Phase 8 code is deployed — `app_*` module keys must exist in the `modules` table for `getPermissionsRpc` to return meaningful data

## Self-Check: PASSED

- `src/lib/dal.ts` — FOUND
- `src/actions/auth.ts` — FOUND
- `.planning/phases/06-db-auth-foundation/06-02-SUMMARY.md` — FOUND
- Commit `8b9645b` — FOUND
- Commit `366a330` — FOUND

---
*Phase: 06-db-auth-foundation*
*Completed: 2026-03-04*
